/**
 * server/db.ts — database factory for Framestack
 *
 * Uses `libsql` (Turso's better-sqlite3-compatible driver) which supports
 * three connection modes controlled entirely by environment variables:
 *
 * Mode 1 — Local file (dev / CI default):
 *   DATABASE_URL unset  →  ./data.db
 *
 * Mode 2 — Embedded replica (production on Railway):
 *   DATABASE_URL=file:./data.db
 *   LIBSQL_SYNC_URL=libsql://<db>.turso.io
 *   LIBSQL_AUTH_TOKEN=<token>
 *
 *   Local file stays in sync with a Turso cloud primary.
 *   Reads are local + fast. Writes forwarded to primary + synced back.
 *   Data persists even if the Railway container restarts / redeploys.
 *
 * No code changes needed between modes — just set/unset env vars.
 */

import Database from "libsql";
import type BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

let _db: Database.Database | null = null;
let _drizzle: BetterSQLite3Database<Record<string, never>> | null = null;

function resolveFilePath(raw: string): string {
  if (raw.startsWith("file:")) return raw.slice("file:".length);
  return raw;
}

export function getDb(): Database.Database {
  if (_db && _db.open) return _db;

  const rawUrl    = process.env.DATABASE_URL    ?? "file:./data.db";
  const syncUrl   = process.env.LIBSQL_SYNC_URL;
  const authToken = process.env.LIBSQL_AUTH_TOKEN;
  const syncInterval = process.env.LIBSQL_SYNC_INTERVAL
    ? Number(process.env.LIBSQL_SYNC_INTERVAL)
    : undefined;

  const isRemote = rawUrl.startsWith("libsql://");
  const filePath = isRemote ? rawUrl : resolveFilePath(rawUrl);

  const opts: Record<string, unknown> = {};
  if (syncUrl)   opts.syncUrl   = syncUrl;
  if (authToken) opts.authToken = authToken;
  if (syncInterval && syncInterval > 0) opts.syncInterval = syncInterval;

  _db = new Database(filePath, opts);

  // WAL mode for local files — improves concurrent read performance
  if (!isRemote) _db.pragma("journal_mode = WAL");

  // Initial sync for embedded-replica mode
  if (syncUrl) {
    try {
      const sync = (_db as any).sync;
      if (typeof sync === "function") {
        const r = sync.call(_db);
        if (r && typeof r.then === "function") {
          r.catch((e: unknown) => console.warn("[db] initial sync failed (offline fallback):", e));
        }
      }
    } catch (e) {
      console.warn("[db] initial sync threw (offline fallback):", e);
    }
  }

  const mode = syncUrl ? "embedded-replica" : isRemote ? "remote" : "local-file";
  console.log(`[db] connected — mode: ${mode}`);
  return _db;
}

export function getDrizzle(): BetterSQLite3Database<Record<string, never>> {
  if (_drizzle) return _drizzle;
  _drizzle = drizzle(getDb() as unknown as BetterSqlite3.Database);
  return _drizzle;
}
