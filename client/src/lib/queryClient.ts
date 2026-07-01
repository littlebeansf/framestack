import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { localStore } from "./localStore";

// __PORT_5000__ is replaced at deploy time by deploy_website.
// In dev (localhost), it starts with "__" → falls back to "" (same-origin Vite proxy).
// On deploy_website, it becomes the proxied backend URL.
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

export async function checkBackend(): Promise<boolean> {
  if (_backendAvailable !== null) return _backendAvailable;
  try {
    const r = await fetch(`${API_BASE}/api/items`, { signal: AbortSignal.timeout(3000) });
    _backendAvailable = r.ok || r.status < 500;
  } catch {
    _backendAvailable = false;
  }
  return _backendAvailable;
}

export function isBackendAvailable() { return _backendAvailable; }
export function setBackendAvailable(v: boolean) { _backendAvailable = v; }

// ─── Default query function ───────────────────────────────────────────────────
// When backend is available: sync localStore from it (single source of truth).
// When backend fails: fall back to localStore (offline / GitHub Pages static).
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

      // Sync localStore from backend (real data)
      if (key === "/api/items") localStore.replaceItems(data);
      if (key === "/api/collections") localStore.replaceCollections(data);

      return data as T;
    } catch {
      setBackendAvailable(false);
      // Fall back to localStore (offline / static hosting)
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
