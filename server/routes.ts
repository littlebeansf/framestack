import type { Express } from "express";
import { Server } from "http";
import { storage } from "./storage";
import { insertTodoListSchema, insertTodoItemSchema } from "@shared/schema";
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
      const gql = `query($q:String){Page(perPage:12){media(search:$q,type:ANIME,sort:SEARCH_MATCH){id title{english romaji}coverImage{large}startDate{year}episodes genres studios(isMain:true){nodes{name}}}}}`;
      const r = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: gql, variables: { q: String(q) } }),
        signal: AbortSignal.timeout(8000) as any,
      });
      if (!r.ok) return res.status(502).json({ error: "upstream_error" });
      const data = await r.json() as any;
      const media = data?.data?.Page?.media;
      if (!media) return res.status(502).json({ error: "no_data" });
      res.json(media.map((a: any) => ({
        externalId: String(a.id), externalSource: "anilist",
        title: a.title?.english || a.title?.romaji,
        coverUrl: a.coverImage?.large,
        year: a.startDate?.year ? String(a.startDate.year) : undefined,
        mediaType: "anime", episodes: a.episodes,
        genres: JSON.stringify(a.genres || []),
        studio: a.studios?.nodes?.[0]?.name,
      })));
    } catch { res.status(502).json({ error: "upstream_unreachable" }); }
  });

  app.get("/api/search/manga", async (req, res) => {
    try {
      const { q } = req.query;
      const gql = `query($q:String){Page(perPage:12){media(search:$q,type:MANGA,sort:SEARCH_MATCH){id title{english romaji}coverImage{large}startDate{year}genres staff(perPage:3,sort:RELEVANCE){nodes{name{full}}}}}}`;
      const r = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: gql, variables: { q: String(q) } }),
        signal: AbortSignal.timeout(8000) as any,
      });
      if (!r.ok) return res.status(502).json({ error: "upstream_error" });
      const data = await r.json() as any;
      const media = data?.data?.Page?.media;
      if (!media) return res.status(502).json({ error: "no_data" });
      res.json(media.map((m: any) => ({
        externalId: String(m.id), externalSource: "anilist",
        title: m.title?.english || m.title?.romaji,
        coverUrl: m.coverImage?.large,
        year: m.startDate?.year ? String(m.startDate.year) : undefined,
        mediaType: "manga",
        genres: JSON.stringify(m.genres || []),
        author: m.staff?.nodes?.[0]?.name?.full,
      })));
    } catch { res.status(502).json({ error: "upstream_unreachable" }); }
  });

  app.get("/api/search/movie", async (req, res) => {
    try {
      const { q } = req.query;
      const r = await fetch(`https://imdb.iamidiotareyoutoo.com/search?q=${encodeURIComponent(String(q))}`, { signal: AbortSignal.timeout(8000) as any });
      if (!r.ok) return res.status(502).json({ error: 'upstream_error' });
      const data = await r.json() as any;
      if (!data.ok || !Array.isArray(data.description)) return res.status(502).json({ error: 'no_data' });
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
      const r = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(String(q))}`, { signal: AbortSignal.timeout(8000) as any });
      if (!r.ok) return res.status(502).json({ error: 'upstream_error' });
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
  // Podcast search via iTunes Search API (free, no key needed)
  app.get("/api/search/podcast", async (req, res) => {
    try {
      const q = req.query.q as string;
      if (!q?.trim()) return res.json([]);
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=podcast&limit=15&media=podcast`;
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return res.json([]);
      const data: any = await r.json();
      const results = (data.results || []).map((p: any) => ({
        externalId: String(p.collectionId),
        externalSource: "itunes",
        title: p.collectionName,
        coverUrl: p.artworkUrl600 || p.artworkUrl100,
        year: p.releaseDate ? p.releaseDate.slice(0, 4) : undefined,
        mediaType: "podcast",
        studio: p.artistName,                   // host / publisher
        genres: p.genres ? JSON.stringify(p.genres) : undefined,
        episodes: p.trackCount || undefined,
      }));
      res.json(results);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });


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
      const { url, title, description, addedBy, icon, favicon: clientFavicon } = req.body;
      if (!url?.trim() || !title?.trim()) return res.status(400).json({ error: "url and title required" });
      // Use client-provided favicon (Google S2 service) if available, else derive from origin
      let favicon: string | null = clientFavicon ?? null;
      if (!favicon) {
        try { favicon = `${new URL(url).origin}/favicon.ico`; } catch {}
      }
      res.json(storage.createLink({ listId, url: url.trim(), title: title.trim(), description: description?.trim() ?? null, favicon, addedBy: addedBy ?? null, icon: icon?.trim() ?? null, createdAt: Date.now() }));
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

  // ─── Restaurants ──────────────────────────────────────────────────────────────────────

  app.get("/api/restaurants", (_req, res) => {
    try { res.json(storage.getAllRestaurants()); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/restaurants", (req, res) => {
    try {
      const { name, address, lat, lng, status, cuisine, emoji, rating, notes, addedBy } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: "name required" });
      res.status(201).json(storage.createRestaurant({
        name: name.trim(),
        address: address?.trim() ?? null,
        lat: lat ?? null,
        lng: lng ?? null,
        status: status ?? "want_to_go",
        cuisine: cuisine?.trim() ?? null,
        emoji: emoji?.trim() ?? null,
        rating: rating ?? null,
        notes: notes?.trim() ?? null,
        addedBy: addedBy ?? null,
        visitedAt: status === "been" ? Date.now() : null,
        createdAt: Date.now(),
      }));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/restaurants/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, address, lat, lng, status, cuisine, emoji, rating, notes, addedBy } = req.body;
      const existing = storage.getRestaurantById(id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      const visitedAt = status === "been" && existing.status !== "been"
        ? Date.now()
        : status === "want_to_go" ? null : existing.visitedAt;
      const updated = storage.updateRestaurant(id, {
        ...(name !== undefined && { name: name.trim() }),
        ...(address !== undefined && { address: address?.trim() ?? null }),
        ...(lat !== undefined && { lat }),
        ...(lng !== undefined && { lng }),
        ...(status !== undefined && { status }),
        ...(cuisine !== undefined && { cuisine: cuisine?.trim() ?? null }),
        ...(emoji !== undefined && { emoji: emoji?.trim() ?? null }),
        ...(rating !== undefined && { rating }),
        ...(notes !== undefined && { notes: notes?.trim() ?? null }),
        ...(addedBy !== undefined && { addedBy }),
        visitedAt,
      });
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/restaurants/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      storage.deleteRestaurant(id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Export / Restore (full DB backup) ──────────────────────────────────────
  // GET  /api/export  → download entire DB as JSON (items, collections, collection-items, profiles, link-lists, links)
  // POST /api/restore → restore from that same JSON shape (additive — does not wipe existing data first)

  app.get("/api/export", (_req, res) => {
    try {
      const items       = storage.getAllItems();
      const collections = storage.getAllCollections();
      const profiles    = ["jack", "sally", "together"].map(o => storage.getProfile(o)).filter(Boolean);
      const linkLists   = storage.getAllLinkLists();

      // Collect all collection-items
      const collectionItems: Array<{ collectionId: number; itemId: number; status: string | null }> = [];
      for (const col of collections) {
        const its = storage.getItemsInCollection(col.id);
        for (const it of its) {
          collectionItems.push({ collectionId: col.id, itemId: it.id, status: (it as any).collectionStatus ?? null });
        }
      }

      // Collect all links per list
      const links: Array<any> = [];
      for (const ll of linkLists) {
        const lks = storage.getLinksByList(ll.id);
        links.push(...lks);
      }

      // Collect all quotes
      const jackQuotes = storage.getQuotesByOwner("jack");
      const sallyQuotes = storage.getQuotesByOwner("sally");
      const allQuotes = [...jackQuotes, ...sallyQuotes];

      // Collect all secret messages
      const secretMessages = [
        ...storage.getMessagesFor("jack"),
        ...storage.getMessagesFor("sally"),
      ];

      const payload = {
        exportedAt: new Date().toISOString(),
        version: 1,
        items,
        collections,
        collectionItems,
        profiles,
        linkLists,
        links,
        quotes: allQuotes,
        secretMessages,
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="framestack-backup-${new Date().toISOString().slice(0,10)}.json"`);
      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/restore", (req, res) => {
    try {
      const { items: restoreItems = [], collections: restoreCols = [], collectionItems: restoreCI = [],
              linkLists: restoreLists = [], links: restoreLinks = [] } = req.body;

      const itemIdMap: Record<number, number> = {};
      const colIdMap:  Record<number, number> = {};
      const listIdMap: Record<number, number> = {};

      // Restore items (skip duplicates by externalId+externalSource)
      const existingItems = storage.getAllItems();
      const existingKeys = new Set(existingItems.map((i: any) => `${i.externalSource}:${i.externalId}`));

      for (const item of restoreItems) {
        const key = `${item.externalSource}:${item.externalId}`;
        if (item.externalId && existingKeys.has(key)) {
          // Already exists — map old ID to existing item's ID
          const existing = existingItems.find((i: any) => i.externalSource === item.externalSource && i.externalId === item.externalId);
          if (existing) itemIdMap[item.id] = existing.id;
          continue;
        }
        const { id: oldId, userId: _u, ...rest } = item;
        const created = storage.createItem({ ...rest, userId: USER_ID });
        itemIdMap[oldId] = created.id;
        if (item.externalId) existingKeys.add(key);
      }

      // Restore non-default collections
      const existingCols = storage.getAllCollections();
      for (const col of restoreCols) {
        if (col.isDefault) {
          // Map to the existing default collection with same owner+mediaGroup+defaultStatus
          const match = existingCols.find((c: any) =>
            c.owner === col.owner && c.isDefault &&
            c.mediaGroup === col.mediaGroup && c.defaultStatus === col.defaultStatus
          );
          if (match) colIdMap[col.id] = match.id;
          continue;
        }
        const { id: oldId, userId: _u, ...rest } = col;
        const created = storage.createCollection({ ...rest, userId: USER_ID });
        colIdMap[oldId] = created.id;
      }

      // Restore collection-items
      for (const ci of restoreCI) {
        const newColId  = colIdMap[ci.collectionId];
        const newItemId = itemIdMap[ci.itemId];
        if (!newColId || !newItemId) continue;
        try { storage.addItemToCollection({ collectionId: newColId, itemId: newItemId, status: ci.status ?? null }); } catch {}
      }

      // Restore link lists
      for (const ll of restoreLists) {
        const { id: oldId, ...rest } = ll;
        const created = storage.createLinkList({ ...rest });
        listIdMap[oldId] = created.id;
      }

      // Restore links
      for (const lk of restoreLinks) {
        const newListId = listIdMap[lk.listId];
        if (!newListId) continue;
        const { id: _id, listId: _l, ...rest } = lk;
        try { storage.createLink({ ...rest, listId: newListId }); } catch {}
      }

      res.json({ ok: true, itemsRestored: Object.keys(itemIdMap).length, collectionsRestored: Object.keys(colIdMap).length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // books alias
  app.get("/api/search/books", async (req, res) => {
    req.url = req.url.replace("/books", "/book");
    app._router.handle(req, res, () => {});
  });

  // ─── Quotes ───────────────────────────────────────────────────────────────────

  // GET /api/quotes/:owner
  app.get("/api/quotes/:owner", (req, res) => {
    const { owner } = req.params;
    if (owner !== "jack" && owner !== "sally") return res.status(400).json({ error: "Invalid owner" });
    res.json(storage.getQuotesByOwner(owner));
  });

  // POST /api/quotes
  app.post("/api/quotes", (req, res) => {
    const { owner, text, author } = req.body;
    if (!owner || !text || !author) return res.status(400).json({ error: "owner, text, author required" });
    if (owner !== "jack" && owner !== "sally") return res.status(400).json({ error: "Invalid owner" });
    const q = storage.createQuote({ owner, text, author });
    res.status(201).json(q);
  });

  // PATCH /api/quotes/:id
  app.patch("/api/quotes/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const { text, author } = req.body;
    const updated = storage.updateQuote(id, { ...(text && { text }), ...(author && { author }) });
    if (!updated) return res.status(404).json({ error: "Quote not found" });
    res.json(updated);
  });

  // DELETE /api/quotes/:id
  app.delete("/api/quotes/:id", (req, res) => {
    storage.deleteQuote(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // POST /api/quotes/:id/feature — toggle featured (max 5 per owner)
  app.post("/api/quotes/:id/feature", (req, res) => {
    const id = parseInt(req.params.id);
    const { featured } = req.body; // boolean
    const updated = storage.setQuoteFeatured(id, !!featured);
    if (updated === null && !!featured) return res.status(409).json({ error: "Max 5 featured quotes reached" });
    if (!updated) return res.status(404).json({ error: "Quote not found" });
    res.json(updated);
  });

  // POST /api/quotes/reorder-featured — reorder favorites for an owner
  app.post("/api/quotes/reorder-featured", (req, res) => {
    const { owner, orderedIds } = req.body;
    if (!owner || !Array.isArray(orderedIds)) return res.status(400).json({ error: "owner and orderedIds required" });
    storage.reorderFeatured(owner, orderedIds);
    res.json({ ok: true });
  });

  // ─── Secret Messages ────────────────────────────────────────────────────────────

  // GET /api/messages/:owner — all messages addressed to owner (for archive tab)
  app.get("/api/messages/:owner", (req, res) => {
    const owner = req.params.owner;
    if (owner !== "jack" && owner !== "sally") return res.status(400).json({ error: "Invalid owner" });
    res.json(storage.getMessagesFor(owner));
  });

  // GET /api/messages/:owner/unread — unread messages (inbox pop)
  app.get("/api/messages/:owner/unread", (req, res) => {
    const owner = req.params.owner;
    if (owner !== "jack" && owner !== "sally") return res.status(400).json({ error: "Invalid owner" });
    res.json(storage.getUnreadFor(owner));
  });

  // POST /api/messages — send a message from one owner to the other
  app.post("/api/messages", (req, res) => {
    const { from, to, subject, body, mood } = req.body;
    if (!from || !to || !body) return res.status(400).json({ error: "from, to, body required" });
    if (from === to) return res.status(400).json({ error: "Cannot send to yourself" });
    if (![ "jack", "sally" ].includes(from) || ![ "jack", "sally" ].includes(to))
      return res.status(400).json({ error: "Invalid sender/recipient" });
    const msg = storage.createMessage({ from, to, subject: subject || null, body, mood: mood || null });
    res.status(201).json(msg);
  });

  // PATCH /api/messages/:id/read — mark as read (archive it)
  app.patch("/api/messages/:id/read", (req, res) => {
    const id = parseInt(req.params.id);
    const updated = storage.markRead(id);
    if (!updated) return res.status(404).json({ error: "Message not found" });
    res.json(updated);
  });

  // DELETE /api/messages/:id — delete a message permanently
  app.delete("/api/messages/:id", (req, res) => {
    storage.deleteMessage(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── Daily Mood ───────────────────────────────────────────────────────────────────────────

  // GET /api/mood/:owner?date=YYYY-MM-DD — get mood for a specific date (default today)
  app.get("/api/mood/:owner", (req, res) => {
    const { owner } = req.params;
    if (owner !== "jack" && owner !== "sally") return res.status(400).json({ error: "Invalid owner" });
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const mood = storage.getMood(owner, date);
    res.json(mood ?? null);
  });

  // GET /api/mood/:owner/history — last 30 days
  app.get("/api/mood/:owner/history", (req, res) => {
    const { owner } = req.params;
    if (owner !== "jack" && owner !== "sally") return res.status(400).json({ error: "Invalid owner" });
    res.json(storage.getMoodHistory(owner, 30));
  });

  // POST /api/mood/:owner — upsert today's mood
  app.post("/api/mood/:owner", (req, res) => {
    const { owner } = req.params;
    if (owner !== "jack" && owner !== "sally") return res.status(400).json({ error: "Invalid owner" });
    const { mood, note, date } = req.body;
    if (!mood) return res.status(400).json({ error: "mood required" });
    const today = date || new Date().toISOString().slice(0, 10);
    const result = storage.upsertMood(owner, today, mood, note);
    res.json(result);
  });

  // ── Grocery Lists ──────────────────────────────────────────────────────────

  app.get("/api/grocery/lists", (_req, res) => {
    res.json(storage.getGroceryLists(true));
  });

  app.post("/api/grocery/lists", (req, res) => {
    const { name, date, is_template, created_by } = req.body;
    if (!name || !date || !created_by) return res.status(400).json({ error: "name, date, created_by required" });
    const list = storage.createGroceryList({ name, date, is_template: is_template ? 1 : 0, created_by });
    res.json(list);
  });

  app.patch("/api/grocery/lists/:id", (req, res) => {
    const id = Number(req.params.id);
    const updated = storage.updateGroceryList(id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/grocery/lists/:id", (req, res) => {
    storage.deleteGroceryList(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/grocery/lists/:id/use-template", (req, res) => {
    const templateId = Number(req.params.id);
    const { date, name, created_by } = req.body;
    if (!date || !name || !created_by) return res.status(400).json({ error: "date, name, created_by required" });
    try {
      const list = storage.cloneListFromTemplate(templateId, date, name, created_by);
      res.json(list);
    } catch (e: any) {
      res.status(404).json({ error: e.message });
    }
  });

  // ── Grocery Items ──────────────────────────────────────────────────────────

  app.get("/api/grocery/lists/:id/items", (req, res) => {
    res.json(storage.getGroceryItems(Number(req.params.id)));
  });

  app.post("/api/grocery/lists/:id/items", (req, res) => {
    const list_id = Number(req.params.id);
    const { name, location, price, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const item = storage.createGroceryItem({ list_id, name, location: location ?? null, price: price ?? null, checked: 0, sort_order: sort_order ?? 0 });
    res.json(item);
  });

  app.patch("/api/grocery/items/:id", (req, res) => {
    const updated = storage.updateGroceryItem(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/grocery/items/:id", (req, res) => {
    storage.deleteGroceryItem(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Events ──────────────────────────────────────────────────────────

  app.get("/api/events", (_req, res) => {
    res.json(storage.getEvents());
  });

  app.post("/api/events", (req, res) => {
    const { title, date, end_date, time, category, notes, created_by } = req.body;
    if (!title || !date || !created_by) return res.status(400).json({ error: "title, date, created_by required" });
    const event = storage.createEvent({ title, date, end_date: end_date ?? null, time: time ?? null, category: category ?? "other", notes: notes ?? null, created_by });
    res.json(event);
  });

  app.patch("/api/events/:id", (req, res) => {
    const updated = storage.updateEvent(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/events/:id", (req, res) => {
    storage.deleteEvent(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Places ───────────────────────────────────────────────────────────────
  app.get("/api/places", (_req, res) => {
    res.json(storage.getPlaces());
  });

  app.post("/api/places", (req, res) => {
    const { name, emoji, address, lat, lng, category, notes, added_by } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const place = storage.createPlace({
      name,
      emoji: emoji ?? null,
      address: address ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      category: category ?? "other",
      notes: notes ?? null,
      added_by: added_by ?? "together",
      created_at: Date.now(),
    });
    res.json(place);
  });

  app.patch("/api/places/:id", (req, res) => {
    const updated = storage.updatePlace(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "not found" });
    res.json(updated);
  });

  app.delete("/api/places/:id", (req, res) => {
    storage.deletePlace(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Todos ─────────────────────────────────────────────────────────────────────
  // Return all todo items that have a due_date (for calendar display)
  app.get("/api/todo-due-dates", (req, res) => {
    const lists = storage.getTodoLists(true); // include archived
    const result: any[] = [];
    for (const list of lists) {
      const items = storage.getTodoItems(list.id);
      for (const item of items) {
        if (item.due_date) {
          result.push({ ...item, list_name: list.name });
        }
      }
    }
    res.json(result);
  });

  app.get("/api/todo-lists", (req, res) => {
    const includeArchived = req.query.archived === "true";
    res.json(storage.getTodoLists(includeArchived));
  });
  app.post("/api/todo-lists", (req, res) => {
    try {
      const data = insertTodoListSchema.parse(req.body);
      res.json(storage.createTodoList(data));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.patch("/api/todo-lists/:id", (req, res) => {
    const updated = storage.updateTodoList(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "not found" });
    res.json(updated);
  });
  app.delete("/api/todo-lists/:id", (req, res) => {
    storage.deleteTodoList(Number(req.params.id));
    res.json({ ok: true });
  });
  app.post("/api/todo-lists/:id/clone", (req, res) => {
    try {
      const { name, created_by } = req.body;
      res.json(storage.cloneTodoFromTemplate(Number(req.params.id), name, created_by || "together"));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.get("/api/todo-lists/:id/items", (req, res) => {
    res.json(storage.getTodoItems(Number(req.params.id)));
  });
  app.post("/api/todo-lists/:id/items", (req, res) => {
    try {
      const data = insertTodoItemSchema.parse({ ...req.body, list_id: Number(req.params.id) });
      res.json(storage.createTodoItem(data));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.patch("/api/todo-items/:id", (req, res) => {
    const updated = storage.updateTodoItem(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "not found" });
    res.json(updated);
  });
  app.delete("/api/todo-items/:id", (req, res) => {
    storage.deleteTodoItem(Number(req.params.id));
    res.json({ ok: true });
  });

}
