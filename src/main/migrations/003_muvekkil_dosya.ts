import type { Migration } from "../db/migrate";

export const migration003MuvekkilDosya: Migration = {
  id: "003_muvekkil_dosya",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS muvekkil (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        muvekkil_turu TEXT NOT NULL DEFAULT 'GERCEK_KISI',
        ad_soyad TEXT NOT NULL DEFAULT '',
        telefon TEXT,
        eposta TEXT,
        adres TEXT,
        sirket_unvani TEXT,
        yetkili_ad_soyad TEXT,
        yetkili_telefon TEXT,
        mudur_ad_soyad TEXT,
        mudur_telefon TEXT,
        muhasebe_ad_soyad TEXT,
        muhasebe_telefon TEXT,
        vergi_no TEXT,
        vergi_dairesi TEXT,
        aktif_mi INTEGER NOT NULL DEFAULT 1,
        notu TEXT,
        kayit_tarihi TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_muvekkil_ad_soyad ON muvekkil(ad_soyad);

      CREATE TABLE IF NOT EXISTS dosya (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        muvekkil_id INTEGER NOT NULL REFERENCES muvekkil(id) ON DELETE CASCADE,
        konu_basligi TEXT,
        mahkeme_adi TEXT,
        dosya_numarasi TEXT,
        aciklama TEXT,
        durum TEXT NOT NULL DEFAULT 'AKTIF',
        notu TEXT,
        kayit_tarihi TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_dosya_muvekkil ON dosya(muvekkil_id);
    `);

    const muCols = db.prepare(`PRAGMA table_info(muvekkil)`).all() as { name: string }[];
    const muNames = new Set(muCols.map((c) => c.name));
    const addMu = (col: string, ddl: string) => {
      if (!muNames.has(col)) db.exec(ddl);
    };
    addMu("adres", `ALTER TABLE muvekkil ADD COLUMN adres TEXT`);
    addMu("vergi_no", `ALTER TABLE muvekkil ADD COLUMN vergi_no TEXT`);
    addMu("vergi_dairesi", `ALTER TABLE muvekkil ADD COLUMN vergi_dairesi TEXT`);
    addMu("aktif_mi", `ALTER TABLE muvekkil ADD COLUMN aktif_mi INTEGER NOT NULL DEFAULT 1`);

    const dCols = db.prepare(`PRAGMA table_info(dosya)`).all() as { name: string }[];
    const dNames = new Set(dCols.map((c) => c.name));
    if (!dNames.has("aciklama")) db.exec(`ALTER TABLE dosya ADD COLUMN aciklama TEXT`);
    if (!dNames.has("durum")) {
      db.exec(`ALTER TABLE dosya ADD COLUMN durum TEXT NOT NULL DEFAULT 'AKTIF'`);
    }
  },
};
