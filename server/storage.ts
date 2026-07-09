import { eq, and, desc } from "drizzle-orm";
import {
  users, items, collections, collectionItems, profiles, links, linkLists, secretMessages, quotes, restaurants, dailyMoods,
  groceryLists, groceryItems, events,
  type User, type InsertUser,
  type Item, type InsertItem,
  type Collection, type InsertCollection,
  type CollectionItem, type InsertCollectionItem,
  type Profile, type InsertProfile,
  type Link, type InsertLink,
  type LinkList, type InsertLinkList,
  type SecretMessage, type InsertSecretMessage,
  type Quote, type InsertQuote,
  type Restaurant, type InsertRestaurant,
  type DailyMood, type InsertDailyMood,
  type GroceryList, type GroceryItem, type InsertGroceryList, type InsertGroceryItem,
  type Event, type InsertEvent,
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

  CREATE TABLE IF NOT EXISTS link_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    emoji TEXT,
    created_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL REFERENCES link_lists(id),
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    favicon TEXT,
    added_by TEXT,
    created_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner TEXT NOT NULL,
    text TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS secret_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    mood TEXT,
    read_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT 0
  );
`);

// Add new columns to existing tables if upgrading
try { sqlite.exec(`ALTER TABLE items ADD COLUMN added_by TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE collections ADD COLUMN owner TEXT NOT NULL DEFAULT 'together'`); } catch {}
try { sqlite.exec(`ALTER TABLE collections ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE collections ADD COLUMN media_group TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE collections ADD COLUMN default_status TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE collection_items ADD COLUMN status TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE quotes ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE quotes ADD COLUMN featured_pos INTEGER`); } catch {}

// Force Together avatar to 🏠 (user may have edited it to 🔥 via the UI)
try { sqlite.exec(`UPDATE profiles SET avatar_emoji = '\ud83c\udfe0' WHERE owner = 'together' AND avatar_emoji != '\ud83c\udfe0'`); } catch {}
// Migrate links table: add list_id column if missing, drop category if present
try { sqlite.exec(`ALTER TABLE links ADD COLUMN list_id INTEGER NOT NULL DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE link_lists ADD COLUMN emoji TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE links ADD COLUMN icon TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE links ADD COLUMN locked INTEGER NOT NULL DEFAULT 0`); } catch {}
// Migrate daily_moods table
try { sqlite.exec(`CREATE TABLE IF NOT EXISTS daily_moods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  date TEXT NOT NULL,
  mood TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL DEFAULT 0,
  UNIQUE(owner, date)
)`); } catch {}
// Migrate profiles table — new diary + visual fields
try { sqlite.exec(`ALTER TABLE profiles ADD COLUMN diary_entry TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE profiles ADD COLUMN unpopular_opinion TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE profiles ADD COLUMN vibe_tags TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE profiles ADD COLUMN top_3 TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE profiles ADD COLUMN avatar_url TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE profiles ADD COLUMN bg_style TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE profiles ADD COLUMN bg_custom TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE profiles ADD COLUMN banner_pattern TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE profiles ADD COLUMN profile_music_url TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE profiles ADD COLUMN profile_music_label TEXT`); } catch {}
// Migrate restaurants table
try { sqlite.exec(`CREATE TABLE IF NOT EXISTS restaurants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  lat REAL,
  lng REAL,
  status TEXT NOT NULL DEFAULT 'want_to_go',
  cuisine TEXT,
  emoji TEXT,
  rating REAL,
  notes TEXT,
  added_by TEXT,
  visited_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT 0
)`); } catch {}

// Migrate grocery tables
try { sqlite.exec(`CREATE TABLE IF NOT EXISTS grocery_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  is_template INTEGER NOT NULL DEFAULT 0,
  is_completed INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ''
)`); } catch {}
try { sqlite.exec(`ALTER TABLE grocery_lists ADD COLUMN is_completed INTEGER NOT NULL DEFAULT 0`); } catch {}
try { sqlite.exec(`CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  end_date TEXT,
  time TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ''
)`); } catch {}
try { sqlite.exec(`CREATE TABLE IF NOT EXISTS grocery_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  price REAL,
  checked INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
)`); } catch {}

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
      avatarEmoji: "🏠", accentColor: "hsl(20 90% 60%)", bannerColor: "hsl(30 60% 10%)",
      catchphrase: "Two degenerates, one couch",
    },
  ];
  for (const d of defaults) {
    const existing = db.select().from(profiles).where(eq(profiles.owner, d.owner)).get();
    if (!existing) db.insert(profiles).values(d).run();
  }
}
seedProfiles();

// Migrate: remove old broad-group default collections (mediaGroup = "anime" that covers
// movie+series, or mediaGroup = "book" that covers manga). These came from the previous
// schema where anime/movie/series shared one set of 4 collections. We now have per-type.
// Only remove a broad-group row if per-type rows already exist (or we're about to add them).
function migrateOldBroadDefaults() {
  // The old scheme had mediaGroup "anime" (= all of anime+movie+series) and "book" (= manga+book).
  // The new scheme uses exact types: "anime", "movie", "series", "manga", "book".
  // A broad-group row is identified as: isDefault=true AND mediaGroup IN ('anime','book')
  // AND there are also per-type rows for 'movie' or 'series' (or 'manga') — meaning the
  // migration already ran. We delete the stale broad ones unconditionally on each boot
  // because per-type seeding below will create the correct ones.
  //
  // Safe to do: broad "anime" rows can't overlap with per-type "anime" rows by defaultStatus+owner combo,
  // because per-type "anime" rows have the same mediaGroup value ("anime") — they ARE the per-type ones.
  // So we specifically target old broad rows that are now REPLACED:
  // - Old: mediaGroup="anime", defaultStatus IN (watching/completed/want_to_rewatch/dropped)
  //   but we also have those for per-type "anime" now — those are fine to keep.
  // - Old: mediaGroup="book", defaultStatus IN (reading/completed/wishlist/owned)
  //   but "book" is also a valid per-type now — fine to keep.
  //
  // THE ONLY STALE ONES are those that were created BEFORE per-type was introduced,
  // meaning they predate the movie/series/manga rows. Since we can't easily distinguish,
  // we use a simpler heuristic: if per-type rows for "movie" exist, migration is done.
  // This function is safe to call every boot (idempotent).
  //
  // Nothing to delete — the existing "anime" and "book" mediaGroup values are still valid
  // per-type group names. The old duplicate broad rows (if any) were already the same
  // mediaGroup value, so the seed's `if (!existing)` check handles deduplication naturally.
  // No action needed here.
}
migrateOldBroadDefaults();

// Seed default collections for each owner.
// Each exact media type (anime/movie/series/manga/book) gets its own 4 default collections.
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

// ─── Migration: fix items misplaced in broad-group collections ─────────────────────
// Old scheme used mediaGroup="anime" for anime/movie/series and
// mediaGroup="book" for manga/book. This migration moves any collection_items
// where item.media_type doesn't match the collection.media_group into the
// correct per-type default collection for the same owner + status.
function migrateCollectionItems() {
  // Find all collection_items where the item's media_type != collection's media_group
  const misplaced = getDb().prepare(`
    SELECT 
      ci.id          AS ci_id,
      ci.item_id,
      ci.status,
      i.media_type,
      c.default_status,
      c.owner
    FROM collection_items ci
    JOIN items i ON i.id = ci.item_id
    JOIN collections c ON c.id = ci.collection_id
    WHERE c.is_default = 1
      AND c.media_group != i.media_type
  `).all() as Array<{
    ci_id: number;
    item_id: number;
    status: string | null;
    media_type: string;
    default_status: string | null;
    owner: string;
  }>;

  if (misplaced.length === 0) return;
  console.log(`[migration] Moving ${misplaced.length} misplaced collection item(s) to correct per-type collections`);

  for (const row of misplaced) {
    // Find the correct default collection: same owner, same defaultStatus, correct mediaGroup
    const targetStatus = row.status ?? row.default_status ?? "watching";
    const target = getDb().prepare(`
      SELECT id FROM collections
      WHERE is_default = 1
        AND owner = ?
        AND media_group = ?
        AND default_status = ?
      LIMIT 1
    `).get(row.owner, row.media_type, targetStatus) as { id: number } | undefined;

    if (!target) {
      // Try any collection matching owner + mediaGroup
      const fallback = getDb().prepare(`
        SELECT id FROM collections
        WHERE is_default = 1 AND owner = ? AND media_group = ?
        LIMIT 1
      `).get(row.owner, row.media_type) as { id: number } | undefined;
      if (!fallback) { console.warn(`[migration] No target collection for owner=${row.owner} mediaType=${row.media_type}`); continue; }

      // Move: delete from old, upsert into new
      getDb().prepare(`DELETE FROM collection_items WHERE id = ?`).run(row.ci_id);
      const exists = getDb().prepare(`SELECT id FROM collection_items WHERE collection_id = ? AND item_id = ?`).get(fallback.id, row.item_id);
      if (!exists) getDb().prepare(`INSERT INTO collection_items (collection_id, item_id, status) VALUES (?, ?, ?)`).run(fallback.id, row.item_id, row.status);
      continue;
    }

    getDb().prepare(`DELETE FROM collection_items WHERE id = ?`).run(row.ci_id);
    const exists = getDb().prepare(`SELECT id FROM collection_items WHERE collection_id = ? AND item_id = ?`).get(target.id, row.item_id);
    if (!exists) getDb().prepare(`INSERT INTO collection_items (collection_id, item_id, status) VALUES (?, ?, ?)`).run(target.id, row.item_id, row.status);
  }
  console.log(`[migration] Done.`);
}
migrateCollectionItems();

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

  // Link Lists
  getAllLinkLists(): LinkList[];
  getLinkListById(id: number): LinkList | undefined;
  createLinkList(data: InsertLinkList): LinkList;
  updateLinkList(id: number, data: Partial<InsertLinkList>): LinkList | undefined;
  deleteLinkList(id: number): void;

  // Links (scoped to a list)
  getLinksByList(listId: number): Link[];
  getLinkById(id: number): Link | undefined;
  createLink(data: InsertLink): Link;
  updateLink(id: number, data: Partial<InsertLink>): Link | undefined;
  deleteLink(id: number): void;

  // Quotes
  getQuotesByOwner(owner: string): Quote[];
  createQuote(data: InsertQuote): Quote;
  updateQuote(id: number, data: Partial<InsertQuote> & { isFeatured?: number; featuredPos?: number | null }): Quote | undefined;
  setQuoteFeatured(id: number, featured: boolean): Quote | null;
  reorderFeatured(owner: string, orderedIds: number[]): void;
  deleteQuote(id: number): void;

  // Restaurants
  getAllRestaurants(): Restaurant[];
  getRestaurantById(id: number): Restaurant | undefined;
  createRestaurant(data: InsertRestaurant): Restaurant;
  updateRestaurant(id: number, data: Partial<InsertRestaurant>): Restaurant | undefined;
  deleteRestaurant(id: number): void;

  // Secret Messages
  getMessagesFor(to: string): SecretMessage[];          // all messages for recipient
  getUnreadFor(to: string): SecretMessage[];             // unread (inbox) messages
  createMessage(data: InsertSecretMessage): SecretMessage;
  markRead(id: number): SecretMessage | undefined;       // sets readAt = now
  deleteMessage(id: number): void;

  // Daily Mood
  getMood(owner: string, date: string): DailyMood | undefined;
  getMoodHistory(owner: string, limit?: number): DailyMood[];
  upsertMood(owner: string, date: string, mood: string, note?: string): DailyMood;

  // Grocery
  getGroceryLists(includeTemplates?: boolean): GroceryList[];
  getGroceryList(id: number): GroceryList | undefined;
  createGroceryList(data: Omit<InsertGroceryList, 'created_at'>): GroceryList;
  updateGroceryList(id: number, data: Partial<InsertGroceryList>): GroceryList | undefined;
  deleteGroceryList(id: number): void;
  getGroceryItems(listId: number): GroceryItem[];
  createGroceryItem(data: InsertGroceryItem): GroceryItem;
  updateGroceryItem(id: number, data: Partial<InsertGroceryItem>): GroceryItem | undefined;
  deleteGroceryItem(id: number): void;
  cloneListFromTemplate(templateId: number, date: string, name: string, createdBy: string): GroceryList;
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

  // ── Link Lists ───────────────────────────────────────────────────────────
  getAllLinkLists() {
    return db.select().from(linkLists).orderBy(desc(linkLists.createdAt)).all();
  }
  getLinkListById(id: number) {
    return db.select().from(linkLists).where(eq(linkLists.id, id)).get();
  }
  createLinkList(data: InsertLinkList) {
    return db.insert(linkLists).values({ ...data, createdAt: Date.now() }).returning().get();
  }
  updateLinkList(id: number, data: Partial<InsertLinkList>) {
    return db.update(linkLists).set(data).where(eq(linkLists.id, id)).returning().get();
  }
  deleteLinkList(id: number) {
    // cascade-delete links in this list first
    db.delete(links).where(eq(links.listId, id)).run();
    db.delete(linkLists).where(eq(linkLists.id, id)).run();
  }

  // ── Links ──────────────────────────────────────────────────────────────────
  getLinksByList(listId: number) {
    return db.select().from(links).where(eq(links.listId, listId)).orderBy(desc(links.createdAt)).all();
  }
  getLinkById(id: number) {
    return db.select().from(links).where(eq(links.id, id)).get();
  }
  createLink(data: InsertLink) {
    return db.insert(links).values({ ...data, createdAt: Date.now() }).returning().get();
  }
  updateLink(id: number, data: Partial<InsertLink>) {
    return db.update(links).set(data).where(eq(links.id, id)).returning().get();
  }
  deleteLink(id: number) {
    db.delete(links).where(eq(links.id, id)).run();
  }

  // ── Quotes ─────────────────────────────────────────────────────────────
  getQuotesByOwner(owner: string) {
    return db.select().from(quotes)
      .where(eq(quotes.owner, owner))
      .orderBy(desc(quotes.createdAt))
      .all();
  }
  createQuote(data: InsertQuote) {
    return db.insert(quotes)
      .values({ ...data, createdAt: Date.now() })
      .returning().get();
  }
  updateQuote(id: number, data: Partial<InsertQuote> & { isFeatured?: number; featuredPos?: number | null }) {
    return db.update(quotes)
      .set(data)
      .where(eq(quotes.id, id))
      .returning().get();
  }
  /**
   * Toggle featured status on a quote.
   * - If marking featured: assign the next available slot (1-5). If all 5 slots taken, returns null.
   * - If un-featuring: clear isFeatured + featuredPos.
   * - Returns the updated quote, or null if no slot available.
   */
  setQuoteFeatured(id: number, featured: boolean): Quote | null {
    if (!featured) {
      return db.update(quotes)
        .set({ isFeatured: 0, featuredPos: null })
        .where(eq(quotes.id, id))
        .returning().get() ?? null;
    }
    // Find which owner this quote belongs to
    const q = db.select().from(quotes).where(eq(quotes.id, id)).get();
    if (!q) return null;
    // Get current featured positions for this owner
    const featured_rows = db.select().from(quotes)
      .where(eq(quotes.owner, q.owner))
      .all()
      .filter(r => r.isFeatured === 1)
      .sort((a, b) => (a.featuredPos ?? 99) - (b.featuredPos ?? 99));
    if (featured_rows.length >= 5) return null; // slots full
    const usedSlots = new Set(featured_rows.map(r => r.featuredPos));
    let slot = 1;
    while (usedSlots.has(slot) && slot <= 5) slot++;
    return db.update(quotes)
      .set({ isFeatured: 1, featuredPos: slot })
      .where(eq(quotes.id, id))
      .returning().get() ?? null;
  }
  /** Reorder featured quotes for an owner — accepts array of ids in desired order */
  reorderFeatured(owner: string, orderedIds: number[]): void {
    orderedIds.forEach((id, index) => {
      db.update(quotes)
        .set({ featuredPos: index + 1 })
        .where(eq(quotes.id, id))
        .run();
    });
  }
  deleteQuote(id: number) {
    db.delete(quotes).where(eq(quotes.id, id)).run();
  }

  // ── Restaurants ──────────────────────────────────────────────────
  getAllRestaurants() {
    return db.select().from(restaurants).orderBy(desc(restaurants.createdAt)).all();
  }
  getRestaurantById(id: number) {
    return db.select().from(restaurants).where(eq(restaurants.id, id)).get();
  }
  createRestaurant(data: InsertRestaurant) {
    return db.insert(restaurants).values({ ...data, createdAt: Date.now() }).returning().get();
  }
  updateRestaurant(id: number, data: Partial<InsertRestaurant>) {
    return db.update(restaurants).set(data).where(eq(restaurants.id, id)).returning().get();
  }
  deleteRestaurant(id: number) {
    db.delete(restaurants).where(eq(restaurants.id, id)).run();
  }

  // ── Secret Messages ───────────────────────────────────────────────────────
  getMessagesFor(to: string) {
    return db.select().from(secretMessages)
      .where(eq(secretMessages.to, to))
      .orderBy(desc(secretMessages.createdAt))
      .all();
  }
  getUnreadFor(to: string) {
    return db.select().from(secretMessages)
      .where(and(eq(secretMessages.to, to)))
      .orderBy(desc(secretMessages.createdAt))
      .all()
      .filter(m => m.readAt === null || m.readAt === undefined);
  }
  createMessage(data: InsertSecretMessage) {
    return db.insert(secretMessages)
      .values({ ...data, createdAt: Date.now() })
      .returning().get();
  }
  markRead(id: number) {
    return db.update(secretMessages)
      .set({ readAt: Date.now() })
      .where(eq(secretMessages.id, id))
      .returning().get();
  }
  deleteMessage(id: number) {
    db.delete(secretMessages).where(eq(secretMessages.id, id)).run();
  }

  // ── Daily Mood ────────────────────────────────────────────────────────
  getMood(owner: string, date: string) {
    return db.select().from(dailyMoods)
      .where(and(eq(dailyMoods.owner, owner), eq(dailyMoods.date, date)))
      .get();
  }
  getMoodHistory(owner: string, limit = 30) {
    return db.select().from(dailyMoods)
      .where(eq(dailyMoods.owner, owner))
      .orderBy(desc(dailyMoods.date))
      .all()
      .slice(0, limit);
  }
  upsertMood(owner: string, date: string, mood: string, note?: string) {
    const existing = this.getMood(owner, date);
    if (existing) {
      return db.update(dailyMoods)
        .set({ mood, note: note ?? existing.note })
        .where(eq(dailyMoods.id, existing.id))
        .returning().get()!;
    }
    return db.insert(dailyMoods)
      .values({ owner, date, mood, note: note ?? null, createdAt: Date.now() })
      .returning().get()!;
  }

  // ── Grocery Lists ──────────────────────────────────────────────────────
  getGroceryLists(includeTemplates = true) {
    return db.select().from(groceryLists)
      .orderBy(desc(groceryLists.date))
      .all()
      .filter(l => includeTemplates ? true : !l.is_template);
  }
  getGroceryList(id: number) {
    return db.select().from(groceryLists).where(eq(groceryLists.id, id)).get();
  }
  createGroceryList(data: Omit<InsertGroceryList, 'created_at'>) {
    return db.insert(groceryLists)
      .values({ ...data, is_completed: 0, created_at: new Date().toISOString() })
      .returning().get()!;
  }
  updateGroceryList(id: number, data: Partial<InsertGroceryList>) {
    return db.update(groceryLists).set(data).where(eq(groceryLists.id, id)).returning().get();
  }
  deleteGroceryList(id: number) {
    db.delete(groceryItems).where(eq(groceryItems.list_id, id)).run();
    db.delete(groceryLists).where(eq(groceryLists.id, id)).run();
  }

  // ── Grocery Items ──────────────────────────────────────────────────────
  getGroceryItems(listId: number) {
    return db.select().from(groceryItems)
      .where(eq(groceryItems.list_id, listId))
      .orderBy(groceryItems.sort_order)
      .all();
  }
  createGroceryItem(data: InsertGroceryItem) {
    return db.insert(groceryItems).values(data).returning().get()!;
  }
  updateGroceryItem(id: number, data: Partial<InsertGroceryItem>) {
    return db.update(groceryItems).set(data).where(eq(groceryItems.id, id)).returning().get();
  }
  deleteGroceryItem(id: number) {
    db.delete(groceryItems).where(eq(groceryItems.id, id)).run();
  }
  cloneListFromTemplate(templateId: number, date: string, name: string, createdBy: string) {
    const tmpl = this.getGroceryList(templateId);
    if (!tmpl) throw new Error("Template not found");
    const newList = this.createGroceryList({ name, date, is_template: 0, is_completed: 0, created_by: createdBy });
    const items = this.getGroceryItems(templateId);
    items.forEach((item, idx) => {
      this.createGroceryItem({
        list_id: newList.id,
        name: item.name,
        location: item.location ?? null,
        price: item.price ?? null,
        checked: 0,
        sort_order: idx,
      });
    });
    return newList;
  }

  // ── Events ───────────────────────────────────────────────────────────────
  getEvents() {
    return db.select().from(events).orderBy(events.date).all();
  }
  getEvent(id: number) {
    return db.select().from(events).where(eq(events.id, id)).get();
  }
  createEvent(data: Omit<InsertEvent, 'created_at'>) {
    return db.insert(events)
      .values({ ...data, created_at: new Date().toISOString() })
      .returning().get()!;
  }
  updateEvent(id: number, data: Partial<InsertEvent>) {
    return db.update(events).set(data).where(eq(events.id, id)).returning().get();
  }
  deleteEvent(id: number) {
    db.delete(events).where(eq(events.id, id)).run();
  }
}

export const storage = new Storage();