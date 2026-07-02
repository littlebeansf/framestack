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

export function getMediaGroup(mediaType: string): "anime" | "book" {
  return mediaType === "manga" || mediaType === "book" ? "book" : "anime";
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

export const DEFAULT_COLLECTIONS: Array<{
  name: string;
  description: string;
  mediaGroup: "anime" | "book";
  defaultStatus: string;
}> = [
  // Anime/Movie/Series group
  { name: "Watching", description: "Currently watching", mediaGroup: "anime", defaultStatus: "watching" },
  { name: "Completed", description: "Finished and done", mediaGroup: "anime", defaultStatus: "completed" },
  { name: "Want to Rewatch", description: "So good, need to see again", mediaGroup: "anime", defaultStatus: "want_to_rewatch" },
  { name: "Dropped", description: "Gave up on these", mediaGroup: "anime", defaultStatus: "dropped" },
  // Book/Manga group
  { name: "Reading", description: "Currently reading", mediaGroup: "book", defaultStatus: "reading" },
  { name: "Completed", description: "Books & manga finished", mediaGroup: "book", defaultStatus: "completed" },
  { name: "Wishlist", description: "Want to read someday", mediaGroup: "book", defaultStatus: "wishlist" },
  { name: "Owned", description: "Own but haven't started", mediaGroup: "book", defaultStatus: "owned" },
];
