/**
 * SaaS `tcmbKur.service.ts` paritesi — Electron main.
 * TCMB XML; referans = Döviz Alış; max 14 gün geriye bakış.
 */
import {
  type ParaBirimi,
  roundMoney,
  roundRate,
} from "@shared/lib/paraBirimi";

const TCMB_HOST = "www.tcmb.gov.tr";
const TODAY_PATH = "/kurlar/today.xml";
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_TTL_AWAITING_TODAY_MS = 15 * 60 * 1000;
const FORCE_REFRESH_COOLDOWN_MS = 10_000;
const AFTERNOON_REFRESH_HOUR = 16;
const AFTERNOON_REFRESH_MINUTE = 35;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;
const MAX_LOOKBACK_DAYS = 14;
const ISTANBUL_TZ = "Europe/Istanbul";

export type TcmbCurrencyQuote = {
  currency: "USD" | "EUR";
  buyingRate: string;
  sellingRate: string;
  unit: number;
};

export type TcmbRatesSnapshot = {
  istenilenTarih: string;
  bulunanTcmbKurTarihi: string;
  effectiveDate: string;
  fetchedAt: string;
  lastCheckedAt: string;
  fromCache: boolean;
  source: "TCMB";
  stale: boolean;
  fallbackKullanildi: boolean;
  usd: TcmbCurrencyQuote;
  eur: TcmbCurrencyQuote;
  usdEurCapraz: string;
  eurUsdCapraz: string;
};

export type TcmbPairQuote = {
  istenilenTarih: string;
  bulunanTcmbKurTarihi: string;
  bazParaBirimi: ParaBirimi;
  karsiParaBirimi: ParaBirimi;
  dovizAlis: string;
  dovizSatis: string | null;
  kaynak: "TCMB";
  fallbackKullanildi: boolean;
  stale: boolean;
  fetchedAt: string;
  lastCheckedAt?: string;
  fromCache?: boolean;
  available: boolean;
};

type CacheEntry = {
  expiresAt: number;
  snapshot: TcmbRatesSnapshot;
  lastCheckedAt: string;
};

const memoryCache = new Map<string, CacheEntry>();
let lastSuccessful: TcmbRatesSnapshot | null = null;
const inflightByKey = new Map<string, Promise<TcmbRatesSnapshot | null>>();
let lastForceRefreshAt = 0;
let afternoonRefreshDoneForYmd: string | null = null;

export type TcmbFetchFn = (url: string) => Promise<string>;

function istanbulYmdAndHm(now: Date): { ymd: string; hour: number; minute: number; weekday: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ISTANBUL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number.parseInt(get("hour"), 10),
    minute: Number.parseInt(get("minute"), 10),
    weekday: get("weekday"),
  };
}

function isIstanbulWeekend(weekday: string): boolean {
  return weekday === "Sat" || weekday === "Sun";
}

function needsAfternoonBulletinRefresh(
  now: Date,
  snap: TcmbRatesSnapshot | null,
  istenilenYmd: string,
): boolean {
  const { ymd, hour, minute, weekday } = istanbulYmdAndHm(now);
  if (istenilenYmd !== ymd) return false;
  if (isIstanbulWeekend(weekday)) return false;
  if (hour < AFTERNOON_REFRESH_HOUR) return false;
  if (hour === AFTERNOON_REFRESH_HOUR && minute < AFTERNOON_REFRESH_MINUTE) return false;
  if (afternoonRefreshDoneForYmd === ymd) return false;
  if (snap && snap.bulunanTcmbKurTarihi === ymd && !snap.stale) {
    afternoonRefreshDoneForYmd = ymd;
    return false;
  }
  return true;
}

function assertTcmbUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== TCMB_HOST) {
    throw new Error("Yalnızca TCMB adreslerine erişilir.");
  }
  if (!parsed.pathname.startsWith("/kurlar/")) {
    throw new Error("Geçersiz TCMB kur yolu.");
  }
}

export function parseTcmbXml(xml: string): {
  tarih: string;
  usdBuying: number;
  usdSelling: number;
  eurBuying: number;
  eurSelling: number;
} {
  if (/<!ENTITY/i.test(xml) || /SYSTEM\s+["']/i.test(xml)) {
    throw new Error("XML içinde harici entity yasaktır.");
  }
  const dateMatch =
    /Tarih_Date[^>]*\sTarih="(\d{2}\.\d{2}\.\d{4})"/i.exec(xml) ??
    /Date="(\d{2}\/\d{2}\/\d{4})"/i.exec(xml);
  if (!dateMatch?.[1]) throw new Error("TCMB kur tarihi okunamadı.");
  const rawDate = dateMatch[1].includes("/") ? dateMatch[1].replace(/\//g, ".") : dateMatch[1];
  const [dd, mm, yyyy] = rawDate.split(".");
  const tarih = `${yyyy}-${mm}-${dd}`;

  function extractCurrency(code: "USD" | "EUR") {
    const block =
      new RegExp(`<Currency[^>]*CurrencyCode="${code}"[^>]*>([\\s\\S]*?)</Currency>`, "i").exec(xml)?.[1] ??
      new RegExp(`<Currency[^>]*Kod="${code}"[^>]*>([\\s\\S]*?)</Currency>`, "i").exec(xml)?.[1];
    if (!block) throw new Error(`${code} kuru bulunamadı.`);
    const unitRaw = /<Unit>([^<]+)<\/Unit>/i.exec(block)?.[1]?.trim() ?? "1";
    const buyingRaw = /<ForexBuying>([^<]*)<\/ForexBuying>/i.exec(block)?.[1]?.trim();
    const sellingRaw = /<ForexSelling>([^<]*)<\/ForexSelling>/i.exec(block)?.[1]?.trim();
    if (!buyingRaw || !sellingRaw) throw new Error(`${code} Döviz Alış/Satış okunamadı.`);
    const unit = Number.parseInt(unitRaw, 10) || 1;
    return {
      buying: roundRate(Number(buyingRaw.replace(",", ".")) / unit),
      selling: roundRate(Number(sellingRaw.replace(",", ".")) / unit),
    };
  }

  const usd = extractCurrency("USD");
  const eur = extractCurrency("EUR");
  return {
    tarih,
    usdBuying: usd.buying,
    usdSelling: usd.selling,
    eurBuying: eur.buying,
    eurSelling: eur.selling,
  };
}

export function buildTcmbHistoricalUrl(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw new Error("Tarih YYYY-MM-DD olmalıdır.");
  const [, y, mo, d] = m;
  return `https://${TCMB_HOST}/kurlar/${y}${mo}/${d}${mo}${y}.xml`;
}

export function buildTcmbTodayUrl(): string {
  return `https://${TCMB_HOST}${TODAY_PATH}`;
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmdUtc(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw new Error("Tarih YYYY-MM-DD olmalıdır.");
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function addDaysYmd(ymd: string, delta: number): string {
  const d = parseYmdUtc(ymd);
  d.setUTCDate(d.getUTCDate() + delta);
  return toYmd(d);
}

async function defaultFetch(url: string): Promise<string> {
  assertTcmbUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    let lastErr: unknown;
    for (let i = 0; i <= MAX_RETRIES; i++) {
      try {
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { Accept: "application/xml,text/xml,*/*" },
        });
        if (!res.ok) throw new Error(`TCMB HTTP ${res.status}`);
        return await res.text();
      } catch (e) {
        lastErr = e;
        if (i < MAX_RETRIES) await new Promise((r) => setTimeout(r, 300 * (i + 1)));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("TCMB erişilemedi.");
  } finally {
    clearTimeout(timer);
  }
}

function buildSnapshot(
  istenilenTarih: string,
  parsed: ReturnType<typeof parseTcmbXml>,
  fallbackKullanildi: boolean,
  stale: boolean,
  checkedAtIso: string,
): TcmbRatesSnapshot {
  return {
    istenilenTarih,
    bulunanTcmbKurTarihi: parsed.tarih,
    effectiveDate: parsed.tarih,
    fetchedAt: checkedAtIso,
    lastCheckedAt: checkedAtIso,
    fromCache: false,
    source: "TCMB",
    stale,
    fallbackKullanildi,
    usd: {
      currency: "USD",
      buyingRate: parsed.usdBuying.toFixed(8),
      sellingRate: parsed.usdSelling.toFixed(8),
      unit: 1,
    },
    eur: {
      currency: "EUR",
      buyingRate: parsed.eurBuying.toFixed(8),
      sellingRate: parsed.eurSelling.toFixed(8),
      unit: 1,
    },
    usdEurCapraz: roundRate(parsed.usdBuying / parsed.eurBuying).toFixed(8),
    eurUsdCapraz: roundRate(parsed.eurBuying / parsed.usdBuying).toFixed(8),
  };
}

export type GetTcmbRatesOptions = {
  date?: string;
  fetchXml?: TcmbFetchFn;
  bypassCache?: boolean;
  forceRefresh?: boolean;
  now?: Date;
};

async function fetchTcmbRatesUncached(
  istenilen: string,
  now: Date,
  fetchXml: TcmbFetchFn,
): Promise<TcmbRatesSnapshot | null> {
  const checkedAtIso = now.toISOString();
  const todayYmd = istanbulYmdAndHm(now).ymd;

  for (let i = 0; i <= MAX_LOOKBACK_DAYS; i++) {
    const candidate = addDaysYmd(istenilen, -i);
    const url =
      candidate === todayYmd && i === 0 ? buildTcmbTodayUrl() : buildTcmbHistoricalUrl(candidate);
    try {
      const xml = await fetchXml(url);
      const parsed = parseTcmbXml(xml);
      const fallbackKullanildi = parsed.tarih !== istenilen;
      const snap = buildSnapshot(istenilen, parsed, fallbackKullanildi, false, checkedAtIso);
      const awaitingTodayBulletin = istenilen === todayYmd && fallbackKullanildi;
      const ttl = awaitingTodayBulletin ? CACHE_TTL_AWAITING_TODAY_MS : CACHE_TTL_MS;
      memoryCache.set(istenilen, {
        expiresAt: Date.now() + ttl,
        snapshot: snap,
        lastCheckedAt: checkedAtIso,
      });
      lastSuccessful = snap;
      if (snap.bulunanTcmbKurTarihi === todayYmd) afternoonRefreshDoneForYmd = todayYmd;
      return snap;
    } catch {
      continue;
    }
  }

  if (lastSuccessful) {
    return {
      ...lastSuccessful,
      istenilenTarih: istenilen,
      stale: true,
      fallbackKullanildi: true,
      lastCheckedAt: checkedAtIso,
      fromCache: true,
    };
  }
  return null;
}

export async function getTcmbRates(opts: GetTcmbRatesOptions = {}): Promise<TcmbRatesSnapshot | null> {
  const now = opts.now ?? new Date();
  const istenilen = opts.date?.trim() || istanbulYmdAndHm(now).ymd;
  const cacheKey = istenilen;
  const hit = memoryCache.get(cacheKey);
  const hitValid = Boolean(hit && hit.expiresAt > Date.now());
  const cachedSnap = hit?.snapshot ?? lastSuccessful;

  let wantLive = Boolean(opts.bypassCache || opts.forceRefresh);
  if (opts.forceRefresh) {
    const since = Date.now() - lastForceRefreshAt;
    if (since < FORCE_REFRESH_COOLDOWN_MS && hitValid && hit) wantLive = false;
    else lastForceRefreshAt = Date.now();
  }
  if (!wantLive && needsAfternoonBulletinRefresh(now, cachedSnap, istenilen)) wantLive = true;
  if (!wantLive && !hitValid) wantLive = true;

  if (!wantLive && hitValid && hit) {
    return { ...hit.snapshot, lastCheckedAt: hit.lastCheckedAt, fromCache: true };
  }

  const existing = inflightByKey.get(cacheKey);
  if (existing) {
    const shared = await existing;
    return shared ? { ...shared, fromCache: true, lastCheckedAt: shared.lastCheckedAt } : shared;
  }

  const fetchXml = opts.fetchXml ?? defaultFetch;
  const pending = fetchTcmbRatesUncached(istenilen, now, fetchXml).finally(() => {
    inflightByKey.delete(cacheKey);
  });
  inflightByKey.set(cacheKey, pending);
  const result = await pending;

  const { ymd, hour, minute, weekday } = istanbulYmdAndHm(now);
  if (result && result.bulunanTcmbKurTarihi === ymd) {
    afternoonRefreshDoneForYmd = ymd;
  } else if (
    result &&
    !isIstanbulWeekend(weekday) &&
    (hour > AFTERNOON_REFRESH_HOUR ||
      (hour === AFTERNOON_REFRESH_HOUR && minute >= AFTERNOON_REFRESH_MINUTE))
  ) {
    afternoonRefreshDoneForYmd = ymd;
  }
  return result;
}

export async function getTcmbPairRate(
  baz: ParaBirimi,
  karsi: ParaBirimi,
  opts: GetTcmbRatesOptions = {},
): Promise<TcmbPairQuote | null> {
  if (baz === karsi) {
    const ymd = opts.date ?? toYmd(new Date());
    return {
      istenilenTarih: ymd,
      bulunanTcmbKurTarihi: ymd,
      bazParaBirimi: baz,
      karsiParaBirimi: karsi,
      dovizAlis: "1.00000000",
      dovizSatis: "1.00000000",
      kaynak: "TCMB",
      fallbackKullanildi: false,
      stale: false,
      fetchedAt: new Date().toISOString(),
      available: true,
    };
  }
  const snap = await getTcmbRates(opts);
  if (!snap) return null;

  const usdTry = Number(snap.usd.buyingRate);
  const eurTry = Number(snap.eur.buyingRate);
  const usdTrySell = Number(snap.usd.sellingRate);
  const eurTrySell = Number(snap.eur.sellingRate);

  let alis: number;
  let satis: number | null;

  if (baz === "USD" && karsi === "TRY") {
    alis = usdTry;
    satis = usdTrySell;
  } else if (baz === "EUR" && karsi === "TRY") {
    alis = eurTry;
    satis = eurTrySell;
  } else if (baz === "TRY" && karsi === "USD") {
    alis = roundRate(1 / usdTry);
    satis = roundRate(1 / usdTrySell);
  } else if (baz === "TRY" && karsi === "EUR") {
    alis = roundRate(1 / eurTry);
    satis = roundRate(1 / eurTrySell);
  } else if (baz === "USD" && karsi === "EUR") {
    alis = roundRate(usdTry / eurTry);
    satis = roundRate(usdTrySell / eurTrySell);
  } else if (baz === "EUR" && karsi === "USD") {
    alis = roundRate(eurTry / usdTry);
    satis = roundRate(eurTrySell / usdTrySell);
  } else {
    return null;
  }

  return {
    istenilenTarih: snap.istenilenTarih,
    bulunanTcmbKurTarihi: snap.bulunanTcmbKurTarihi,
    bazParaBirimi: baz,
    karsiParaBirimi: karsi,
    dovizAlis: roundRate(alis).toFixed(8),
    dovizSatis: satis == null ? null : roundRate(satis).toFixed(8),
    kaynak: "TCMB",
    fallbackKullanildi: snap.fallbackKullanildi,
    stale: snap.stale,
    fetchedAt: snap.fetchedAt,
    lastCheckedAt: snap.lastCheckedAt,
    fromCache: snap.fromCache,
    available: true,
  };
}

/** Yaklaşık TRY gösterimi — muhasebe değeri değil. */
export function yaklasikTryTutar(
  tutar: number,
  paraBirimi: ParaBirimi,
  snap: TcmbRatesSnapshot | null,
): { tryTutar: number | null; kurTarihi: string | null; aciklama: string | null } {
  if (paraBirimi === "TRY") {
    return { tryTutar: roundMoney(tutar), kurTarihi: null, aciklama: null };
  }
  if (!snap) return { tryTutar: null, kurTarihi: null, aciklama: null };
  const rate = paraBirimi === "USD" ? Number(snap.usd.buyingRate) : Number(snap.eur.buyingRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return { tryTutar: null, kurTarihi: null, aciklama: null };
  }
  const tryTutar = roundMoney(tutar * rate);
  return {
    tryTutar,
    kurTarihi: snap.bulunanTcmbKurTarihi,
    aciklama: `Bugünkü TCMB Döviz Alış kuruna göre yaklaşık`,
  };
}

export function clearTcmbCacheForTests(): void {
  memoryCache.clear();
  lastSuccessful = null;
  inflightByKey.clear();
  lastForceRefreshAt = 0;
  afternoonRefreshDoneForYmd = null;
}

export function seedTcmbCacheForTests(snapshot: TcmbRatesSnapshot): void {
  lastSuccessful = snapshot;
  memoryCache.set(snapshot.istenilenTarih, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    snapshot,
    lastCheckedAt: snapshot.lastCheckedAt,
  });
}
