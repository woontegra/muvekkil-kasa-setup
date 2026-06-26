import { app } from "electron";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

let db: Database.Database | null = null;
let dbFilePath: string | null = null;

export function nowIso(): string {
  return new Date().toISOString();
}

export function getDbPath(): string {
  const testPath = process.env.MKD_TEST_DB?.trim();
  if (testPath) return testPath;
  if (dbFilePath) return dbFilePath;
  const dir = app.getPath("userData");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  dbFilePath = join(dir, "muvekkil-kasa-defteri.sqlite");
  return dbFilePath;
}

export function getDb(): Database.Database {
  if (db) return db;
  const path = getDbPath();
  db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
