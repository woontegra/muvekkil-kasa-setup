import type Database from "better-sqlite3";

export type Migration = {
  id: string;
  up: (db: Database.Database) => void;
};

export function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

export function runMigrations(db: Database.Database, migrations: Migration[], nowIso: () => string): void {
  ensureMigrationsTable(db);
  const applied = new Set(
    db.prepare(`SELECT id FROM schema_migrations`).all().map((r) => String((r as { id: string }).id))
  );
  const insert = db.prepare(`INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)`);
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    const run = db.transaction(() => {
      m.up(db);
      insert.run(m.id, nowIso());
    });
    run();
  }
}
