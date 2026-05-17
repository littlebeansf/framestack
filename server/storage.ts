import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc } from "drizzle-orm";
import {
  users, items, collections, collectionItems,
  type User, type InsertUser,
  type Item, type InsertItem,
  type Collection, type InsertCollection,
  type CollectionItem, type InsertCollectionItem,
} from "@shared/schema";

const sqlite = new Database("data.db");
const db = drizzle(sqlite);

// ─── Migrations ──────────────────────────────────────────────────────────────

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    media_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'wishlist',
    cover_url TEXT,
    year TEXT,
    external_id TEXT,
    external_source TEXT,
    rating REAL,
    notes TEXT,
    genres TEXT,
    author TEXT,
    studio TEXT,
    episodes INTEGER
  );

  CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    cover_url TEXT
  );

  CREATE TABLE IF NOT EXISTS collection_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL REFERENCES collections(id),
    item_id INTEGER NOT NULL REFERENCES items(id)
  );
`);

// ─── Interface ───────────────────────────────────────────────────────────────

export interface IStorage {
  // Users
  getUserById(id: number): User | undefined;
  getUserByUsername(username: string): User | undefined;
  getUserByEmail(email: string): User | undefined;
  createUser(data: InsertUser): User;
  updateUser(id: number, data: Partial<InsertUser>): User | undefined;

  // Items
  getItemsByUser(userId: number): Item[];
  getItemById(id: number): Item | undefined;
  createItem(data: InsertItem): Item;
  updateItem(id: number, data: Partial<InsertItem>): Item | undefined;
  deleteItem(id: number): void;

  // Collections
  getCollectionsByUser(userId: number): Collection[];
  getCollectionById(id: number): Collection | undefined;
  createCollection(data: InsertCollection): Collection;
  updateCollection(id: number, data: Partial<InsertCollection>): Collection | undefined;
  deleteCollection(id: number): void;

  // Collection Items
  getItemsInCollection(collectionId: number): Item[];
  addItemToCollection(data: InsertCollectionItem): CollectionItem;
  removeItemFromCollection(collectionId: number, itemId: number): void;
  getCollectionsForItem(itemId: number): Collection[];
}

export class Storage implements IStorage {
  getUserById(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  getUserByUsername(username: string) {
    return db.select().from(users).where(eq(users.username, username)).get();
  }
  getUserByEmail(email: string) {
    return db.select().from(users).where(eq(users.email, email)).get();
  }
  createUser(data: InsertUser) {
    return db.insert(users).values(data).returning().get();
  }
  updateUser(id: number, data: Partial<InsertUser>) {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  }

  getItemsByUser(userId: number) {
    return db.select().from(items).where(eq(items.userId, userId)).all();
  }
  getItemById(id: number) {
    return db.select().from(items).where(eq(items.id, id)).get();
  }
  createItem(data: InsertItem) {
    return db.insert(items).values(data).returning().get();
  }
  updateItem(id: number, data: Partial<InsertItem>) {
    return db.update(items).set(data).where(eq(items.id, id)).returning().get();
  }
  deleteItem(id: number) {
    db.delete(collectionItems).where(eq(collectionItems.itemId, id)).run();
    db.delete(items).where(eq(items.id, id)).run();
  }

  getCollectionsByUser(userId: number) {
    return db.select().from(collections).where(eq(collections.userId, userId)).all();
  }
  getCollectionById(id: number) {
    return db.select().from(collections).where(eq(collections.id, id)).get();
  }
  createCollection(data: InsertCollection) {
    return db.insert(collections).values(data).returning().get();
  }
  updateCollection(id: number, data: Partial<InsertCollection>) {
    return db.update(collections).set(data).where(eq(collections.id, id)).returning().get();
  }
  deleteCollection(id: number) {
    db.delete(collectionItems).where(eq(collectionItems.collectionId, id)).run();
    db.delete(collections).where(eq(collections.id, id)).run();
  }

  getItemsInCollection(collectionId: number) {
    const rows = db.select({ item: items })
      .from(collectionItems)
      .innerJoin(items, eq(collectionItems.itemId, items.id))
      .where(eq(collectionItems.collectionId, collectionId))
      .all();
    return rows.map((r) => r.item);
  }
  addItemToCollection(data: InsertCollectionItem) {
    // Check for duplicate
    const existing = db.select().from(collectionItems)
      .where(and(eq(collectionItems.collectionId, data.collectionId), eq(collectionItems.itemId, data.itemId)))
      .get();
    if (existing) return existing;
    return db.insert(collectionItems).values(data).returning().get();
  }
  removeItemFromCollection(collectionId: number, itemId: number) {
    db.delete(collectionItems)
      .where(and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.itemId, itemId)))
      .run();
  }
  getCollectionsForItem(itemId: number) {
    const rows = db.select({ collection: collections })
      .from(collectionItems)
      .innerJoin(collections, eq(collectionItems.collectionId, collections.id))
      .where(eq(collectionItems.itemId, itemId))
      .all();
    return rows.map((r) => r.collection);
  }
}

export const storage = new Storage();
