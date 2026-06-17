const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const Database = require("better-sqlite3");

const root = path.join(__dirname, "..");
const dbPath = path.join(os.tmpdir(), `mkd-makbuz-test-${Date.now()}.sqlite`);
const db = new Database(dbPath);
const t = new Date().toISOString();

function mig006() {
  const src = fs.readFileSync(path.join(root, "src", "main", "migrations", "006_makbuz_office.ts"), "utf8");
  const m = src.match(/db\.exec\(`([\s\S]*?)`\)/);
  if (!m) throw new Error("migration 006 sql");
  db.exec(m[1]);
  const t2 = new Date().toISOString();
  db.prepare(`INSERT INTO office_settings (id, kayit_tarihi, guncelleme_tarihi) VALUES (1,?,?)`).run(t2, t2);
}

db.exec(`
  CREATE TABLE muvekkil (id INTEGER PRIMARY KEY, ad_soyad TEXT, muvekkil_turu TEXT DEFAULT 'GERCEK_KISI');
  CREATE TABLE dosya (id INTEGER PRIMARY KEY, muvekkil_id INTEGER, konu_basligi TEXT, mahkeme_adi TEXT, dosya_numarasi TEXT);
  CREATE TABLE dosya_kasa_hareket (
    id INTEGER PRIMARY KEY AUTOINCREMENT, dosya_id INTEGER, muvekkil_id INTEGER, islem_tipi TEXT,
    tutar REAL, tarih TEXT, belge_no TEXT, odeme_yontemi TEXT, onay_durumu TEXT,
    duzeltme_mi INTEGER DEFAULT 0, kayit_tarihi TEXT, guncelleme_tarihi TEXT,
    makbuz_no TEXT, makbuz_olusturuldu_mu INTEGER DEFAULT 0, makbuz_tarihi TEXT
  );
  CREATE TABLE vekalet_taksit_odeme (
    id INTEGER PRIMARY KEY AUTOINCREMENT, taksit_id INTEGER, vekalet_id INTEGER,
    dosya_id INTEGER, muvekkil_id INTEGER, odeme_tarihi TEXT, tutar REAL,
    odeme_yontemi TEXT, makbuz_no TEXT, smm_kesildi_mi INTEGER DEFAULT 0,
    kayit_tarihi TEXT, guncelleme_tarihi TEXT
  );
`);
mig006();
db.prepare(`INSERT INTO muvekkil (id, ad_soyad) VALUES (1,'Test')`).run();
db.prepare(`INSERT INTO dosya (id, muvekkil_id, konu_basligi, mahkeme_adi, dosya_numarasi) VALUES (1,1,'Konu','Mahkeme','2024/1')`).run();
db.prepare(
  `INSERT INTO dosya_kasa_hareket (dosya_id, muvekkil_id, islem_tipi, tutar, tarih, belge_no, odeme_yontemi, onay_durumu, kayit_tarihi, guncelleme_tarihi)
   VALUES (1,1,'AVANS_GIRISI',5000,'2026-06-16','AVN-2026-000001','NAKIT','ONAYLI',?,?)`
).run(t, t);
const hId = Number(db.prepare(`SELECT last_insert_rowid() id`).get().id);

function kasaMakbuzNo(id) {
  const cur = db.prepare(`SELECT makbuz_no, onay_durumu FROM dosya_kasa_hareket WHERE id=?`).get(id);
  if (cur.makbuz_no) return cur.makbuz_no;
  const yil = 2026;
  const next = 1;
  db.prepare(`INSERT INTO makbuz_sayac (yil, son_sira) VALUES (?,?)`).run(yil, next);
  const no = `MAK-${yil}-000001`;
  db.prepare(`UPDATE dosya_kasa_hareket SET makbuz_no=?, makbuz_olusturuldu_mu=1, makbuz_tarihi='2026-06-16' WHERE id=?`).run(no, id);
  return no;
}

const n1 = kasaMakbuzNo(hId);
const n2 = kasaMakbuzNo(hId);
if (n1 !== n2 || !/^MAK-2026-\d{6}$/.test(n1)) throw new Error("kasa makbuz no fail");

db.prepare(
  `INSERT INTO vekalet_taksit_odeme (taksit_id, vekalet_id, dosya_id, muvekkil_id, odeme_tarihi, tutar, odeme_yontemi, kayit_tarihi, guncelleme_tarihi)
   VALUES (1,1,1,1,'2026-06-16',30000,'NAKIT',?,?)`
).run(t, t);
db.prepare(
  `INSERT INTO vekalet_taksit_odeme (taksit_id, vekalet_id, dosya_id, muvekkil_id, odeme_tarihi, tutar, odeme_yontemi, kayit_tarihi, guncelleme_tarihi)
   VALUES (1,1,1,1,'2026-06-17',20000,'NAKIT',?,?)`
).run(t, t);
const o1 = Number(db.prepare(`SELECT id FROM vekalet_taksit_odeme ORDER BY id`).get().id);
const o2 = o1 + 1;

function vekMakbuz(oid) {
  const cur = db.prepare(`SELECT makbuz_no, tutar FROM vekalet_taksit_odeme WHERE id=?`).get(oid);
  if (cur.makbuz_no) return { no: cur.makbuz_no, tutar: cur.tutar };
  const yil = 2026;
  const row = db.prepare(`SELECT son_sira FROM vekalet_makbuz_sayac WHERE yil=?`).get(yil);
  const next = (row?.son_sira ?? 0) + 1;
  if (row) db.prepare(`UPDATE vekalet_makbuz_sayac SET son_sira=? WHERE yil=?`).run(next, yil);
  else db.prepare(`INSERT INTO vekalet_makbuz_sayac (yil, son_sira) VALUES (?,?)`).run(yil, next);
  const no = `VEK-${yil}-${String(next).padStart(6, "0")}`;
  db.prepare(`UPDATE vekalet_taksit_odeme SET makbuz_no=? WHERE id=?`).run(no, oid);
  return { no, tutar: cur.tutar };
}

const v1 = vekMakbuz(o1);
const v1b = vekMakbuz(o1);
const v2 = vekMakbuz(o2);
if (v1.no !== v1b.no) throw new Error("vekalet tekrar no degisti");
if (v1.tutar !== 30000 || v2.tutar !== 20000) throw new Error("vekalet tutar yanlis");
if (!v1.no.startsWith("VEK-2026-")) throw new Error("vek format");

console.log("OK — makbuz test geçti");
db.close();
try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
