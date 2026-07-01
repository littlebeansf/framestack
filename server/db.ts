/**
 * server/db.ts — database factory for Framestack
 *
 * Uses `libsql` as a drop-in replacement for better-sqlite3.
 * Reads/writes to a local `data.db` file that persists in the sandbox.
 * No external services required.
 */

import Database from "libsql";
import type BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

let _db: Database.Database | null = null;
let _drizzle: BetterSQLite3Database<Record<string, never>> | null = null;

export function getDb(): Database.Database {
  if (_db && _db.open) return _db;

  const filePath = process.env.DATABASE_URL?.replace("file:", "") ?? "./data.db";
  _db = new Database(filePath);
  _db.pragma("journal_mode = WAL");

  console.log(`[db] connected — local file: ${filePath}`);
  return _db;
}

export function getDrizzle(): BetterSQLite3Database<Record<string, never>> {
  if (_drizzle) return _drizzle;
  _drizzle = drizzle(getDb() as unknown as BetterSqlite3.Database);
  return _drizzle;
}
