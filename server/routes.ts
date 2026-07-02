import type { Express } from "express";
import { Server } from "http";
import { storage } from "./storage";
import fetch from "node-fetch";

const USER_ID = 1;

export async function registerRoutes(httpServer: Server, app: Express) {
  // Ensure the single user exists on startup
  if (!storage.getUserById(USER_ID)) {
    storage.createUser({ username: "me", email: "me@framestack.local", password: "", displayName: "Me" });
  }

  // ─── Profiles ──────────────────────────────────────────────────────────────

  app.get("/api/profiles/:owner", (req, res) => {
    const profile = storage.getProfile(req.params.owner);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  });

  app.patch("/api/profiles/:owner", (req, res) => {
    try {
      const updated = storage.updateProfile(req.params.owner, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Items (shared library) ────────────────────────────────────────────────

  app.get("/api/items", (req, res) => {
    res.json(storage.getAllItems());
  });

  app.post("/api/items", (req, res) => {
    try {
      const item = storage.createItem({ ...req.body, userId: USER_ID });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/items/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!storage.getItemById(id)) return res.status(404).json({ error: "Not found" });
      res.json(storage.updateItem(id, req.body));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/items/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!storage.getItemById(id)) return res.status(404).json({ error: "Not found" });
      storage.deleteItem(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/items/:id/collections", (req, res) => {
    res.json(storage.getCollectionsForItem(parseInt(req.params.id)));
  });

  // Get all collection-items for a specific item (with status info)
  app.get("/api/items/:id/collection-items", (req, res) => {
    res.json(storage.getCollectionItemsForItem(parseInt(req.params.id)));
  });

  // ─── Collections (owner-scoped) ────────────────────────────────────────────

  // Get all collections (optionally filtered by owner)
  app.get("/api/collections", (req, res) => {
    const { owner } = req.query;
    if (owner && typeof owner === "string") {
      res.json(storage.getCollectionsByOwner(owner));
    } else {
      res.json(storage.getAllCollections());
    }
  });

  app.post("/api/collections", (req, res) => {
    try {
      const col = storage.createCollection({ ...req.body, userId: USER_ID });
      res.json(col);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/collections/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!storage.getCollectionById(id)) return res.status(404).json({ error: "Not found" });
      res.json(storage.updateCollection(id, req.body));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/collections/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const col = storage.getCollectionById(id);
      if (!col) return res.status(404).json({ error: "Not found" });
      // Prevent deleting default/system collections
      if (col.isDefault) return res.status(403).json({ error: "Cannot delete a default collection" });
      storage.deleteCollection(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get items in collection (returns ItemWithStatus — includes collectionStatus field)
  app.get("/api/collections/:id/items", (req, res) => {
    res.json(storage.getItemsInCollection(parseInt(req.params.id)));
  });

  app.post("/api/collections/:id/items", (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const { itemId, status } = req.body;
      res.json(storage.addItemToCollection({ collectionId, itemId, status: status ?? null }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/collections/:id/items/:itemId", (req, res) => {
    try {
      storage.removeItemFromCollection(parseInt(req.params.id), parseInt(req.params.itemId));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update the status of an item within a specific collection
  app.patch("/api/collections/:id/items/:itemId/status", (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      const { status } = req.body;
      const updated = storage.updateCollectionItemStatus(collectionId, itemId, status);
      if (!updated) return res.status(404).json({ error: "Collection-item not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Bulk import ───────────────────────────────────────────────────────────

  app.post("/api/import", (req, res) => {
    try {
      const { items: importItems = [], collections: importCollections = [], colItems = {} } = req.body;
      const itemIdMap: Record<number, number> = {};
      const colIdMap: Record<number, number> = {};

      for (const item of importItems) {
        const { id: oldId, userId: _u, ...rest } = item;
        itemIdMap[oldId] = storage.createItem({ ...rest, userId: USER_ID }).id;
      }
      for (const col of importCollections) {
        const { id: oldId, userId: _u, ...rest } = col;
        // Skip default collections during import (they're seeded automatically)
        if (rest.isDefault) continue;
        colIdMap[oldId] = storage.createCollection({ ...rest, userId: USER_ID }).id;
      }
      for (const [oldColId, oldItemIds] of Object.entries(colItems)) {
        const newColId = colIdMap[Number(oldColId)];
        if (!newColId) continue;
        for (const entry of oldItemIds as any[]) {
          const oldItemId = typeof entry === "number" ? entry : entry.itemId;
          const newItemId = itemIdMap[oldItemId];
          const status = typeof entry === "object" ? entry.status : null;
          if (newItemId) {
            try { storage.addItemToCollection({ collectionId: newColId, itemId: newItemId, status: status ?? null }); } catch {}
          }
        }
      }
      res.json({ ok: true, itemIdMap, colIdMap });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Search ────────────────────────────────────────────────────────────────

  app.get("/api/search/anime", async (req, res) => {
    try {
      const { q } = req.query;
      await new Promise(r => setTimeout(r, 350));
      const r = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(String(q))}&limit=10&sfw=true`);
      if (!r.ok) return res.json([]);
      const data = await r.json() as any;
      res.json((data.data || []).map((a: any) => ({
        externalId: String(a.mal_id), externalSource: "jikan",
        title: a.title_english || a.title,
        coverUrl: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url,
        year: a.year ? String(a.year) : a.aired?.from?.split("-")[0],
        mediaType: "anime", episodes: a.episodes,
        genres: JSON.stringify((a.genres || []).map((g: any) => g.name)),
        studio: (a.studios || [])[0]?.name,
      })));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/search/manga", async (req, res) => {
    try {
      const { q } = req.query;
      await new Promise(r => setTimeout(r, 350));
      const r = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(String(q))}&limit=10&sfw=true`);
      if (!r.ok) return res.json([]);
      const data = await r.json() as any;
      res.json((data.data || []).map((m: any) => ({
        externalId: String(m.mal_id), externalSource: "jikan",
        title: m.title_english || m.title,
        coverUrl: m.images?.jpg?.large_image_url || m.images?.jpg?.image_url,
        year: m.published?.from?.split("-")[0],
        mediaType: "manga",
        genres: JSON.stringify((m.genres || []).map((g: any) => g.name)),
        author: (m.authors || [])[0]?.name,
      })));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/search/movie", async (req, res) => {
    try {
      const { q } = req.query;
      const r = await fetch(`https://imdb.iamidiotareyoutoo.com/search?q=${encodeURIComponent(String(q))}`, { signal: AbortSignal.timeout(8000) as any });
      if (!r.ok) return res.json([]);
      const data = await r.json() as any;
      if (!data.ok || !Array.isArray(data.description)) return res.json([]);
      res.json(data.description.slice(0, 12).map((m: any) => ({
        externalId: m["#IMDB_ID"], externalSource: "imdb",
        title: m["#TITLE"], coverUrl: m["#IMG_POSTER"] || null,
        year: m["#YEAR"] ? String(m["#YEAR"]) : null, mediaType: "movie",
        studio: m["#ACTORS"] ? m["#ACTORS"].split(", ").slice(0, 2).join(", ") : null,
      })));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/search/series", async (req, res) => {
    try {
      const { q } = req.query;
      const r = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(String(q))}`);
      if (!r.ok) return res.json([]);
      const data = await r.json() as any[];
      res.json(data.slice(0, 12).map(({ show }: any) => ({
        externalId: String(show.id), externalSource: "tvmaze",
        title: show.name, coverUrl: show.image?.medium || null,
        year: show.premiered?.slice(0, 4) || null, mediaType: "series",
        genres: show.genres?.length ? JSON.stringify(show.genres) : null,
        studio: show.network?.name || show.webChannel?.name || null,
        episodes: show.runtime ?? null,
      })));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/search/book", async (req, res) => {
    try {
      const { q } = req.query;
      const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(String(q))}&limit=10&fields=key,title,author_name,first_publish_year,cover_i,subject`);
      if (!r.ok) return res.json([]);
      const data = await r.json() as any;
      res.json((data.docs || []).slice(0, 10).map((b: any) => ({
        externalId: b.key, externalSource: "openlibrary",
        title: b.title, coverUrl: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : null,
        year: b.first_publish_year ? String(b.first_publish_year) : null, mediaType: "book",
        author: (b.author_name || []).slice(0, 2).join(", "),
        genres: JSON.stringify((b.subject || []).slice(0, 5)),
      })));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Link Lists ─────────────────────────────────────────────────────────────────

  app.get("/api/link-lists", (_req, res) => {
    res.json(storage.getAllLinkLists());
  });

  app.post("/api/link-lists", (req, res) => {
    try {
      const { name, emoji } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: "name required" });
      res.json(storage.createLinkList({ name: name.trim(), emoji: emoji ?? null, createdAt: Date.now() }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/link-lists/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!storage.getLinkListById(id)) return res.status(404).json({ error: "Not found" });
      res.json(storage.updateLinkList(id, req.body));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/link-lists/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!storage.getLinkListById(id)) return res.status(404).json({ error: "Not found" });
      storage.deleteLinkList(id); // cascades links
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Links (scoped to a list) ──────────────────────────────────────────────────

  app.get("/api/link-lists/:listId/links", (req, res) => {
    res.json(storage.getLinksByList(parseInt(req.params.listId)));
  });

  app.post("/api/link-lists/:listId/links", (req, res) => {
    try {
      const listId = parseInt(req.params.listId);
      if (!storage.getLinkListById(listId)) return res.status(404).json({ error: "List not found" });
      const { url, title, description, addedBy } = req.body;
      if (!url?.trim() || !title?.trim()) return res.status(400).json({ error: "url and title required" });
      let favicon: string | null = null;
      try { favicon = `${new URL(url).origin}/favicon.ico`; } catch {}
      res.json(storage.createLink({ listId, url: url.trim(), title: title.trim(), description: description?.trim() ?? null, favicon, addedBy: addedBy ?? null, createdAt: Date.now() }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/links/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!storage.getLinkById(id)) return res.status(404).json({ error: "Not found" });
      res.json(storage.updateLink(id, req.body));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/links/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!storage.getLinkById(id)) return res.status(404).json({ error: "Not found" });
      storage.deleteLink(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // books alias
  app.get("/api/search/books", async (req, res) => {
    req.url = req.url.replace("/books", "/book");
    app._router.handle(req, res, () => {});
  });
}
