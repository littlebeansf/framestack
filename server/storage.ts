import { eq, and } from "drizzle-orm";
import {
  users, items, collections, collectionItems, profiles,
  type User, type InsertUser,
  type Item, type InsertItem,
  type Collection, type InsertCollection,
  type CollectionItem, type InsertCollectionItem,
  type Profile, type InsertProfile,
  type ItemWithStatus,
  OWNERS, DEFAULT_COLLECTIONS,
} from "@shared/schema";
import { getDb, getDrizzle } from "./db";

const sqlite = getDb();
const db = getDrizzle();

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

  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    bio TEXT,
    avatar_emoji TEXT,
    accent_color TEXT,
    banner_color TEXT,
    favorite_genre TEXT,
    currently_obsessed_with TEXT,
    catchphrase TEXT,
    vinyl_count INTEGER,
    custom_stat1_label TEXT,
    custom_stat1_value TEXT,
    custom_stat2_label TEXT,
    custom_stat2_value TEXT
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
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
    episodes INTEGER,
    added_by TEXT
  );

  CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    owner TEXT NOT NULL DEFAULT 'together',
    name TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    media_group TEXT,
    default_status TEXT
  );

  CREATE TABLE IF NOT EXISTS collection_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL REFERENCES collections(id),
    item_id INTEGER NOT NULL REFERENCES items(id),
    status TEXT
  );
`);

// Add new columns to existing tables if upgrading
try { sqlite.exec(`ALTER TABLE items ADD COLUMN added_by TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE collections ADD COLUMN owner TEXT NOT NULL DEFAULT 'together'`); } catch {}
try { sqlite.exec(`ALTER TABLE collections ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE collections ADD COLUMN media_group TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE collections ADD COLUMN default_status TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE collection_items ADD COLUMN status TEXT`); } catch {}

// Seed default profiles
function seedProfiles() {
  const defaults = [
    {
      owner: "jack", displayName: "Jack",
      bio: "Chaotic good media enjoyer. Currently losing sleep over fictional characters.",
      avatarEmoji: "🐻", accentColor: "hsl(220 80% 60%)", bannerColor: "hsl(240 60% 15%)",
      catchphrase: "I'll watch one more episode",
    },
    {
      owner: "sally", displayName: "Sally",
      bio: "Professional crier at anime. Collector of fictional husbands.",
      avatarEmoji: "🌸", accentColor: "hsl(330 75% 65%)", bannerColor: "hsl(310 50% 12%)",
      catchphrase: "It's not a phase, it's a lifestyle",
    },
    {
      owner: "together", displayName: "Together 💕",
      bio: "Our shared universe of things we love watching side by side.",
      avatarEmoji: "🫶", accentColor: "hsl(20 90% 60%)", bannerColor: "hsl(30 60% 10%)",
      catchphrase: "Two degenerates, one couch",
    },
  ];
  for (const d of defaults) {
    const existing = db.select().from(profiles).where(eq(profiles.owner, d.owner)).get();
    if (!existing) db.insert(profiles).values(d).run();
  }
}
seedProfiles();

// Seed default collections for each owner
function seedDefaultCollections() {
  for (const owner of OWNERS) {
    for (const def of DEFAULT_COLLECTIONS) {
      const existing = db.select().from(collections).where(
        and(
          eq(collections.owner, owner),
          eq(collections.isDefault, true),
          eq(collections.defaultStatus, def.defaultStatus),
          eq(collections.mediaGroup, def.mediaGroup),
        )
      ).get();
      if (!existing) {
        db.insert(collections).values({
          userId: 1,
          owner,
          name: def.name,
          description: def.description,
          isDefault: true,
          mediaGroup: def.mediaGroup,
          defaultStatus: def.defaultStatus,
        }).run();
      }
    }
  }
}
seedDefaultCollections();

// ─── Interface ───────────────────────────────────────────────────────────────

export interface IStorage {
  // Profiles
  getProfile(owner: string): Profile | undefined;
  updateProfile(owner: string, data: Partial<InsertProfile>): Profile | undefined;

  // Users
  getUserById(id: number): User | undefined;
  createUser(data: InsertUser): User;

  // Items (shared library)
  getAllItems(): Item[];
  getItemById(id: number): Item | undefined;
  createItem(data: InsertItem): Item;
  updateItem(id: number, data: Partial<InsertItem>): Item | undefined;
  deleteItem(id: number): void;

  // Collections (per-owner)
  getCollectionsByOwner(owner: string): Collection[];
  getAllCollections(): Collection[];
  getCollectionById(id: number): Collection | undefined;
  createCollection(data: InsertCollection): Collection;
  updateCollection(id: number, data: Partial<InsertCollection>): Collection | undefined;
  deleteCollection(id: number): void;

  // Collection Items — now with status
  getItemsInCollection(collectionId: number): ItemWithStatus[];
  getCollectionItem(collectionId: number, itemId: number): CollectionItem | undefined;
  addItemToCollection(data: InsertCollectionItem): CollectionItem;
  removeItemFromCollection(collectionId: number, itemId: number): void;
  updateCollectionItemStatus(collectionId: number, itemId: number, status: string): CollectionItem | undefined;
  getCollectionsForItem(itemId: number): Collection[];
  getCollectionItemsForItem(itemId: number): CollectionItem[];
}

export class Storage implements IStorage {
  getProfile(owner: string) {
    return db.select().from(profiles).where(eq(profiles.owner, owner)).get();
  }
  updateProfile(owner: string, data: Partial<InsertProfile>) {
    return db.update(profiles).set(data).where(eq(profiles.owner, owner)).returning().get();
  }

  getUserById(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  createUser(data: InsertUser) {
    return db.insert(users).values(data).returning().get();
  }

  getAllItems() {
    return db.select().from(items).all();
  }
  getItemsByUser(userId: number) {
    return this.getAllItems(); // shared library
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

  getCollectionsByOwner(owner: string) {
    return db.select().from(collections).where(eq(collections.owner, owner)).all();
  }
  getAllCollections() {
    return db.select().from(collections).all();
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

  getItemsInCollection(collectionId: number): ItemWithStatus[] {
    const rows = db.select({ item: items, ci: collectionItems })
      .from(collectionItems)
      .innerJoin(items, eq(collectionItems.itemId, items.id))
      .where(eq(collectionItems.collectionId, collectionId))
      .all();
    return rows.map((r) => ({
      ...r.item,
      collectionItemId: r.ci.id,
      collectionStatus: r.ci.status,
    }));
  }

  getCollectionItem(collectionId: number, itemId: number) {
    return db.select().from(collectionItems)
      .where(and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.itemId, itemId)))
      .get();
  }

  addItemToCollection(data: InsertCollectionItem) {
    const existing = db.select().from(collectionItems)
      .where(and(eq(collectionItems.collectionId, data.collectionId), eq(collectionItems.itemId, data.itemId)))
      .get();
    if (existing) {
      // Update status if provided and different
      if (data.status && data.status !== existing.status) {
        return db.update(collectionItems)
          .set({ status: data.status })
          .where(eq(collectionItems.id, existing.id))
          .returning().get() ?? existing;
      }
      return existing;
    }
    return db.insert(collectionItems).values(data).returning().get();
  }

  removeItemFromCollection(collectionId: number, itemId: number) {
    db.delete(collectionItems)
      .where(and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.itemId, itemId)))
      .run();
  }

  updateCollectionItemStatus(collectionId: number, itemId: number, status: string) {
    return db.update(collectionItems)
      .set({ status })
      .where(and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.itemId, itemId)))
      .returning().get();
  }

  getCollectionsForItem(itemId: number) {
    const rows = db.select({ collection: collections })
      .from(collectionItems)
      .innerJoin(collections, eq(collectionItems.collectionId, collections.id))
      .where(eq(collectionItems.itemId, itemId))
      .all();
    return rows.map((r) => r.collection);
  }

  getCollectionItemsForItem(itemId: number) {
    return db.select().from(collectionItems).where(eq(collectionItems.itemId, itemId)).all();
  }
}

export const storage = new Storage();
