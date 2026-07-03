import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { localStore } from "./localStore";

// __PORT_5000__ is replaced at deploy time by deploy_website.
// In dev (localhost), it starts with "__" → falls back to "" (same-origin Vite proxy).
const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export { API_BASE };

// ── Auth token ────────────────────────────────────────────────────────────────
// The token is stored in a module-level variable (_authToken) and mirrored to
// sessionStorage when available. On startup, initToken() restores it from
// sessionStorage (or from the URL hash if the login page just redirected here).
//
// The login screen (in App.tsx) calls setToken() after a successful POST to
// /__auth. All API fetch calls read the token via authHeaders().
// ─────────────────────────────────────────────────────────────────────────────

let _authToken: string = "";

// In-memory mirror — used as fallback when sessionStorage is blocked
// (Safari Tracking Prevention, certain browser privacy modes).
const _ssCache: Record<string, string> = {};

function ssGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return _ssCache[key] ?? null; }
}
function ssSet(key: string, val: string): void {
  _ssCache[key] = val; // always keep in memory
  try { sessionStorage.setItem(key, val); } catch { /* blocked — in-memory copy is enough */ }
}
function ssDel(key: string): void {
  delete _ssCache[key];
  try { sessionStorage.removeItem(key); } catch {}
}

// Called once on module load. Restores token from storage or URL hash.
function initToken() {
  // 1. Restore from sessionStorage / in-memory cache (survives page refresh)
  const stored = ssGet("fs_token");
  if (stored) { _authToken = stored; return; }

  // 2. Restore from URL hash — set by the React login component after auth
  //    e.g. window.location.hash === "#__token=d3c31fdf..."
  const hash = window.location.hash;
  const match = hash.match(/__token=([a-f0-9]+)/);
  if (match) {
    _authToken = match[1];
    ssSet("fs_token", _authToken);
    // Strip the token from the URL so it doesn't appear in the address bar
    const clean = hash.replace(/[#&]?__token=[a-f0-9]+/, "").replace(/^#$/, "") || "#/";
    window.history.replaceState(null, "", clean || "/");
  }
}

if (typeof window !== "undefined") initToken();

/** Read the current auth token (empty string = not logged in). */
export function getAuthToken(): string { return _authToken; }

/** Store a freshly obtained token. Called by the React login component. */
export function setToken(token: string): void {
  _authToken = token;
  ssSet("fs_token", token);
}

/** Clear the token (logout). */
export function clearToken(): void {
  _authToken = "";
  ssDel("fs_token");
}

/** True if the user has a token (i.e., is authenticated). */
export function isAuthenticated(): boolean { return _authToken.length > 0; }

// ── Error helper ───────────────────────────────────────────────────────────────
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    let message = res.statusText;
    try {
      const json = JSON.parse(text);
      message = json.error || json.message || text;
    } catch {
      message = text || res.statusText;
    }
    throw new Error(message);
  }
}

// ── Auth headers helper ────────────────────────────────────────────────────────
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  if (_authToken) h["x-auth-token"] = _authToken;
  return h;
}

// ── apiRequest ─────────────────────────────────────────────────────────────────
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const headers = authHeaders(data ? { "Content-Type": "application/json" } : {});

  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(8000),
  });

  await throwIfResNotOk(res);
  return res;
}

// ── Backend availability ───────────────────────────────────────────────────────
let _backendAvailable: boolean | null = null;

export function isBackendAvailable() { return _backendAvailable; }
export function setBackendAvailable(v: boolean) { _backendAvailable = v; }

// ── localStorage → backend migration ──────────────────────────────────────────
let _migrationDone = false;

async function migrateLocalStoreToBackend(): Promise<void> {
  if (_migrationDone) return;
  _migrationDone = true;

  const localItems = localStore.getItems();
  const localCollections = localStore.getCollections();
  const colItems = localStore.exportAll().colItems;

  if (localItems.length === 0) return;

  try {
    const res = await fetch(`${API_BASE}/api/import`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ items: localItems, collections: localCollections, colItems }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return;

    const { itemIdMap, colIdMap } = await res.json();

    const remappedItems = localItems.map(item => ({
      ...item,
      id: itemIdMap[item.id] ?? item.id,
    }));
    localStore.replaceItems(remappedItems);

    const remappedCols = localCollections.map(col => ({
      ...col,
      id: colIdMap[col.id] ?? col.id,
    }));
    localStore.replaceCollections(remappedCols);

    const remappedColItems: Record<number, number[]> = {};
    for (const [oldColId, oldItemIds] of Object.entries(colItems)) {
      const newColId = colIdMap[Number(oldColId)];
      if (newColId) {
        remappedColItems[newColId] = (oldItemIds as number[]).map(
          (oldId: number) => itemIdMap[oldId] ?? oldId
        );
      }
    }
    localStore.replaceColItems(remappedColItems);

    console.log(`[migration] Migrated ${localItems.length} items + ${localCollections.length} collections to backend`);
  } catch (e) {
    console.warn("[migration] failed:", e);
  }
}

// ── Default query function ─────────────────────────────────────────────────────
export const getQueryFn: <T>(options: { on401: "returnNull" | "throw" }) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey }) => {
    const key = queryKey[0] as string;
    try {
      const res = await fetch(`${API_BASE}${key}`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(5000),
      });

      if (on401 === "returnNull" && res.status === 401) return null as T;
      await throwIfResNotOk(res);

      const data = await res.json();
      setBackendAvailable(true);

      if (key === "/api/items" && (data as any[]).length === 0 && localStore.getItems().length > 0) {
        await migrateLocalStoreToBackend();
        const res2 = await fetch(`${API_BASE}/api/items`, {
          headers: authHeaders(),
          signal: AbortSignal.timeout(5000),
        });
        const data2 = await res2.json();
        localStore.replaceItems(data2);
        return data2 as T;
      }

      if (key === "/api/items") localStore.replaceItems(data);
      if (key === "/api/collections") localStore.replaceCollections(data);

      return data as T;
    } catch {
      setBackendAvailable(false);
      if (key === "/api/items") return localStore.getItems() as T;
      if (key.startsWith("/api/collections") && !key.includes("/items")) return localStore.getCollections() as T;
      return [] as T;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
