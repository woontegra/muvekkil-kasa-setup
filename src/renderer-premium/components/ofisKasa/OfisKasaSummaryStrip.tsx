import { FinanceKpiCard } from "../overview/FinanceKpiCard";
import type { OfisKasaUstOzet } from "@shared/types/ofisKasa";
import { CurrencyBalanceCards } from "../currency/CurrencyFields";

type Props = {
  ust: OfisKasaUstOzet | null;
  loading: boolean;
  error: string | null;
  periodEtiket: string;
  onRetry: () => void;
};

export function OfisKasaSummaryStrip({ ust, loading, error, periodEtiket, onRetry }: Props) {
  const etiket = ust?.period?.etiket || periodEtiket;
  const net = ust?.donemNetSonucu ?? null;
  const duzeltme = ust ? (ust.donemDuzeltmeEtkisi ?? ust.buAyDuzeltmeEtkisi) : null;

  return (
    <section className="pm-ofis-summary pm-stagger" aria-label="Ofis kasa özeti">
      {error ? (
        <div className="pm-ofis-summary-error">
          <span>{error}</span>
          <button type="button" className="pm-btn pm-btn--sm pm-btn--ghost" onClick={onRetry}>
            Yeniden dene
          </button>
        </div>
      ) : null}
      {etiket ? <p className="pm-ofis-period-label pm-stagger-item">{etiket}</p> : null}
      <div className="pm-finance-grid pm-ofis-finance-grid">
        <CurrencyBalanceCards bakiyeler={ust?.bakiyeler} loading={loading} />
        <FinanceKpiCard
          label="Devreden bakiye"
          value={ust?.devredenBakiye ?? null}
          loading={loading}
          staggerIndex={0}
          tone="balance"
        />
        <FinanceKpiCard
          label="Dönem geliri"
          value={ust ? (ust.donemGelir ?? ust.buAyGelir) : null}
          loading={loading}
          staggerIndex={1}
          tone="income"
        />
        <FinanceKpiCard
          label="Dönem gideri"
          value={ust ? (ust.donemGider ?? ust.buAyGider) : null}
          loading={loading}
          staggerIndex={2}
          tone="expense"
        />
        <FinanceKpiCard
          label="Dönem düzeltme etkisi"
          value={duzeltme}
          loading={loading}
          staggerIndex={3}
          signed
          tone="adjustment"
        />
        <FinanceKpiCard
          label="Dönem net sonucu"
          value={net}
          loading={loading}
          staggerIndex={4}
          signed
          tone={net == null ? "neutral" : net > 0 ? "net-pos" : net < 0 ? "net-neg" : "neutral"}
        />
        <FinanceKpiCard
          label="Güncel kasa bakiyesi"
          value={ust?.kasaBakiyesi ?? null}
          loading={loading}
          staggerIndex={5}
          tone="balance"
        />
      </div>
    </section>
  );
}
