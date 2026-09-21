import type { Migration } from "../db/migrate";

export const migration012AppSettings: Migration = {
  id: "012_app_settings",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        anahtar TEXT PRIMARY KEY NOT NULL,
        deger TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL
      );
    `);
    const row = db.prepare(`SELECT 1 AS x FROM app_settings WHERE anahtar = 'accounting_period_mode'`).get();
    if (!row) {
      const t = new Date().toISOString();
      db.prepare(
        `INSERT INTO app_settings (anahtar, deger, guncelleme_tarihi) VALUES ('accounting_period_mode', 'YEARLY', ?)`,
      ).run(t);
    }
  },
};
