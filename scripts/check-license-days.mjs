/**
 * Lisans süresi teşhisi — hassas alanları loglamaz.
 */
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";

const API = (
  process.env.LICENSE_API_BASE ??
  "https://lisans-server-backend-production.up.railway.app/api/public/license"
).replace(/\/$/, "");

function ceilDays(ms) {
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
function floorDays(ms) {
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

const dbPath = path.join(
  process.env.MKD_USER_DATA ?? path.join(os.homedir(), "AppData", "Roaming", "muvekkil-kasa-defteri"),
  "muvekkil-kasa-defteri.sqlite",
);

const row = new Database(dbPath, { readonly: true })
  .prepare(`SELECT expires_at, last_validated_at, kayit_tarihi, guncelleme_tarihi FROM yerel_lisans WHERE id=1`)
  .get();

const now = Date.now();
const localExpires = row?.expires_at;
const localMs = localExpires ? new Date(localExpires).getTime() : NaN;

console.log("=== Lisans süre teşhisi ===");
console.log("local_expires_at:", localExpires);
console.log("local_days_remaining_ceil:", Number.isFinite(localMs) ? ceilDays(localMs - now) : null);
console.log("local_days_remaining_floor:", Number.isFinite(localMs) ? floorDays(localMs - now) : null);

const { license_key, device_hash } = new Database(dbPath, { readonly: true })
  .prepare(`SELECT license_key, device_hash FROM yerel_lisans WHERE id=1`)
  .get();

const res = await fetch(`${API}/validate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    licenseKey: license_key,
    deviceHash: device_hash,
    appCode: "MUVEKKIL_KASA_DESKTOP",
  }),
});

const json = await res.json();
const serverExpires = json.expiresAt;
const serverMs = serverExpires ? new Date(serverExpires).getTime() : NaN;

console.log("server_valid:", json.valid);
console.log("server_expires_at:", serverExpires);
console.log("server_days_remaining_ceil:", Number.isFinite(serverMs) ? ceilDays(serverMs - now) : null);

if (Number.isFinite(localMs) && Number.isFinite(serverMs)) {
  const totalFromLocalRecord = row.kayit_tarihi
    ? ceilDays(localMs - new Date(row.kayit_tarihi).getTime())
    : null;
  console.log("approx_total_days_from_local_kayit:", totalFromLocalRecord);
}

// Simulate fresh 365-day license from today
const sim = new Date();
sim.setDate(sim.getDate() + 365);
console.log("simulated_365d_from_today_expires:", sim.toISOString());
console.log("simulated_365d_days_remaining:", ceilDays(sim.getTime() - now));

// Toplam lisans süresi (oluşturulma -> bitiş) 365 mü?
if (row?.kayit_tarihi && Number.isFinite(localMs)) {
  const totalDays = ceilDays(localMs - new Date(row.kayit_tarihi).getTime());
  console.log("license_total_period_days:", totalDays);
  if (totalDays === 365) {
    console.log("[OK] Lisans toplam süresi 365 gün (1 yıl).");
  } else if (totalDays === 360) {
    console.log("[WARN] Toplam süre 360 gün — sunucu 360 günlük lisans üretmiş olabilir.");
  } else {
    console.log(`[INFO] Toplam süre ${totalDays} gün.`);
  }
  const elapsed = totalDays - ceilDays(localMs - now);
  console.log("elapsed_days_since_issue:", elapsed);
  console.log("expected_remaining:", totalDays - elapsed, "actual_remaining:", ceilDays(localMs - now));
}
