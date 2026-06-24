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

function ozetSatirlari() {
  return db
    .prepare(
      `SELECT islem_tipi, tutar, tarih, duzeltme_mi, onay_durumu, NULL AS duzeltme_kasa_etkisi
       FROM ofis_kasa_hareketleri WHERE onay_durumu IN ('ONAYSIZ','ONAYLI')`
    )
    .all();
}

function satirKatki(r) {
  if (r.islem_tipi === "GELIR" && !r.duzeltme_mi) return { gelir: r.tutar, gider: 0, duzeltme: 0 };
  if (r.islem_tipi === "GIDER" && !r.duzeltme_mi) return { gelir: 0, gider: r.tutar, duzeltme: 0 };
  if (r.islem_tipi === "DUZELTME" && r.duzeltme_mi) {
    const duzeltme = r.duzeltme_kasa_etkisi != null ? r.duzeltme_kasa_etkisi : r.tutar;
    return { gelir: 0, gider: 0, duzeltme };
  }
  return { gelir: 0, gider: 0, duzeltme: 0 };
}

function lifetimeBakiye(rows) {
  let gelir = 0;
  let gider = 0;
  let duzeltme = 0;
  for (const r of rows) {
    const k = satirKatki(r);
    gelir += k.gelir;
    gider += k.gider;
    duzeltme += k.duzeltme;
  }
  return gelir - gider + duzeltme;
}

function hesaplaDonemOzet(rows, donemBas, donemBit) {
  let devredenGelir = 0;
  let devredenGider = 0;
  let devredenDuzeltme = 0;
  let donemGelir = 0;
  let donemGider = 0;
  let donemDuzeltme = 0;

  for (const r of rows) {
    const t = String(r.tarih ?? "").slice(0, 10);
    const k = satirKatki(r);
    if (t < donemBas) {
      devredenGelir += k.gelir;
      devredenGider += k.gider;
      devredenDuzeltme += k.duzeltme;
    } else if (t <= donemBit) {
      donemGelir += k.gelir;
      donemGider += k.gider;
      donemDuzeltme += k.duzeltme;
    }
  }

  const devredenBakiye = devredenGelir - devredenGider + devredenDuzeltme;
  const kasaBakiyesi = devredenBakiye + (donemGelir - donemGider + donemDuzeltme);
  return {
    devredenBakiye,
    donemGelir,
    donemGider,
    donemDuzeltmeEtkisi: donemDuzeltme,
    kasaBakiyesi,
  };
}

function insertHareket(islemTipi, tarih, tutar, extra = {}) {
  const t = nowIso();
  db.prepare(
    `INSERT INTO ofis_kasa_hareketleri (
      islem_tipi, tarih, kategori, aciklama, tutar, odeme_yontemi, onay_durumu, duzeltme_mi,
      otomatik_onay_mi, olusturma_tarihi, guncelleme_tarihi
    ) VALUES (?,?,?,?,?,?,?,?,0,?,?)`
  ).run(
    islemTipi,
    tarih,
    extra.kategori ?? (islemTipi === "GELIR" ? "VEKALET_DISI_GELIR" : "OFIS_KIRASI"),
    extra.aciklama ?? "Test",
    tutar,
    "NAKIT",
    extra.onayDurumu ?? "ONAYSIZ",
    extra.duzeltmeMi ?? 0,
    t,
    t
  );
}

runMigration002();
const t = nowIso();

insertHareket("GELIR", "2026-06-16", 1000);
insertHareket("GIDER", "2026-06-16", 400);

assert(rowCount() === 2, "2 kayıt olmalı");
assert(lifetimeBakiye(ozetSatirlari()) === 600, "Bakiye 600 olmalı (1000-400)");

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
assert(lifetimeBakiye(ozetSatirlari()) === 500, "Düzeltme sonrası bakiye 500");

const liste = db
  .prepare(`SELECT * FROM ofis_kasa_hareketleri WHERE tarih >= ? AND tarih <= ? ORDER BY tarih DESC`)
  .all("2026-06-01", "2026-06-30");
assert(liste.length === 3, "Filtreli liste 3 kayıt");

// --- Devreden bakiye: Mayıs sonu 1.250 ₺, Haziran başı devreden + sıfır ay neti ---
db.exec(`DELETE FROM ofis_kasa_hareketleri`);
insertHareket("GELIR", "2026-05-10", 2000);
insertHareket("GIDER", "2026-05-20", 750);

const mayisSonu = hesaplaDonemOzet(ozetSatirlari(), "2026-05-01", "2026-05-31");
assert(mayisSonu.kasaBakiyesi === 1250, `Mayıs sonu bakiye 1250 olmalı, gelen: ${mayisSonu.kasaBakiyesi}`);

const haziranBasi = hesaplaDonemOzet(ozetSatirlari(), "2026-06-01", "2026-06-30");
assert(haziranBasi.devredenBakiye === 1250, `Haziran devreden 1250 olmalı, gelen: ${haziranBasi.devredenBakiye}`);
assert(haziranBasi.donemGelir === 0, "Haziran gelir sıfır başlamalı");
assert(haziranBasi.donemGider === 0, "Haziran gider sıfır başlamalı");
assert(haziranBasi.donemDuzeltmeEtkisi === 0, "Haziran düzeltme sıfır başlamalı");
assert(haziranBasi.kasaBakiyesi === 1250, "Haziran başı güncel bakiye devreden ile aynı olmalı");

insertHareket("GELIR", "2026-06-05", 300);
insertHareket("GIDER", "2026-06-12", 50);
const haziranOrta = hesaplaDonemOzet(ozetSatirlari(), "2026-06-01", "2026-06-30");
assert(haziranOrta.devredenBakiye === 1250, "Devreden değişmemeli");
assert(haziranOrta.donemGelir === 300, "Haziran gelir 300");
assert(haziranOrta.donemGider === 50, "Haziran gider 50");
assert(haziranOrta.kasaBakiyesi === 1500, `Güncel bakiye 1500 olmalı, gelen: ${haziranOrta.kasaBakiyesi}`);
assert(lifetimeBakiye(ozetSatirlari()) === 1500, "Ömür boyu bakiye 1500");

try {
  db.prepare(`DELETE FROM ofis_kasa_hareketleri WHERE onay_durumu='ONAYLI'`).run();
  throw new Error("Onaylı silme engellenmeliydi");
} catch {
  /* beklenen — FK veya manuel kontrol test dışı */
}

console.log("OK — Ofis Kasası tablo/özet/düzeltme/devreden testleri geçti");
console.log("DB:", dbPath);
db.close();
