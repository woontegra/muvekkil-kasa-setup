import { useEffect, useMemo, useState } from "react";
import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";
import { getAccountingPeriod, getPreviousAccountingPeriod } from "@shared/lib/accountingPeriod";

export type PeriodFilter = "ALL" | "CURRENT" | "PREVIOUS";

export function useAccountingPeriodFilter() {
  const [mode, setMode] = useState<AccountingPeriodMode>("YEARLY");
  const [filter, setFilter] = useState<PeriodFilter>("CURRENT");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadMode = async () => {
      setLoading(true);
      try {
        const m = await window.api.getAccountingPeriodMode?.();
        if (!cancelled) setMode(m === "MONTHLY" ? "MONTHLY" : "YEARLY");
      } catch {
        if (!cancelled) setMode("YEARLY");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadMode();
    const onPeriodChanged = () => void loadMode();
    window.addEventListener("mkd:accounting-period-changed", onPeriodChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("mkd:accounting-period-changed", onPeriodChanged);
    };
  }, []);

  const range = useMemo(() => {
    if (filter === "ALL") return null;
    const current = getAccountingPeriod(mode);
    if (filter === "CURRENT") return { bas: current.bas, bit: current.bit };
    const prev = getPreviousAccountingPeriod(current);
    return { bas: prev.bas, bit: prev.bit };
  }, [filter, mode]);

  function filterByPeriod<T extends { tarih: string }>(rows: T[]): T[] {
    if (!range) return rows;
    return rows.filter((h) => {
      const t = (h.tarih ?? "").slice(0, 10);
      return t >= range.bas && t <= range.bit;
    });
  }

  const rangeKey = range ? `${range.bas}|${range.bit}` : "ALL";

  return { filter, setFilter, filterByPeriod, rangeKey, loading };
}
