import type { Migration } from "../db/migrate";

/**
 * SaaS multi_currency paritesi (additive).
 * Mevcut tutarlar değişmez; eksik PB → TRY; ödemelerde kasa_tutari = tutar.
 */
export const migration016MultiCurrency: Migration = {
  id: "016_multi_currency",
  up(db) {
    const addCol = (table: string, col: string, ddl: string) => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (!cols.some((c) => c.name === col)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
      }
    };

    // —— Ofis kasa ——
    addCol("ofis_kasa_hareketleri", "para_birimi", `para_birimi TEXT NOT NULL DEFAULT 'TRY'`);
    addCol("ofis_kasa_hareketleri", "doviz_donusum_id", `doviz_donusum_id TEXT`);
    addCol("ofis_kasa_hareketleri", "kur", `kur REAL`);
    addCol("ofis_kasa_hareketleri", "kur_baz_para_birimi", `kur_baz_para_birimi TEXT`);
    addCol("ofis_kasa_hareketleri", "kur_karsi_para_birimi", `kur_karsi_para_birimi TEXT`);
    addCol("ofis_kasa_hareketleri", "kur_kaynagi", `kur_kaynagi TEXT`);
    addCol("ofis_kasa_hareketleri", "tcmb_kur_tarihi", `tcmb_kur_tarihi TEXT`);
    addCol("ofis_kasa_hareketleri", "tcmb_referans_kur", `tcmb_referans_kur REAL`);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ofis_kasa_para_birimi
        ON ofis_kasa_hareketleri(para_birimi, tarih);
      CREATE INDEX IF NOT EXISTS idx_ofis_kasa_doviz_donusum
        ON ofis_kasa_hareketleri(doviz_donusum_id);
    `);

    db.exec(`UPDATE ofis_kasa_hareketleri SET para_birimi = 'TRY' WHERE para_birimi IS NULL OR trim(para_birimi) = ''`);

    // —— Vekalet ücret / taksit ——
    addCol("anlasilan_vekalet_ucreti", "para_birimi", `para_birimi TEXT NOT NULL DEFAULT 'TRY'`);
    addCol("vekalet_ucreti_taksit", "para_birimi", `para_birimi TEXT NOT NULL DEFAULT 'TRY'`);
    db.exec(`UPDATE anlasilan_vekalet_ucreti SET para_birimi = 'TRY' WHERE para_birimi IS NULL OR trim(para_birimi) = ''`);
    db.exec(`UPDATE vekalet_ucreti_taksit SET para_birimi = 'TRY' WHERE para_birimi IS NULL OR trim(para_birimi) = ''`);

    // —— Vekalet ödeme ——
    addCol("vekalet_taksit_odeme", "kasa_tutari", `kasa_tutari REAL`);
    addCol("vekalet_taksit_odeme", "alacak_para_birimi", `alacak_para_birimi TEXT NOT NULL DEFAULT 'TRY'`);
    addCol("vekalet_taksit_odeme", "odeme_para_birimi", `odeme_para_birimi TEXT NOT NULL DEFAULT 'TRY'`);
    addCol("vekalet_taksit_odeme", "kur", `kur REAL`);
    addCol("vekalet_taksit_odeme", "kur_baz_para_birimi", `kur_baz_para_birimi TEXT`);
    addCol("vekalet_taksit_odeme", "kur_karsi_para_birimi", `kur_karsi_para_birimi TEXT`);
    addCol("vekalet_taksit_odeme", "kur_kaynagi", `kur_kaynagi TEXT`);
    addCol("vekalet_taksit_odeme", "tcmb_kur_tarihi", `tcmb_kur_tarihi TEXT`);
    addCol("vekalet_taksit_odeme", "tcmb_referans_kur", `tcmb_referans_kur REAL`);

    db.exec(`
      UPDATE vekalet_taksit_odeme
      SET kasa_tutari = tutar
      WHERE kasa_tutari IS NULL;
      UPDATE vekalet_taksit_odeme SET alacak_para_birimi = 'TRY'
        WHERE alacak_para_birimi IS NULL OR trim(alacak_para_birimi) = '';
      UPDATE vekalet_taksit_odeme SET odeme_para_birimi = 'TRY'
        WHERE odeme_para_birimi IS NULL OR trim(odeme_para_birimi) = '';
    `);

    // —— İcra ——
    addCol("icra_tahsilat_alacak", "para_birimi", `para_birimi TEXT NOT NULL DEFAULT 'TRY'`);
    addCol("icra_tahsilat_taksit", "para_birimi", `para_birimi TEXT NOT NULL DEFAULT 'TRY'`);
    db.exec(`UPDATE icra_tahsilat_alacak SET para_birimi = 'TRY' WHERE para_birimi IS NULL OR trim(para_birimi) = ''`);
    db.exec(`UPDATE icra_tahsilat_taksit SET para_birimi = 'TRY' WHERE para_birimi IS NULL OR trim(para_birimi) = ''`);

    addCol("icra_tahsilat_odeme", "kasa_tutari", `kasa_tutari REAL`);
    addCol("icra_tahsilat_odeme", "alacak_para_birimi", `alacak_para_birimi TEXT NOT NULL DEFAULT 'TRY'`);
    addCol("icra_tahsilat_odeme", "odeme_para_birimi", `odeme_para_birimi TEXT NOT NULL DEFAULT 'TRY'`);
    addCol("icra_tahsilat_odeme", "kur", `kur REAL`);
    addCol("icra_tahsilat_odeme", "kur_baz_para_birimi", `kur_baz_para_birimi TEXT`);
    addCol("icra_tahsilat_odeme", "kur_karsi_para_birimi", `kur_karsi_para_birimi TEXT`);
    addCol("icra_tahsilat_odeme", "kur_kaynagi", `kur_kaynagi TEXT`);
    addCol("icra_tahsilat_odeme", "tcmb_kur_tarihi", `tcmb_kur_tarihi TEXT`);
    addCol("icra_tahsilat_odeme", "tcmb_referans_kur", `tcmb_referans_kur REAL`);

    db.exec(`
      UPDATE icra_tahsilat_odeme
      SET kasa_tutari = tutar
      WHERE kasa_tutari IS NULL;
      UPDATE icra_tahsilat_odeme SET alacak_para_birimi = 'TRY'
        WHERE alacak_para_birimi IS NULL OR trim(alacak_para_birimi) = '';
      UPDATE icra_tahsilat_odeme SET odeme_para_birimi = 'TRY'
        WHERE odeme_para_birimi IS NULL OR trim(odeme_para_birimi) = '';
    `);
  },
};
