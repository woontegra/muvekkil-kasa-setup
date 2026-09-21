import type { Migration } from "../db/migrate";

export const migration011IcraTahsilat: Migration = {
  id: "011_icra_tahsilat",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS icra_tahsilat_alacak (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alacak_turu TEXT NOT NULL,
        borclu_adi TEXT NOT NULL,
        muvekkil_id INTEGER REFERENCES muvekkil(id) ON DELETE SET NULL,
        dosya_id INTEGER REFERENCES dosya(id) ON DELETE SET NULL,
        toplam_tutar REAL NOT NULL,
        pesinat_tutar REAL NOT NULL DEFAULT 0,
        taksit_sayisi INTEGER NOT NULL DEFAULT 0,
        ilk_vade_tarihi TEXT,
        varsayilan_odeme_yontemi TEXT NOT NULL DEFAULT 'NAKIT',
        aciklama TEXT,
        durum TEXT NOT NULL DEFAULT 'ACIK',
        kayit_tarihi TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_icra_alacak_muvekkil ON icra_tahsilat_alacak(muvekkil_id);
      CREATE INDEX IF NOT EXISTS idx_icra_alacak_dosya ON icra_tahsilat_alacak(dosya_id);
      CREATE INDEX IF NOT EXISTS idx_icra_alacak_kayit ON icra_tahsilat_alacak(kayit_tarihi);

      CREATE TABLE IF NOT EXISTS icra_tahsilat_taksit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alacak_id INTEGER NOT NULL REFERENCES icra_tahsilat_alacak(id) ON DELETE CASCADE,
        taksit_no INTEGER NOT NULL,
        tutar REAL NOT NULL,
        vade_tarihi TEXT,
        aciklama TEXT,
        kayit_tarihi TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL,
        UNIQUE(alacak_id, taksit_no)
      );
      CREATE INDEX IF NOT EXISTS idx_icra_taksit_alacak ON icra_tahsilat_taksit(alacak_id);

      CREATE TABLE IF NOT EXISTS icra_tahsilat_odeme (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alacak_id INTEGER NOT NULL REFERENCES icra_tahsilat_alacak(id) ON DELETE CASCADE,
        taksit_id INTEGER REFERENCES icra_tahsilat_taksit(id) ON DELETE CASCADE,
        odeme_tarihi TEXT NOT NULL,
        tutar REAL NOT NULL,
        odeme_yontemi TEXT NOT NULL DEFAULT 'NAKIT',
        aciklama TEXT,
        makbuz_no TEXT,
        smm_kesildi_mi INTEGER NOT NULL DEFAULT 0,
        pesinat_mi INTEGER NOT NULL DEFAULT 0,
        ofis_kasa_hareket_id INTEGER REFERENCES ofis_kasa_hareketleri(id),
        olusturan_kullanici_id INTEGER,
        olusturan_kullanici_adi TEXT,
        kayit_tarihi TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_icra_odeme_alacak ON icra_tahsilat_odeme(alacak_id);
      CREATE INDEX IF NOT EXISTS idx_icra_odeme_taksit ON icra_tahsilat_odeme(taksit_id);
    `);
  },
};
