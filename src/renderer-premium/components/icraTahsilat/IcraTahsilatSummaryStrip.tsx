import { FinanceKpiCard } from "../overview/FinanceKpiCard";
import type { IcraTahsilatUstOzet } from "@shared/types/icraTahsilat";
import { PARA_BIRIMLERI, formatMoney } from "@shared/lib/paraBirimi";

type Props = {
  ust: IcraTahsilatUstOzet | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

export function IcraTahsilatSummaryStrip({ ust, loading, error, onRetry }: Props) {
  return (
    <section className="pm-icra-summary pm-stagger" aria-label="İcra tahsilat özeti">
      {error ? (
        <div className="pm-icra-summary-error">
          <span>{error}</span>
          <button type="button" className="pm-btn pm-btn--sm pm-btn--ghost" onClick={onRetry}>
            Yeniden dene
          </button>
        </div>
      ) : null}
      <div className="pm-finance-grid pm-icra-finance-grid">
        {PARA_BIRIMLERI.map((pb, i) => {
          const toneByPb = { TRY: "pb-try", USD: "pb-usd", EUR: "pb-eur" } as const;
          return (
            <article
              key={pb}
              className={`pm-finance-kpi pm-finance-kpi--${toneByPb[pb]} pm-stagger-item`}
              data-kpi-tone={toneByPb[pb]}
              data-pb={pb}
              style={{ ["--pm-stagger-i" as string]: i }}
            >
              <div className="pm-finance-kpi-body">
                <span className="pm-finance-kpi-label">Kalan alacak · {pb}</span>
                <span className="pm-finance-kpi-value">
                  {loading ? "…" : formatMoney(ust?.byCurrency?.[pb]?.kalanAlacak ?? 0, pb)}
                </span>
              </div>
            </article>
          );
        })}
        <FinanceKpiCard label="Toplam alacak" value={ust?.toplamAlacak ?? null} loading={loading} staggerIndex={3} tone="balance" />
        <FinanceKpiCard
          label="Tahsil edilen"
          value={ust?.tahsilEdilen ?? null}
          loading={loading}
          staggerIndex={4}
          tone="income"
        />
        <FinanceKpiCard label="Kalan alacak" value={ust?.kalanAlacak ?? null} loading={loading} staggerIndex={5} tone="balance" />
        <FinanceKpiCard
          label="Vadesi geçmiş taksit"
          value={ust?.vadesiGecmisTaksit ?? null}
          loading={loading}
          staggerIndex={6}
          format="count"
          tone="expense"
        />
        <FinanceKpiCard
          label="Dönem tahsilatı"
          value={ust?.buAyTahsilat ?? null}
          loading={loading}
          staggerIndex={7}
          tone="income"
        />
      </div>
    </section>
  );
}
