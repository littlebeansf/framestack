import type { Express } from "express";
import { Server } from "http";
import bcrypt from "bcrypt";
import { signToken, requireAuth } from "./auth";
import { storage } from "./storage";
import fetch from "node-fetch";

export async function registerRoutes(httpServer: Server, app: Express) {
  // ─── Auth ──────────────────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, email, password, displayName } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      if (storage.getUserByUsername(username)) {
        return res.status(400).json({ error: "Username already taken" });
      }
      if (storage.getUserByEmail(email)) {
        return res.status(400).json({ error: "Email already in use" });
      }
      const hashed = await bcrypt.hash(password, 10);
      const user = storage.createUser({
        username,
        email,
        password: hashed,
        displayName: displayName || username,
      });
      const token = signToken(user.id);
      const { password: _, ...safe } = user;
      res.json({ token, user: safe });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Missing username or password" });
      }
      const user = storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      const token = signToken(user.id);
      const { password: _, ...safe } = user;
      res.json({ token, user: safe });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    // JWT is stateless — client just drops the token
    res.json({ ok: true });
  });

  // Used by the auth context to rehydrate on mount if a token were stored.
  // Since we do NOT store the token (iframe sandbox), this just validates the
  // bearer token and returns the user — useful for the initial auth check.
  app.get("/api/auth/me", requireAuth, (req, res) => {
    const userId = (req as any).userId;
    const user = storage.getUserById(userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    const { password: _, ...safe } = user;
    res.json(safe);
  });

  app.patch("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { displayName, avatarUrl, email } = req.body;
      const updated = storage.updateUser(userId, { displayName, avatarUrl, email });
      if (!updated) return res.status(404).json({ error: "User not found" });
      const { password: _, ...safe } = updated;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { currentPassword, newPassword } = req.body;
      const user = storage.getUserById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(400).json({ error: "Current password is incorrect" });
      const hashed = await bcrypt.hash(newPassword, 10);
      storage.updateUser(userId, { password: hashed });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Items ─────────────────────────────────────────────────────────────────

  app.get("/api/items", requireAuth, (req, res) => {
    const userId = (req as any).userId;
    const items = storage.getItemsByUser(userId);
    res.json(items);
  });

  app.post("/api/items", requireAuth, (req, res) => {
    try {
      const userId = (req as any).userId;
      const item = storage.createItem({ ...req.body, userId });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/items/:id", requireAuth, (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = storage.getItemById(id);
      if (!item) return res.status(404).json({ error: "Item not found" });
      if (item.userId !== (req as any).userId) return res.status(403).json({ error: "Forbidden" });
      const updated = storage.updateItem(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/items/:id", requireAuth, (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = storage.getItemById(id);
      if (!item) return res.status(404).json({ error: "Item not found" });
      if (item.userId !== (req as any).userId) return res.status(403).json({ error: "Forbidden" });
      storage.deleteItem(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/items/:id/collections", requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    res.json(storage.getCollectionsForItem(id));
  });

  // ─── Collections ───────────────────────────────────────────────────────────

  app.get("/api/collections", requireAuth, (req, res) => {
    const userId = (req as any).userId;
    res.json(storage.getCollectionsByUser(userId));
  });

  app.post("/api/collections", requireAuth, (req, res) => {
    try {
      const userId = (req as any).userId;
      const col = storage.createCollection({ ...req.body, userId });
      res.json(col);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/collections/:id", requireAuth, (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const col = storage.getCollectionById(id);
      if (!col) return res.status(404).json({ error: "Collection not found" });
      if (col.userId !== (req as any).userId) return res.status(403).json({ error: "Forbidden" });
      const updated = storage.updateCollection(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/collections/:id", requireAuth, (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const col = storage.getCollectionById(id);
      if (!col) return res.status(404).json({ error: "Collection not found" });
      if (col.userId !== (req as any).userId) return res.status(403).json({ error: "Forbidden" });
      storage.deleteCollection(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/collections/:id/items", requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    res.json(storage.getItemsInCollection(id));
  });

  app.post("/api/collections/:id/items", requireAuth, (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const { itemId } = req.body;
      const result = storage.addItemToCollection({ collectionId, itemId });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/collections/:id/items/:itemId", requireAuth, (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      storage.removeItemFromCollection(collectionId, itemId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── External Search ───────────────────────────────────────────────────────

  // Proxy to Jikan (anime/manga) — no API key needed
  app.get("/api/search/anime", requireAuth, async (req, res) => {
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

  app.get("/api/search/manga", requireAuth, async (req, res) => {
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

  // OMDb proxy (movies + series) — uses free API key
  app.get("/api/search/omdb", requireAuth, async (req, res) => {
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

  // Open Library proxy (books)
  app.get("/api/search/books", requireAuth, async (req, res) => {
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

  // ─── Unified search (all types) ────────────────────────────────────────────
  app.get("/api/search", requireAuth, async (req, res) => {
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
