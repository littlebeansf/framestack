import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Owners: jack | sally | together ─────────────────────────────────────────
// Library (items) are always shared.
// Collections are owned by jack, sally, or together.
// Profiles are per-owner.

export const OWNERS = ["jack", "sally", "together"] as const;
export type Owner = (typeof OWNERS)[number];

// ─── Profiles ─────────────────────────────────────────────────────────────────

export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull().unique(), // "jack" | "sally" | "together"
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  avatarEmoji: text("avatar_emoji"), // e.g. "🐻" "🌸"
  accentColor: text("accent_color"), // hsl string e.g. "hsl(310 80% 65%)"
  bannerColor: text("banner_color"), // hsl string for profile banner gradient
  favoriteGenre: text("favorite_genre"),
  currentlyObsessedWith: text("currently_obsessed_with"),
  // Extra flair fields
  catchphrase: text("catchphrase"),
  vinylCount: integer("vinyl_count"), // fun stat
  customStat1Label: text("custom_stat1_label"),
  customStat1Value: text("custom_stat1_value"),
  customStat2Label: text("custom_stat2_label"),
  customStat2Value: text("custom_stat2_value"),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

// ─── Media Items (shared library) ─────────────────────────────────────────────

export const MEDIA_TYPES = ["anime", "manga", "movie", "series", "book"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

// Status sets per media group
// Anime / Movie / Series: watching, completed, want_to_rewatch, dropped
// Manga / Book: wishlist, owned, reading, completed
export const ANIME_STATUSES = ["watching", "completed", "want_to_rewatch", "dropped"] as const;
export const BOOK_STATUSES = ["wishlist", "owned", "reading", "completed"] as const;
export type AnimeStatus = (typeof ANIME_STATUSES)[number];
export type BookStatus = (typeof BOOK_STATUSES)[number];
export type AnyStatus = AnimeStatus | BookStatus;

// Broad group for UI grouping (library toggle, add-from-library selector)
export function getMediaGroup(mediaType: string): "anime" | "book" {
  return mediaType === "manga" || mediaType === "book" ? "book" : "anime";
}

// Exact media group — used for per-type default collections
export type ExactMediaGroup = "anime" | "movie" | "series" | "manga" | "book";
export function getExactMediaGroup(mediaType: string): ExactMediaGroup {
  const t = mediaType as ExactMediaGroup;
  return (["anime", "movie", "series", "manga", "book"] as ExactMediaGroup[]).includes(t) ? t : "anime";
}

export function getStatusesForMediaType(mediaType: string): readonly string[] {
  return getMediaGroup(mediaType) === "book" ? BOOK_STATUSES : ANIME_STATUSES;
}

export const STATUS_LABELS: Record<string, string> = {
  // Anime/Movie/Series
  watching: "Watching",
  completed: "Completed",
  want_to_rewatch: "Want to Rewatch",
  dropped: "Dropped",
  // Book/Manga
  wishlist: "Wishlist",
  owned: "Owned",
  reading: "Reading",
};

export const STATUS_COLORS: Record<string, string> = {
  watching: "hsl(190 75% 55%)",
  completed: "hsl(160 65% 50%)",
  want_to_rewatch: "hsl(255 75% 70%)",
  dropped: "hsl(0 65% 60%)",
  wishlist: "hsl(220 8% 55%)",
  owned: "hsl(30 85% 65%)",
  reading: "hsl(255 75% 70%)",
};

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(), // legacy field, always 1
  title: text("title").notNull(),
  mediaType: text("media_type").notNull(),
  // status kept for backward compat but no longer shown in UI
  status: text("status").notNull().default("wishlist"),
  coverUrl: text("cover_url"),
  year: text("year"),
  externalId: text("external_id"),
  externalSource: text("external_source"),
  rating: real("rating"),
  notes: text("notes"),
  genres: text("genres"),
  author: text("author"),
  studio: text("studio"),
  episodes: integer("episodes"),
  // Who added this item (for display attribution)
  addedBy: text("added_by"), // "jack" | "sally" | null = together
});

export const insertItemSchema = createInsertSchema(items).omit({ id: true });
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

// ─── Collections (owned per-owner or together) ───────────────────────────────

// mediaGroup: "anime" covers anime/movie/series, "book" covers manga/book, null = custom (any)
// isDefault: true = system-created categorized collection (cannot be deleted by user UI)
// defaultStatus: which status this default collection represents (e.g. "watching")

export const collections = sqliteTable("collections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(), // legacy field, always 1
  owner: text("owner").notNull().default("together"), // "jack" | "sally" | "together"
  name: text("name").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  mediaGroup: text("media_group"), // "anime" | "book" | null
  defaultStatus: text("default_status"), // the status slug this default collection maps to
});

export const insertCollectionSchema = createInsertSchema(collections).omit({ id: true });
export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type Collection = typeof collections.$inferSelect;

// ─── Collection Items (junction) — status lives HERE now ─────────────────────

export const collectionItems = sqliteTable("collection_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  collectionId: integer("collection_id").notNull().references(() => collections.id),
  itemId: integer("item_id").notNull().references(() => items.id),
  status: text("status"), // per-collection-item status (e.g. "watching", "completed")
});

export const insertCollectionItemSchema = createInsertSchema(collectionItems).omit({ id: true });
export type InsertCollectionItem = z.infer<typeof insertCollectionItemSchema>;
export type CollectionItem = typeof collectionItems.$inferSelect;

// ─── Extended item with collection-item status ────────────────────────────────
export type ItemWithStatus = Item & { collectionItemId?: number; collectionStatus?: string | null };

// ─── Link Lists + Links (Together shared link board) ──────────────────────────

// A named list (e.g. "Date night ideas", "Recipes", "Travel")
export const linkLists = sqliteTable("link_lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  emoji: text("emoji"),          // decorative emoji e.g. "🍕"
  createdAt: integer("created_at").notNull().default(0),
});

export const insertLinkListSchema = createInsertSchema(linkLists).omit({ id: true });
export type InsertLinkList = z.infer<typeof insertLinkListSchema>;
export type LinkList = typeof linkLists.$inferSelect;

// A single link belonging to a list
export const links = sqliteTable("links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listId: integer("list_id").notNull().references(() => linkLists.id),
  url: text("url").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  favicon: text("favicon"),   // favicon URL (cached from origin)
  addedBy: text("added_by"),  // "jack" | "sally" | null
  createdAt: integer("created_at").notNull().default(0),
});

export const insertLinkSchema = createInsertSchema(links).omit({ id: true });
export type InsertLink = z.infer<typeof insertLinkSchema>;
export type Link = typeof links.$inferSelect;

// ─── Secret Messages (jack ↔ sally) ──────────────────────────────────────────
// from: "jack" | "sally"   — who wrote it
// to:   "jack" | "sally"   — who receives it
// readAt: null = unread (shows as inbox pop), non-null = archived

export const secretMessages = sqliteTable("secret_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  from: text("from").notNull(),          // "jack" | "sally"
  to: text("to").notNull(),              // "jack" | "sally"
  subject: text("subject"),             // optional short subject line
  body: text("body").notNull(),          // message content
  mood: text("mood"),                   // emoji mood tag e.g. "💖" "😂" "🔥"
  readAt: integer("read_at"),           // unix ms timestamp — null = unread
  createdAt: integer("created_at").notNull().default(0),
});

export const insertSecretMessageSchema = createInsertSchema(secretMessages).omit({ id: true, readAt: true });
export type InsertSecretMessage = z.infer<typeof insertSecretMessageSchema>;
export type SecretMessage = typeof secretMessages.$inferSelect;

// ─── Users (legacy, kept for DB compatibility) ────────────────────────────────

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Default collection definitions ──────────────────────────────────────────
// Each exact media type gets its own 4 default collections.
// mediaGroup stores the exact type ("anime" | "movie" | "series" | "manga" | "book")

export const DEFAULT_COLLECTIONS: Array<{
  name: string;
  description: string;
  mediaGroup: ExactMediaGroup;
  defaultStatus: string;
}> = [
  // ── Anime
  { name: "Watching",        description: "Anime I'm currently watching",          mediaGroup: "anime",  defaultStatus: "watching" },
  { name: "Completed",       description: "Anime I finished",                       mediaGroup: "anime",  defaultStatus: "completed" },
  { name: "Want to Rewatch", description: "Anime worth a second watch",             mediaGroup: "anime",  defaultStatus: "want_to_rewatch" },
  { name: "Dropped",         description: "Anime I gave up on",                    mediaGroup: "anime",  defaultStatus: "dropped" },
  // ── Movie
  { name: "Watching",        description: "Movies in progress",                    mediaGroup: "movie",  defaultStatus: "watching" },
  { name: "Completed",       description: "Movies I've seen",                      mediaGroup: "movie",  defaultStatus: "completed" },
  { name: "Want to Rewatch", description: "Movies worth watching again",            mediaGroup: "movie",  defaultStatus: "want_to_rewatch" },
  { name: "Dropped",         description: "Movies I didn't finish",                mediaGroup: "movie",  defaultStatus: "dropped" },
  // ── Series
  { name: "Watching",        description: "Series I'm currently watching",         mediaGroup: "series", defaultStatus: "watching" },
  { name: "Completed",       description: "Series I finished",                     mediaGroup: "series", defaultStatus: "completed" },
  { name: "Want to Rewatch", description: "Series worth another go",               mediaGroup: "series", defaultStatus: "want_to_rewatch" },
  { name: "Dropped",         description: "Series I abandoned",                   mediaGroup: "series", defaultStatus: "dropped" },
  // ── Manga
  { name: "Reading",         description: "Manga I'm currently reading",           mediaGroup: "manga",  defaultStatus: "reading" },
  { name: "Completed",       description: "Manga I finished",                      mediaGroup: "manga",  defaultStatus: "completed" },
  { name: "Wishlist",        description: "Manga I want to read",                  mediaGroup: "manga",  defaultStatus: "wishlist" },
  { name: "Owned",           description: "Manga I own but haven't started",       mediaGroup: "manga",  defaultStatus: "owned" },
  // ── Book
  { name: "Reading",         description: "Books I'm currently reading",           mediaGroup: "book",   defaultStatus: "reading" },
  { name: "Completed",       description: "Books I finished",                      mediaGroup: "book",   defaultStatus: "completed" },
  { name: "Wishlist",        description: "Books I want to read",                  mediaGroup: "book",   defaultStatus: "wishlist" },
  { name: "Owned",           description: "Books I own but haven't started",       mediaGroup: "book",   defaultStatus: "owned" },
];
