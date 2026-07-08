// Search via the Express backend — all external API calls happen server-side.
// This avoids CORS issues and rate limiting on the published pplx.app domain.
// Falls back to direct browser calls if the backend is unreachable (GitHub Pages).

import { API_BASE, getAuthToken } from "./queryClient";

export interface SearchResult {
  externalId: string;
  externalSource: string;
  title: string;
  coverUrl?: string;
  year?: string;
  mediaType: "anime" | "manga" | "movie" | "series" | "book" | "podcast";
  genres?: string;
  author?: string;
  studio?: string;
  episodes?: number;
}

// ── Backend search (primary path) ─────────────────────────────────────────────

async function searchViaBackend(q: string, type: string): Promise<SearchResult[] | null> {
  try {
    const url = `${API_BASE}/api/search/${type}?q=${encodeURIComponent(q)}`;
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers["x-auth-token"] = token;
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── Direct browser fallbacks (used on GitHub Pages / when backend unreachable) ─

async function searchAnimeDirect(q: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=10&sfw=true`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data || []).map((a: any) => ({
      externalId: String(a.mal_id), externalSource: "jikan",
      title: a.title_english || a.title,
      coverUrl: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url,
      year: a.year ? String(a.year) : a.aired?.from?.split("-")[0],
      mediaType: "anime" as const, episodes: a.episodes,
      genres: JSON.stringify((a.genres || []).map((g: any) => g.name)),
      studio: (a.studios || [])[0]?.name,
    }));
  } catch { return []; }
}

async function searchMangaDirect(q: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=10&sfw=true`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data || []).map((m: any) => ({
      externalId: String(m.mal_id), externalSource: "jikan",
      title: m.title_english || m.title,
      coverUrl: m.images?.jpg?.large_image_url || m.images?.jpg?.image_url,
      year: m.published?.from?.split("-")[0],
      mediaType: "manga" as const,
      genres: JSON.stringify((m.genres || []).map((g: any) => g.name)),
      author: (m.authors || [])[0]?.name,
    }));
  } catch { return []; }
}

async function searchMoviesDirect(q: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(`https://imdb.iamidiotareyoutoo.com/search?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const data = await r.json();
    if (!data.ok || !Array.isArray(data.description)) return [];
    return data.description.slice(0, 12).map((m: any) => ({
      externalId: m["#IMDB_ID"], externalSource: "imdb",
      title: m["#TITLE"],
      coverUrl: m["#IMG_POSTER"] || undefined,
      year: m["#YEAR"] ? String(m["#YEAR"]) : undefined,
      mediaType: "movie" as const,
      studio: m["#ACTORS"] ? m["#ACTORS"].split(", ").slice(0, 2).join(", ") : undefined,
    }));
  } catch { return []; }
}

async function searchSeriesDirect(q: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
    if (!r.ok) return [];
    const data: any[] = await r.json();
    return data.map(({ show }: any) => ({
      externalId: String(show.id), externalSource: "tvmaze",
      title: show.name,
      coverUrl: show.image?.medium || show.image?.original,
      year: show.premiered?.slice(0, 4),
      mediaType: "series" as const,
      genres: show.genres?.length ? JSON.stringify(show.genres) : undefined,
      studio: show.network?.name || show.webChannel?.name,
      episodes: show.runtime ?? undefined,
    })).slice(0, 12);
  } catch { return []; }
}

async function searchBooksDirect(q: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10&fields=key,title,author_name,first_publish_year,cover_i,subject`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.docs || []).slice(0, 10).map((b: any) => ({
      externalId: b.key, externalSource: "openlibrary",
      title: b.title,
      coverUrl: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : undefined,
      year: b.first_publish_year ? String(b.first_publish_year) : undefined,
      mediaType: "book" as const,
      author: (b.author_name || []).slice(0, 2).join(", "),
      genres: JSON.stringify((b.subject || []).slice(0, 5)),
    }));
  } catch { return []; }
}

// ── Aggregate ─────────────────────────────────────────────────────────────────

async function searchPodcastDirect(q: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=podcast&limit=15&media=podcast`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.results || []).map((p: any) => ({
      externalId: String(p.collectionId),
      externalSource: "itunes",
      title: p.collectionName,
      coverUrl: p.artworkUrl600 || p.artworkUrl100,
      year: p.releaseDate ? p.releaseDate.slice(0, 4) : undefined,
      mediaType: "podcast" as const,
      studio: p.artistName,
      genres: p.genres ? JSON.stringify(p.genres) : undefined,
      episodes: p.trackCount || undefined,
    }));
  } catch { return []; }
}

const DIRECT_FALLBACKS: Record<string, (q: string) => Promise<SearchResult[]>> = {
  anime: searchAnimeDirect,
  manga: searchMangaDirect,
  movie: searchMoviesDirect,
  series: searchSeriesDirect,
  book: searchBooksDirect,
  podcast: searchPodcastDirect,
};

export async function searchAll(q: string, type?: string): Promise<SearchResult[]> {
  if (!q.trim()) return [];

  const types = type
    ? [type]
    : ["anime", "manga", "movie", "series", "book", "podcast"];

  const results = await Promise.all(
    types.map(async (t) => {
      // Try backend first
      const backendResults = await searchViaBackend(q, t);
      if (backendResults !== null) return backendResults;
      // Fall back to direct browser call
      const fallback = DIRECT_FALLBACKS[t];
      return fallback ? fallback(q) : [];
    })
  );

  return results.flat();
}
