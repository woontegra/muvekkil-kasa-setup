/**
 * Static UI parity source checks — Ofis Kasası semantic KPI tones + remaining UI signatures.
 * No DB writes. Run: node scripts/run-ui-parity-source-test.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function mustInclude(src, needle, label) {
  assert(src.includes(needle), `${label}: missing ${JSON.stringify(needle)}`);
}

const ofis = read("src/renderer-premium/components/ofisKasa/OfisKasaSummaryStrip.tsx");
mustInclude(ofis, 'tone="income"', "Ofis dönem geliri");
mustInclude(ofis, 'tone="expense"', "Ofis dönem gideri");
mustInclude(ofis, 'tone="balance"', "Ofis bakiye");
mustInclude(ofis, 'tone="adjustment"', "Ofis düzeltme");
mustInclude(ofis, "net-pos", "Ofis net-pos");
mustInclude(ofis, "net-neg", "Ofis net-neg");
mustInclude(ofis, "CurrencyBalanceCards", "Ofis PB cards");

const currency = read("src/renderer-premium/components/currency/CurrencyFields.tsx");
mustInclude(currency, "pb-try", "TRY tone");
mustInclude(currency, "pb-usd", "USD tone");
mustInclude(currency, "pb-eur", "EUR tone");
mustInclude(currency, "data-kpi-tone", "kpi tone attr");
mustInclude(currency, "data-pb", "pb attr");

const css = read("src/renderer-premium/styles/overview.css");
for (const cls of [
  ".pm-finance-kpi--pb-try",
  ".pm-finance-kpi--pb-usd",
  ".pm-finance-kpi--pb-eur",
  ".pm-finance-kpi--income",
  ".pm-finance-kpi--expense",
  ".pm-finance-kpi--pending",
  ".pm-finance-kpi--adjustment",
  ".pm-finance-kpi--balance",
  ".pm-finance-kpi--net-pos",
  ".pm-finance-kpi--net-neg",
  ".pm-mk-row--kritik",
  ".pm-karlilik-stat--gelir",
  ".pm-tahsilat-side-stat--danger",
]) {
  mustInclude(css, cls, "overview.css");
}

const kalem = read("src/renderer-premium/components/settings/SettingsKalemleriSection.tsx");
mustInclude(kalem, "pm-kalem-tabs", "Kalem tabs");
mustInclude(kalem, "pm-kalem-add", "Kalem add row");
mustInclude(kalem, "pm-kalem-rows", "Kalem rows");
mustInclude(kalem, "pm-kalem-lock", "Kalem K badge");
assert(!/list-style:\s*disc/.test(kalem), "Kalem must not use bullet list style");

const users = read("src/renderer-premium/components/settings/SettingsKullanicilarSection.tsx");
mustInclude(users, "pm-users-role-badge", "Users role badge");
mustInclude(users, "pm-users-status", "Users status");
mustInclude(users, "ROL_HINT", "Role hints");

const denetim = read("src/renderer-premium/components/settings/SettingsDenetimSection.tsx");
mustInclude(denetim, "pm-audit-toolbar", "Denetim toolbar");
mustInclude(denetim, "pm-audit-row", "Denetim rows");

const mali = read("src/renderer-premium/components/overview/MaliKontrolCard.tsx");
mustInclude(mali, "pm-mk-list", "Mali kontrol list");
mustInclude(mali, "Kayda git", "Mali kontrol CTA");
mustInclude(mali, "Kontroller temiz", "Mali healthy state");

const karl = read("src/renderer-premium/components/muvekkil/MuvekkilKarlilikSection.tsx");
mustInclude(karl, "pm-karlilik-stat--", "Karlilik tones");
mustInclude(karl, "pm-karlilik-dagilim", "Karlilik dagilim");

const dosyaStrip = read("src/renderer-premium/components/dosya/DosyaKasaSummaryStrip.tsx");
mustInclude(dosyaStrip, "onayBekleyenSayisi", "Dosya onaysız KPI data");
mustInclude(dosyaStrip, "onaysiz", "Dosya onaysız tone");

const dosyaInfo = read("src/renderer-premium/components/dosya/DosyaInfoPanel.tsx");
mustInclude(dosyaInfo, "StatusBadge", "Dosya durum badge");
mustInclude(dosyaInfo, "dosyaDurumEtiket", "Dosya durum etiket");

const tahsil = read("src/renderer-premium/components/tahsilatMerkezi/TahsilatMerkeziSummaryStrip.tsx");
mustInclude(tahsil, 'tone="alert"', "Tahsilat gecikmiş");
mustInclude(tahsil, 'tone="pending"', "Tahsilat bugün");

const icra = read("src/renderer-premium/components/icraTahsilat/IcraTahsilatSummaryStrip.tsx");
mustInclude(icra, "pb-try", "Icra TRY");
mustInclude(icra, 'tone="income"', "Icra income");

console.log("[PASS] UI parity source signatures (Ofis KPI colors + 6 PARTIAL screens + scan fixes)");
