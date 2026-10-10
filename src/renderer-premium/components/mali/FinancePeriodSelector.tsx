import type { FinancePeriodPreset, FinancePeriodRange } from "@shared/lib/financePeriodRange";
import { FINANCE_PERIOD_OPTIONS, resolveFinancePeriodRange } from "@shared/lib/financePeriodRange";

type Props = {
  value: FinancePeriodRange;
  onChange: (next: FinancePeriodRange) => void;
  disabled?: boolean;
};

export function FinancePeriodSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="pm-finance-period">
      <label className="pm-finance-period-label" htmlFor="pm-finance-period-preset">
        Dönem
      </label>
      <select
        id="pm-finance-period-preset"
        className="pm-input pm-input--compact"
        value={value.preset === "CUSTOM" ? "CUSTOM" : value.preset}
        disabled={disabled}
        onChange={(e) => {
          const preset = e.target.value as FinancePeriodPreset;
          if (preset === "CUSTOM") {
            onChange(
              resolveFinancePeriodRange("CUSTOM", {
                bas: value.bas,
                bit: value.bit,
              }),
            );
          } else {
            onChange(resolveFinancePeriodRange(preset));
          }
        }}
      >
        {FINANCE_PERIOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value="CUSTOM">Özel Tarih</option>
      </select>
      {value.preset === "CUSTOM" ? (
        <div className="pm-finance-period-custom">
          <input
            type="date"
            className="pm-input pm-input--compact"
            value={value.bas ?? ""}
            disabled={disabled}
            aria-label="Dönem başlangıç"
            onChange={(e) =>
              onChange(
                resolveFinancePeriodRange("CUSTOM", {
                  bas: e.target.value,
                  bit: value.bit,
                }),
              )
            }
          />
          <span className="pm-muted">–</span>
          <input
            type="date"
            className="pm-input pm-input--compact"
            value={value.bit ?? ""}
            disabled={disabled}
            aria-label="Dönem bitiş"
            onChange={(e) =>
              onChange(
                resolveFinancePeriodRange("CUSTOM", {
                  bas: value.bas,
                  bit: e.target.value,
                }),
              )
            }
          />
        </div>
      ) : null}
    </div>
  );
}
