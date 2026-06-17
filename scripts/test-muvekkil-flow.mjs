/**
 * Müvekkil / dosya akışı — SQLite servis doğrulaması (Electron olmadan).
 * Kullanım: node scripts/test-muvekkil-flow.mjs
 */
import Database from "better-sqlite3";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmpDir = join(__dirname, "..", ".tmp-test");
const dbPath = join(tmpDir, "flow-test.sqlite");

function nowIso() {
  return new Date().toISOString();
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function setupDb() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE muvekkil (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      muvekkil_turu TEXT NOT NULL DEFAULT 'GERCEK_KISI',
      ad_soyad TEXT NOT NULL DEFAULT '',
      telefon TEXT, eposta TEXT, adres TEXT,
      sirket_unvani TEXT, yetkili_ad_soyad TEXT, yetkili_telefon TEXT,
      mudur_ad_soyad TEXT, mudur_telefon TEXT, muhasebe_ad_soyad TEXT, muhasebe_telefon TEXT,
      vergi_no TEXT, vergi_dairesi TEXT,
      aktif_mi INTEGER NOT NULL DEFAULT 1, notu TEXT,
      kayit_tarihi TEXT NOT NULL, guncelleme_tarihi TEXT NOT NULL
    );
    CREATE TABLE dosya (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      muvekkil_id INTEGER NOT NULL REFERENCES muvekkil(id) ON DELETE CASCADE,
      konu_basligi TEXT, mahkeme_adi TEXT, dosya_numarasi TEXT,
      aciklama TEXT, durum TEXT NOT NULL DEFAULT 'AKTIF', notu TEXT,
      kayit_tarihi TEXT NOT NULL, guncelleme_tarihi TEXT NOT NULL
    );
  `);
  return db;
}

function main() {
  const db = setupDb();
  const t = nowIso();

  const ins = db
    .prepare(
      `INSERT INTO muvekkil (muvekkil_turu, ad_soyad, telefon, eposta, adres, aktif_mi, notu, kayit_tarihi, guncelleme_tarihi)
       VALUES ('GERCEK_KISI', ?, ?, ?, ?, 1, ?, ?, ?)`
    )
    .run("Test Müvekkil", "05551234567", "test@ornek.com", "İstanbul", "not", t, t);
  const mid = Number(ins.lastInsertRowid);
  assert(mid > 0, "müvekkil insert");

  const row = db.prepare(`SELECT * FROM muvekkil WHERE id = ?`).get(mid);
  assert(row?.ad_soyad === "Test Müvekkil", "müvekkil read");

  const dins = db
    .prepare(
      `INSERT INTO dosya (muvekkil_id, konu_basligi, mahkeme_adi, dosya_numarasi, aciklama, durum, kayit_tarihi, guncelleme_tarihi)
       VALUES (?, ?, ?, ?, ?, 'AKTIF', ?, ?)`
    )
    .run(mid, "İcra takibi", "İstanbul 1. İcra", "2024/123", "açıklama", t, t);
  const did = Number(dins.lastInsertRowid);
  assert(did > 0, "dosya insert");

  const list = db.prepare(`SELECT * FROM dosya WHERE muvekkil_id = ?`).all(mid);
  assert(list.length === 1, "dosya list");

  const aktif = db
    .prepare(`SELECT COUNT(*) AS c FROM dosya WHERE muvekkil_id = ? AND durum = 'AKTIF'`)
    .get(mid);
  assert(Number(aktif.c) === 1, "aktif dosya sayısı");

  db.close();

  const db2 = new Database(dbPath);
  const persisted = db2.prepare(`SELECT COUNT(*) AS c FROM muvekkil`).get();
  assert(Number(persisted.c) === 1, "persist after reopen");
  const dosyaPersist = db2.prepare(`SELECT konu_basligi FROM dosya WHERE id = ?`).get(did);
  assert(dosyaPersist?.konu_basligi === "İcra takibi", "dosya persist");
  db2.close();

  console.log("OK — müvekkil/dosya SQLite akış testi geçti.");
  console.log(`  müvekkil id=${mid}, dosya id=${did}`);
}

try {
  main();
} catch (e) {
  console.error("FAIL", e);
  process.exit(1);
}
