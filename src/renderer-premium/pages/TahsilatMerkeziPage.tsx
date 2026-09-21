import { TahsilatMerkeziFilters } from "../components/tahsilatMerkezi/TahsilatMerkeziFilters";
import { TahsilatMerkeziSummaryStrip } from "../components/tahsilatMerkezi/TahsilatMerkeziSummaryStrip";
import { TahsilatMerkeziTable } from "../components/tahsilatMerkezi/TahsilatMerkeziTable";
import { PremiumTaksitOdemeModal } from "../components/vekalet/PremiumTaksitOdemeModal";
import { usePremiumToast } from "../context/PremiumToastContext";
import { useTahsilatMerkezi } from "../hooks/useTahsilatMerkezi";

export function TahsilatMerkeziPage() {
  const { showToast } = usePremiumToast();
  const tm = useTahsilatMerkezi(showToast);

  return (
    <div className="pm-tahsilat-page pm-page-enter">
      <TahsilatMerkeziSummaryStrip
        ozet={tm.ozet}
        loading={tm.ozetLoading}
        error={tm.ozetError}
        onRetry={() => void tm.yukleOzet()}
      />

      <TahsilatMerkeziFilters tm={tm} />
      <TahsilatMerkeziTable tm={tm} />

      {tm.odemeTaksit ? (
        <PremiumTaksitOdemeModal
          open={tm.odemeSatir != null}
          saving={tm.odemeSaving}
          error={tm.odemeError}
          taksit={tm.odemeTaksit}
          onClose={() => tm.setOdemeSatir(null)}
          onSave={tm.odemeKaydet}
        />
      ) : null}
    </div>
  );
}
