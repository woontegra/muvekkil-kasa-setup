import { FinanceKpiCard } from "../overview/FinanceKpiCard";
import type { TahsilatMerkeziOzet } from "@shared/types/tahsilatMerkezi";

type Props = {
  ozet: TahsilatMerkeziOzet | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

export function TahsilatMerkeziSummaryStrip({ ozet, loading, error, onRetry }: Props) {
  return (
    <section className="pm-tahsilat-summary pm-stagger" aria-label="Tahsilat merkezi özeti">
      {error ? (
        <div className="pm-tahsilat-summary-error">
          <span>{error}</span>
          <button type="button" className="pm-btn pm-btn--sm pm-btn--ghost" onClick={onRetry}>
            Yeniden dene
          </button>
        </div>
      ) : null}
      <div className="pm-finance-grid pm-tahsilat-finance-grid">
        <FinanceKpiCard
          label="Gecikmiş tahsilat"
          value={ozet?.gecikmisToplam ?? null}
          loading={loading}
          staggerIndex={0}
          tone="alert"
          hint={ozet ? `${ozet.gecikmisAdet} taksit` : undefined}
        />
        <FinanceKpiCard
          label="Bugün vadesi gelen"
          value={ozet?.bugunToplam ?? null}
          loading={loading}
          staggerIndex={1}
          tone="pending"
          hint={ozet ? `${ozet.bugunAdet} taksit` : undefined}
        />
        <FinanceKpiCard
          label="7 gün içinde"
          value={ozet?.yakin7GunToplam ?? null}
          loading={loading}
          staggerIndex={2}
          tone="balance"
          hint={ozet ? `${ozet.yakin7GunAdet} taksit` : undefined}
        />
        <FinanceKpiCard
          label="Kısmi ödenen"
          value={ozet?.kismiToplam ?? null}
          loading={loading}
          staggerIndex={3}
          tone="adjustment"
          hint={ozet ? `${ozet.kismiAdet} taksit` : undefined}
        />
      </div>
    </section>
  );
}
