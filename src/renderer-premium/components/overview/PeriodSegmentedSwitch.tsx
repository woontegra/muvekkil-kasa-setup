import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";

type Props = {
  mode: AccountingPeriodMode;
  busy?: boolean;
  onChange: (mode: AccountingPeriodMode) => void;
};

export function PeriodSegmentedSwitch({ mode, busy, onChange }: Props) {
  return (
    <div className="pm-period-switch" role="radiogroup" aria-label="Hesap dönemi">
      <button
        type="button"
        role="radio"
        aria-checked={mode === "MONTHLY"}
        className={`pm-period-switch-btn${mode === "MONTHLY" ? " pm-period-switch-btn--active" : ""}`}
        disabled={busy}
        onClick={() => onChange("MONTHLY")}
      >
        Aylık
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "YEARLY"}
        className={`pm-period-switch-btn${mode === "YEARLY" ? " pm-period-switch-btn--active" : ""}`}
        disabled={busy}
        onClick={() => onChange("YEARLY")}
      >
        Yıllık
      </button>
    </div>
  );
}
