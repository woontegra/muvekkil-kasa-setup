import type { KasaOzet } from "@shared/types/kasa";
import { formatTry } from "../../lib/format";
import { AnimatedAmount } from "../overview/AnimatedAmount";

type Props = {
  ozet: KasaOzet | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

function Metric({
  label,
  value,
  tone,
  loading,
  format = "money",
}: {
  label: string;
  value: number | null;
  tone: string;
  loading: boolean;
  format?: "money" | "count";
}) {
  return (
    <div className={`pm-dosya-metric pm-dosya-metric--${tone}`} data-kpi-tone={tone}>
      <span className="pm-dosya-metric-label">{label}</span>
      {loading ? (
        <span className="pm-dosya-metric-skeleton" aria-hidden />
      ) : value != null ? (
        format === "count" ? (
          <span className="pm-dosya-metric-value">{value}</span>
        ) : (
          <AnimatedAmount value={value} format={formatTry} className="pm-dosya-metric-value" />
        )
      ) : (
        <span className="pm-dosya-metric-value">—</span>
      )}
    </div>
  );
}

export function DosyaKasaSummaryStrip({ ozet, loading, error, onRetry }: Props) {
  const onaysiz = ozet?.onayBekleyenSayisi ?? null;
  return (
    <section className="pm-dosya-summary pm-dosya-stagger" aria-label="Dosya kasa özeti">
      {error ? (
        <div className="pm-dosya-summary-error">
          <span>{error}</span>
          <button type="button" className="pm-btn pm-btn--ghost pm-btn--sm" onClick={onRetry}>
            Yeniden dene
          </button>
        </div>
      ) : null}
      <div className="pm-dosya-summary-grid">
        <Metric label="Toplam avans (onaylı)" value={ozet?.toplamAvans ?? null} tone="avans" loading={loading} />
        <Metric label="Toplam masraf (onaylı)" value={ozet?.toplamMasraf ?? null} tone="masraf" loading={loading} />
        <Metric label="Kalan avans" value={ozet?.kalanAvans ?? null} tone="kalan" loading={loading} />
        <Metric
          label="Onaysız işlem"
          value={onaysiz}
          tone={onaysiz != null && onaysiz > 0 ? "onaysiz-aktif" : "onaysiz"}
          loading={loading}
          format="count"
        />
      </div>
    </section>
  );
}
