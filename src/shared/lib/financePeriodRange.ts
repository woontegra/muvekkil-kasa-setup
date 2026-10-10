import { toLocalYmd } from "./accountingPeriod";

export type FinancePeriodPreset =
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "LAST_3_MONTHS"
  | "LAST_6_MONTHS"
  | "LAST_12_MONTHS"
  | "THIS_YEAR"
  | "ALL_TIME"
  | "CUSTOM";

export type FinancePeriodRange = {
  preset: FinancePeriodPreset;
  bas: string | null;
  bit: string | null;
  etiket: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function thisMonthRange(now: Date): { bas: string; bit: string } {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return { bas: `${y}-${pad2(m)}-01`, bit: toLocalYmd(now) };
}

function lastMonthRange(now: Date): { bas: string; bit: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const prevY = m === 0 ? y - 1 : y;
  const prevM = m === 0 ? 12 : m;
  const last = lastDayOfMonth(prevY, prevM);
  return { bas: `${prevY}-${pad2(prevM)}-01`, bit: `${prevY}-${pad2(prevM)}-${pad2(last)}` };
}

function lastNMonthsRange(now: Date, n: number): { bas: string; bit: string } {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  let ty = y;
  let tm = m - n;
  while (tm <= 0) {
    tm += 12;
    ty -= 1;
  }
  const maxD = lastDayOfMonth(ty, tm);
  const day = Math.min(d, maxD);
  return { bas: `${ty}-${pad2(tm)}-${pad2(day)}`, bit: toLocalYmd(now) };
}

function thisYearRange(now: Date): { bas: string; bit: string } {
  const y = now.getFullYear();
  return { bas: `${y}-01-01`, bit: toLocalYmd(now) };
}

const PRESET_LABELS: Record<FinancePeriodPreset, string> = {
  THIS_MONTH: "Bu Ay",
  LAST_MONTH: "Geçen Ay",
  LAST_3_MONTHS: "Son 3 Ay",
  LAST_6_MONTHS: "Son 6 Ay",
  LAST_12_MONTHS: "Son 12 Ay",
  THIS_YEAR: "Bu Yıl",
  ALL_TIME: "Tüm Zamanlar",
  CUSTOM: "Özel Tarih",
};

export const FINANCE_PERIOD_OPTIONS: { value: FinancePeriodPreset; label: string }[] = (
  Object.keys(PRESET_LABELS) as FinancePeriodPreset[]
)
  .filter((p) => p !== "CUSTOM")
  .map((p) => ({ value: p, label: PRESET_LABELS[p] }));

export function resolveFinancePeriodRange(
  preset: FinancePeriodPreset,
  opts?: { now?: Date; bas?: string | null; bit?: string | null },
): FinancePeriodRange {
  const now = opts?.now ?? new Date();
  if (preset === "ALL_TIME") {
    return { preset, bas: null, bit: null, etiket: PRESET_LABELS.ALL_TIME };
  }
  if (preset === "CUSTOM") {
    const bas = opts?.bas?.trim().slice(0, 10) || null;
    const bit = opts?.bit?.trim().slice(0, 10) || null;
    return { preset, bas, bit, etiket: PRESET_LABELS.CUSTOM };
  }
  let range: { bas: string; bit: string };
  switch (preset) {
    case "LAST_MONTH":
      range = lastMonthRange(now);
      break;
    case "LAST_3_MONTHS":
      range = lastNMonthsRange(now, 3);
      break;
    case "LAST_6_MONTHS":
      range = lastNMonthsRange(now, 6);
      break;
    case "LAST_12_MONTHS":
      range = lastNMonthsRange(now, 12);
      break;
    case "THIS_YEAR":
      range = thisYearRange(now);
      break;
    case "THIS_MONTH":
    default:
      range = thisMonthRange(now);
  }
  return { preset, bas: range.bas, bit: range.bit, etiket: PRESET_LABELS[preset] };
}

export function donemBoundsFromFinanceRange(range: FinancePeriodRange): { bas: string; bit: string } {
  if (range.bas && range.bit) return { bas: range.bas, bit: range.bit };
  return { bas: "0000-01-01", bit: "9999-12-31" };
}
