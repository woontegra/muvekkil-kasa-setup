import type { CSSProperties, ReactNode } from "react";
import { AnimatedAmount } from "./AnimatedAmount";
import { formatSignedTry, formatTry } from "../../lib/format";

/** SaaS Ofis Kasası / kârlılık semantic tones. */
export type FinanceKpiTone =
  | "default"
  | "positive"
  | "neutral"
  | "alert"
  | "income"
  | "expense"
  | "pending"
  | "adjustment"
  | "balance"
  | "net-pos"
  | "net-neg"
  | "pb-try"
  | "pb-usd"
  | "pb-eur";

type Props = {
  label: string;
  hint?: string;
  value: number | null;
  loading?: boolean;
  format?: "money" | "count";
  signed?: boolean;
  tone?: FinanceKpiTone;
  icon?: ReactNode;
  staggerIndex?: number;
  animateKey?: string;
};

export function FinanceKpiCard({
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

  const resolvedTone: FinanceKpiTone =
    tone === "default" && signed && value != null
      ? value > 0
        ? "net-pos"
        : value < 0
          ? "net-neg"
          : "neutral"
      : tone;

  return (
    <article
      className={`pm-finance-kpi pm-finance-kpi--${resolvedTone} pm-stagger-item`}
      style={{ "--pm-stagger-i": staggerIndex } as CSSProperties}
      data-kpi-tone={resolvedTone}
    >
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
