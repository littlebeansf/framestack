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
  // Diary & personality
  diaryEntry: text("diary_entry"),              // freeform diary text shown on profile
  unpopularOpinion: text("unpopular_opinion"),  // hot take shown as sealed diary entry
  vibeTags: text("vibe_tags"),                  // JSON array of tags e.g. ["night owl","weeb"]
  top3: text("top_3"),                          // JSON array [{title,type,emoji}] — pinned top picks
  // Visual customisation
  avatarUrl: text("avatar_url"),                // custom image URL for avatar
  bgStyle: text("bg_style"),                    // "aurora" | "waves" | "noise" | "mesh" | "stars" | "solid" | "custom"
  bgCustom: text("bg_custom"),                  // raw CSS gradient string when bgStyle=custom
  bannerPattern: text("banner_pattern"),        // optional overlay texture
  profileMusicUrl: text("profile_music_url"),   // spotify/yt link shown on profile
  profileMusicLabel: text("profile_music_label"), // display label for music link
});

export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

// ─── Media Items (shared library) ─────────────────────────────────────────────

export const MEDIA_TYPES = ["anime", "manga", "movie", "series", "book", "podcast"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

// Status sets per media group
// Anime / Movie / Series: watching, completed, want_to_rewatch, dropped
// Manga / Book: wishlist, owned, reading, completed
// Podcast: listening, completed, wishlist, dropped
export const ANIME_STATUSES = ["watching", "completed", "want_to_rewatch", "dropped"] as const;
export const BOOK_STATUSES = ["wishlist", "owned", "reading", "completed"] as const;
export const PODCAST_STATUSES = ["listening", "completed", "wishlist", "dropped"] as const;
export type AnimeStatus = (typeof ANIME_STATUSES)[number];
export type BookStatus = (typeof BOOK_STATUSES)[number];
export type PodcastStatus = (typeof PODCAST_STATUSES)[number];
export type AnyStatus = AnimeStatus | BookStatus | PodcastStatus;

// Broad group for UI grouping (library toggle, add-from-library selector)
export function getMediaGroup(mediaType: string): "anime" | "book" | "podcast" {
  if (mediaType === "podcast") return "podcast";
  return mediaType === "manga" || mediaType === "book" ? "book" : "anime";
}

// Exact media group — used for per-type default collections
export type ExactMediaGroup = "anime" | "movie" | "series" | "manga" | "book" | "podcast";
export function getExactMediaGroup(mediaType: string): ExactMediaGroup {
  const t = mediaType as ExactMediaGroup;
  return (["anime", "movie", "series", "manga", "book", "podcast"] as ExactMediaGroup[]).includes(t) ? t : "anime";
}

export function getStatusesForMediaType(mediaType: string): readonly string[] {
  const g = getMediaGroup(mediaType);
  if (g === "podcast") return PODCAST_STATUSES;
  if (g === "book") return BOOK_STATUSES;
  return ANIME_STATUSES;
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
  // Podcast
  listening: "Listening",
};

export const STATUS_COLORS: Record<string, string> = {
  watching: "hsl(190 75% 55%)",
  completed: "hsl(160 65% 50%)",
  want_to_rewatch: "hsl(255 75% 70%)",
  dropped: "hsl(0 65% 60%)",
  wishlist: "hsl(220 8% 55%)",
  owned: "hsl(30 85% 65%)",
  reading: "hsl(255 75% 70%)",
  listening: "hsl(190 75% 55%)",
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
  icon: text("icon"),         // optional emoji or short tag e.g. "🎬" "inspo" "must"
  locked: integer("locked").notNull().default(0), // 1 = locked (blocks external link open)
  createdAt: integer("created_at").notNull().default(0),
});

export const insertLinkSchema = createInsertSchema(links).omit({ id: true });
export type InsertLink = z.infer<typeof insertLinkSchema>;
export type Link = typeof links.$inferSelect;

// ─── Quotes (per-owner collection) ─────────────────────────────────────────
// Each owner (jack | sally) keeps their own quote collection.
// author is a free-text field; the frontend derives the dropdown from existing authors.

export const quotes = sqliteTable("quotes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),      // "jack" | "sally"
  text: text("text").notNull(),        // the quote body
  author: text("author").notNull(),    // free-text author name
  createdAt: integer("created_at").notNull().default(0),
  isFeatured: integer("is_featured").notNull().default(0), // 0|1 boolean
  featuredPos: integer("featured_pos").default(null),      // 1-5 ordering slot
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

// ─── Restaurants (Together shared tracker) ──────────────────────────────────

export const RESTAURANT_STATUSES = ["want_to_go", "been"] as const;
export type RestaurantStatus = (typeof RESTAURANT_STATUSES)[number];

export const restaurants = sqliteTable("restaurants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  address: text("address"),
  lat: real("lat"),
  lng: real("lng"),
  status: text("status").notNull().default("want_to_go"), // "want_to_go" | "been"
  cuisine: text("cuisine"),        // free-text e.g. "Italian" "Sushi" "Thai"
  emoji: text("emoji"),            // decorative e.g. "🍕" "🍣"
  rating: real("rating"),          // 1–5, null if not yet rated
  notes: text("notes"),
  addedBy: text("added_by"),       // "jack" | "sally" | null
  visitedAt: integer("visited_at"), // unix ms — set when marking as "been"
  createdAt: integer("created_at").notNull().default(0),
});

export const insertRestaurantSchema = createInsertSchema(restaurants).omit({ id: true });
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Restaurant = typeof restaurants.$inferSelect;

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

// ─── Daily Mood ──────────────────────────────────────────────────────────────────────
// One entry per owner per day. mood is one of the MOOD_KEYS.
export const dailyMoods = sqliteTable("daily_moods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),          // "jack" | "sally"
  date: text("date").notNull(),            // ISO date string "2026-07-07"
  mood: text("mood").notNull(),            // e.g. "happy" | "sad" | "hyped" ...
  note: text("note"),                      // optional short thought for the day
  createdAt: integer("created_at").notNull().default(0),
});

export const insertDailyMoodSchema = createInsertSchema(dailyMoods).omit({ id: true });
export type InsertDailyMood = z.infer<typeof insertDailyMoodSchema>;
export type DailyMood = typeof dailyMoods.$inferSelect;

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
  // ── Podcast
  { name: "Listening",       description: "Podcasts I'm currently listening to",   mediaGroup: "podcast", defaultStatus: "listening" },
  { name: "Completed",       description: "Podcasts I finished",                   mediaGroup: "podcast", defaultStatus: "completed" },
  { name: "Wishlist",        description: "Podcasts I want to listen to",          mediaGroup: "podcast", defaultStatus: "wishlist" },
  { name: "Dropped",         description: "Podcasts I stopped listening to",       mediaGroup: "podcast", defaultStatus: "dropped" },
];

// ── Grocery Lists ────────────────────────────────────────────────────────────

export const groceryLists = sqliteTable("grocery_lists", {
  id:           integer("id").primaryKey({ autoIncrement: true }),
  name:         text("name").notNull(),
  date:         text("date").notNull(),          // ISO date string YYYY-MM-DD
  is_template:  integer("is_template").notNull().default(0),   // 0=list, 1=template
  is_completed: integer("is_completed").notNull().default(0),  // 0=active, 1=archived
  created_by:   text("created_by").notNull(),    // "jack" | "sally"
  created_at:   text("created_at").notNull().default(""),
});

export const groceryItems = sqliteTable("grocery_items", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  list_id:     integer("list_id").notNull(),
  name:        text("name").notNull(),
  location:    text("location"),               // optional store/aisle
  price:       real("price"),                  // optional price
  checked:     integer("checked").notNull().default(0),
  sort_order:  integer("sort_order").notNull().default(0),
});

// ── Events / Calendar ──────────────────────────────────────────────────────────

export const events = sqliteTable("events", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  title:       text("title").notNull(),
  date:        text("date").notNull(),         // YYYY-MM-DD
  end_date:    text("end_date"),               // optional, for multi-day spans
  time:        text("time"),                   // "HH:MM" optional
  category:    text("category").notNull().default("other"), // date|trip|anniversary|concert|birthday|reminder|other
  notes:       text("notes"),
  created_by:  text("created_by").notNull(),   // "jack"|"sally"|"together"
  created_at:  text("created_at").notNull().default(""),
});

export const insertEventSchema = createInsertSchema(events).omit({ id: true, created_at: true });
export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

export const insertGroceryListSchema = createInsertSchema(groceryLists).omit({ id: true, created_at: true });
export const insertGroceryItemSchema = createInsertSchema(groceryItems).omit({ id: true });

export type GroceryList = typeof groceryLists.$inferSelect;
export type GroceryItem = typeof groceryItems.$inferSelect;
export type InsertGroceryList = typeof groceryLists.$inferInsert;
export type InsertGroceryItem = typeof groceryItems.$inferInsert;
