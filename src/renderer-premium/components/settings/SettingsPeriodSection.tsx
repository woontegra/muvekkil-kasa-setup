import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";
import { PeriodSegmentedSwitch } from "../overview/PeriodSegmentedSwitch";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { SettingsSectionFrame } from "./SettingsSectionFrame";

export function SettingsPeriodSection() {
  const { showToast } = usePremiumToast();
  const [mode, setMode] = useState<AccountingPeriodMode>("YEARLY");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await window.api.getAccountingPeriodMode();
      setMode(m === "MONTHLY" ? "MONTHLY" : "YEARLY");
    } catch {
      setError("Hesap dönemi ayarı yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onPeriodChanged = () => {
      void (async () => {
        try {
          const m = await window.api.getAccountingPeriodMode();
          setMode(m === "MONTHLY" ? "MONTHLY" : "YEARLY");
        } catch {
          /* ignore */
        }
      })();
    };
    window.addEventListener("mkd:accounting-period-changed", onPeriodChanged);
    return () => window.removeEventListener("mkd:accounting-period-changed", onPeriodChanged);
  }, []);

  async function handleChange(next: AccountingPeriodMode) {
    if (busyRef.current || next === mode) return;
    const prev = mode;
    busyRef.current = true;
    setBusy(true);
    setMode(next);
    try {
      const saved = await window.api.setAccountingPeriodMode(next);
      const resolved = saved === "MONTHLY" ? "MONTHLY" : "YEARLY";
      setMode(resolved);
      window.dispatchEvent(new CustomEvent("mkd:accounting-period-changed"));
      showToast(
        "success",
        resolved === "MONTHLY" ? "Aylık hesap dönemi etkinleştirildi." : "Yıllık hesap dönemi etkinleştirildi.",
      );
    } catch {
      setMode(prev);
      showToast("error", "Hesap dönemi kaydedilemedi.");
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  return (
    <SettingsSectionFrame
      title="Hesap Dönemi"
      description="Ana sayfadaki gelir, gider ve dönem sonucu hesaplarının hangi dönem üzerinden gösterileceğini belirler."
      loading={loading}
      error={error}
      onRetry={() => void load()}
    >
      <div className="pm-settings-period-panel pm-stagger-item">
        <PeriodSegmentedSwitch mode={mode} busy={busy} onChange={(m) => void handleChange(m)} />
        <div className="pm-settings-period-notes">
          <div className="pm-settings-period-note">
            <strong>Yıllık dönem</strong>
            <p>Her takvim yılında gelir ve gider hesapları sıfırdan başlar. Önceki yıldan kalan kasa tutarı devreden bakiye olarak gösterilir.</p>
          </div>
          <div className="pm-settings-period-note">
            <strong>Aylık dönem</strong>
            <p>Her ay gelir ve gider hesapları sıfırdan başlar. Önceki aydan kalan kasa tutarı devreden bakiye olarak gösterilir.</p>
          </div>
        </div>
      </div>
    </SettingsSectionFrame>
  );
}
