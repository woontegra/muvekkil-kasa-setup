import type { Migration } from "../db/migrate";

export const migration004DosyaKasaHareket: Migration = {
  id: "004_dosya_kasa_hareket",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS dosya_kasa_hareket (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dosya_id INTEGER NOT NULL REFERENCES dosya(id) ON DELETE CASCADE,
        muvekkil_id INTEGER NOT NULL REFERENCES muvekkil(id) ON DELETE CASCADE,
        islem_tipi TEXT NOT NULL,
        masraf_turu TEXT,
        tutar REAL NOT NULL,
        tarih TEXT NOT NULL,
        masrafi_yapan_kisi TEXT,
        aciklama TEXT,
        belge_no TEXT,
        odeme_yontemi TEXT NOT NULL DEFAULT 'NAKIT',
        onay_durumu TEXT NOT NULL DEFAULT 'ONAYSIZ',
        duzeltme_mi INTEGER NOT NULL DEFAULT 0,
        duzeltilen_islem_id INTEGER,
        otomatik_onay_mi INTEGER NOT NULL DEFAULT 0,
        onay_tarihi TEXT,
        kayit_tarihi TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL,
        olusturan_kullanici_id INTEGER,
        olusturan_kullanici_adi TEXT,
        onaylayan_kullanici_id INTEGER,
        onaylayan_kullanici_adi TEXT,
        FOREIGN KEY (duzeltilen_islem_id) REFERENCES dosya_kasa_hareket(id)
      );
      CREATE INDEX IF NOT EXISTS idx_hareket_dosya ON dosya_kasa_hareket(dosya_id);
      CREATE INDEX IF NOT EXISTS idx_hareket_onay ON dosya_kasa_hareket(onay_durumu);

      CREATE TABLE IF NOT EXISTS belge_no_sayac (
        yil INTEGER NOT NULL,
        grup TEXT NOT NULL,
        son_sira INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (yil, grup)
      );
    `);

    const cols = db.prepare(`PRAGMA table_info(dosya_kasa_hareket)`).all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    const add = (col: string, ddl: string) => {
      if (!names.has(col)) db.exec(ddl);
    };
    add("odeme_yontemi", `ALTER TABLE dosya_kasa_hareket ADD COLUMN odeme_yontemi TEXT NOT NULL DEFAULT 'NAKIT'`);
    add("otomatik_onay_mi", `ALTER TABLE dosya_kasa_hareket ADD COLUMN otomatik_onay_mi INTEGER NOT NULL DEFAULT 0`);
    add("onay_tarihi", `ALTER TABLE dosya_kasa_hareket ADD COLUMN onay_tarihi TEXT`);
    add("guncelleme_tarihi", `ALTER TABLE dosya_kasa_hareket ADD COLUMN guncelleme_tarihi TEXT`);
    add("olusturan_kullanici_id", `ALTER TABLE dosya_kasa_hareket ADD COLUMN olusturan_kullanici_id INTEGER`);
    add("olusturan_kullanici_adi", `ALTER TABLE dosya_kasa_hareket ADD COLUMN olusturan_kullanici_adi TEXT`);
    add("onaylayan_kullanici_id", `ALTER TABLE dosya_kasa_hareket ADD COLUMN onaylayan_kullanici_id INTEGER`);
    add("onaylayan_kullanici_adi", `ALTER TABLE dosya_kasa_hareket ADD COLUMN onaylayan_kullanici_adi TEXT`);

    db.exec(`
      UPDATE dosya_kasa_hareket SET guncelleme_tarihi = kayit_tarihi WHERE guncelleme_tarihi IS NULL OR trim(guncelleme_tarihi) = '';
      UPDATE dosya_kasa_hareket SET onay_tarihi = kayit_tarihi
        WHERE onay_durumu = 'ONAYLI' AND (onay_tarihi IS NULL OR trim(onay_tarihi) = '');
    `);

    const rows = db
      .prepare(`SELECT belge_no FROM dosya_kasa_hareket WHERE belge_no IS NOT NULL AND TRIM(belge_no) != ''`)
      .all() as { belge_no: string }[];
    const re = /^(AVN|MSF|DZT)-(\d{4})-(\d{6})$/;
    for (const { belge_no } of rows) {
      const m = re.exec(String(belge_no).trim());
      if (!m) continue;
      const grup = m[1];
      const yil = Number(m[2]);
      const seq = Number(m[3]);
      if (!Number.isFinite(yil) || !Number.isFinite(seq)) continue;
      db.prepare(
        `INSERT INTO belge_no_sayac (yil, grup, son_sira) VALUES (?,?,?)
         ON CONFLICT(yil, grup) DO UPDATE SET son_sira = MAX(son_sira, excluded.son_sira)`
      ).run(yil, grup, seq);
    }
  },
};
