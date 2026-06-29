/**
 * Import / Export utilities for Framestack.
 *
 * Export format (JSON):
 *   { version: 1, exportedAt: ISO, items: [...], collections: [...], colItems: {...} }
 *
 * The same file can be re-imported to fully restore the library on any device.
 */

import { localStore } from "./localStore";
import type { Item, Collection } from "@shared/schema";

// ── Export ────────────────────────────────────────────────────────────────────

/** Triggers a browser download of the full library as a JSON file. */
export function exportLibraryJSON(): void {
  const data = localStore.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  triggerDownload(blob, `framestack-backup-${datestamp()}.json`);
}

/** Triggers a browser download of the library items as a CSV file. */
export function exportLibraryCSV(): void {
  const items = localStore.getItems();
  if (items.length === 0) return;

  const headers: (keyof Item)[] = [
    "id", "title", "mediaType", "status", "year", "rating", "studio", "author",
    "episodes", "externalId", "externalSource", "notes",
  ];
  const rows = items.map(item =>
    headers.map(h => {
      const v = item[h];
      if (v == null) return "";
      const str = String(v);
      // Escape commas and quotes
      return str.includes(",") || str.includes("\"") || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `framestack-library-${datestamp()}.csv`);
}

/** Triggers a browser download of all collections (with their items) as JSON. */
export function exportCollectionsJSON(): void {
  const collections = localStore.getCollections();
  const colItems = collections.map(c => ({
    ...c,
    items: localStore.getCollectionItems(c.id),
  }));
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), collections: colItems }, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, `framestack-collections-${datestamp()}.json`);
}

// ── Import ────────────────────────────────────────────────────────────────────

export type ImportResult =
  | { ok: true; itemCount: number; collectionCount: number }
  | { ok: false; error: string };

/**
 * Reads a File, validates it, and merges or replaces the store.
 * `mode`:
 *   "replace" — wipes current data and loads the backup (full restore)
 *   "merge"   — adds items/collections not already present (by id)
 */
export async function importFromFile(
  file: File,
  mode: "replace" | "merge" = "replace"
): Promise<ImportResult> {
  let raw: string;
  try {
    raw = await readFileText(file);
  } catch {
    return { ok: false, error: "Could not read file." };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid JSON file." };
  }

  // Support both full backup format and collections-only export
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Unrecognised file format." };
  }

  if (parsed.version !== 1) {
    return { ok: false, error: `Unsupported version: ${parsed.version}` };
  }

  const items: Item[] = Array.isArray(parsed.items) ? parsed.items : [];
  const collections: Collection[] = Array.isArray(parsed.collections) ? parsed.collections : [];
  // colItems may come as the raw map or as embedded items arrays (collections-only export)
  let colItems: Record<number, number[]> = {};
  if (parsed.colItems && typeof parsed.colItems === "object") {
    colItems = parsed.colItems;
  } else if (Array.isArray(parsed.collections) && parsed.collections[0]?.items) {
    // collections-only export: rebuild colItems from embedded items arrays
    parsed.collections.forEach((c: any) => {
      if (Array.isArray(c.items)) {
        colItems[c.id] = c.items.map((i: any) => i.id);
      }
    });
  }

  if (mode === "replace") {
    localStore.importAll({ version: 1, exportedAt: "", items, collections, colItems, _nextItemId: parsed._nextItemId, _nextColId: parsed._nextColId });
  } else {
    // Merge: add only items/collections not already in store (by id)
    const existingItems = localStore.getItems();
    const existingIds = new Set(existingItems.map(i => i.id));
    const newItems = items.filter(i => !existingIds.has(i.id));
    newItems.forEach(i => {
      // Use replaceItems approach: push manually to avoid ID counter collision
      existingItems.push(i);
    });
    localStore.replaceItems(existingItems);

    const existingCols = localStore.getCollections();
    const existingColIds = new Set(existingCols.map(c => c.id));
    const newCols = collections.filter(c => !existingColIds.has(c.id));
    newCols.forEach(c => existingCols.push(c));
    localStore.replaceCollections(existingCols);

    // Merge colItems
    Object.entries(colItems).forEach(([colId, itemIds]) => {
      (itemIds as number[]).forEach(itemId => localStore.addItemToCollection(Number(colId), itemId));
    });
  }

  return { ok: true, itemCount: items.length, collectionCount: collections.length };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function datestamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
