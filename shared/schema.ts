import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users ───────────────────────────────────────────────────────────────────

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

// ─── Media Items ─────────────────────────────────────────────────────────────

export const MEDIA_TYPES = ["anime", "manga", "movie", "series", "book"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const STATUSES = ["watching", "reading", "completed", "on_hold", "dropped", "wishlist"] as const;
export type Status = (typeof STATUSES)[number];

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  // Core metadata
  title: text("title").notNull(),
  mediaType: text("media_type").notNull(), // MediaType
  status: text("status").notNull().default("wishlist"), // Status
  coverUrl: text("cover_url"),
  year: text("year"),
  // External IDs (for dedup / re-fetch)
  externalId: text("external_id"),
  externalSource: text("external_source"), // "jikan" | "omdb" | "openlibrary"
  // User data
  rating: real("rating"), // 1-10, nullable
  notes: text("notes"),
  // Extras stored as JSON text
  genres: text("genres"), // JSON string array
  author: text("author"), // for books / manga
  studio: text("studio"), // for anime / movies
  episodes: integer("episodes"), // anime / series
});

export const insertItemSchema = createInsertSchema(items).omit({ id: true });
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

// ─── Collections ─────────────────────────────────────────────────────────────

export const collections = sqliteTable("collections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"), // first item's cover, auto-filled
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
