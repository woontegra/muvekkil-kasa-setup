const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const Database = require("better-sqlite3");

const root = path.join(__dirname, "..");
const dbPath = path.join(os.tmpdir(), `mkd-vekalet-test-${Date.now()}.sqlite`);
const db = new Database(dbPath);

function nowIso() {
  return new Date().toISOString();
}

function runMigrations() {
  const migPath = path.join(root, "src", "main", "migrations", "005_vekalet_taksit_odeme.ts");
  const src = fs.readFileSync(migPath, "utf8");
  const m = src.match(/db\.exec\(`([\s\S]*?)`\)/);
  if (!m) throw new Error("Migration 005 SQL bulunamadı");
  db.exec(`
    CREATE TABLE muvekkil (id INTEGER PRIMARY KEY, ad_soyad TEXT);
    CREATE TABLE dosya (id INTEGER PRIMARY KEY, muvekkil_id INTEGER);
    CREATE TABLE dosya_kasa_hareket (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dosya_id INTEGER, muvekkil_id INTEGER, islem_tipi TEXT, masraf_turu TEXT,
      tutar REAL, tarih TEXT, masrafi_yapan_kisi TEXT, aciklama TEXT, belge_no TEXT,
      odeme_yontemi TEXT, onay_durumu TEXT, duzeltme_mi INTEGER, duzeltilen_islem_id INTEGER,
      kayit_tarihi TEXT, guncelleme_tarihi TEXT, olusturan_kullanici_id INTEGER, olusturan_kullanici_adi TEXT
    );
    CREATE TABLE belge_no_sayac (id INTEGER PRIMARY KEY, yil INTEGER, onEk TEXT, son_no INTEGER);
  `);
  db.exec(m[1]);
  db.prepare(`INSERT INTO muvekkil (id, ad_soyad) VALUES (1, 'Test')`).run();
  db.prepare(`INSERT INTO dosya (id, muvekkil_id) VALUES (1, 1)`).run();
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const t = nowIso();
runMigrations();

db.prepare(
  `INSERT INTO anlasilan_vekalet_ucreti (dosya_id, muvekkil_id, anlasilan_tutar, kayit_tarihi, guncelleme_tarihi) VALUES (1,1,120000,?,?)`
).run(t, t);
const vekaletId = Number(db.prepare(`SELECT id FROM anlasilan_vekalet_ucreti WHERE dosya_id=1`).get().id);

const taksitler = [50000, 50000, 20000];
for (let i = 0; i < 3; i++) {
  db.prepare(
    `INSERT INTO vekalet_ucreti_taksit (vekalet_ucreti_id, dosya_id, muvekkil_id, taksit_no, tutar, kayit_tarihi, guncelleme_tarihi) VALUES (?,?,?,?,?,?,?)`
  ).run(vekaletId, 1, 1, i + 1, taksitler[i], t, t);
}
const taksit1 = Number(db.prepare(`SELECT id FROM vekalet_ucreti_taksit WHERE taksit_no=1`).get().id);

db.prepare(
  `INSERT INTO dosya_kasa_hareket (dosya_id, muvekkil_id, islem_tipi, tutar, tarih, aciklama, belge_no, odeme_yontemi, onay_durumu, duzeltme_mi, kayit_tarihi, guncelleme_tarihi)
   VALUES (1,1,'AVANS_GIRISI',30000,'2026-06-16','Vekalet taksit #1 tahsilatı','AVN-2026-000001','NAKIT','ONAYSIZ',0,?,?)`
).run(t, t);
const kasaId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);

db.prepare(
  `INSERT INTO vekalet_taksit_odeme (taksit_id, vekalet_id, dosya_id, muvekkil_id, odeme_tarihi, tutar, odeme_yontemi, smm_kesildi_mi, kasa_hareket_id, kayit_tarihi, guncelleme_tarihi)
   VALUES (?,?,?,?,?,?,?,?,?,?,?)`
).run(taksit1, vekaletId, 1, 1, "2026-06-16", 30000, "NAKIT", 0, kasaId, t, t);
const odeme1 = Number(db.prepare(`SELECT id FROM vekalet_taksit_odeme`).get().id);

const odenen1 = Number(db.prepare(`SELECT COALESCE(SUM(tutar),0) s FROM vekalet_taksit_odeme WHERE taksit_id=?`).get(taksit1).s);
assert(odenen1 === 30000, "1. ödeme 30000 olmalı");
assert(
  Number(db.prepare(`SELECT COUNT(*) c FROM vekalet_taksit_odeme WHERE smm_kesildi_mi=0`).get().c) === 1,
  "SMM bekleyen 1 olmalı"
);

db.prepare(`UPDATE vekalet_taksit_odeme SET smm_kesildi_mi=1 WHERE id=?`).run(odeme1);
assert(
  Number(db.prepare(`SELECT COUNT(*) c FROM vekalet_taksit_odeme WHERE smm_kesildi_mi=0`).get().c) === 0,
  "SMM kesildi sonrası bekleyen 0"
);

db.prepare(
  `INSERT INTO dosya_kasa_hareket (dosya_id, muvekkil_id, islem_tipi, tutar, tarih, aciklama, belge_no, odeme_yontemi, onay_durumu, duzeltme_mi, kayit_tarihi, guncelleme_tarihi)
   VALUES (1,1,'AVANS_GIRISI',20000,'2026-06-17','Vekalet taksit #1 tahsilatı','AVN-2026-000002','NAKIT','ONAYSIZ',0,?,?)`
).run(t, t);
db.prepare(
  `INSERT INTO vekalet_taksit_odeme (taksit_id, vekalet_id, dosya_id, muvekkil_id, odeme_tarihi, tutar, odeme_yontemi, smm_kesildi_mi, kasa_hareket_id, kayit_tarihi, guncelleme_tarihi)
   VALUES (?,?,?,?,?,?,?,0,?,?,?)`
).run(taksit1, vekaletId, 1, 1, "2026-06-17", 20000, "NAKIT", kasaId + 1, t, t);

const odenenTop = Number(db.prepare(`SELECT COALESCE(SUM(tutar),0) s FROM vekalet_taksit_odeme WHERE taksit_id=?`).get(taksit1).s);
assert(odenenTop === 50000, "Taksit tam ödendi");
assert(
  Number(db.prepare(`SELECT COUNT(*) c FROM vekalet_taksit_odeme WHERE smm_kesildi_mi=0`).get().c) === 1,
  "2. ödeme için SMM bekliyor"
);
assert(
  Number(db.prepare(`SELECT COUNT(*) c FROM dosya_kasa_hareket WHERE aciklama LIKE 'Vekalet taksit #1%'`).get().c) === 2,
  "2 kasa hareketi"
);

console.log("OK — vekalet test senaryosu geçti");
db.close();
try {
  fs.unlinkSync(dbPath);
} catch {
  /* ignore */
}
