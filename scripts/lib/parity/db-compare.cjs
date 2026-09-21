/**
 * Legacy / premium parite DB karşılaştırması (saf Node).
 */
const Database = require("better-sqlite3");

const BUSINESS_TABLES = [
  "muvekkil",
  "dosya",
  "dosya_kasa_hareket",
  "anlasilan_vekalet_ucreti",
  "vekalet_ucreti_taksit",
  "vekalet_taksit_odeme",
  "ofis_kasa_hareketleri",
  "icra_tahsilat_alacak",
  "icra_tahsilat_taksit",
  "icra_tahsilat_odeme",
  "office_settings",
  "app_settings",
  "belge_no_sayac",
  "makbuz_sayac",
  "vekalet_makbuz_sayac",
];

const SKIP_COLS = new Set([
  "id",
  "kayit_tarihi",
  "guncelleme_tarihi",
  "olusturma_tarihi",
  "created_at",
  "updated_at",
  "uuid",
  "device_hash",
  "license_key",
  "last_validated_at",
  "offline_grace_until",
  "expires_at",
]);

function tableExists(db, name) {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
  return Boolean(row);
}

function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (SKIP_COLS.has(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = Math.round(v * 1000) / 1000;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function rowsForTable(db, table) {
  if (!tableExists(db, table)) return [];
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  const order = cols.includes("id") ? "id" : cols[0];
  const raw = db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all();
  return raw.map(normalizeRow);
}

function compareDbs(legacyPath, premiumPath) {
  const legacy = new Database(legacyPath, { readonly: true });
  const premium = new Database(premiumPath, { readonly: true });
  const diffs = [];

  try {
    for (const table of BUSINESS_TABLES) {
      const lRows = rowsForTable(legacy, table);
      const pRows = rowsForTable(premium, table);
      const lJson = JSON.stringify(lRows);
      const pJson = JSON.stringify(pRows);
      if (lJson !== pJson) {
        diffs.push({
          table,
          legacyCount: lRows.length,
          premiumCount: pRows.length,
          legacySample: lRows.slice(0, 3),
          premiumSample: pRows.slice(0, 3),
        });
      }
    }
  } finally {
    legacy.close();
    premium.close();
  }

  return { ok: diffs.length === 0, diffs, tables: BUSINESS_TABLES };
}

function compareVisible(legacyPath, premiumPath) {
  let legacy = {};
  let premium = {};
  try {
    legacy = JSON.parse(require("node:fs").readFileSync(legacyPath, "utf8"));
    premium = JSON.parse(require("node:fs").readFileSync(premiumPath, "utf8"));
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
  const diffs = [];
  const keys = new Set([...Object.keys(legacy), ...Object.keys(premium)]);
  for (const k of keys) {
    const l = JSON.stringify(legacy[k]);
    const p = JSON.stringify(premium[k]);
    if (l !== p) diffs.push({ key: k, legacy: legacy[k], premium: premium[k] });
  }
  return { ok: diffs.length === 0, diffs };
}

module.exports = { compareDbs, compareVisible, BUSINESS_TABLES };
