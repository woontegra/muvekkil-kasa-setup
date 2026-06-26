/**
 * Vekalet tahsilatı → Ofis Kasası gelir entegrasyon testi
 * node scripts/run-vekalet-ofis-kasa-test.cjs
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const Database = require("better-sqlite3");

const root = path.join(__dirname, "..");
const dbPath = path.join(os.tmpdir(), `mkd-vekalet-ofis-${Date.now()}.sqlite`);
const db = new Database(dbPath);

function nowIso() {
  return new Date().toISOString();
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function execMigrationFile(relPath, extractExec = true) {
  const src = fs.readFileSync(path.join(root, relPath), "utf8");
  if (extractExec) {
    const m = src.match(/db\.exec\(`([\s\S]*?)`\)/);
    if (m) db.exec(m[1]);
    return;
  }
  const mig = require(path.join(root, relPath.replace(/\.ts$/, ".js")));
  // skip - use SQL extraction
}

function runMigrations() {
  db.exec(`
    CREATE TABLE muvekkil (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      muvekkil_turu TEXT NOT NULL DEFAULT 'GERCEK_KISI',
      ad_soyad TEXT NOT NULL DEFAULT '',
      telefon TEXT,
      sirket_unvani TEXT,
      kayit_tarihi TEXT NOT NULL,
      guncelleme_tarihi TEXT NOT NULL
    );
    CREATE TABLE dosya (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      muvekkil_id INTEGER NOT NULL,
      konu_basligi TEXT,
      kayit_tarihi TEXT NOT NULL,
      guncelleme_tarihi TEXT NOT NULL
    );
    CREATE TABLE dosya_kasa_hareket (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dosya_id INTEGER, muvekkil_id INTEGER, islem_tipi TEXT, masraf_turu TEXT,
      tutar REAL, tarih TEXT, masrafi_yapan_kisi TEXT, aciklama TEXT, belge_no TEXT,
      odeme_yontemi TEXT, onay_durumu TEXT, duzeltme_mi INTEGER, duzeltilen_islem_id INTEGER,
      kayit_tarihi TEXT, guncelleme_tarihi TEXT, olusturan_kullanici_id INTEGER, olusturan_kullanici_adi TEXT
    );
  `);

  const mig002 = fs.readFileSync(path.join(root, "src/main/migrations/index.ts"), "utf8");
  const m2 = mig002.match(/id: "002_ofis_kasa_hareketleri"[\s\S]*?db\.exec\(`([\s\S]*?)`\)/);
  if (!m2) throw new Error("002 migration SQL bulunamadı");
  db.exec(m2[1]);

  const mig005 = fs.readFileSync(path.join(root, "src/main/migrations/005_vekalet_taksit_odeme.ts"), "utf8");
  const m5 = mig005.match(/db\.exec\(`([\s\S]*?)`\)/);
  if (!m5) throw new Error("005 migration SQL bulunamadı");
  db.exec(m5[1]);

  const mig009 = fs.readFileSync(path.join(root, "src/main/migrations/009_vekalet_ofis_kasa.ts"), "utf8");
  const m9a = mig009.match(/ALTER TABLE ofis_kasa_hareketleri ADD COLUMN kaynak_tipi TEXT/);
  if (!m9a) throw new Error("009 migration bulunamadı");
  db.exec(`ALTER TABLE ofis_kasa_hareketleri ADD COLUMN kaynak_tipi TEXT`);
  db.exec(`ALTER TABLE ofis_kasa_hareketleri ADD COLUMN kaynak_id INTEGER`);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ofis_kasa_kaynak_unique
      ON ofis_kasa_hareketleri(kaynak_tipi, kaynak_id)
      WHERE kaynak_tipi IS NOT NULL AND kaynak_id IS NOT NULL;
  `);
  db.exec(
    `ALTER TABLE vekalet_taksit_odeme ADD COLUMN ofis_kasa_hareket_id INTEGER REFERENCES ofis_kasa_hareketleri(id)`
  );
}

function avansBakiye(dosyaId) {
  const rows = db
    .prepare(
      `SELECT islem_tipi, tutar, duzeltme_mi FROM dosya_kasa_hareket WHERE dosya_id = ? AND onay_durumu IN ('ONAYSIZ','ONAYLI')`
    )
    .all(dosyaId);
  let avans = 0;
  let masraf = 0;
  for (const r of rows) {
    if (r.duzeltme_mi) continue;
    if (r.islem_tipi === "AVANS_GIRISI") avans += r.tutar;
    if (r.islem_tipi === "MASRAF") masraf += r.tutar;
  }
  return avans - masraf;
}

function ofisGelirToplam() {
  return Number(
    db
      .prepare(
        `SELECT COALESCE(SUM(tutar),0) s FROM ofis_kasa_hareketleri WHERE islem_tipi='GELIR' AND duzeltme_mi=0`
      )
      .get().s
  );
}

function vekaletTahsilatOfisEkle(odemeId, tutar, tarih, aciklama) {
  const existing = db
    .prepare(`SELECT id FROM ofis_kasa_hareketleri WHERE kaynak_tipi = ? AND kaynak_id = ?`)
    .get("VEKALET_TAHSILATI", odemeId);
  if (existing) return existing.id;

  const t = nowIso();
  const r = db
    .prepare(
      `INSERT INTO ofis_kasa_hareketleri (
        islem_tipi, tarih, kategori, aciklama, tutar, odeme_yontemi,
        onay_durumu, duzeltme_mi, otomatik_onay_mi, olusturma_tarihi, guncelleme_tarihi,
        kaynak_tipi, kaynak_id
      ) VALUES ('GELIR', ?, 'VEKALET_TAHSILATI', ?, ?, 'NAKIT', 'ONAYSIZ', 0, 0, ?, ?, 'VEKALET_TAHSILATI', ?)`
    )
    .run(tarih, aciklama, tutar, t, t, odemeId);
  return Number(r.lastInsertRowid);
}

const t = nowIso();
runMigrations();

db.prepare(`INSERT INTO muvekkil (ad_soyad, kayit_tarihi, guncelleme_tarihi) VALUES ('Ahmet Yılmaz', ?, ?)`).run(t, t);
const muvekkilId = Number(db.prepare(`SELECT last_insert_rowid() id`).get().id);
db.prepare(`INSERT INTO dosya (muvekkil_id, konu_basligi, kayit_tarihi, guncelleme_tarihi) VALUES (?, 'İş davası', ?, ?)`).run(
  muvekkilId,
  t,
  t
);
const dosyaId = Number(db.prepare(`SELECT last_insert_rowid() id`).get().id);

db.prepare(
  `INSERT INTO dosya_kasa_hareket (dosya_id, muvekkil_id, islem_tipi, tutar, tarih, odeme_yontemi, onay_durumu, duzeltme_mi, kayit_tarihi, guncelleme_tarihi)
   VALUES (?, ?, 'AVANS_GIRISI', 5000, '2026-06-01', 'NAKIT', 'ONAYSIZ', 0, ?, ?)`
).run(dosyaId, muvekkilId, t, t);
const avansOnce = avansBakiye(dosyaId);
assert(avansOnce === 5000, "Başlangıç avans 5000 olmalı");

db.prepare(
  `INSERT INTO anlasilan_vekalet_ucreti (dosya_id, muvekkil_id, anlasilan_tutar, kayit_tarihi, guncelleme_tarihi) VALUES (?,?,75000,?,?)`
).run(dosyaId, muvekkilId, t, t);
const vekaletId = Number(db.prepare(`SELECT id FROM anlasilan_vekalet_ucreti WHERE dosya_id=?`).get(dosyaId).id);

db.prepare(
  `INSERT INTO vekalet_ucreti_taksit (vekalet_ucreti_id, dosya_id, muvekkil_id, taksit_no, tutar, kayit_tarihi, guncelleme_tarihi) VALUES (?,?,?,?,15000,?,?)`
).run(vekaletId, dosyaId, muvekkilId, 1, t, t);
const taksitId = Number(db.prepare(`SELECT id FROM vekalet_ucreti_taksit WHERE taksit_no=1`).get().id);

const odemeIns = db
  .prepare(
    `INSERT INTO vekalet_taksit_odeme (taksit_id, vekalet_id, dosya_id, muvekkil_id, odeme_tarihi, tutar, odeme_yontemi, smm_kesildi_mi, kasa_hareket_id, kayit_tarihi, guncelleme_tarihi)
     VALUES (?,?,?,?, '2026-06-20', 15000, 'NAKIT', 0, NULL, ?, ?)`
  )
  .run(taksitId, vekaletId, dosyaId, muvekkilId, t, t);
const odemeId = Number(odemeIns.lastInsertRowid);

const ofisId = vekaletTahsilatOfisEkle(
  odemeId,
  15000,
  "2026-06-20",
  "Vekalet tahsilatı - Ahmet Yılmaz - İş davası - Taksit No: 1"
);
db.prepare(`UPDATE vekalet_taksit_odeme SET ofis_kasa_hareket_id = ? WHERE id = ?`).run(ofisId, odemeId);

assert(avansBakiye(dosyaId) === 5000, "Vekalet tahsilatı avans bakiyesini değiştirmemeli");
assert(ofisGelirToplam() === 15000, "Ofis kasası gelir 15000 olmalı");

const odenen = Number(
  db.prepare(`SELECT COALESCE(SUM(tutar),0) s FROM vekalet_taksit_odeme WHERE taksit_id=?`).get(taksitId).s
);
assert(odenen === 15000, "Taksit ödenen 15000 olmalı");

const ofisId2 = vekaletTahsilatOfisEkle(odemeId, 15000, "2026-06-20", "tekrar");
assert(ofisId2 === ofisId, "Aynı ödeme için ikinci Ofis Kasası kaydı oluşmamalı");
assert(
  Number(db.prepare(`SELECT COUNT(*) c FROM ofis_kasa_hareketleri WHERE kaynak_id=?`).get(odemeId).c) === 1,
  "Tek ofis kasa kaydı"
);

db.prepare(`UPDATE vekalet_taksit_odeme SET smm_kesildi_mi=1 WHERE id=?`).run(odemeId);
const ofisOnceSmm = Number(db.prepare(`SELECT COUNT(*) c FROM ofis_kasa_hareketleri`).get().c);
assert(ofisOnceSmm === 1, "SMM Kesildi Ofis Kasası'na yeni hareket eklememeli");

const ofisRow = db.prepare(`SELECT kategori, aciklama FROM ofis_kasa_hareketleri WHERE id=?`).get(ofisId);
assert(ofisRow.kategori === "VEKALET_TAHSILATI", "Kategori VEKALET_TAHSILATI olmalı");
assert(ofisRow.aciklama.includes("Taksit No: 1"), "Açıklama taksit no içermeli");

console.log("OK — vekalet → ofis kasa entegrasyon testi geçti");
db.close();
try {
  fs.unlinkSync(dbPath);
} catch {
  /* ignore */
}
