import { useMemo, useState } from "react";
import {
  donemBoundsFromFinanceRange,
  resolveFinancePeriodRange,
  type FinancePeriodRange,
} from "@shared/lib/financePeriodRange";

/** Client-side finans dönem filtresi — economicTarih (yoksa tarih) ile. */
export function useFinancePeriodFilter(initial: FinancePeriodRange = resolveFinancePeriodRange("THIS_MONTH")) {
  const [financePeriod, setFinancePeriod] = useState<FinancePeriodRange>(initial);

  const range = useMemo(() => {
    if (financePeriod.preset === "ALL_TIME") return null;
    const bounds = donemBoundsFromFinanceRange(financePeriod);
    if (bounds.bas === "0000-01-01") return null;
    return bounds;
  }, [financePeriod]);

  function filterByPeriod<T extends { tarih: string; economicTarih?: string }>(rows: T[]): T[] {
    if (!range) return rows;
    return rows.filter((h) => {
      const t = (h.economicTarih ?? h.tarih ?? "").slice(0, 10);
      return t >= range.bas && t <= range.bit;
    });
  }

  const rangeKey = `${financePeriod.preset}|${financePeriod.bas ?? ""}|${financePeriod.bit ?? ""}`;

  return { financePeriod, setFinancePeriod, filterByPeriod, rangeKey, range };
}
