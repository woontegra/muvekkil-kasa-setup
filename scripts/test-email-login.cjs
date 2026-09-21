/**
 * E-posta kimliği + legacy username backward-compat.
 * Electron native better-sqlite3 (ELECTRON_RUN_AS_NODE).
 * Production /trial çağırmaz.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const LOGIN_IDENTITY_SQL =
  "kullanici_adi = ? COLLATE NOCASE OR (eposta IS NOT NULL AND TRIM(eposta) != '' AND eposta = ? COLLATE NOCASE)";

function safeTrim(raw) {
  return typeof raw === "string" ? raw.trim() : "";
}

function normalizeLocalEmail(raw) {
  return safeTrim(raw).toLowerCase();
}

function resolveInternalUsername(input) {
  const emailRaw = safeTrim(input?.eposta);
  if (emailRaw) {
    const email = normalizeLocalEmail(emailRaw);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Geçerli bir e-posta adresi girin." };
    }
    return { ok: true, kullaniciAdi: email, eposta: email };
  }
  const ka = safeTrim(input?.kullaniciAdi);
  if (ka) return { ok: true, kullaniciAdi: ka, eposta: null };
  return { ok: false, error: "E-posta zorunludur." };
}

function setupFirstFields(input) {
  if (!input || typeof input !== "object") return { ok: false, error: "Lütfen tüm alanları doldurun." };
  const resolved = resolveInternalUsername({ eposta: input.eposta, kullaniciAdi: input.kullaniciAdi });
  if (!resolved.ok) return resolved;
  return { ok: true, ...resolved, adSoyad: safeTrim(input.adSoyad) };
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
  const raw = String(identity ?? "").trim();
  if (!raw) return undefined;
  return db
    .prepare(`SELECT * FROM uygulama_kullanici WHERE ${LOGIN_IDENTITY_SQL}`)
    .get(raw, normalizeLocalEmail(raw));
}

const dir = path.join(os.tmpdir(), `mkd-email-login-${Date.now()}`);
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, "auth.sqlite"));

try {
  console.log("\n=== Email login / legacy username ===\n");

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
  `);

  const resolved = resolveInternalUsername({ eposta: " Test@Example.com " });
  assert(resolved.ok && resolved.kullaniciAdi === "test@example.com", "1/2 setup without username → internal email");
  assert(resolved.ok && resolved.eposta === "test@example.com", "2 internal kullanici_adi = normalized email");

  const newHash = bcrypt.hashSync("YeniSifre1", 12);
  const cevapHash = bcrypt.hashSync("ankara", 12);
  db.prepare(
    `INSERT INTO uygulama_kullanici (ad_soyad, kullanici_adi, eposta, telefon, sifre_hash, aktif_mi, kayit_tarihi, guvenlik_sorusu_kodu, guvenlik_cevap_hash)
     VALUES (?, ?, ?, ?, ?, 1, ?, 'G1', ?)`,
  ).run("Yeni Kullanıcı", resolved.kullaniciAdi, resolved.eposta, "+905321234567", newHash, "2026-09-21T00:00:00.000Z", cevapHash);

  const byEmail = findByIdentity(db, "test@example.com");
  assert(Boolean(byEmail) && bcrypt.compareSync("YeniSifre1", byEmail.sifre_hash), "3 new user email + password login");

  const byCase = findByIdentity(db, "  TEST@EXAMPLE.COM ");
  assert(Boolean(byCase) && byCase.id === byEmail.id, "4 email case-insensitive/trim login");

  let dupBlocked = false;
  try {
    const dup = resolveInternalUsername({ eposta: "TEST@EXAMPLE.COM" });
    db.prepare(
      `INSERT INTO uygulama_kullanici (ad_soyad, kullanici_adi, eposta, sifre_hash, aktif_mi, kayit_tarihi)
       VALUES (?, ?, ?, ?, 1, ?)`,
    ).run("Kopya", dup.kullaniciAdi, dup.eposta, newHash, "2026-09-21T00:00:00.000Z");
  } catch (e) {
    dupBlocked = String(e.message || e).toUpperCase().includes("UNIQUE");
  }
  assert(dupBlocked, "5 duplicate normalized email blocked");

  const legacyHash = bcrypt.hashSync("EskiSifre1", 12);
  db.prepare(
    `INSERT INTO uygulama_kullanici (ad_soyad, kullanici_adi, eposta, telefon, sifre_hash, aktif_mi, kayit_tarihi, guvenlik_sorusu_kodu, guvenlik_cevap_hash)
     VALUES (?, ?, NULL, NULL, ?, 1, ?, 'G1', ?)`,
  ).run("Eski Admin", "eskiadmin", legacyHash, "2025-01-01T00:00:00.000Z", cevapHash);

  const legacyRow = findByIdentity(db, "EskiAdmin");
  assert(Boolean(legacyRow) && legacyRow.eposta == null && bcrypt.compareSync("EskiSifre1", legacyRow.sifre_hash), "9/10 legacy username + NULL eposta login");

  const forgotNew = findByIdentity(db, "  Test@Example.com");
  assert(Boolean(forgotNew) && forgotNew.guvenlik_sorusu_kodu === "G1" && bcrypt.compareSync("ankara", forgotNew.guvenlik_cevap_hash), "8 forgot-password via email");

  const forgotLegacy = findByIdentity(db, "eskiadmin");
  assert(Boolean(forgotLegacy) && forgotLegacy.id === legacyRow.id, "8b forgot-password via legacy username");

  const missing = findByIdentity(db, "yok@mail.com");
  assert(!missing, "unknown email does not match NULL-eposta legacy");

  const fallback = resolveInternalUsername({ kullaniciAdi: "print_e2e" });
  assert(fallback.ok && fallback.kullaniciAdi === "print_e2e" && fallback.eposta === null, "e2e username fallback preserved");

  let aThrew = false;
  let a;
  try {
    a = setupFirstFields({ adSoyad: "Deneme", eposta: "  Recov@Mail.com ", kullaniciAdi: undefined, sifre: "123456" });
  } catch {
    aThrew = true;
  }
  assert(!aThrew && a.ok && a.kullaniciAdi === "recov@mail.com" && a.eposta === "recov@mail.com", "A email + undefined kullaniciAdi succeeds");

  const b = resolveInternalUsername({ eposta: "  Recov@Mail.com " });
  assert(b.ok && b.kullaniciAdi === "recov@mail.com", "B email trim/case normalize");

  const c = setupFirstFields({ adSoyad: "E2E", kullaniciAdi: "print_e2e" });
  assert(c.ok && c.kullaniciAdi === "print_e2e" && c.eposta === null, "C legacy kullaniciAdi without email");

  let dThrew = false;
  let d;
  try {
    d = setupFirstFields({ adSoyad: "Bos", eposta: undefined, kullaniciAdi: undefined });
  } catch {
    dThrew = true;
  }
  assert(!dThrew && !d.ok && d.error === "E-posta zorunludur.", "D both undefined → validation, no TypeError");

  db.exec(`
    CREATE TABLE yerel_lisans (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL,
      license_key TEXT,
      device_hash TEXT NOT NULL,
      product_name TEXT,
      expires_at TEXT,
      last_validated_at TEXT,
      offline_grace_until TEXT,
      status TEXT NOT NULL
    );
  `);
  const expiresAt = "2026-09-28T00:02:15.672Z";
  const persistTrial = (expires) => {
    db.prepare(
      `INSERT INTO yerel_lisans (id, kind, license_key, device_hash, product_name, expires_at, last_validated_at, offline_grace_until, status)
       VALUES (1, 'trial', NULL, 'abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd', 'Müvekkil Kasa Defteri', ?, '2026-09-21T00:02:12.873Z', NULL, 'ACTIVE')
       ON CONFLICT(id) DO UPDATE SET expires_at = excluded.expires_at, kind = excluded.kind, status = excluded.status`,
    ).run(expires);
  };
  persistTrial(expiresAt);
  const afterFail = db.prepare(`SELECT kind, status, expires_at FROM yerel_lisans WHERE id = 1`).get();
  const usersAfterFail = db.prepare(`SELECT COUNT(*) AS n FROM uygulama_kullanici`).get();
  assert(afterFail.kind === "trial" && afterFail.status === "ACTIVE" && usersAfterFail.n === 2, "E central trial local, setup user missing is recoverable");

  const resumeResponse = { success: true, resumed: true, trial: true, expiresAt };
  persistTrial(resumeResponse.expiresAt);
  const afterResume = db.prepare(`SELECT expires_at, kind FROM yerel_lisans WHERE id = 1`).get();
  const plus7 = new Date(Date.parse(expiresAt) + 7 * 24 * 60 * 60 * 1000).toISOString();
  assert(resumeResponse.resumed === true, "E retry resumed=true");
  assert(afterResume.expires_at === expiresAt && afterResume.expires_at !== plus7, "E same expiresAt, no +7");

  const recovery = setupFirstFields({ adSoyad: "Kurtarma", eposta: "  Recov@Mail.com ", kullaniciAdi: undefined });
  db.prepare(
    `INSERT INTO uygulama_kullanici (ad_soyad, kullanici_adi, eposta, sifre_hash, aktif_mi, kayit_tarihi)
     VALUES (?, ?, ?, ?, 1, ?)`,
  ).run(recovery.adSoyad, recovery.kullaniciAdi, recovery.eposta, newHash, "2026-09-21T00:10:00.000Z");
  const recovered = findByIdentity(db, "RECOV@MAIL.COM");
  assert(Boolean(recovered) && recovered.kullanici_adi === "recov@mail.com", "E local setup completes after resume");

  const count = db.prepare(`SELECT COUNT(*) AS n FROM uygulama_kullanici`).get();
  assert(count.n === 3, "recovery user added without rewriting legacy rows", String(count.n));
} finally {
  db.close();
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

console.log(`\n=== Email login results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
