import type { Migration } from "../db/migrate";

/**
 * SaaS parity — güvenli sil (soft-delete + audit):
 * dosya_kasa_hareket ve ofis_kasa_hareketleri için silinme alanları.
 * Mevcut satırlar aktif kalır (silinme_tarihi NULL).
 */
export const migration018GuvenliSoftDelete: Migration = {
  id: "018_guvenli_soft_delete",
  up(db) {
    const addCol = (table: string, col: string, ddl: string) => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (!cols.some((c) => c.name === col)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
      }
    };

    for (const table of ["dosya_kasa_hareket", "ofis_kasa_hareketleri"] as const) {
      addCol(table, "silinme_tarihi", `silinme_tarihi TEXT`);
      addCol(table, "silen_kullanici_id", `silen_kullanici_id INTEGER REFERENCES uygulama_kullanici(id)`);
      addCol(table, "silme_nedeni", `silme_nedeni TEXT`);
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_dosya_kasa_dosya_silinme
        ON dosya_kasa_hareket(dosya_id, silinme_tarihi);
      CREATE INDEX IF NOT EXISTS idx_ofis_kasa_silinme
        ON ofis_kasa_hareketleri(silinme_tarihi);
    `);
  },
};
