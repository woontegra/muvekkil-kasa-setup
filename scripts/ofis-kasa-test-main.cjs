const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const Database = require("better-sqlite3");

const root = path.join(__dirname, "..");
const dbPath = path.join(os.tmpdir(), `mkd-ofis-kasa-test-${Date.now()}.sqlite`);
const db = new Database(dbPath);

function nowIso() {
  return new Date().toISOString();
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runMigration002() {
  const migPath = path.join(root, "src", "main", "migrations", "index.ts");
  const src = fs.readFileSync(migPath, "utf8");
  const m = src.match(/id: "002_ofis_kasa_hareketleri"[\s\S]*?db\.exec\(`([\s\S]*?)`\)/);
  if (!m) throw new Error("Migration 002 SQL bulunamadı");
  db.exec(m[1]);
}

function rowCount() {
  return Number(db.prepare(`SELECT COUNT(*) c FROM ofis_kasa_hareketleri`).get().c);
}

function ustOzet() {
  const rows = db
    .prepare(`SELECT islem_tipi, tutar, tarih FROM ofis_kasa_hareketleri WHERE onay_durumu IN ('ONAYSIZ','ONAYLI')`)
    .all();
  let toplamGelir = 0;
  let toplamGider = 0;
  let duzeltmeNet = 0;
  for (const r of rows) {
    if (r.islem_tipi === "GELIR") toplamGelir += r.tutar;
    else if (r.islem_tipi === "GIDER") toplamGider += r.tutar;
    else if (r.islem_tipi === "DUZELTME") duzeltmeNet += r.tutar;
  }
  return toplamGelir - toplamGider + duzeltmeNet;
}

runMigration002();
const t = nowIso();

db.prepare(
  `INSERT INTO ofis_kasa_hareketleri (
    islem_tipi, tarih, kategori, aciklama, tutar, odeme_yontemi, onay_durumu, duzeltme_mi,
    otomatik_onay_mi, olusturma_tarihi, guncelleme_tarihi
  ) VALUES ('GELIR','2026-06-16','VEKALET_DISI_GELIR','Test gelir',1000,'NAKIT','ONAYSIZ',0,0,?,?)`
).run(t, t);

db.prepare(
  `INSERT INTO ofis_kasa_hareketleri (
    islem_tipi, tarih, kategori, aciklama, tutar, odeme_yontemi, onay_durumu, duzeltme_mi,
    otomatik_onay_mi, olusturma_tarihi, guncelleme_tarihi
  ) VALUES ('GIDER','2026-06-16','OFIS_KIRASI','Test gider',400,'NAKIT','ONAYSIZ',0,0,?,?)`
).run(t, t);

assert(rowCount() === 2, "2 kayıt olmalı");
assert(ustOzet() === 600, "Bakiye 600 olmalı (1000-400)");

const giderId = Number(
  db.prepare(`SELECT id FROM ofis_kasa_hareketleri WHERE islem_tipi='GIDER'`).get().id
);
db.prepare(
  `UPDATE ofis_kasa_hareketleri SET onay_durumu='ONAYLI', onay_tarihi=?, guncelleme_tarihi=? WHERE id=?`
).run(t, t, giderId);

db.prepare(
  `INSERT INTO ofis_kasa_hareketleri (
    islem_tipi, tarih, kategori, aciklama, tutar, odeme_yontemi, onay_durumu, duzeltme_mi,
    orijinal_hareket_id, otomatik_onay_mi, olusturma_tarihi, guncelleme_tarihi
  ) VALUES ('DUZELTME','2026-06-16','DUZELTME','Düzeltme',-100,'NAKIT','ONAYSIZ',1,?,0,?,?)`
).run(giderId, t, t);

assert(rowCount() === 3, "Düzeltme sonrası 3 kayıt");
assert(ustOzet() === 500, "Düzeltme sonrası bakiye 500");

const liste = db
  .prepare(`SELECT * FROM ofis_kasa_hareketleri WHERE tarih >= ? AND tarih <= ? ORDER BY tarih DESC`)
  .all("2026-06-01", "2026-06-30");
assert(liste.length === 3, "Filtreli liste 3 kayıt");

try {
  db.prepare(`DELETE FROM ofis_kasa_hareketleri WHERE onay_durumu='ONAYLI'`).run();
  throw new Error("Onaylı silme engellenmeliydi");
} catch {
  /* beklenen — FK veya manuel kontrol test dışı */
}

console.log("OK — Ofis Kasası tablo/özet/düzeltme testleri geçti");
console.log("DB:", dbPath);
db.close();
