import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { localStore } from "./localStore";

// __PORT_5000__ is replaced at deploy time by deploy_website.
// In dev (localhost), it starts with "__" → falls back to "" (same-origin Vite proxy).
const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export { API_BASE };

// ─── Error helper ─────────────────────────────────────────────────────────────
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

// ─── apiRequest ───────────────────────────────────────────────────────────────
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(8000),
  });

  await throwIfResNotOk(res);
  return res;
}

// ─── Backend availability ─────────────────────────────────────────────────────
let _backendAvailable: boolean | null = null;

export function isBackendAvailable() { return _backendAvailable; }
export function setBackendAvailable(v: boolean) { _backendAvailable = v; }

// ─── localStorage → backend migration ────────────────────────────────────────
// Runs once per session when the backend is empty but localStorage has data.
let _migrationDone = false;

async function migrateLocalStoreToBackend(): Promise<void> {
  if (_migrationDone) return;
  _migrationDone = true;

  const localItems = localStore.getItems();
  const localCollections = localStore.getCollections();
  const colItems = localStore.exportAll().colItems;

  if (localItems.length === 0) return; // nothing to migrate

  try {
    const res = await fetch(`${API_BASE}/api/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: localItems, collections: localCollections, colItems }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return;

    const { itemIdMap, colIdMap } = await res.json();

    // Remap localStorage IDs to backend IDs so future mutations use correct IDs
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

    // Remap colItems
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

// ─── Default query function ───────────────────────────────────────────────────
// On first load: if backend is empty but localStorage has data → migrate first.
// After that: backend is source of truth; localStorage is kept in sync as fallback.
export const getQueryFn: <T>(options: { on401: "returnNull" | "throw" }) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey }) => {
    const key = queryKey[0] as string;
    try {
      const res = await fetch(`${API_BASE}${key}`, { signal: AbortSignal.timeout(5000) });

      if (on401 === "returnNull" && res.status === 401) return null as T;
      await throwIfResNotOk(res);

      const data = await res.json();
      setBackendAvailable(true);

      // If backend returned empty items but localStorage has data → migrate
      if (key === "/api/items" && (data as any[]).length === 0 && localStore.getItems().length > 0) {
        await migrateLocalStoreToBackend();
        // Re-fetch after migration
        const res2 = await fetch(`${API_BASE}/api/items`, { signal: AbortSignal.timeout(5000) });
        const data2 = await res2.json();
        localStore.replaceItems(data2);
        return data2 as T;
      }

      // Sync localStore from backend (source of truth)
      if (key === "/api/items") localStore.replaceItems(data);
      if (key === "/api/collections") localStore.replaceCollections(data);

      return data as T;
    } catch {
      setBackendAvailable(false);
      // Fall back to localStore (offline / GitHub Pages static)
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
