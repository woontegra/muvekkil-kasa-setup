import { FinanceKpiCard } from "../overview/FinanceKpiCard";
import type { OfisKasaUstOzet } from "@shared/types/ofisKasa";
import { PARA_BIRIMLERI } from "@shared/lib/paraBirimi";
import { CurrencyBalanceCards } from "../currency/CurrencyFields";
import { FinancePeriodSelector } from "../mali/FinancePeriodSelector";
import type { FinancePeriodRange } from "@shared/lib/financePeriodRange";

type Props = {
  ust: OfisKasaUstOzet | null;
  loading: boolean;
  error: string | null;
  periodEtiket: string;
  financePeriod: FinancePeriodRange;
  onFinancePeriodChange: (next: FinancePeriodRange) => void;
  onRetry: () => void;
};

export function OfisKasaSummaryStrip({
  ust,
  loading,
  error,
  periodEtiket,
  financePeriod,
  onFinancePeriodChange,
  onRetry,
}: Props) {
  const etiket = ust?.period?.etiket || periodEtiket;
  const net = ust?.donemNetSonucu ?? null;
  const duzeltme = ust ? (ust.donemDuzeltmeEtkisi ?? ust.buAyDuzeltmeEtkisi) : null;
  const onayBekleyen = ust?.onayBekleyenSayisi ?? null;

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
      <div className="pm-ofis-summary-head pm-stagger-item">
        <FinancePeriodSelector value={financePeriod} onChange={onFinancePeriodChange} disabled={loading} />
        {etiket ? <p className="pm-ofis-period-label">{etiket}</p> : null}
      </div>
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
        <FinanceKpiCard
          label="Onay bekleyen"
          value={onayBekleyen}
          loading={loading}
          staggerIndex={6}
          tone="neutral"
        />
      </div>
      {ust?.byCurrency ? (
        <div className="pm-ofis-currency-period-grid pm-stagger-item">
          {PARA_BIRIMLERI.map((pb) => {
            const o = ust.byCurrency[pb];
            if (!o) return null;
            return (
              <div key={pb} className="pm-ofis-currency-period-card" data-pb={pb}>
                <h3 className="pm-ofis-currency-period-title">{pb} dönem özeti</h3>
                <dl className="pm-ofis-currency-period-dl">
                  <div>
                    <dt>Gelir</dt>
                    <dd>{loading ? "…" : o.donemGelir.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</dd>
                  </div>
                  <div>
                    <dt>Gider</dt>
                    <dd>{loading ? "…" : o.donemGider.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</dd>
                  </div>
                  <div>
                    <dt>Net</dt>
                    <dd>{loading ? "…" : o.donemNetSonucu.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
