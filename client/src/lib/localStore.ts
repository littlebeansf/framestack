// Persistent item store with try/catch localStorage wrapper.
// On GitHub Pages: localStorage is available → data survives page refresh.
// In Perplexity sandboxed iframe: localStorage is blocked → silently falls back to in-memory.

import type { Item, Collection } from "@shared/schema";

const LS_ITEMS_KEY = "framestack_items";
const LS_COLLECTIONS_KEY = "framestack_collections";
const LS_NEXT_ITEM_ID_KEY = "framestack_next_item_id";
const LS_NEXT_COL_ID_KEY = "framestack_next_col_id";

// ── Persistence helpers ──────────────────────────────────────────────────────

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Blocked in sandboxed iframes — silent fallback to in-memory only
  }
}

// ── Initialise state from localStorage (or start fresh) ──────────────────────

let _items: Item[] = lsGet<Item[]>(LS_ITEMS_KEY, []);
let _collections: Collection[] = lsGet<Collection[]>(LS_COLLECTIONS_KEY, []);
let _nextItemId = lsGet<number>(LS_NEXT_ITEM_ID_KEY, 1_000_000);
let _nextColId = lsGet<number>(LS_NEXT_COL_ID_KEY, 1_000_000);

function saveItems() { lsSet(LS_ITEMS_KEY, _items); lsSet(LS_NEXT_ITEM_ID_KEY, _nextItemId); }
function saveCols() { lsSet(LS_COLLECTIONS_KEY, _collections); lsSet(LS_NEXT_COL_ID_KEY, _nextColId); }

// ── Store API ────────────────────────────────────────────────────────────────

export const localStore = {
  // ── Items ──────────────────────────────────────────────────────────────────
  getItems(): Item[] { return [..._items]; },

  addItem(data: Omit<Item, "id">): Item {
    const item: Item = { id: _nextItemId++, ...data } as Item;
    _items.push(item);
    saveItems();
    return item;
  },

  updateItem(id: number, data: Partial<Item>): Item | undefined {
    const idx = _items.findIndex(i => i.id === id);
    if (idx === -1) return undefined;
    _items[idx] = { ..._items[idx], ...data };
    saveItems();
    return _items[idx];
  },

  deleteItem(id: number): void {
    _items = _items.filter(i => i.id !== id);
    saveItems();
  },

  replaceItems(items: Item[]): void {
    _items = [...items];
    saveItems();
  },

  // ── Collections ────────────────────────────────────────────────────────────
  getCollections(): Collection[] { return [..._collections]; },

  addCollection(data: Omit<Collection, "id">): Collection {
    const col: Collection = { id: _nextColId++, ...data } as Collection;
    _collections.push(col);
    saveCols();
    return col;
  },

  updateCollection(id: number, data: Partial<Collection>): Collection | undefined {
    const idx = _collections.findIndex(c => c.id === id);
    if (idx === -1) return undefined;
    _collections[idx] = { ..._collections[idx], ...data };
    saveCols();
    return _collections[idx];
  },

  deleteCollection(id: number): void {
    _collections = _collections.filter(c => c.id !== id);
    saveCols();
  },

  replaceCollections(cols: Collection[]): void {
    _collections = [...cols];
    saveCols();
  },

  // ── Utility: check if item exists by externalId ───────────────────────────
  hasExternalId(externalId: string, externalSource: string): boolean {
    return _items.some(i => i.externalId === externalId && i.externalSource === externalSource);
  },
};
