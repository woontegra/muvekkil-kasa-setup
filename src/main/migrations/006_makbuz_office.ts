import type { Migration } from "../db/migrate";
import { nowIso } from "../db/connection";

export const migration006MakbuzOffice: Migration = {
  id: "006_makbuz_office",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS office_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        ofis_adi TEXT,
        avukat_adi_soyadi TEXT,
        telefon TEXT,
        eposta TEXT,
        adres TEXT,
        vergi_no TEXT,
        vergi_dairesi TEXT,
        baro_adi TEXT,
        baro_sicil_no TEXT,
        logo_path TEXT,
        kayit_tarihi TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS makbuz_sayac (
        yil INTEGER PRIMARY KEY,
        son_sira INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS vekalet_makbuz_sayac (
        yil INTEGER PRIMARY KEY,
        son_sira INTEGER NOT NULL DEFAULT 0
      );
    `);
    const hasOffice = db.prepare(`SELECT 1 FROM office_settings WHERE id = 1`).get();
    if (!hasOffice) {
      const t = nowIso();
      db.prepare(
        `INSERT INTO office_settings (id, ofis_adi, avukat_adi_soyadi, telefon, eposta, adres, vergi_no, vergi_dairesi, baro_adi, baro_sicil_no, logo_path, kayit_tarihi, guncelleme_tarihi)
         VALUES (1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`
      ).run(t, t);
    }
    const hCols = db.prepare(`PRAGMA table_info(dosya_kasa_hareket)`).all() as { name: string }[];
    const hNames = new Set(hCols.map((c) => c.name));
    if (!hNames.has("makbuz_no")) {
      db.exec(`ALTER TABLE dosya_kasa_hareket ADD COLUMN makbuz_no TEXT`);
    }
    if (!hNames.has("makbuz_olusturuldu_mu")) {
      db.exec(`ALTER TABLE dosya_kasa_hareket ADD COLUMN makbuz_olusturuldu_mu INTEGER NOT NULL DEFAULT 0`);
    }
    if (!hNames.has("makbuz_tarihi")) {
      db.exec(`ALTER TABLE dosya_kasa_hareket ADD COLUMN makbuz_tarihi TEXT`);
      db.exec(
        `UPDATE dosya_kasa_hareket SET makbuz_tarihi = substr(kayit_tarihi, 1, 10) WHERE makbuz_no IS NOT NULL AND makbuz_tarihi IS NULL`
      );
    }
  },
};
