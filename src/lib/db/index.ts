import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { migrate } from "./migrate";
import { mkdirSync } from "fs";
import { dirname } from "path";

const DB_PATH = process.env.DATABASE_URL || "/media/data/clipsaw.db";

let _db: BetterSQLite3Database<typeof schema> | null = null;

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!_db) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    const sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    migrate(sqlite);
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

// Lazy proxy: import { db } from "@/lib/db" で従来通り使える
export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
