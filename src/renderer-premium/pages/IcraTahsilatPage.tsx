import { PremiumButton } from "../components/PremiumButton";
import { IcraTahsilatFilters } from "../components/icraTahsilat/IcraTahsilatFilters";
import { IcraTahsilatSummaryStrip } from "../components/icraTahsilat/IcraTahsilatSummaryStrip";
import { IcraTahsilatTable } from "../components/icraTahsilat/IcraTahsilatTable";
import { PremiumIcraAlacakModal } from "../components/icraTahsilat/PremiumIcraAlacakModal";
import { PremiumIcraDetayModal } from "../components/icraTahsilat/PremiumIcraDetayModal";
import { usePremiumToast } from "../context/PremiumToastContext";
import { useIcraTahsilat } from "../hooks/useIcraTahsilat";

export function IcraTahsilatPage() {
  const { showToast } = usePremiumToast();
  const icra = useIcraTahsilat(showToast);

  return (
    <div className="pm-icra-page pm-page-enter">
      <div className="pm-icra-toolbar pm-stagger-item">
        <PremiumButton type="button" className="pm-btn--sm" onClick={() => icra.setAlacakModalAcik(true)}>
          Yeni icra tahsilat alacağı
        </PremiumButton>
        <PremiumButton type="button" variant="ghost" className="pm-btn--sm" onClick={icra.raporYazdir}>
          İcra tahsilat raporu yazdır
        </PremiumButton>
      </div>

      <IcraTahsilatSummaryStrip
        ust={icra.ust}
        loading={icra.ustLoading}
        error={icra.ustError}
        onRetry={() => void icra.yukleUst()}
      />

      <IcraTahsilatFilters icra={icra} />
      <IcraTahsilatTable icra={icra} />

      <PremiumIcraAlacakModal
        open={icra.alacakModalAcik}
        onClose={() => icra.setAlacakModalAcik(false)}
        onSaved={icra.onAlacakKaydedildi}
      />

      <PremiumIcraDetayModal
        open={icra.detay != null}
        alacak={icra.detay}
        onClose={() => icra.setDetay(null)}
        onChanged={icra.onDetayDegisti}
        showToast={showToast}
      />
    </div>
  );
}
