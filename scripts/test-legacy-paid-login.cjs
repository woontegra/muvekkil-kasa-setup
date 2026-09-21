/**
 * RELEASE BLOCKER: 0.1.9 legacy paid user → 0.1.10 username/email identity.
 * Temp SQLite only. Production DB'ye yazmaz. /trial çağırmaz.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const root = path.join(__dirname, "..");
const identitySrc = fs.readFileSync(path.join(root, "src", "shared", "lib", "localAuthIdentity.ts"), "utf8");
const authSrc = fs.readFileSync(path.join(root, "src", "main", "services", "auth.service.ts"), "utf8");

const sqlMatch = identitySrc.match(/export const LOGIN_IDENTITY_SQL =\s*"([^"]+)"/);
const LOGIN_IDENTITY_SQL = sqlMatch ? sqlMatch[1] : "";
const EMPTY_ERR = "E-posta veya kullanıcı adı boş olamaz.";
const CRED_ERR = "E-posta, kullanıcı adı veya şifre hatalı.";

function safeTrim(raw) {
  return typeof raw === "string" ? raw.trim() : "";
}
function normalizeLocalEmail(raw) {
  return safeTrim(raw).toLowerCase();
}

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

function findByIdentity(db, identity) {
  const raw = safeTrim(identity);
  if (!raw) return undefined;
  return db
    .prepare(`SELECT * FROM uygulama_kullanici WHERE ${LOGIN_IDENTITY_SQL}`)
    .get(raw, normalizeLocalEmail(raw));
}

function login(db, identity, password) {
  const ka = safeTrim(identity);
  if (!ka || !password) return { ok: false, error: "Lütfen tüm alanları doldurun." };
  const r = findByIdentity(db, ka);
  if (!r) return { ok: false, error: CRED_ERR };
  if (!Number(r.aktif_mi)) return { ok: false, error: "Bu kullanıcı pasif durumda." };
  if (!bcrypt.compareSync(password, r.sifre_hash)) return { ok: false, error: CRED_ERR };
  return { ok: true, id: r.id };
}

function forgotGetQuestion(db, identity) {
  const ka = safeTrim(identity);
  if (!ka) return { ok: false, error: EMPTY_ERR };
  const r = findByIdentity(db, ka);
  if (!r || !Number(r.aktif_mi)) return { ok: false, error: "Kullanıcı bulunamadı." };
  const kod = (r.guvenlik_sorusu_kodu || "").trim();
  if (!kod) return { ok: false, error: "Bu hesap için güvenlik sorusu tanımlı değil." };
  return { ok: true, soruKodu: kod };
}

function snapshot(db) {
  const user = db
    .prepare(
      `SELECT id, kullanici_adi, eposta, telefon, sifre_hash, guvenlik_sorusu_kodu, guvenlik_cevap_hash, aktif_mi
       FROM uygulama_kullanici WHERE id = 1`,
    )
    .get();
  const license = db
    .prepare(`SELECT kind, license_key, device_hash, status, expires_at FROM yerel_lisans WHERE id = 1`)
    .get();
  const counts = {
    users: db.prepare(`SELECT COUNT(*) AS c FROM uygulama_kullanici`).get().c,
    muvekkil: db.prepare(`SELECT COUNT(*) AS c FROM muvekkil`).get().c,
    dosya: db.prepare(`SELECT COUNT(*) AS c FROM dosya`).get().c,
    kasa: db.prepare(`SELECT COUNT(*) AS c FROM dosya_kasa_hareket`).get().c,
  };
  return { user, license, counts };
}

assert(Boolean(LOGIN_IDENTITY_SQL) && LOGIN_IDENTITY_SQL.includes("kullanici_adi = ?"), "LOGIN_IDENTITY_SQL exported");
assert(LOGIN_IDENTITY_SQL.includes("eposta = ? COLLATE NOCASE"), "identity SQL matches eposta OR username");
assert(identitySrc.includes("LOCAL_AUTH_IDENTITY_EMPTY_ERROR") && identitySrc.includes(EMPTY_ERR), "empty identity error constant");
assert(identitySrc.includes("LOCAL_AUTH_CREDENTIALS_INVALID_ERROR") && identitySrc.includes(CRED_ERR), "credentials error constant");
assert(authSrc.includes("findUserRowByLoginIdentity(ka)"), "login uses shared identity resolver");
assert((authSrc.match(/findUserRowByLoginIdentity/g) || []).length >= 3, "login + forgot get + forgot submit share resolver");
assert(authSrc.includes("LOCAL_AUTH_IDENTITY_EMPTY_ERROR"), "auth empty error is identity-neutral");
assert(authSrc.includes("LOCAL_AUTH_CREDENTIALS_INVALID_ERROR"), "auth login error is identity-neutral");
assert(!authSrc.includes("E-posta boş olamaz."), "no email-only empty error in auth.service");
assert(!authSrc.includes('"E-posta veya şifre hatalı."'), "no email-only credential error in auth.service");

const dir = path.join(os.tmpdir(), `mkd-legacy-paid-login-${Date.now()}`);
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, "legacy-paid.sqlite"));

try {
  console.log("\n=== Legacy paid username login (RELEASE BLOCKER) ===\n");

  db.exec(`
    CREATE TABLE uygulama_kullanici (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_soyad TEXT NOT NULL,
      kullanici_adi TEXT NOT NULL COLLATE NOCASE UNIQUE,
      eposta TEXT COLLATE NOCASE UNIQUE,
      telefon TEXT,
      sifre_hash TEXT NOT NULL,
      aktif_mi INTEGER NOT NULL DEFAULT 1,
      kayit_tarihi TEXT NOT NULL,
      guvenlik_sorusu_kodu TEXT,
      guvenlik_cevap_hash TEXT
    );
    CREATE TABLE yerel_lisans (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      kind TEXT NOT NULL DEFAULT 'paid',
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
    CREATE TABLE muvekkil (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_soyad TEXT NOT NULL,
      kayit_tarihi TEXT NOT NULL,
      guncelleme_tarihi TEXT NOT NULL
    );
    CREATE TABLE dosya (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      muvekkil_id INTEGER NOT NULL,
      konu_basligi TEXT,
      kayit_tarihi TEXT NOT NULL
    );
    CREATE TABLE dosya_kasa_hareket (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dosya_id INTEGER NOT NULL,
      muvekkil_id INTEGER NOT NULL,
      islem_tipi TEXT NOT NULL,
      tutar REAL NOT NULL
    );
  `);

  const password = "EskiSifre1";
  const hash = bcrypt.hashSync(password, 12);
  const cevapHash = bcrypt.hashSync("ankara", 12);
  db.prepare(
    `INSERT INTO uygulama_kullanici
      (ad_soyad, kullanici_adi, eposta, telefon, sifre_hash, aktif_mi, kayit_tarihi, guvenlik_sorusu_kodu, guvenlik_cevap_hash)
     VALUES ('Avukat Eski', 'avukateski', NULL, NULL, ?, 1, '2025-01-01T00:00:00.000Z', 'G2', ?)`,
  ).run(hash, cevapHash);
  db.prepare(
    `INSERT INTO yerel_lisans (id, kind, license_key, device_hash, product_name, expires_at, last_validated_at, offline_grace_until, status, kayit_tarihi, guncelleme_tarihi)
     VALUES (1, 'paid', 'WTG-PAID-LEGACY-0001', 'abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd',
       'Müvekkil Kasa Defteri', '2028-07-26T07:56:50.203Z', '2026-09-21T08:50:47.377Z', '2026-09-28T08:50:47.377Z',
       'ACTIVE', '2026-07-27T08:01:02.391Z', '2026-09-21T08:50:47.377Z')`,
  ).run();
  db.prepare(`INSERT INTO muvekkil (ad_soyad, kayit_tarihi, guncelleme_tarihi) VALUES ('Müvekkil Eski', '2026-01-01', '2026-01-01')`).run();
  db.prepare(`INSERT INTO dosya (muvekkil_id, konu_basligi, kayit_tarihi) VALUES (1, 'Eski dosya', '2026-01-01')`).run();
  db.prepare(`INSERT INTO dosya_kasa_hareket (dosya_id, muvekkil_id, islem_tipi, tutar) VALUES (1, 1, 'TAHSILAT', 1500)`).run();

  const before = snapshot(db);
  assert(before.user.eposta == null, "fixture eposta NULL");
  assert(before.user.telefon == null, "fixture telefon NULL");
  assert(before.user.kullanici_adi === "avukateski", "fixture username present");
  assert(before.license.kind === "paid" && before.license.status === "ACTIVE", "fixture paid ACTIVE");
  assert(before.counts.muvekkil === 1 && before.counts.kasa === 1, "fixture business rows present");

  const okLogin = login(db, "AvukatEski", password);
  assert(okLogin.ok === true && okLogin.id === 1, "legacy username + correct password → LOGIN SUCCESS");

  const caseLogin = login(db, "  avukateski  ", password);
  assert(caseLogin.ok === true, "legacy username trim/NOCASE login");

  const badPass = login(db, "avukateski", "yanlis");
  assert(badPass.ok === false && badPass.error === CRED_ERR, "wrong password rejected without mutation");

  const licenseEmail = login(db, "info@woontegra.com", password);
  assert(licenseEmail.ok === false, "central license email does not match NULL-eposta legacy user");

  const forgot = forgotGetQuestion(db, "avukateski");
  assert(forgot.ok === true && forgot.soruKodu === "G2", "forgot-password username → QUESTION SUCCESS");

  const forgotCase = forgotGetQuestion(db, "AVUKATESKI");
  assert(forgotCase.ok === true, "forgot-password username NOCASE");

  const forgotEmpty = forgotGetQuestion(db, "   ");
  assert(forgotEmpty.ok === false && forgotEmpty.error === EMPTY_ERR, "forgot empty identity is identity-neutral");

  const forgotUnknown = forgotGetQuestion(db, "info@woontegra.com");
  assert(forgotUnknown.ok === false && forgotUnknown.error === "Kullanıcı bulunamadı.", "license email still not found for legacy user");

  const afterLegacy = snapshot(db);
  assert(afterLegacy.user.eposta === before.user.eposta, "email NULL remains NULL (no backfill)");
  assert(afterLegacy.user.kullanici_adi === before.user.kullanici_adi, "username unchanged");
  assert(afterLegacy.user.sifre_hash === before.user.sifre_hash, "password hash unchanged");
  assert(afterLegacy.user.guvenlik_sorusu_kodu === before.user.guvenlik_sorusu_kodu, "security question unchanged");
  assert(afterLegacy.user.guvenlik_cevap_hash === before.user.guvenlik_cevap_hash, "security answer hash unchanged");
  assert(afterLegacy.license.kind === before.license.kind && afterLegacy.license.license_key === before.license.license_key, "paid license unchanged");
  assert(afterLegacy.license.status === before.license.status, "license status unchanged");
  assert(
    afterLegacy.counts.users === before.counts.users &&
      afterLegacy.counts.muvekkil === before.counts.muvekkil &&
      afterLegacy.counts.dosya === before.counts.dosya &&
      afterLegacy.counts.kasa === before.counts.kasa,
    "business rows unchanged",
  );

  console.log("\n=== New email-first login / forgot ===\n");
  const newHash = bcrypt.hashSync("YeniSifre1", 12);
  const newCevap = bcrypt.hashSync("ankara", 12);
  db.prepare(
    `INSERT INTO uygulama_kullanici
      (ad_soyad, kullanici_adi, eposta, telefon, sifre_hash, aktif_mi, kayit_tarihi, guvenlik_sorusu_kodu, guvenlik_cevap_hash)
     VALUES ('Yeni Kullanıcı', 'yeni@example.com', 'yeni@example.com', '+905321234567', ?, 1, '2026-09-21T00:00:00.000Z', 'G1', ?)`,
  ).run(newHash, newCevap);

  const emailLogin = login(db, "  YENI@EXAMPLE.COM ", "YeniSifre1");
  assert(emailLogin.ok === true, "new user email + password → LOGIN SUCCESS");

  const emailForgot = forgotGetQuestion(db, "yeni@example.com");
  assert(emailForgot.ok === true && emailForgot.soruKodu === "G1", "new user email forgot → QUESTION SUCCESS");

  const internal = db.prepare(`SELECT kullanici_adi, eposta FROM uygulama_kullanici WHERE eposta = 'yeni@example.com'`).get();
  assert(internal.kullanici_adi === "yeni@example.com" && internal.eposta === "yeni@example.com", "internal username = email");

  const legacyStill = login(db, "avukateski", password);
  assert(legacyStill.ok === true, "new email user does not break legacy username login");
} finally {
  db.close();
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

console.log(`\n=== Legacy paid login results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
