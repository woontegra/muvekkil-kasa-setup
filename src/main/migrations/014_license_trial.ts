import type { Migration } from "../db/migrate";

function columnNames(db: { prepare: (sql: string) => { all: () => { name: string }[] } }, table: string): Set<string> {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
}

export const migration014LicenseTrial: Migration = {
  id: "014_license_trial",
  up(db) {
    const cols = columnNames(db, "yerel_lisans");
    if (cols.size === 0) return;
    if (cols.has("kind")) return;

    db.exec(`
      CREATE TABLE yerel_lisans_v2 (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        kind TEXT NOT NULL DEFAULT 'paid' CHECK (kind IN ('paid', 'trial')),
        license_key TEXT,
        device_hash TEXT NOT NULL,
        product_name TEXT,
        expires_at TEXT,
        last_validated_at TEXT,
        offline_grace_until TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        kayit_tarihi TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL
      );
      INSERT INTO yerel_lisans_v2 (
        id, kind, license_key, device_hash, product_name, expires_at,
        last_validated_at, offline_grace_until, status, kayit_tarihi, guncelleme_tarihi
      )
      SELECT
        id,
        'paid',
        license_key,
        device_hash,
        product_name,
        expires_at,
        last_validated_at,
        offline_grace_until,
        status,
        kayit_tarihi,
        guncelleme_tarihi
      FROM yerel_lisans;
      DROP TABLE yerel_lisans;
      ALTER TABLE yerel_lisans_v2 RENAME TO yerel_lisans;
    `);
  },
};
