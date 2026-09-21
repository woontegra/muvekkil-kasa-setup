/**
 * SaaS `paraBirimi.ts` paritesi — TRY / USD / EUR.
 * Para: 2 ondalık HALF_UP. Kur: 8 ondalık HALF_UP.
 */

export const PARA_BIRIMLERI = ["TRY", "USD", "EUR"] as const;
export type ParaBirimi = (typeof PARA_BIRIMLERI)[number];

export const PARA_BIRIMI_SEMBOL: Record<ParaBirimi, string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
};

export const PARA_BIRIMI_LABEL: Record<ParaBirimi, string> = {
  TRY: "Türk Lirası",
  USD: "ABD Doları",
  EUR: "Euro",
};

export type KurKaynagi = "TCMB" | "MANUEL";

export const MONEY_NBSP = "\u00A0";

/** HALF_UP to `places` using string scale (avoids JS float drift for finance). */
function roundHalfUp(value: number | string, places: number): number {
  const raw = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(raw)) return NaN;
  const neg = raw < 0;
  const abs = Math.abs(raw);
  const factor = 10 ** places;
  const scaled = abs * factor;
  const whole = Math.floor(scaled + 1e-12);
  const frac = scaled - whole;
  let rounded = frac >= 0.5 - 1e-12 ? whole + 1 : whole;
  // tie-breaking already HALF_UP via >= 0.5
  const out = rounded / factor;
  return neg ? -out : out;
}

export function roundMoney(value: number | string): number {
  return roundHalfUp(value, 2);
}

export function roundRate(value: number | string): number {
  return roundHalfUp(value, 8);
}

export function moneyToFixed2(value: number | string): string {
  return roundMoney(value).toFixed(2);
}

export function rateToFixed8(value: number | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return roundRate(value).toFixed(8);
}

export function resolveParaBirimi(raw: unknown): ParaBirimi {
  if (raw == null || raw === "") return "TRY";
  const s = String(raw).trim().toUpperCase();
  if (s === "TRY" || s === "USD" || s === "EUR") return s;
  throw new Error("Geçersiz para birimi. TRY, USD veya EUR olmalıdır.");
}

export function tryResolveParaBirimi(raw: unknown): ParaBirimi {
  try {
    return resolveParaBirimi(raw);
  } catch {
    return "TRY";
  }
}

function formatFixed2AsTrDigits(fixed2: string): string {
  const neg = fixed2.startsWith("-");
  const body = neg ? fixed2.slice(1) : fixed2;
  const [intRaw, fracRaw = "00"] = body.split(".");
  const frac = `${fracRaw}00`.slice(0, 2);
  const intFormatted = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${intFormatted},${frac}`;
}

/** SaaS formatMoneyDisplay paritesi. */
export function formatMoney(amount: number, currency: ParaBirimi = "TRY"): string {
  if (!Number.isFinite(amount)) return "—";
  const fixed = roundMoney(amount).toFixed(2);
  const neg = fixed.startsWith("-");
  const absFixed = neg ? fixed.slice(1) : fixed;
  const digits = formatFixed2AsTrDigits(absFixed);
  const sign = neg ? "-" : "";
  if (currency === "TRY") return `${sign}${digits}${MONEY_NBSP}₺`;
  if (currency === "USD") return `${sign}$${digits}`;
  return `${sign}€${digits}`;
}

export function formatKurOzeti(baz: ParaBirimi, karsi: ParaBirimi, kur: number | string): string {
  return `1 ${baz} = ${roundRate(kur).toFixed(8)} ${karsi}`;
}

export function parsePositiveMoney(raw: unknown, fieldLabel = "Tutar"): number {
  if (raw == null || raw === "") throw new Error(`${fieldLabel} zorunludur.`);
  let n: number;
  if (typeof raw === "string") {
    const s = raw.trim();
    let normalized: string;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || (s.includes(",") && s.includes("."))) {
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else if (s.includes(",")) {
      normalized = s.replace(",", ".");
    } else {
      normalized = s;
    }
    n = Number(normalized);
  } else {
    n = Number(raw);
  }
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${fieldLabel} pozitif olmalıdır.`);
  return roundMoney(n);
}

export type CrossPaymentInput = {
  alacakParaBirimi: ParaBirimi;
  kasaTutari?: unknown;
  odemeParaBirimi?: unknown;
  mahsupTutari: unknown;
  kalanBorc: number;
};

export type ResolvedPayment = {
  alacakParaBirimi: ParaBirimi;
  odemeParaBirimi: ParaBirimi;
  mahsupTutari: number;
  kasaTutari: number;
  kur: number | null;
  kurBazParaBirimi: ParaBirimi | null;
  kurKarsiParaBirimi: ParaBirimi | null;
  kurOzeti: string | null;
  isCrossCurrency: boolean;
};

/**
 * Aynı PB: kasa = mahsup, kur yok.
 * Farklı PB: kur = kasa / mahsup → «1 {alacak} = kur {odeme}».
 */
export function resolvePaymentAmounts(input: CrossPaymentInput): ResolvedPayment {
  const alacakParaBirimi = input.alacakParaBirimi;
  const odemeParaBirimi = resolveParaBirimi(input.odemeParaBirimi ?? alacakParaBirimi);
  const mahsupTutari = parsePositiveMoney(input.mahsupTutari, "Borçtan düşülecek tutar");
  const kalan = roundMoney(input.kalanBorc);

  if (mahsupTutari > kalan + 1e-9) {
    throw new Error(`Mahsup tutarı kalan borcu (${formatMoney(kalan, alacakParaBirimi)}) aşamaz.`);
  }

  if (odemeParaBirimi === alacakParaBirimi) {
    const kasa =
      input.kasaTutari == null || input.kasaTutari === ""
        ? mahsupTutari
        : parsePositiveMoney(input.kasaTutari, "Kasaya giren tutar");
    if (Math.abs(kasa - mahsupTutari) > 0.0001) {
      throw new Error("Aynı para biriminde kasaya giren tutar ile mahsup tutarı eşit olmalıdır.");
    }
    return {
      alacakParaBirimi,
      odemeParaBirimi,
      mahsupTutari,
      kasaTutari: kasa,
      kur: null,
      kurBazParaBirimi: null,
      kurKarsiParaBirimi: null,
      kurOzeti: null,
      isCrossCurrency: false,
    };
  }

  if (input.kasaTutari == null || input.kasaTutari === "") {
    throw new Error("Farklı para biriminde ödeme için kasaya giren tutar zorunludur.");
  }
  const kasaTutari = parsePositiveMoney(input.kasaTutari, "Kasaya giren tutar");
  const kur = roundRate(kasaTutari / mahsupTutari);
  if (!Number.isFinite(kur) || kur <= 0) throw new Error("Uygulanan kur geçersiz.");

  return {
    alacakParaBirimi,
    odemeParaBirimi,
    mahsupTutari,
    kasaTutari,
    kur,
    kurBazParaBirimi: alacakParaBirimi,
    kurKarsiParaBirimi: odemeParaBirimi,
    kurOzeti: formatKurOzeti(alacakParaBirimi, odemeParaBirimi, kur),
    isCrossCurrency: true,
  };
}

export function resolveDovizDonusum(opts: {
  kaynakParaBirimi: unknown;
  hedefParaBirimi: unknown;
  kaynakTutar: unknown;
  hedefTutar: unknown;
}): {
  kaynakParaBirimi: ParaBirimi;
  hedefParaBirimi: ParaBirimi;
  kaynakTutar: number;
  hedefTutar: number;
  kur: number;
  kurOzeti: string;
} {
  const kaynakParaBirimi = resolveParaBirimi(opts.kaynakParaBirimi);
  const hedefParaBirimi = resolveParaBirimi(opts.hedefParaBirimi);
  if (kaynakParaBirimi === hedefParaBirimi) {
    throw new Error("Kaynak ve hedef para birimi aynı olamaz.");
  }
  const kaynakTutar = parsePositiveMoney(opts.kaynakTutar, "Kaynak tutar");
  const hedefTutar = parsePositiveMoney(opts.hedefTutar, "Hedef tutar");
  const kur = roundRate(hedefTutar / kaynakTutar);
  if (!Number.isFinite(kur) || kur <= 0) throw new Error("Uygulanan kur geçersiz.");
  return {
    kaynakParaBirimi,
    hedefParaBirimi,
    kaynakTutar,
    hedefTutar,
    kur,
    kurOzeti: formatKurOzeti(kaynakParaBirimi, hedefParaBirimi, kur),
  };
}

export type CurrencyBucket = {
  toplamGelir: number;
  toplamGider: number;
  toplamDuzeltme: number;
  dovizCikis: number;
  dovizGiris: number;
};

export function emptyCurrencyBuckets(): Record<ParaBirimi, CurrencyBucket> {
  const one = (): CurrencyBucket => ({
    toplamGelir: 0,
    toplamGider: 0,
    toplamDuzeltme: 0,
    dovizCikis: 0,
    dovizGiris: 0,
  });
  return { TRY: one(), USD: one(), EUR: one() };
}

export function currencyBucketBalance(b: CurrencyBucket): number {
  return roundMoney(b.toplamGelir - b.toplamGider + b.toplamDuzeltme - b.dovizCikis + b.dovizGiris);
}

export function applyToCurrencyBucket(
  buckets: Record<ParaBirimi, CurrencyBucket>,
  islemTipi: string,
  paraBirimi: ParaBirimi,
  tutar: number,
): void {
  const b = buckets[paraBirimi];
  const t = roundMoney(tutar);
  if (islemTipi === "GELIR") b.toplamGelir = roundMoney(b.toplamGelir + t);
  else if (islemTipi === "GIDER") b.toplamGider = roundMoney(b.toplamGider + t);
  else if (islemTipi === "DUZELTME") b.toplamDuzeltme = roundMoney(b.toplamDuzeltme + t);
  else if (islemTipi === "DOVIZ_CIKIS") b.dovizCikis = roundMoney(b.dovizCikis + t);
  else if (islemTipi === "DOVIZ_GIRIS") b.dovizGiris = roundMoney(b.dovizGiris + t);
}
