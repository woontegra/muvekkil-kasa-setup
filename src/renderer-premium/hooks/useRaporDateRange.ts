import { getActiveAccountingPeriodRange } from "@shared/lib/accountingPeriod";
import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";
import { useCallback, useEffect, useRef, useState } from "react";
import { ayBasiSonu } from "../lib/ofisKasa";

export function useRaporDateRange() {
  const fallback = ayBasiSonu();
  const [bas, setBasState] = useState(fallback.bas);
  const [bit, setBitState] = useState(fallback.bit);
  const autoRef = useRef(true);

  const applyAutoRange = useCallback(async () => {
    try {
      const mode = (await window.api.getAccountingPeriodMode?.()) as AccountingPeriodMode | undefined;
      const range = getActiveAccountingPeriodRange(mode === "MONTHLY" ? "MONTHLY" : "YEARLY");
      if (autoRef.current) {
        setBasState(range.bas);
        setBitState(range.bit);
      }
    } catch {
      /* keep current */
    }
  }, []);

  useEffect(() => {
    void applyAutoRange();
    const onPeriodChanged = () => {
      void applyAutoRange();
    };
    window.addEventListener("mkd:accounting-period-changed", onPeriodChanged);
    return () => window.removeEventListener("mkd:accounting-period-changed", onPeriodChanged);
  }, [applyAutoRange]);

  const setBas = useCallback((value: string) => {
    autoRef.current = false;
    setBasState(value);
  }, []);

  const setBit = useCallback((value: string) => {
    autoRef.current = false;
    setBitState(value);
  }, []);

  return { bas, bit, setBas, setBit };
}
