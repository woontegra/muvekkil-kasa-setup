import type { Migration } from "../db/migrate";

export const migration009VekaletOfisKasa: Migration = {
  id: "009_vekalet_ofis_kasa_baglantisi",
  up(db) {
    const ofisCols = db.prepare(`PRAGMA table_info(ofis_kasa_hareketleri)`).all() as { name: string }[];
    const ofisNames = new Set(ofisCols.map((c) => c.name));
    if (!ofisNames.has("kaynak_tipi")) {
      db.exec(`ALTER TABLE ofis_kasa_hareketleri ADD COLUMN kaynak_tipi TEXT`);
    }
    if (!ofisNames.has("kaynak_id")) {
      db.exec(`ALTER TABLE ofis_kasa_hareketleri ADD COLUMN kaynak_id INTEGER`);
    }
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ofis_kasa_kaynak_unique
        ON ofis_kasa_hareketleri(kaynak_tipi, kaynak_id)
        WHERE kaynak_tipi IS NOT NULL AND kaynak_id IS NOT NULL;
    `);

    const odemeCols = db.prepare(`PRAGMA table_info(vekalet_taksit_odeme)`).all() as { name: string }[];
    const odemeNames = new Set(odemeCols.map((c) => c.name));
    if (!odemeNames.has("ofis_kasa_hareket_id")) {
      db.exec(
        `ALTER TABLE vekalet_taksit_odeme ADD COLUMN ofis_kasa_hareket_id INTEGER REFERENCES ofis_kasa_hareketleri(id)`
      );
    }
  },
};
