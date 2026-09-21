import type { Migration } from "../db/migrate";

/**
 * SaaS parity — vekalet satır güvenli iptal:
 * anlasilan_vekalet_ucreti durum/soft-delete, taksit odeme_durumu IPTAL,
 * vekalet_taksit_odeme makbuz/iptal damgası.
 * Mevcut satırlar aktif kalır.
 */
export const migration019VekaletGuvenliIptal: Migration = {
  id: "019_vekalet_guvenli_iptal",
  up(db) {
    const addCol = (table: string, col: string, ddl: string) => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (!cols.some((c) => c.name === col)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
      }
    };

    addCol("anlasilan_vekalet_ucreti", "durum", `durum TEXT NOT NULL DEFAULT 'AKTIF'`);
    addCol("anlasilan_vekalet_ucreti", "silinme_tarihi", `silinme_tarihi TEXT`);
    addCol("anlasilan_vekalet_ucreti", "silen_kullanici_id", `silen_kullanici_id INTEGER REFERENCES uygulama_kullanici(id)`);
    addCol("anlasilan_vekalet_ucreti", "silme_nedeni", `silme_nedeni TEXT`);

    addCol("vekalet_ucreti_taksit", "odeme_durumu", `odeme_durumu TEXT NOT NULL DEFAULT 'AKTIF'`);

    addCol("vekalet_taksit_odeme", "makbuz_durumu", `makbuz_durumu TEXT NOT NULL DEFAULT 'AKTIF'`);
    addCol("vekalet_taksit_odeme", "iptal_tarihi", `iptal_tarihi TEXT`);
    addCol("vekalet_taksit_odeme", "iptal_eden_kullanici_id", `iptal_eden_kullanici_id INTEGER REFERENCES uygulama_kullanici(id)`);
    addCol("vekalet_taksit_odeme", "iptal_nedeni", `iptal_nedeni TEXT`);

    db.exec(`UPDATE anlasilan_vekalet_ucreti SET durum = 'AKTIF' WHERE durum IS NULL OR trim(durum) = ''`);
    db.exec(`UPDATE vekalet_ucreti_taksit SET odeme_durumu = 'AKTIF' WHERE odeme_durumu IS NULL OR trim(odeme_durumu) = ''`);
    db.exec(`UPDATE vekalet_taksit_odeme SET makbuz_durumu = 'AKTIF' WHERE makbuz_durumu IS NULL OR trim(makbuz_durumu) = ''`);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_vekalet_ucreti_dosya_durum
        ON anlasilan_vekalet_ucreti(dosya_id, durum);
      CREATE INDEX IF NOT EXISTS idx_vekalet_taksit_odeme_durum
        ON vekalet_taksit_odeme(iptal_tarihi, makbuz_durumu);
      CREATE INDEX IF NOT EXISTS idx_vekalet_taksit_odeme_durum_taksit
        ON vekalet_ucreti_taksit(odeme_durumu);
    `);
  },
};
