/**
 * SaaS `karlilikOfisGelir.ts` paritesi — kârlılık para birimi kovaları.
 * Para birimleri birbirine çevrilmez; her kova bağımsız toplanır.
 */
import { PARA_BIRIMLERI, moneyToFixed2, roundMoney, type ParaBirimi } from "./paraBirimi";

export type KarlilikCurrency = ParaBirimi;

export type NumberByCurrency = Record<KarlilikCurrency, number>;

export type MoneyByCurrency = Record<KarlilikCurrency, string>;

export const KARLILIK_CURRENCIES: readonly KarlilikCurrency[] = PARA_BIRIMLERI;

export function emptyNumberByCurrency(): NumberByCurrency {
  return { TRY: 0, USD: 0, EUR: 0 };
}

export function resolveKarlilikCurrency(raw: unknown): KarlilikCurrency | null {
  const pb = String(raw ?? "").trim().toUpperCase();
  if (pb === "TRY" || pb === "USD" || pb === "EUR") return pb;
  return null;
}

/** Tanınmayan para birimi sessizce atlanır (SaaS davranışı). */
export function addToNumberByCurrency(
  buckets: NumberByCurrency,
  paraBirimi: unknown,
  amount: number,
): void {
  const pb = resolveKarlilikCurrency(paraBirimi);
  if (!pb) return;
  if (!Number.isFinite(amount)) return;
  buckets[pb] = roundMoney(buckets[pb] + amount);
}

export function toMoneyByCurrency(buckets: NumberByCurrency): MoneyByCurrency {
  return {
    TRY: moneyToFixed2(buckets.TRY),
    USD: moneyToFixed2(buckets.USD),
    EUR: moneyToFixed2(buckets.EUR),
  };
}

/** Net = gelir − gider; para birimleri karışmaz. */
export function netByCurrency(gelir: NumberByCurrency, gider: NumberByCurrency): NumberByCurrency {
  return {
    TRY: roundMoney(gelir.TRY - gider.TRY),
    USD: roundMoney(gelir.USD - gider.USD),
    EUR: roundMoney(gelir.EUR - gider.EUR),
  };
}

export function moneyStringNonZero(s: string | null | undefined): boolean {
  if (s == null || s === "") return false;
  const n = Number(s);
  return Number.isFinite(n) && Math.abs(n) > 0.0001;
}
