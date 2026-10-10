import type { CSSProperties, ReactNode } from "react";
import { AnimatedAmount } from "../overview/AnimatedAmount";
import { formatSignedTry, formatTry } from "../../lib/format";
import type { FinanceKpiTone } from "../overview/FinanceKpiCard";

export type DashboardMetricTone = FinanceKpiTone;

type Props = {
  label: string;
  hint?: string;
  value: number | null;
  loading?: boolean;
  format?: "money" | "count";
  signed?: boolean;
  tone?: DashboardMetricTone;
  icon?: ReactNode;
  staggerIndex?: number;
};

export function DashboardMetricCard({
  label,
  hint,
  value,
  loading,
  format = "money",
  signed = false,
  tone = "default",
  icon,
  staggerIndex = 0,
}: Props) {
  const fmt =
    format === "count"
      ? (n: number) => String(Math.round(n))
      : signed
        ? formatSignedTry
        : formatTry;

  const resolvedTone: DashboardMetricTone =
    tone === "default" && signed && value != null
      ? value > 0
        ? "net-pos"
        : value < 0
          ? "net-neg"
          : "neutral"
      : tone;

  return (
    <article
      className={`pm-finance-kpi pm-dash-metric pm-finance-kpi--${resolvedTone} pm-stagger-item`}
      style={{ "--pm-stagger-i": staggerIndex } as CSSProperties}
      data-kpi-tone={resolvedTone}
    >
      <span className="pm-dash-metric-accent" aria-hidden />
      {icon ? (
        <div className="pm-finance-kpi-icon" aria-hidden>
          {icon}
        </div>
      ) : null}
      <div className="pm-finance-kpi-body">
        <span className="pm-finance-kpi-label">{label}</span>
        {loading ? (
          <span className="pm-skeleton pm-skeleton--value" aria-hidden />
        ) : (
          <span className="pm-finance-kpi-value">
            {value != null ? <AnimatedAmount value={value} format={fmt} /> : "—"}
          </span>
        )}
        {hint ? <span className="pm-finance-kpi-hint">{hint}</span> : null}
      </div>
    </article>
  );
}
