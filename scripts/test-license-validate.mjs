/**
 * Lisans doğrulama regresyon testi (Electron açmaz, ağ ve gerçek DB kullanmaz).
 * license.service.ts gerçek kodu; electron ve db/connection bellek içi stub, fetch mock.
 * Kapsam: geçici HTTP/ağ hataları LOCKED yapmaz, HTTP 200 + valid:false kilitler,
 * 7 günlük çevrimdışı süre ve sona ermesi, deneme lisansında çevrimdışı hak yok.
 * Çalıştırma: node scripts/test-license-validate.mjs
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

let passed = 0;
let failed = 0;
function assert(cond, name) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
  }
}

const electronStub = `export const app = { getVersion: () => "0.1.14", isPackaged: false };
export default { app };`;

const dbStub = `const store = (globalThis.__mkdLicenseDb ??= { row: null, writes: [] });
export function nowIso() { return new Date().toISOString(); }
export function getDbPath() { return ":stub:"; }
export function closeDb() {}
export function getDb() {
  return {
    prepare(sql) {
      const s = sql.replace(/\\s+/g, " ").trim();
      return {
        get() {
          if (/^SELECT .* FROM yerel_lisans WHERE id = 1$/.test(s)) return store.row ? { ...store.row } : undefined;
          throw new Error("beklenmeyen get: " + s);
        },
        run(...a) {
          store.writes.push(s.slice(0, 40));
          if (s.startsWith("INSERT INTO yerel_lisans")) {
            const [kind, license_key, device_hash, product_name, expires_at, last_validated_at, offline_grace_until, status, kayit, guncelleme] = a;
            store.row = { ...(store.row ?? { kayit_tarihi: kayit }), kind, license_key, device_hash, product_name, expires_at, last_validated_at, offline_grace_until, status, guncelleme_tarihi: guncelleme };
            return;
          }
          if (/^UPDATE yerel_lisans SET status = 'LOCKED'/.test(s)) {
            if (store.row) store.row = { ...store.row, status: "LOCKED", guncelleme_tarihi: a[0] };
            return;
          }
          throw new Error("beklenmeyen run: " + s);
        },
      };
    },
  };
}`;

const tmp = mkdtempSync(join(os.tmpdir(), "mkd-license-validate-"));
const realFetch = globalThis.fetch;
const db = (globalThis.__mkdLicenseDb = { row: null, writes: [] });
const fetchCalls = [];
let respond = null;

globalThis.fetch = async (url, init) => {
  fetchCalls.push({ url: String(url), body: JSON.parse(init.body) });
  if (!respond) throw new Error("fetch beklenmiyordu");
  return respond();
};

const json = (status, body) => () =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const text = (status, body) => () => new Response(body, { status, headers: { "Content-Type": "text/html" } });
const networkDown = () => () => {
  throw new TypeError("fetch failed");
};

function paidRow({ validatedAgoMs, graceDays = 7, expiresInDays = 200, status = "ACTIVE" }) {
  const validated = new Date(Date.now() - validatedAgoMs);
  return {
    kind: "paid",
    license_key: "TEST-KEY-0001",
    device_hash: "a".repeat(64),
    product_name: "Müvekkil Kasa Defteri",
    expires_at: new Date(Date.now() + expiresInDays * DAY).toISOString(),
    last_validated_at: validated.toISOString(),
    offline_grace_until: new Date(validated.getTime() + graceDays * DAY).toISOString(),
    status,
    kayit_tarihi: validated.toISOString(),
    guncelleme_tarihi: validated.toISOString(),
  };
}

function trialRow({ expiresInDays = 5, status = "ACTIVE" } = {}) {
  const now = new Date().toISOString();
  return {
    kind: "trial",
    license_key: null,
    device_hash: "b".repeat(64),
    product_name: "Müvekkil Kasa Defteri",
    expires_at: new Date(Date.now() + expiresInDays * DAY).toISOString(),
    last_validated_at: now,
    offline_grace_until: null,
    status,
    kayit_tarihi: now,
    guncelleme_tarihi: now,
  };
}

let svc;
function reset(row, responder) {
  db.row = row ? { ...row } : null;
  db.writes = [];
  fetchCalls.length = 0;
  respond = responder;
  svc.resetLicenseRuntimeFlagsForTests();
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (iso, targetMs, tolMs = 60_000) => Math.abs(new Date(iso).getTime() - targetMs) <= tolMs;

try {
  writeFileSync(join(tmp, "electron-stub.mjs"), electronStub);
  writeFileSync(join(tmp, "db-stub.mjs"), dbStub);
  const outfile = join(tmp, "license.service.mjs");
  await build({
    entryPoints: [join(root, "src/main/services/license.service.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "error",
    alias: { "@shared": join(root, "src/shared") },
    plugins: [
      {
        name: "stubs",
        setup(b) {
          b.onResolve({ filter: /^electron$/ }, () => ({ path: join(tmp, "electron-stub.mjs") }));
          b.onResolve({ filter: /\/db\/connection$/ }, () => ({ path: join(tmp, "db-stub.mjs") }));
        },
      },
    ],
  });
  svc = await import(pathToFileURL(outfile).href);
  const { classifyPaidValidateResponse } = await import(
    pathToFileURL(
      await (async () => {
        const out = join(tmp, "classify.mjs");
        await build({ entryPoints: [join(root, "src/main/services/licenseValidateResponse.ts")], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error" });
        return out;
      })(),
    ).href
  );

  console.log("Yanıt sınıflandırma");
  assert(classifyPaidValidateResponse(200, { valid: true }).kind === "valid", "200 valid:true → valid");
  assert(classifyPaidValidateResponse(200, { valid: false }).kind === "rejected", "200 valid:false → rejected");
  assert(classifyPaidValidateResponse(429, { valid: false }).kind === "transient", "429 valid:false → transient");
  assert(classifyPaidValidateResponse(500, { valid: false }).kind === "transient", "500 valid:false → transient");
  assert(classifyPaidValidateResponse(400, { valid: false }).kind === "transient", "400 valid:false → transient");
  assert(classifyPaidValidateResponse(200, null).kind === "transient", "200 JSON değil → transient");
  assert(classifyPaidValidateResponse(200, { valid: "false" }).kind === "transient", "200 valid string → transient");

  console.log("Başarılı doğrulama");
  reset(paidRow({ validatedAgoMs: 2 * DAY }), json(200, { valid: true, expiresAt: null, offlineGraceDays: 7 }));
  let r = await svc.licenseValidate({ force: true });
  assert(r.ok === true && !r.offlineDegraded, "200 valid:true → ok");
  assert(db.row.status === "ACTIVE" && near(db.row.last_validated_at, Date.now()), "son doğrulama zamanı güncellendi");
  assert(near(db.row.offline_grace_until, Date.now() + 7 * DAY), "çevrimdışı süre = şimdi + 7 gün");
  assert(fetchCalls.length === 1 && fetchCalls[0].url.endsWith("/validate"), "tek /validate isteği");
  assert(same(Object.keys(fetchCalls[0].body), ["licenseKey", "deviceHash", "appCode"]), "payload değişmedi (platform yok)");
  assert(fetchCalls[0].body.appCode === "MUVEKKIL_KASA_DESKTOP", "appCode değişmedi");

  reset(paidRow({ validatedAgoMs: 2 * DAY }), json(200, { valid: true, offlineGraceDays: 3 }));
  await svc.licenseValidate({ force: true });
  assert(near(db.row.offline_grace_until, Date.now() + 3 * DAY), "sunucunun offlineGraceDays değeri (3) uygulanıyor");

  console.log("Gerçek lisans reddi (HTTP 200 + valid:false)");
  reset(paidRow({ validatedAgoMs: 2 * DAY }), json(200, { valid: false, message: "Lisans iptal edildi." }));
  r = await svc.licenseValidate({ force: true });
  assert(r.ok === false && r.locked === true && r.error === "Lisans iptal edildi.", "kilitli sonuç + sunucu mesajı");
  assert(db.row.status === "LOCKED", "yerel kayıt LOCKED");
  assert(svc.licenseGetState().locked === true, "durum kilitli");

  console.log("Geçici hatalar (çevrimdışı süre içinde)");
  const transientCases = [
    ["429 JSON valid:false", json(429, { valid: false, message: "Too many requests" })],
    ["429 HTML", text(429, "<html>rate limited</html>")],
    ["500 JSON valid:false", json(500, { valid: false, message: "Internal error" })],
    ["502 boş gövde", text(502, "")],
    ["503 HTML", text(503, "<html>unavailable</html>")],
    ["400 JSON valid:false", json(400, { valid: false, message: "Bad request" })],
    ["403 JSON valid:false", json(403, { valid: false })],
    ["404 HTML", text(404, "not found")],
    ["200 HTML", text(200, "<html>proxy</html>")],
    ["200 valid alanı yok", json(200, { message: "?" })],
    ["ağ hatası", networkDown()],
  ];
  for (const [label, responder] of transientCases) {
    const row = paidRow({ validatedAgoMs: 2 * DAY });
    reset(row, responder);
    r = await svc.licenseValidate({ force: true });
    const state = svc.licenseGetStateForRenderer();
    assert(
      r.ok === true && r.offlineDegraded === true && same(db.row, row) && db.writes.length === 0 &&
        state.valid === true && state.phase === "paidOfflineGrace",
      `${label}: LOCKED yok, kayıt ve son doğrulama değişmedi, çevrimdışı devam`,
    );
  }

  console.log("7 günlük çevrimdışı süre sınırı");
  let row = paidRow({ validatedAgoMs: 7 * DAY - HOUR });
  reset(row, json(503, { valid: false }));
  r = await svc.licenseValidate({ force: true });
  assert(r.ok === true && r.offlineDegraded === true && same(db.row, row), "6 gün 23 saat: çevrimdışı devam");

  row = paidRow({ validatedAgoMs: 7 * DAY + HOUR });
  reset(row, json(429, { valid: false }));
  r = await svc.licenseValidate({ force: true });
  let state = svc.licenseGetState();
  assert(r.ok === false && r.locked === true, "7 gün 1 saat + 429: kilitli sonuç");
  assert(same(db.row, row) && db.row.status === "ACTIVE", "süre dolsa da geçici hata kaydı LOCKED yapmıyor");
  assert(state.locked === true && state.phase === "locked" && svc.isBusinessLicenseAuthorized() === false, "süre dolunca işletme erişimi kapalı");

  reset(row, networkDown());
  r = await svc.licenseValidate({ force: true });
  assert(r.ok === false && r.error === "Lisans sunucusuna ulaşılamadı ve çevrimdışı süre doldu.", "süre dolmuş + ağ hatası mesajı");
  reset(row, json(500, {}));
  r = await svc.licenseValidate({ force: true });
  assert(r.ok === false && r.error === "Lisans doğrulanamadı ve çevrimdışı süre doldu.", "süre dolmuş + 500 mesajı");

  reset(row, json(200, { valid: true, offlineGraceDays: 7 }));
  r = await svc.licenseValidate({ force: true });
  state = svc.licenseGetState();
  assert(r.ok === true && db.row.status === "ACTIVE" && state.phase === "paidActive", "sunucu dönünce lisans tekrar aktif");

  console.log("Sunucu reddi sonrası geçici hata kilidi kaldırmaz");
  row = paidRow({ validatedAgoMs: 2 * DAY, status: "LOCKED" });
  reset(row, json(429, { valid: false }));
  await svc.licenseValidate({ force: true });
  assert(db.row.status === "LOCKED" && svc.licenseGetState().locked === true, "LOCKED kayıt 429 ile açılmıyor");
  reset(row, json(200, { valid: true }));
  await svc.licenseValidate({ force: true });
  assert(db.row.status === "ACTIVE", "LOCKED kayıt yalnızca 200 valid:true ile açılıyor");

  console.log("Mevcut kurallar korunuyor");
  reset(paidRow({ validatedAgoMs: 2 * DAY, expiresInDays: -1 }), json(200, { valid: true }));
  r = await svc.licenseValidate({ force: true });
  assert(r.ok === false && r.locked === true && fetchCalls.length === 0 && db.row.status === "LOCKED", "süresi geçmiş lisans istek atmadan kilitleniyor (eski davranış)");
  reset(paidRow({ validatedAgoMs: HOUR }), json(200, { valid: true }));
  r = await svc.licenseValidate();
  assert(r.ok === true && fetchCalls.length === 0, "24 saat içinde otomatik doğrulama atlanıyor");

  console.log("Deneme lisansı (çevrimdışı hak yok)");
  for (const [label, responder] of [
    ["429 JSON", json(429, { success: false, message: "Too many requests" })],
    ["500 JSON", json(500, { success: false })],
    ["ağ hatası", networkDown()],
  ]) {
    const tr = trialRow();
    reset(tr, responder);
    r = await svc.licenseValidate({ force: true });
    state = svc.licenseGetState();
    assert(
      r.ok === false && r.locked === false && same(db.row, tr) && state.phase === "trialNetworkRequired" && state.valid === false,
      `deneme + ${label}: kilitlenmiyor, çevrimdışı kullanım yok`,
    );
  }
  reset(trialRow(), json(200, { success: true, valid: true }));
  r = await svc.licenseValidate({ force: true });
  assert(r.ok === true && svc.licenseGetState().phase === "trialActive", "deneme + 200 valid → aktif");
  assert(same(Object.keys(fetchCalls[0].body), ["appCode", "deviceHash"]) && fetchCalls[0].url.endsWith("/trial/validate"), "deneme payload değişmedi");
  reset(trialRow(), json(200, { success: false, valid: false, code: "TRIAL_EXPIRED" }));
  r = await svc.licenseValidate({ force: true });
  assert(r.locked === true && db.row.status === "LOCKED", "deneme TRIAL_EXPIRED → LOCKED (eski davranış)");
} finally {
  globalThis.fetch = realFetch;
  delete globalThis.__mkdLicenseDb;
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${passed} geçti, ${failed} başarısız`);
process.exit(failed === 0 ? 0 : 1);
