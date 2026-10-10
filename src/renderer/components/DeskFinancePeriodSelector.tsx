import type { FinancePeriodPreset, FinancePeriodRange } from "@shared/lib/financePeriodRange";
import { FINANCE_PERIOD_OPTIONS, resolveFinancePeriodRange } from "@shared/lib/financePeriodRange";

type Props = {
  value: FinancePeriodRange;
  onChange: (next: FinancePeriodRange) => void;
  disabled?: boolean;
};

/** Legacy Ofis Kasası dönem seçici — premium ile aynı sözleşme. */
export function DeskFinancePeriodSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="desk-finance-period">
      <label className="desk-finance-period-label" htmlFor="desk-finance-period-preset">
        Dönem
      </label>
      <select
        id="desk-finance-period-preset"
        className="desk-input"
        value={value.preset}
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
        <div className="desk-finance-period-custom">
          <input
            type="date"
            className="desk-input"
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
          <span className="muted">–</span>
          <input
            type="date"
            className="desk-input"
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
