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

export const STATUSES = ["watching", "reading", "completed", "on_hold", "dropped", "wishlist"] as const;
export type Status = (typeof STATUSES)[number];

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(), // legacy field, always 1
  title: text("title").notNull(),
  mediaType: text("media_type").notNull(),
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

export const collections = sqliteTable("collections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(), // legacy field, always 1
  owner: text("owner").notNull().default("together"), // "jack" | "sally" | "together"
  name: text("name").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
});

export const insertCollectionSchema = createInsertSchema(collections).omit({ id: true });
export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type Collection = typeof collections.$inferSelect;

// ─── Collection Items (junction) ─────────────────────────────────────────────

export const collectionItems = sqliteTable("collection_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  collectionId: integer("collection_id").notNull().references(() => collections.id),
  itemId: integer("item_id").notNull().references(() => items.id),
});

export const insertCollectionItemSchema = createInsertSchema(collectionItems).omit({ id: true });
export type InsertCollectionItem = z.infer<typeof insertCollectionItemSchema>;
export type CollectionItem = typeof collectionItems.$inferSelect;

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
