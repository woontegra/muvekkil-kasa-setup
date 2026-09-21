/**
 * RELEASE BLOCKER: legacy paid SQLite → trial-aware schema.
 * Electron native better-sqlite3 ile çalışır (ELECTRON_RUN_AS_NODE).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const Database = require("better-sqlite3");

const nowIso = () => "2026-01-15T10:00:00.000Z";
let passed = 0;
let failed = 0;

function assert(cond, name, detail) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    failed++;
  }
}

function run(db, id, sql) {
  const applied = db.prepare(`SELECT 1 AS x FROM schema_migrations WHERE id = ?`).get(id);
  if (applied) return;
  db.transaction(() => {
    db.exec(sql);
    db.prepare(`INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)`).run(id, nowIso());
  })();
}

const dir = path.join(os.tmpdir(), `mkd-legacy-paid-${Date.now()}`);
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, "legacy.sqlite"));

try {
  console.log("\n=== Legacy paid DB upgrade (RELEASE BLOCKER) ===\n");
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);`);

  run(
    db,
    "001_uygulama_kullanici",
    `CREATE TABLE uygulama_kullanici (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_soyad TEXT NOT NULL,
      kullanici_adi TEXT NOT NULL COLLATE NOCASE UNIQUE,
      eposta TEXT COLLATE NOCASE UNIQUE,
      sifre_hash TEXT NOT NULL,
      aktif_mi INTEGER NOT NULL DEFAULT 1,
      kayit_tarihi TEXT NOT NULL,
      guvenlik_sorusu_kodu TEXT,
      guvenlik_cevap_hash TEXT
    );`,
  );
  run(
    db,
    "002_ofis_kasa_hareketleri",
    `CREATE TABLE ofis_kasa_hareketleri (
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
      onaylayan_kullanici_adi TEXT
    );`,
  );
  run(
    db,
    "003_muvekkil_dosya",
    `CREATE TABLE muvekkil (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      muvekkil_turu TEXT NOT NULL DEFAULT 'GERCEK_KISI',
      ad_soyad TEXT NOT NULL DEFAULT '',
      telefon TEXT,
      eposta TEXT,
      adres TEXT,
      aktif_mi INTEGER NOT NULL DEFAULT 1,
      kayit_tarihi TEXT NOT NULL,
      guncelleme_tarihi TEXT NOT NULL
    );
    CREATE TABLE dosya (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      muvekkil_id INTEGER NOT NULL REFERENCES muvekkil(id) ON DELETE CASCADE,
      konu_basligi TEXT,
      dosya_numarasi TEXT,
      durum TEXT NOT NULL DEFAULT 'AKTIF',
      kayit_tarihi TEXT NOT NULL,
      guncelleme_tarihi TEXT NOT NULL
    );`,
  );
  run(
    db,
    "004_dosya_kasa_hareket",
    `CREATE TABLE dosya_kasa_hareket (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dosya_id INTEGER NOT NULL REFERENCES dosya(id) ON DELETE CASCADE,
      muvekkil_id INTEGER NOT NULL REFERENCES muvekkil(id) ON DELETE CASCADE,
      islem_tipi TEXT NOT NULL,
      tutar REAL NOT NULL,
      tarih TEXT NOT NULL,
      odeme_yontemi TEXT NOT NULL DEFAULT 'NAKIT',
      kayit_tarihi TEXT NOT NULL,
      guncelleme_tarihi TEXT NOT NULL
    );`,
  );
  run(
    db,
    "008_yerel_lisans",
    `CREATE TABLE yerel_lisans (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      license_key TEXT NOT NULL,
      device_hash TEXT NOT NULL,
      product_name TEXT,
      expires_at TEXT,
      last_validated_at TEXT,
      offline_grace_until TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      kayit_tarihi TEXT NOT NULL,
      guncelleme_tarihi TEXT NOT NULL
    );`,
  );
  db.exec(`
    CREATE TABLE office_theme_settings (
      anahtar TEXT PRIMARY KEY NOT NULL,
      deger TEXT NOT NULL,
      guncelleme_tarihi TEXT NOT NULL
    );
  `);

  db.prepare(
    `INSERT INTO uygulama_kullanici (ad_soyad, kullanici_adi, eposta, sifre_hash, aktif_mi, kayit_tarihi)
     VALUES ('Avukat Eski', 'avukateski', NULL, 'hash', 1, ?)`,
  ).run(nowIso());
  db.prepare(
    `INSERT INTO yerel_lisans (
      id, license_key, device_hash, product_name, expires_at,
      last_validated_at, offline_grace_until, status, kayit_tarihi, guncelleme_tarihi
    ) VALUES (1, 'WTG-PAID-LEGACY-0001', 'abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd',
      'Müvekkil Kasa Defteri', '2027-06-01T00:00:00.000Z', '2026-01-14T10:00:00.000Z',
      '2026-01-21T10:00:00.000Z', 'ACTIVE', ?, ?)`,
  ).run(nowIso(), nowIso());
  db.prepare(`INSERT INTO muvekkil (ad_soyad, kayit_tarihi, guncelleme_tarihi) VALUES ('Müvekkil Eski', ?, ?)`).run(
    nowIso(),
    nowIso(),
  );
  const muvekkil = db.prepare(`SELECT id FROM muvekkil LIMIT 1`).get();
  db.prepare(
    `INSERT INTO dosya (muvekkil_id, konu_basligi, dosya_numarasi, kayit_tarihi, guncelleme_tarihi)
     VALUES (?, 'Eski dosya', '2024/1', ?, ?)`,
  ).run(muvekkil.id, nowIso(), nowIso());
  const dosya = db.prepare(`SELECT id FROM dosya LIMIT 1`).get();
  db.prepare(
    `INSERT INTO dosya_kasa_hareket (dosya_id, muvekkil_id, islem_tipi, tutar, tarih, kayit_tarihi, guncelleme_tarihi)
     VALUES (?, ?, 'TAHSILAT', 1500, '2026-01-10', ?, ?)`,
  ).run(dosya.id, muvekkil.id, nowIso(), nowIso());
  db.prepare(
    `INSERT INTO ofis_kasa_hareketleri (islem_tipi, tarih, kategori, tutar, odeme_yontemi, olusturma_tarihi, guncelleme_tarihi)
     VALUES ('GIDER', '2026-01-10', 'KIRA', 250, 'NAKIT', ?, ?)`,
  ).run(nowIso(), nowIso());
  db.prepare(
    `INSERT INTO office_theme_settings (anahtar, deger, guncelleme_tarihi) VALUES ('office_theme', 'classic', ?)`,
  ).run(nowIso());

  const before = db
    .prepare(`SELECT license_key, expires_at, device_hash, offline_grace_until, status FROM yerel_lisans WHERE id = 1`)
    .get();
  const beforeUsers = db.prepare(`SELECT COUNT(*) AS c FROM uygulama_kullanici`).get();
  const beforeMuv = db.prepare(`SELECT COUNT(*) AS c FROM muvekkil`).get();
  const beforeDosya = db.prepare(`SELECT COUNT(*) AS c FROM dosya`).get();
  const beforeKasa = db.prepare(`SELECT COUNT(*) AS c FROM dosya_kasa_hareket`).get();
  const beforeOfis = db.prepare(`SELECT COUNT(*) AS c FROM ofis_kasa_hareketleri`).get();
  const beforeTheme = db.prepare(`SELECT deger FROM office_theme_settings WHERE anahtar = 'office_theme'`).get();
  const beforeKind = db.prepare(`PRAGMA table_info(yerel_lisans)`).all().some((c) => c.name === "kind");
  assert(!beforeKind, "legacy schema has no kind");

  const migration014 = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "migrations", "014_license_trial.ts"),
    "utf8",
  );
  assert(migration014.includes("kind TEXT NOT NULL DEFAULT 'paid'"), "014 source defaults kind=paid");
  assert(migration014.includes("'paid'"), "014 copies existing rows as paid");

  db.transaction(() => {
    db.exec(`
      CREATE TABLE yerel_lisans_v2 (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        kind TEXT NOT NULL DEFAULT 'paid' CHECK (kind IN ('paid', 'trial')),
        license_key TEXT,
        device_hash TEXT NOT NULL,
        product_name TEXT,
        expires_at TEXT,
        last_validated_at TEXT,
        offline_grace_until TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        kayit_tarihi TEXT NOT NULL,
        guncelleme_tarihi TEXT NOT NULL
      );
      INSERT INTO yerel_lisans_v2 (
        id, kind, license_key, device_hash, product_name, expires_at,
        last_validated_at, offline_grace_until, status, kayit_tarihi, guncelleme_tarihi
      )
      SELECT
        id, 'paid', license_key, device_hash, product_name, expires_at,
        last_validated_at, offline_grace_until, status, kayit_tarihi, guncelleme_tarihi
      FROM yerel_lisans;
      DROP TABLE yerel_lisans;
      ALTER TABLE yerel_lisans_v2 RENAME TO yerel_lisans;
    `);
    db.prepare(`INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)`).run("014_license_trial", nowIso());
  })();

  db.transaction(() => {
    const cols = db.prepare(`PRAGMA table_info(uygulama_kullanici)`).all();
    if (!cols.some((c) => c.name === "telefon")) {
      db.exec(`ALTER TABLE uygulama_kullanici ADD COLUMN telefon TEXT`);
    }
    db.prepare(`INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)`).run("015_user_contact", nowIso());
  })();

  const after = db
    .prepare(`SELECT kind, license_key, expires_at, device_hash, offline_grace_until, status FROM yerel_lisans WHERE id = 1`)
    .get();
  const afterUser = db.prepare(`SELECT id, ad_soyad, kullanici_adi FROM uygulama_kullanici WHERE kullanici_adi = 'avukateski'`).get();
  const afterMuv = db.prepare(`SELECT ad_soyad FROM muvekkil LIMIT 1`).get();
  const afterDosya = db.prepare(`SELECT konu_basligi FROM dosya LIMIT 1`).get();
  assert(db.prepare(`PRAGMA table_info(yerel_lisans)`).all().some((c) => c.name === "kind"), "A) kind column added");
  assert(after.kind === "paid", "B) legacy paid kind=paid");
  assert(after.license_key === before.license_key, "C) license_key unchanged");
  assert(after.expires_at === before.expires_at, "D) expires_at unchanged");
  assert(after.device_hash === before.device_hash, "E) device_hash unchanged");
  assert(after.offline_grace_until === before.offline_grace_until, "F) offline_grace_until unchanged");
  assert(afterUser.ad_soyad === "Avukat Eski", "G) local user same");
  assert(afterMuv.ad_soyad === "Müvekkil Eski", "H) muvekkil same");
  assert(afterDosya.konu_basligi === "Eski dosya", "I) dosya same");
  assert(db.prepare(`SELECT COUNT(*) AS c FROM dosya_kasa_hareket`).get().c === beforeKasa.c, "J) finans rows same");
  assert(db.prepare(`SELECT COUNT(*) AS c FROM ofis_kasa_hareketleri`).get().c === beforeOfis.c, "J2 ofis kasa same");
  assert(
    db.prepare(`SELECT deger FROM office_theme_settings WHERE anahtar = 'office_theme'`).get().deger === beforeTheme.deger,
    "K) ayarlar same",
  );
  assert(after.status === "ACTIVE", "L) remains ACTIVE paid");
  assert(after.kind !== "trial", "N) not converted to trial");
  assert(db.prepare(`SELECT COUNT(*) AS c FROM uygulama_kullanici`).get().c === beforeUsers.c, "user count same");
  assert(db.prepare(`SELECT COUNT(*) AS c FROM muvekkil`).get().c === beforeMuv.c, "muvekkil count same");
  assert(db.prepare(`SELECT COUNT(*) AS c FROM dosya`).get().c === beforeDosya.c, "dosya count same");
  assert(db.prepare(`PRAGMA table_info(uygulama_kullanici)`).all().some((c) => c.name === "telefon"), "015 telefon added");
} finally {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`\n=== Upgrade results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
