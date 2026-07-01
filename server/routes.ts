import type { Express } from "express";
import { Server } from "http";
import { storage } from "./storage";
import fetch from "node-fetch";

// Single-user mode — no auth. All data belongs to userId 1.
const USER_ID = 1;

export async function registerRoutes(httpServer: Server, app: Express) {
  // Ensure the single user exists on startup
  if (!storage.getUserById(USER_ID)) {
    storage.createUser({
      username: "me",
      email: "me@framestack.local",
      password: "",
      displayName: "Me",
    });
  }

  // ─── Items ─────────────────────────────────────────────────────────────────

  app.get("/api/items", (req, res) => {
    res.json(storage.getItemsByUser(USER_ID));
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
      const item = storage.getItemById(id);
      if (!item) return res.status(404).json({ error: "Item not found" });
      const updated = storage.updateItem(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/items/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = storage.getItemById(id);
      if (!item) return res.status(404).json({ error: "Item not found" });
      storage.deleteItem(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/items/:id/collections", (req, res) => {
    const id = parseInt(req.params.id);
    res.json(storage.getCollectionsForItem(id));
  });

  // ─── Collections ───────────────────────────────────────────────────────────

  app.get("/api/collections", (req, res) => {
    res.json(storage.getCollectionsByUser(USER_ID));
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
      const col = storage.getCollectionById(id);
      if (!col) return res.status(404).json({ error: "Collection not found" });
      const updated = storage.updateCollection(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/collections/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const col = storage.getCollectionById(id);
      if (!col) return res.status(404).json({ error: "Collection not found" });
      storage.deleteCollection(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/collections/:id/items", (req, res) => {
    const id = parseInt(req.params.id);
    res.json(storage.getItemsInCollection(id));
  });

  app.post("/api/collections/:id/items", (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const { itemId } = req.body;
      const result = storage.addItemToCollection({ collectionId, itemId });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/collections/:id/items/:itemId", (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      storage.removeItemFromCollection(collectionId, itemId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Bulk import (localStorage → backend migration) ───────────────────────
  // Called once on first load when backend is empty but localStorage has data.
  app.post("/api/import", (req, res) => {
    try {
      const { items: importItems = [], collections: importCollections = [], colItems = {} } = req.body;

      const itemIdMap: Record<number, number> = {};
      const colIdMap: Record<number, number> = {};

      for (const item of importItems) {
        const { id: oldId, userId: _u, ...rest } = item;
        const created = storage.createItem({ ...rest, userId: USER_ID });
        itemIdMap[oldId] = created.id;
      }

      for (const col of importCollections) {
        const { id: oldId, userId: _u, ...rest } = col;
        const created = storage.createCollection({ ...rest, userId: USER_ID });
        colIdMap[oldId] = created.id;
      }

      for (const [oldColId, oldItemIds] of Object.entries(colItems)) {
        const newColId = colIdMap[Number(oldColId)];
        if (!newColId) continue;
        for (const oldItemId of oldItemIds as number[]) {
          const newItemId = itemIdMap[oldItemId];
          if (!newItemId) continue;
          try {
            storage.addItemToCollection({ collectionId: newColId, itemId: newItemId });
          } catch { /* skip duplicates */ }
        }
      }

      res.json({ ok: true, itemIdMap, colIdMap });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── External Search ───────────────────────────────────────────────────────

  app.get("/api/search/anime", async (req, res) => {
    try {
      const { q } = req.query;
      const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(String(q))}&limit=10`;
      const r = await (fetch as any)(url);
      const data = await r.json() as any;
      const results = (data.data || []).map((a: any) => ({
        externalId: String(a.mal_id),
        externalSource: "jikan",
        title: a.title_english || a.title,
        coverUrl: a.images?.jpg?.image_url,
        year: a.year ? String(a.year) : a.aired?.from?.split("-")[0],
        mediaType: "anime",
        episodes: a.episodes,
        genres: JSON.stringify((a.genres || []).map((g: any) => g.name)),
        studio: (a.studios || [])[0]?.name,
      }));
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/search/manga", async (req, res) => {
    try {
      const { q } = req.query;
      const url = `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(String(q))}&limit=10`;
      const r = await (fetch as any)(url);
      const data = await r.json() as any;
      const results = (data.data || []).map((m: any) => ({
        externalId: String(m.mal_id),
        externalSource: "jikan",
        title: m.title_english || m.title,
        coverUrl: m.images?.jpg?.image_url,
        year: m.published?.from?.split("-")[0],
        mediaType: "manga",
        genres: JSON.stringify((m.genres || []).map((g: any) => g.name)),
        author: (m.authors || [])[0]?.name,
      }));
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/search/omdb", async (req, res) => {
    try {
      const { q, type } = req.query;
      const apiKey = "2b7a22dd";
      const url = `https://www.omdbapi.com/?s=${encodeURIComponent(String(q))}&type=${type || ""}&apikey=${apiKey}`;
      const r = await (fetch as any)(url);
      const data = await r.json() as any;
      if (data.Error) return res.json([]);
      const results = (data.Search || []).map((m: any) => ({
        externalId: m.imdbID,
        externalSource: "omdb",
        title: m.Title,
        coverUrl: m.Poster !== "N/A" ? m.Poster : null,
        year: m.Year,
        mediaType: m.Type === "series" ? "series" : "movie",
      }));
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/search/books", async (req, res) => {
    try {
      const { q } = req.query;
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(String(q))}&limit=10&fields=key,title,author_name,first_publish_year,cover_i,subject`;
      const r = await (fetch as any)(url);
      const data = await r.json() as any;
      const results = (data.docs || []).slice(0, 10).map((b: any) => ({
        externalId: b.key,
        externalSource: "openlibrary",
        title: b.title,
        coverUrl: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : null,
        year: b.first_publish_year ? String(b.first_publish_year) : null,
        mediaType: "book",
        author: (b.author_name || []).slice(0, 2).join(", "),
        genres: JSON.stringify((b.subject || []).slice(0, 5)),
      }));
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Unified search ────────────────────────────────────────────────────────
  app.get("/api/search", async (req, res) => {
    try {
      const { q, type } = req.query;
      if (!q) return res.json([]);

      const promises: Promise<any>[] = [];

      if (!type || type === "anime") {
        promises.push(
          (fetch as any)(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(String(q))}&limit=5`)
            .then((r: any) => r.json())
            .then((data: any) => (data.data || []).map((a: any) => ({
              externalId: String(a.mal_id),
              externalSource: "jikan",
              title: a.title_english || a.title,
              coverUrl: a.images?.jpg?.image_url,
              year: a.year ? String(a.year) : a.aired?.from?.split("-")[0],
              mediaType: "anime",
              episodes: a.episodes,
              genres: JSON.stringify((a.genres || []).map((g: any) => g.name)),
              studio: (a.studios || [])[0]?.name,
            })))
            .catch(() => [])
        );
      }

      if (!type || type === "manga") {
        promises.push(
          (fetch as any)(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(String(q))}&limit=5`)
            .then((r: any) => r.json())
            .then((data: any) => (data.data || []).map((m: any) => ({
              externalId: String(m.mal_id),
              externalSource: "jikan",
              title: m.title_english || m.title,
              coverUrl: m.images?.jpg?.image_url,
              year: m.published?.from?.split("-")[0],
              mediaType: "manga",
              genres: JSON.stringify((m.genres || []).map((g: any) => g.name)),
              author: (m.authors || [])[0]?.name,
            })))
            .catch(() => [])
        );
      }

      if (!type || type === "movie" || type === "series") {
        const apiKey = "2b7a22dd";
        const omdbType = type === "movie" ? "movie" : type === "series" ? "series" : "";
        promises.push(
          (fetch as any)(`https://www.omdbapi.com/?s=${encodeURIComponent(String(q))}&type=${omdbType}&apikey=${apiKey}`)
            .then((r: any) => r.json())
            .then((data: any) => {
              if (data.Error) return [];
              return (data.Search || []).map((m: any) => ({
                externalId: m.imdbID,
                externalSource: "omdb",
                title: m.Title,
                coverUrl: m.Poster !== "N/A" ? m.Poster : null,
                year: m.Year,
                mediaType: m.Type === "series" ? "series" : "movie",
              }));
            })
            .catch(() => [])
        );
      }

      if (!type || type === "book") {
        promises.push(
          (fetch as any)(`https://openlibrary.org/search.json?q=${encodeURIComponent(String(q))}&limit=5&fields=key,title,author_name,first_publish_year,cover_i,subject`)
            .then((r: any) => r.json())
            .then((data: any) => (data.docs || []).slice(0, 5).map((b: any) => ({
              externalId: b.key,
              externalSource: "openlibrary",
              title: b.title,
              coverUrl: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : null,
              year: b.first_publish_year ? String(b.first_publish_year) : null,
              mediaType: "book",
              author: (b.author_name || []).slice(0, 2).join(", "),
              genres: JSON.stringify((b.subject || []).slice(0, 5)),
            })))
            .catch(() => [])
        );
      }

      const allResults = await Promise.all(promises);
      res.json(allResults.flat());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
