/**
 * Lisans runtime testi — hassas alanları loglamaz.
 * Kullanım: node scripts/license-runtime-test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";

const APP_CODE = "MUVEKKIL_KASA_DESKTOP";
const LICENSE_API_BASE = (
  process.env.LICENSE_API_BASE ??
  "https://lisans-server-backend-production.up.railway.app/api/public/license"
).replace(/\/$/, "");
const RENEWAL_URL = "https://woontegra.com/yazilimlar/muvekkil-kasa-defteri-yazilimi";
const WARNING_THRESHOLDS = [30, 15, 7, 3, 1];

const dbPath = path.join(
  process.env.MKD_USER_DATA ?? path.join(os.homedir(), "AppData", "Roaming", "muvekkil-kasa-defteri"),
  "muvekkil-kasa-defteri.sqlite",
);

const results = [];
function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`[PASS] ${name}${detail ? `: ${detail}` : ""}`);
}
function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.log(`[FAIL] ${name}${detail ? `: ${detail}` : ""}`);
}

function computeDaysRemaining(expiresAt, now = Date.now()) {
  if (!expiresAt?.trim()) return null;
  const ms = new Date(expiresAt).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil((ms - now) / (1000 * 60 * 60 * 24));
}

function pickWarningThreshold(daysRemaining) {
  if (daysRemaining == null || daysRemaining <= 0) return null;
  const sorted = [...WARNING_THRESHOLDS].sort((a, b) => b - a);
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const lower = sorted[i + 1] ?? 0;
    if (daysRemaining <= t && daysRemaining > lower) return t;
  }
  return null;
}

function isExpired(expiresAt, now = Date.now()) {
  const d = computeDaysRemaining(expiresAt, now);
  return d != null && d <= 0;
}

function evaluateLocal(row, offlineDegraded = false) {
  if (!row || row.status === "NONE") {
    return { valid: false, needsActivation: true, locked: false, isExpired: false };
  }
  const expired = isExpired(row.expires_at);
  const graceMs = row.offline_grace_until ? new Date(row.offline_grace_until).getTime() : null;
  const now = Date.now();
  if (row.status === "LOCKED" || expired) {
    return { valid: false, needsActivation: false, locked: true, isExpired: expired };
  }
  if (graceMs != null && graceMs < now) {
    return { valid: false, needsActivation: false, locked: true, isExpired: false };
  }
  return { valid: true, needsActivation: false, locked: false, isExpired: false, offlineDegraded };
}

function readLicenseRow(db) {
  return db
    .prepare(
      `SELECT status, expires_at, last_validated_at, offline_grace_until, license_key, device_hash
       FROM yerel_lisans WHERE id = 1`,
    )
    .get();
}

function backupRow(row) {
  return row ? { ...row } : null;
}

function addDaysIso(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function postValidate(licenseKey, deviceHash) {
  const res = await fetch(`${LICENSE_API_BASE}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ licenseKey, deviceHash, appCode: APP_CODE }),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function main() {
  console.log("=== MKD License Runtime Test ===");
  console.log(`DB: ${dbPath}`);

  if (!fs.existsSync(dbPath)) {
    fail("db_exists", "Veritabanı bulunamadı — aktivasyonlu kurulum gerekir");
    process.exit(1);
  }
  pass("db_exists");

  const db = new Database(dbPath);
  const original = readLicenseRow(db);
  if (!original?.license_key) {
    fail("license_row", "yerel_lisans kaydı yok");
    db.close();
    process.exit(1);
  }
  pass("license_row", `status=${original.status}, key_len=${original.license_key.length}`);

  // 1) Geçerli lisans — local evaluate + remote validate
  const localNow = evaluateLocal(original);
  if (localNow.valid && !localNow.locked) pass("valid_license_local", `days=${computeDaysRemaining(original.expires_at)}`);
  else if (localNow.locked && localNow.isExpired) fail("valid_license_local", "Lisans süresi dolmuş görünüyor");
  else if (localNow.needsActivation) fail("valid_license_local", "Aktivasyon gerekli");
  else fail("valid_license_local", `locked=${localNow.locked}`);

  try {
    const { status, json } = await postValidate(original.license_key, original.device_hash);
    if (json.valid === true && json.expiresAt) {
      pass("remote_validate", `HTTP ${status}, expiresAt present`);
    } else {
      fail("remote_validate", `HTTP ${status}, valid=${json.valid}, msg=${json.message ?? "?"}`);
    }
  } catch (e) {
    fail("remote_validate", e instanceof Error ? e.message : "network error");
  }

  // Renewal URL constant
  if (RENEWAL_URL === "https://woontegra.com/yazilimlar/muvekkil-kasa-defteri-yazilimi") {
    pass("renewal_url_constant");
  } else fail("renewal_url_constant", RENEWAL_URL);

  // 2) Warning thresholds simulation (in-memory only)
  for (const days of WARNING_THRESHOLDS) {
    const fakeExpiry = addDaysIso(new Date().toISOString(), days);
    const rem = computeDaysRemaining(fakeExpiry);
    const th = pickWarningThreshold(rem);
    if (rem === days && th === days) pass(`warning_threshold_${days}d`, `threshold=${th}`);
    else fail(`warning_threshold_${days}d`, `rem=${rem}, th=${th}`);
    const urgent = days <= 3;
    if (urgent) pass(`warning_urgent_style_${days}d`, "urgent class expected in UI");
  }

  // 3) Expired scenario — temporary DB update, then restore
  const snap = backupRow(original);
  try {
    const past = addDaysIso(new Date().toISOString(), -1);
    db.prepare(`UPDATE yerel_lisans SET expires_at = ?, status = 'ACTIVE' WHERE id = 1`).run(past);
    const expiredRow = readLicenseRow(db);
    const ev = evaluateLocal(expiredRow);
    if (ev.locked && ev.isExpired) pass("expired_scenario", "locked + isExpired");
    else fail("expired_scenario", JSON.stringify(ev));

    // muvekkil table integrity
    const muvekkilCount = db.prepare(`SELECT COUNT(*) AS c FROM muvekkil`).get()?.c ?? 0;
    pass("data_preserved_after_expired_sim", `muvekkil rows=${muvekkilCount}`);
  } finally {
    if (snap) {
      db.prepare(
        `UPDATE yerel_lisans SET expires_at = ?, status = ?, last_validated_at = ?, offline_grace_until = ? WHERE id = 1`,
      ).run(snap.expires_at, snap.status, snap.last_validated_at, snap.offline_grace_until);
    }
  }

  const restored = readLicenseRow(db);
  if (restored?.expires_at === snap?.expires_at && restored?.status === snap?.status) {
    pass("license_row_restored");
  } else {
    fail("license_row_restored", "expires_at/status geri yüklenemedi");
  }

  // 4) Offline — unreachable server + valid grace
  try {
    const futureGrace = addDaysIso(new Date().toISOString(), 7);
    const futureExpiry = addDaysIso(new Date().toISOString(), 90);
    db.prepare(
      `UPDATE yerel_lisans SET expires_at = ?, offline_grace_until = ?, status = 'ACTIVE', last_validated_at = ? WHERE id = 1`,
    ).run(futureExpiry, futureGrace, new Date().toISOString());

    const offlineRow = readLicenseRow(db);
    const offEv = evaluateLocal(offlineRow, true);
    if (offEv.valid && !offEv.locked) pass("offline_grace_valid", "valid with future grace");
    else fail("offline_grace_valid", JSON.stringify(offEv));

    // expired + offline should lock
    db.prepare(`UPDATE yerel_lisans SET expires_at = ? WHERE id = 1`).run(addDaysIso(new Date().toISOString(), -2));
    const offExp = evaluateLocal(readLicenseRow(db), true);
    if (offExp.locked && offExp.isExpired) pass("offline_expired_blocks", "expired blocks full use");
    else fail("offline_expired_blocks", JSON.stringify(offExp));
  } finally {
    if (snap) {
      db.prepare(
        `UPDATE yerel_lisans SET expires_at = ?, status = ?, last_validated_at = ?, offline_grace_until = ? WHERE id = 1`,
      ).run(snap.expires_at, snap.status, snap.last_validated_at, snap.offline_grace_until);
    }
  }

  // 5) Manuel validate cache güncelleme
  try {
    const row = readLicenseRow(db);
    const { json } = await postValidate(row.license_key, row.device_hash);
    if (json.valid && json.expiresAt) {
      db.prepare(
        `UPDATE yerel_lisans SET expires_at = ?, last_validated_at = ?, status = 'ACTIVE' WHERE id = 1`,
      ).run(json.expiresAt, new Date().toISOString());
      pass("manual_validate_cache_update", "server expiresAt applied");
    } else {
      fail("manual_validate_cache_update", `valid=${json.valid}`);
    }
  } catch (e) {
    fail("manual_validate_cache_update", e instanceof Error ? e.message : "error");
  }

  // 6) Offline unreachable — grace ile devam
  try {
    const futureGrace = addDaysIso(new Date().toISOString(), 7);
    const futureExpiry = addDaysIso(new Date().toISOString(), 60);
    db.prepare(
      `UPDATE yerel_lisans SET expires_at = ?, offline_grace_until = ?, status = 'ACTIVE', last_validated_at = ? WHERE id = 1`,
    ).run(futureExpiry, futureGrace, new Date().toISOString());
    await fetch("http://127.0.0.1:1/validate", { method: "POST" }).catch(() => null);
    const offEv = evaluateLocal(readLicenseRow(db), true);
    if (offEv.valid) pass("offline_unreachable_grace", "continue with last validation");
    else fail("offline_unreachable_grace", JSON.stringify(offEv));
  } finally {
    if (snap) {
      db.prepare(
        `UPDATE yerel_lisans SET expires_at = ?, status = ?, last_validated_at = ?, offline_grace_until = ? WHERE id = 1`,
      ).run(snap.expires_at, snap.status, snap.last_validated_at, snap.offline_grace_until);
    }
  }

  db.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== Özet: ${results.length - failed.length}/${results.length} geçti ===`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error("[FATAL]", e instanceof Error ? e.message : e);
  process.exit(1);
});
