// In-memory item store — used as a fallback when the backend is unavailable.
// Data lives only for the current browser session (no localStorage — blocked in iframe).
// When the backend IS available, all mutations go through /api/items and this store
// is kept in sync so the UI never breaks.

import type { Item, Collection } from "@shared/schema";

let _items: Item[] = [];
let _collections: Collection[] = [];
let _nextItemId = 1000000; // high to avoid collision with backend IDs
let _nextColId = 1000000;

export const localStore = {
  // Items
  getItems(): Item[] { return [..._items]; },
  addItem(data: Omit<Item, "id">): Item {
    const item: Item = { id: _nextItemId++, ...data } as Item;
    _items.push(item);
    return item;
  },
  updateItem(id: number, data: Partial<Item>): Item | undefined {
    const idx = _items.findIndex(i => i.id === id);
    if (idx === -1) return undefined;
    _items[idx] = { ..._items[idx], ...data };
    return _items[idx];
  },
  deleteItem(id: number) {
    _items = _items.filter(i => i.id !== id);
  },
  replaceItems(items: Item[]) { _items = [...items]; },

  // Collections
  getCollections(): Collection[] { return [..._collections]; },
  addCollection(data: Omit<Collection, "id">): Collection {
    const col: Collection = { id: _nextColId++, ...data } as Collection;
    _collections.push(col);
    return col;
  },
  updateCollection(id: number, data: Partial<Collection>): Collection | undefined {
    const idx = _collections.findIndex(c => c.id === id);
    if (idx === -1) return undefined;
    _collections[idx] = { ..._collections[idx], ...data };
    return _collections[idx];
  },
  deleteCollection(id: number) {
    _collections = _collections.filter(c => c.id !== id);
  },
  replaceCollections(cols: Collection[]) { _collections = [...cols]; },
};
