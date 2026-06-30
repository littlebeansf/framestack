/**
 * Time estimation for media items.
 *
 * Priority:
 *  1. Use item.episodes * minutesPerEpisode if episodes is known
 *  2. Fall back to type-based averages
 *
 * Returns total minutes, or null if we genuinely can't estimate.
 */

import type { Item } from "@shared/schema";

// Average runtimes (minutes)
const AVG_EPISODE_MINS: Record<string, number> = {
  anime:  22,   // standard cour episode
  series: 42,   // live-action drama episode
  manga:  0,    // reading time, handled separately
  movie:  105,  // average feature film
  book:   0,    // reading time, handled separately
};

// Average episodes/chapters if unknown
const AVG_EPISODES: Record<string, number> = {
  anime:  12,   // one cour
  series: 20,   // one TV season
};

// Avg reading times (minutes)
const AVG_MANGA_CHAPTERS = 10;   // chapters in a volume
const MANGA_MINS_PER_CHAPTER = 5;
const BOOK_PAGES = 300;
const BOOK_MINS_PER_PAGE = 1.5; // ~200 wpm

export function estimateMinutes(item: Item): number | null {
  const type = item.mediaType;

  if (type === "movie") {
    // Movies: fixed average, no episode data needed
    return AVG_EPISODE_MINS.movie;
  }

  if (type === "anime" || type === "series") {
    const eps = item.episodes && item.episodes > 0 ? item.episodes : AVG_EPISODES[type];
    const minsPerEp = AVG_EPISODE_MINS[type];
    return eps * minsPerEp;
  }

  if (type === "manga") {
    // Treat episodes field as chapters if present
    const chapters = item.episodes && item.episodes > 0 ? item.episodes : AVG_MANGA_CHAPTERS;
    return chapters * MANGA_MINS_PER_CHAPTER;
  }

  if (type === "book") {
    return Math.round(BOOK_PAGES * BOOK_MINS_PER_PAGE);
  }

  return null;
}

export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Status buckets for the bar
export type TimeBucket = "completed" | "in_progress" | "not_started";

export function statusToBucket(status: string): TimeBucket {
  if (status === "completed") return "completed";
  if (status === "watching" || status === "reading") return "in_progress";
  return "not_started"; // wishlist, on_hold, dropped
}

export interface CollectionTimeStats {
  totalMinutes: number;
  completedMinutes: number;
  inProgressMinutes: number;
  notStartedMinutes: number;
  // fractions 0-1
  completedFrac: number;
  inProgressFrac: number;
  notStartedFrac: number;
  hasEstimate: boolean;
}

export function calcCollectionTimeStats(items: Item[]): CollectionTimeStats {
  let total = 0, completed = 0, inProgress = 0, notStarted = 0;

  for (const item of items) {
    const mins = estimateMinutes(item);
    if (mins === null) continue;
    total += mins;
    const bucket = statusToBucket(item.status);
    if (bucket === "completed") completed += mins;
    else if (bucket === "in_progress") inProgress += mins;
    else notStarted += mins;
  }

  return {
    totalMinutes: total,
    completedMinutes: completed,
    inProgressMinutes: inProgress,
    notStartedMinutes: notStarted,
    completedFrac:   total > 0 ? completed   / total : 0,
    inProgressFrac:  total > 0 ? inProgress  / total : 0,
    notStartedFrac:  total > 0 ? notStarted  / total : 0,
    hasEstimate: total > 0,
  };
}
