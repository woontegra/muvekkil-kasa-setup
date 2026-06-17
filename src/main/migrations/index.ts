import type { Migration } from "../db/migrate";
import { migration003MuvekkilDosya } from "./003_muvekkil_dosya";
import { migration004DosyaKasaHareket } from "./004_dosya_kasa_hareket";
import { migration005Vekalet } from "./005_vekalet_taksit_odeme";
import { migration006MakbuzOffice } from "./006_makbuz_office";
import { migration007OfisKasaDuzeltme } from "./007_ofis_kasa_duzeltme";

/** v0.1.0 asar-extract ile uyumlu kullanıcı tablosu */
export const migration001UygulamaKullanici: Migration = {
  id: "001_uygulama_kullanici",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS uygulama_kullanici (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ad_soyad TEXT NOT NULL,
        kullanici_adi TEXT NOT NULL COLLATE NOCASE UNIQUE,
        eposta TEXT COLLATE NOCASE UNIQUE,
        sifre_hash TEXT NOT NULL,
        aktif_mi INTEGER NOT NULL DEFAULT 1,
        kayit_tarihi TEXT NOT NULL,
        guvenlik_sorusu_kodu TEXT,
        guvenlik_cevap_hash TEXT
      );
    `);
    const cols = db.prepare(`PRAGMA table_info(uygulama_kullanici)`).all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    if (!names.has("guvenlik_sorusu_kodu")) {
      db.exec(`ALTER TABLE uygulama_kullanici ADD COLUMN guvenlik_sorusu_kodu TEXT`);
    }
    if (!names.has("guvenlik_cevap_hash")) {
      db.exec(`ALTER TABLE uygulama_kullanici ADD COLUMN guvenlik_cevap_hash TEXT`);
    }
  },
};

/** out/ build referansı — Ofis Kasası (ileride tam servis) */
export const migration002OfisKasa: Migration = {
  id: "002_ofis_kasa_hareketleri",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ofis_kasa_hareketleri (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        islem_tipi TEXT NOT NULL,
        tarih TEXT NOT NULL,
        kategori TEXT NOT NULL,
        ozel_kategori_adi TEXT,
        aciklama TEXT,
        tutar REAL NOT NULL,
        odeme_yontemi TEXT NOT NULL,
        belge_no TEXT,
        not_metni TEXT,
        onay_durumu TEXT NOT NULL DEFAULT 'ONAYSIZ',
        duzeltme_mi INTEGER NOT NULL DEFAULT 0,
        orijinal_hareket_id INTEGER,
        otomatik_onay_mi INTEGER NOT NULL DEFAULT 0,
        onay_tarihi TEXT,
        olusturma_tarihi TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL,
        olusturan_kullanici_id INTEGER,
        olusturan_kullanici_adi TEXT,
        onaylayan_kullanici_id INTEGER,
        onaylayan_kullanici_adi TEXT,
        FOREIGN KEY (orijinal_hareket_id) REFERENCES ofis_kasa_hareketleri(id)
      );
      CREATE INDEX IF NOT EXISTS idx_ofis_kasa_tarih ON ofis_kasa_hareketleri(tarih);
      CREATE INDEX IF NOT EXISTS idx_ofis_kasa_onay ON ofis_kasa_hareketleri(onay_durumu);
      CREATE INDEX IF NOT EXISTS idx_ofis_kasa_tip ON ofis_kasa_hareketleri(islem_tipi);
    `);
  },
};

export const allMigrations: Migration[] = [
  migration001UygulamaKullanici,
  migration002OfisKasa,
  migration003MuvekkilDosya,
  migration004DosyaKasaHareket,
  migration005Vekalet,
  migration006MakbuzOffice,
  migration007OfisKasaDuzeltme,
];
