import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { localStore } from "./localStore";

// Runtime API base detection.
// localhost/127.0.0.1 → Vite dev server proxies /api → Express.
// Any other host (Perplexity sandbox, GitHub Pages, etc.) → /port/5000 proxy.
const _hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
const _isLocalhost = _hostname === "localhost" || _hostname === "127.0.0.1";
export const API_BASE = _isLocalhost ? "" : "/port/5000";

// ─── Backend availability ─────────────────────────────────────────────────────
// We ping once on load. If unreachable, all mutations fall back to localStore.
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

// ─── Default query function ───────────────────────────────────────────────────
// For /api/items and /api/collections: if backend is unavailable, return local store.
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

      // Sync local store
      if (key === "/api/items") localStore.replaceItems(data);
      if (key === "/api/collections") localStore.replaceCollections(data);

      return data as T;
    } catch {
      setBackendAvailable(false);
      // Fall back to local store
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
