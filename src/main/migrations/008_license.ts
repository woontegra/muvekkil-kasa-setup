import type { Migration } from "../db/migrate";

export const migration008License: Migration = {
  id: "008_yerel_lisans",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS yerel_lisans (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        license_key TEXT NOT NULL,
        device_hash TEXT NOT NULL,
        product_name TEXT,
        expires_at TEXT,
        last_validated_at TEXT,
        offline_grace_until TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        kayit_tarihi TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL
      );
    `);
  },
};
