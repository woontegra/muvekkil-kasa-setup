/** SaaS `tcmbFormat.ts` paritesi — gösterim yardımcıları. */

/** Europe/Istanbul takvim günü (YYYY-MM-DD). */
export function istanbulTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Üst bar ve form referans gösterimi — tr-TR, en fazla 4 ondalık. */
export function formatTcmbRateDisplay(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(n);
}

/** Düzenlenebilir kur alanı — 8 ondalığa kadar. */
export function formatTcmbKurInput(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(n);
}

export function parseTcmbKurInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const normalized = t.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function formatDateTrShort(iso: string | null | undefined): string {
  const s = (iso ?? "").trim();
  if (!s) return "—";
  const d = s.length >= 10 ? s.slice(0, 10) : s;
  const [y, m, g] = d.split("-");
  if (!y || !m || !g) return s;
  return `${g}.${m}.${y}`;
}

export function formatDateTimeTr(iso: string | null | undefined): string {
  const s = (iso ?? "").trim();
  if (!s) return "—";
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return s;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** SaaS API DTO — Desktop IPC `/kurlar/tcmb` cevabı. */
export type TcmbRatesUiDto = {
  ok: true;
  available: true;
  istenilenTarih: string;
  bulunanTcmbKurTarihi: string;
  effectiveDate: string;
  fetchedAt: string;
  lastCheckedAt: string;
  fromCache: boolean;
  source: "TCMB";
  sourceLabel: string;
  stale: boolean;
  fallbackKullanildi: boolean;
  cacheNote: string | null;
  usdDovizAlis: string;
  usdDovizSatis: string;
  eurDovizAlis: string;
  eurDovizSatis: string;
  usdEurCapraz: string;
  eurUsdCapraz: string;
};

export type TcmbRatesUnavailableDto = {
  ok: boolean;
  available: false;
  message?: string;
  error?: string;
};

export type TcmbRatesResponseDto = TcmbRatesUiDto | TcmbRatesUnavailableDto;
