import type { Migration } from "../db/migrate";

export const migration007OfisKasaDuzeltme: Migration = {
  id: "007_ofis_kasa_duzeltme_alanlari",
  up(db) {
    const cols = db.prepare(`PRAGMA table_info(ofis_kasa_hareketleri)`).all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    if (!names.has("duzeltme_yonu")) {
      db.exec(`ALTER TABLE ofis_kasa_hareketleri ADD COLUMN duzeltme_yonu TEXT`);
    }
    if (!names.has("duzeltme_orijinal_tutar")) {
      db.exec(`ALTER TABLE ofis_kasa_hareketleri ADD COLUMN duzeltme_orijinal_tutar REAL`);
    }
    if (!names.has("duzeltme_dogru_tutar")) {
      db.exec(`ALTER TABLE ofis_kasa_hareketleri ADD COLUMN duzeltme_dogru_tutar REAL`);
    }
    if (!names.has("duzeltme_fark_tutar")) {
      db.exec(`ALTER TABLE ofis_kasa_hareketleri ADD COLUMN duzeltme_fark_tutar REAL`);
    }
    if (!names.has("duzeltme_kasa_etkisi")) {
      db.exec(`ALTER TABLE ofis_kasa_hareketleri ADD COLUMN duzeltme_kasa_etkisi REAL`);
    }
    if (!names.has("duzeltme_ref_tipi")) {
      db.exec(`ALTER TABLE ofis_kasa_hareketleri ADD COLUMN duzeltme_ref_tipi TEXT`);
    }
  },
};
