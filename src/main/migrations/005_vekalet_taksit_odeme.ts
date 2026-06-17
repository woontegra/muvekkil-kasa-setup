import type { Migration } from "../db/migrate";

export const migration005Vekalet: Migration = {
  id: "005_vekalet_taksit_odeme",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS anlasilan_vekalet_ucreti (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dosya_id INTEGER NOT NULL UNIQUE REFERENCES dosya(id) ON DELETE CASCADE,
        muvekkil_id INTEGER NOT NULL REFERENCES muvekkil(id) ON DELETE CASCADE,
        anlasilan_tutar REAL NOT NULL DEFAULT 0,
        aciklama TEXT,
        kayit_tarihi TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS vekalet_ucreti_taksit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vekalet_ucreti_id INTEGER NOT NULL REFERENCES anlasilan_vekalet_ucreti(id) ON DELETE CASCADE,
        dosya_id INTEGER NOT NULL REFERENCES dosya(id) ON DELETE CASCADE,
        muvekkil_id INTEGER NOT NULL REFERENCES muvekkil(id) ON DELETE CASCADE,
        taksit_no INTEGER NOT NULL,
        tutar REAL NOT NULL,
        vade_tarihi TEXT,
        aciklama TEXT,
        kayit_tarihi TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL,
        UNIQUE(vekalet_ucreti_id, taksit_no)
      );
      CREATE INDEX IF NOT EXISTS idx_vekalet_taksit_dosya ON vekalet_ucreti_taksit(dosya_id);

      CREATE TABLE IF NOT EXISTS vekalet_taksit_odeme (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taksit_id INTEGER NOT NULL REFERENCES vekalet_ucreti_taksit(id) ON DELETE CASCADE,
        vekalet_id INTEGER NOT NULL REFERENCES anlasilan_vekalet_ucreti(id) ON DELETE CASCADE,
        dosya_id INTEGER NOT NULL REFERENCES dosya(id) ON DELETE CASCADE,
        muvekkil_id INTEGER NOT NULL REFERENCES muvekkil(id) ON DELETE CASCADE,
        odeme_tarihi TEXT NOT NULL,
        tutar REAL NOT NULL,
        odeme_yontemi TEXT NOT NULL DEFAULT 'NAKIT',
        aciklama TEXT,
        makbuz_no TEXT,
        smm_kesildi_mi INTEGER NOT NULL DEFAULT 0,
        kasa_hareket_id INTEGER REFERENCES dosya_kasa_hareket(id),
        olusturan_kullanici_id INTEGER,
        olusturan_kullanici_adi TEXT,
        kayit_tarihi TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_vekalet_odeme_taksit ON vekalet_taksit_odeme(taksit_id);
      CREATE INDEX IF NOT EXISTS idx_vekalet_odeme_dosya ON vekalet_taksit_odeme(dosya_id);
    `);
  },
};
