import type { Migration } from "../db/migrate";

export const migration013Randevu: Migration = {
  id: "013_randevu",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS randevu (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        baslik TEXT NOT NULL,
        baslangic_at TEXT NOT NULL,
        bitis_at TEXT NOT NULL,
        muvekkil_id INTEGER,
        dosya_id INTEGER,
        sorumlu_kullanici_id INTEGER,
        konum TEXT,
        aciklama TEXT,
        aktif_mi INTEGER NOT NULL DEFAULT 1,
        olusturan_kullanici_id INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (muvekkil_id) REFERENCES muvekkil(id),
        FOREIGN KEY (dosya_id) REFERENCES dosya(id),
        FOREIGN KEY (sorumlu_kullanici_id) REFERENCES uygulama_kullanici(id),
        FOREIGN KEY (olusturan_kullanici_id) REFERENCES uygulama_kullanici(id)
      );
      CREATE INDEX IF NOT EXISTS idx_randevu_baslangic ON randevu(baslangic_at);
      CREATE INDEX IF NOT EXISTS idx_randevu_muvekkil ON randevu(muvekkil_id);
      CREATE INDEX IF NOT EXISTS idx_randevu_aktif ON randevu(aktif_mi);
    `);
  },
};
