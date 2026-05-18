// Direct browser-side search — no backend required.
// Calls Jikan (anime/manga), OMDb (movies/series), Open Library (books) directly.

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

const OMDB_KEY = "2b7a22dd";

async function searchAnime(q: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=8&sfw=true`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data || []).map((a: any) => ({
      externalId: String(a.mal_id),
      externalSource: "jikan",
      title: a.title_english || a.title,
      coverUrl: a.images?.jpg?.image_url,
      year: a.year ? String(a.year) : a.aired?.from?.split("-")[0],
      mediaType: "anime" as const,
      episodes: a.episodes,
      genres: JSON.stringify((a.genres || []).map((g: any) => g.name)),
      studio: (a.studios || [])[0]?.name,
    }));
  } catch { return []; }
}

async function searchManga(q: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=8&sfw=true`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data || []).map((m: any) => ({
      externalId: String(m.mal_id),
      externalSource: "jikan",
      title: m.title_english || m.title,
      coverUrl: m.images?.jpg?.image_url,
      year: m.published?.from?.split("-")[0],
      mediaType: "manga" as const,
      genres: JSON.stringify((m.genres || []).map((g: any) => g.name)),
      author: (m.authors || [])[0]?.name,
    }));
  } catch { return []; }
}

async function searchMoviesSeries(q: string, type?: string): Promise<SearchResult[]> {
  try {
    const t = type === "movie" ? "movie" : type === "series" ? "series" : "";
    const r = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(q)}&type=${t}&apikey=${OMDB_KEY}`);
    if (!r.ok) return [];
    const data = await r.json();
    if (data.Error) return [];
    return (data.Search || []).map((m: any) => ({
      externalId: m.imdbID,
      externalSource: "omdb",
      title: m.Title,
      coverUrl: m.Poster !== "N/A" ? m.Poster : undefined,
      year: m.Year,
      mediaType: (m.Type === "series" ? "series" : "movie") as "movie" | "series",
    }));
  } catch { return []; }
}

async function searchBooks(q: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i,subject`
    );
    if (!r.ok) return [];
    const data = await r.json();
    return (data.docs || []).slice(0, 8).map((b: any) => ({
      externalId: b.key,
      externalSource: "openlibrary",
      title: b.title,
      coverUrl: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : undefined,
      year: b.first_publish_year ? String(b.first_publish_year) : undefined,
      mediaType: "book" as const,
      author: (b.author_name || []).slice(0, 2).join(", "),
      genres: JSON.stringify((b.subject || []).slice(0, 5)),
    }));
  } catch { return []; }
}

export async function searchAll(q: string, type?: string): Promise<SearchResult[]> {
  if (!q.trim()) return [];

  const promises: Promise<SearchResult[]>[] = [];

  if (!type || type === "anime")  promises.push(searchAnime(q));
  if (!type || type === "manga")  promises.push(searchManga(q));
  if (!type || type === "movie" || type === "series") promises.push(searchMoviesSeries(q, type));
  if (!type || type === "book")   promises.push(searchBooks(q));

  const results = await Promise.all(promises);
  return results.flat();
}
