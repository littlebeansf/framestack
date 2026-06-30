// Direct browser-side search — no backend required.
// Sources:
//   Anime/Manga : Jikan (MAL)    — https://jikan.moe          (free, no key)
//   Movies      : FM-DB / IMDbOT — https://imdb.iamidiotareyoutoo.com (free, no key)
//   Series      : TVmaze         — https://api.tvmaze.com      (free, no key)
//   Books       : Open Library   — https://openlibrary.org     (free, no key)

export interface SearchResult {
  externalId: string;
  externalSource: string;
  title: string;
  coverUrl?: string;
  year?: string;
  mediaType: "anime" | "manga" | "movie" | "series" | "book";
  genres?: string;
  author?: string;
  studio?: string;
  episodes?: number;
}

// ── Anime ─────────────────────────────────────────────────────────────────────

async function searchAnime(q: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=10&sfw=true`
    );
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data || []).map((a: any) => ({
      externalId: String(a.mal_id),
      externalSource: "jikan",
      title: a.title_english || a.title,
      coverUrl: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url,
      year: a.year ? String(a.year) : a.aired?.from?.split("-")[0],
      mediaType: "anime" as const,
      episodes: a.episodes,
      genres: JSON.stringify((a.genres || []).map((g: any) => g.name)),
      studio: (a.studios || [])[0]?.name,
    }));
  } catch { return []; }
}

// ── Manga ─────────────────────────────────────────────────────────────────────

async function searchManga(q: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(
      `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=10&sfw=true`
    );
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data || []).map((m: any) => ({
      externalId: String(m.mal_id),
      externalSource: "jikan",
      title: m.title_english || m.title,
      coverUrl: m.images?.jpg?.large_image_url || m.images?.jpg?.image_url,
      year: m.published?.from?.split("-")[0],
      mediaType: "manga" as const,
      genres: JSON.stringify((m.genres || []).map((g: any) => g.name)),
      author: (m.authors || [])[0]?.name,
    }));
  } catch { return []; }
}

// ── Movies (FM-DB — free IMDb mirror, no key) ──────────────────────────────

async function searchMovies(q: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(
      `https://imdb.iamidiotareyoutoo.com/search?q=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return [];
    const data = await r.json();
    if (!data.ok || !Array.isArray(data.description)) return [];
    return data.description.slice(0, 12).map((m: any) => ({
      externalId: m["#IMDB_ID"],
      externalSource: "imdb",
      title: m["#TITLE"],
      coverUrl: m["#IMG_POSTER"] || undefined,
      year: m["#YEAR"] ? String(m["#YEAR"]) : undefined,
      mediaType: "movie" as const,
      studio: m["#ACTORS"] ? m["#ACTORS"].split(", ").slice(0, 2).join(", ") : undefined,
    }));
  } catch { return []; }
}

// ── Series (TVmaze) ───────────────────────────────────────────────────────────
// Free, no API key, covers all TV including Western animation

async function searchSeries(q: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`
    );
    if (!r.ok) return [];
    const data: any[] = await r.json();
    return data
      .map(({ show }: any) => ({
        externalId: String(show.id),
        externalSource: "tvmaze",
        title: show.name,
        // TVmaze image: use medium (210px wide) for thumbnails
        coverUrl: show.image?.medium || show.image?.original,
        year: show.premiered?.slice(0, 4),
        mediaType: "series" as const,
        genres: show.genres?.length ? JSON.stringify(show.genres) : undefined,
        studio: show.network?.name || show.webChannel?.name,
        episodes: show.runtime ?? undefined,
      }))
      .slice(0, 12);
  } catch { return []; }
}

// ── Books (Open Library) ──────────────────────────────────────────────────────

async function searchBooks(q: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10&fields=key,title,author_name,first_publish_year,cover_i,subject`
    );
    if (!r.ok) return [];
    const data = await r.json();
    return (data.docs || []).slice(0, 10).map((b: any) => ({
      externalId: b.key,
      externalSource: "openlibrary",
      title: b.title,
      coverUrl: b.cover_i
        ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg`
        : undefined,
      year: b.first_publish_year ? String(b.first_publish_year) : undefined,
      mediaType: "book" as const,
      author: (b.author_name || []).slice(0, 2).join(", "),
      genres: JSON.stringify((b.subject || []).slice(0, 5)),
    }));
  } catch { return []; }
}

// ── Aggregate ─────────────────────────────────────────────────────────────────

export async function searchAll(q: string, type?: string): Promise<SearchResult[]> {
  if (!q.trim()) return [];

  const promises: Promise<SearchResult[]>[] = [];

  if (!type || type === "anime")  promises.push(searchAnime(q));
  if (!type || type === "manga")  promises.push(searchManga(q));
  if (!type || type === "movie")  promises.push(searchMovies(q));
  if (!type || type === "series") promises.push(searchSeries(q));
  if (!type || type === "book")   promises.push(searchBooks(q));

  const results = await Promise.all(promises);
  return results.flat();
}
