import type { Migration } from "../db/migrate";
import { buildFinansKalemSeeds, normalizeFinansKalemAd } from "../services/finansKalemi.defaults";

/**
 * SaaS parity additive:
 * - finans_kalemi (Gelir/Gider Kalemleri)
 * - ofis hareket: kalem_id, muvekkil_id, muvekkil_adi_snapshot, tahsilati_yapan_kullanici_id
 * - audit_log (Denetim Kayıtları)
 * - uygulama_kullanici.rol (Kullanıcı & yetki temeli)
 *
 * Mevcut tutar/açıklama değiştirilmez; eski kategori metinleri korunur.
 */
export const migration017FinansKalemMuvekkilAudit: Migration = {
  id: "017_finans_kalem_muvekkil_audit",
  up(db) {
    const addCol = (table: string, col: string, ddl: string) => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (!cols.some((c) => c.name === col)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
      }
    };

    db.exec(`
      CREATE TABLE IF NOT EXISTS finans_kalemi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tur TEXT NOT NULL CHECK (tur IN ('GELIR', 'GIDER')),
        kod TEXT,
        ad TEXT NOT NULL,
        normalize_ad TEXT NOT NULL,
        aktif INTEGER NOT NULL DEFAULT 1,
        sistem_mi INTEGER NOT NULL DEFAULT 0,
        sira INTEGER NOT NULL DEFAULT 0,
        archived_at TEXT,
        olusturma_tarihi TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL,
        UNIQUE (tur, normalize_ad)
      );
      CREATE INDEX IF NOT EXISTS idx_finans_kalemi_tur_aktif_sira
        ON finans_kalemi(tur, aktif, sira);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_finans_kalemi_kod
        ON finans_kalemi(kod) WHERE kod IS NOT NULL AND trim(kod) != '';
    `);

    const now = new Date().toISOString();
    const count = (db.prepare(`SELECT COUNT(*) AS c FROM finans_kalemi`).get() as { c: number }).c;
    if (count === 0) {
      const ins = db.prepare(`
        INSERT INTO finans_kalemi (tur, kod, ad, normalize_ad, aktif, sistem_mi, sira, archived_at, olusturma_tarihi, guncelleme_tarihi)
        VALUES (?, ?, ?, ?, 1, ?, ?, NULL, ?, ?)
      `);
      for (const s of buildFinansKalemSeeds()) {
        ins.run(s.tur, s.kod ?? null, s.ad, normalizeFinansKalemAd(s.ad), s.sistemMi ? 1 : 0, s.sira, now, now);
      }
    }

    addCol("ofis_kasa_hareketleri", "kalem_id", `kalem_id INTEGER REFERENCES finans_kalemi(id)`);
    addCol("ofis_kasa_hareketleri", "muvekkil_id", `muvekkil_id INTEGER REFERENCES muvekkil(id)`);
    addCol("ofis_kasa_hareketleri", "muvekkil_adi_snapshot", `muvekkil_adi_snapshot TEXT`);
    addCol(
      "ofis_kasa_hareketleri",
      "tahsilati_yapan_kullanici_id",
      `tahsilati_yapan_kullanici_id INTEGER REFERENCES uygulama_kullanici(id)`,
    );
    addCol("ofis_kasa_hareketleri", "tahsilati_yapan_kullanici_adi", `tahsilati_yapan_kullanici_adi TEXT`);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ofis_kasa_kalem ON ofis_kasa_hareketleri(kalem_id);
      CREATE INDEX IF NOT EXISTS idx_ofis_kasa_muvekkil ON ofis_kasa_hareketleri(muvekkil_id);
      CREATE INDEX IF NOT EXISTS idx_ofis_kasa_tahsil_user ON ofis_kasa_hareketleri(tahsilati_yapan_kullanici_id);
    `);

    // Eski kategori kodlarını kalem_id ile eşle (tutarı değiştirmez)
    db.exec(`
      UPDATE ofis_kasa_hareketleri
      SET kalem_id = (
        SELECT f.id FROM finans_kalemi f
        WHERE f.kod IS NOT NULL AND f.kod = ofis_kasa_hareketleri.kategori
        LIMIT 1
      )
      WHERE kalem_id IS NULL
        AND kategori IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM finans_kalemi f2
          WHERE f2.kod IS NOT NULL AND f2.kod = ofis_kasa_hareketleri.kategori
        );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        olusturma_tarihi TEXT NOT NULL,
        kullanici_id INTEGER,
        kullanici_adi TEXT,
        eylem TEXT NOT NULL,
        varlik_tipi TEXT,
        varlik_id TEXT,
        ozet TEXT,
        detay_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_tarih ON audit_log(olusturma_tarihi DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_log_eylem ON audit_log(eylem);
    `);

    addCol("uygulama_kullanici", "rol", `rol TEXT NOT NULL DEFAULT 'BURO_SAHIBI'`);
    db.exec(`UPDATE uygulama_kullanici SET rol = 'BURO_SAHIBI' WHERE rol IS NULL OR trim(rol) = ''`);
  },
};
