import { useState } from "react";
import { PremiumButton } from "../components/PremiumButton";
import { PremiumConfirmDialog } from "../components/dosya/PremiumConfirmDialog";
import { OfisKasaFilters } from "../components/ofisKasa/OfisKasaFilters";
import { OfisKasaSummaryStrip } from "../components/ofisKasa/OfisKasaSummaryStrip";
import { OfisKasaTable } from "../components/ofisKasa/OfisKasaTable";
import { PremiumOfisKasaDuzeltmeModal } from "../components/ofisKasa/PremiumOfisKasaDuzeltmeModal";
import { PremiumOfisKasaIslemModal } from "../components/ofisKasa/PremiumOfisKasaIslemModal";
import { PremiumDovizDonusumModal } from "../components/ofisKasa/PremiumDovizDonusumModal";
import { usePremiumToast } from "../context/PremiumToastContext";
import { useOfisKasa } from "../hooks/useOfisKasa";
import { GuvenliSilModal } from "../components/kasa/GuvenliSilModal";

export function OfisKasaPage() {
  const { showToast } = usePremiumToast();
  const ofis = useOfisKasa(showToast);
  const [dovizOpen, setDovizOpen] = useState(false);

  return (
    <div className="pm-ofis-page pm-page-enter">
      <div className="pm-ofis-toolbar pm-stagger-item">
        <div className="pm-ofis-toolbar-left">
          <PremiumButton type="button" className="pm-btn--sm" onClick={ofis.openGelirEkle}>
            Gelir ekle
          </PremiumButton>
          <PremiumButton type="button" className="pm-btn--sm" onClick={ofis.openGiderEkle}>
            Gider ekle
          </PremiumButton>
          <PremiumButton type="button" variant="ghost" className="pm-btn--sm" onClick={() => setDovizOpen(true)}>
            Döviz dönüşümü
          </PremiumButton>
        </div>
        <PremiumButton type="button" variant="ghost" className="pm-btn--sm" onClick={ofis.raporYazdir}>
          Rapor yazdır
        </PremiumButton>
      </div>

      <OfisKasaSummaryStrip
        ust={ofis.ust}
        loading={ofis.ustLoading}
        error={ofis.ustError}
        periodEtiket={ofis.periodEtiket}
        onRetry={() => void ofis.yukleUst()}
      />

      <OfisKasaFilters ofis={ofis} />
      <OfisKasaTable ofis={ofis} />

      <PremiumOfisKasaIslemModal ofis={ofis} />
      <PremiumOfisKasaDuzeltmeModal ofis={ofis} />
      <PremiumDovizDonusumModal
        open={dovizOpen}
        onClose={() => setDovizOpen(false)}
        onSaved={() => {
          showToast("success", "Döviz dönüşümü kaydedildi.");
          void ofis.tumunuYenile();
        }}
      />

      <PremiumConfirmDialog
        open={ofis.confirm != null}
        title={ofis.confirm?.title ?? ""}
        message={ofis.confirm?.message ?? ""}
        variant={ofis.confirm?.variant}
        confirmLabel={ofis.confirm?.confirmLabel}
        busy={ofis.confirmBusy}
        onConfirm={() => void ofis.confirm?.onConfirm()}
        onCancel={() => {
          if (!ofis.confirmBusy) ofis.setConfirm(null);
        }}
      />

      <GuvenliSilModal
        ozet={ofis.guvenliSilOzet}
        loading={ofis.guvenliSilBusy}
        error={ofis.guvenliSilErr}
        onClose={() => !ofis.guvenliSilBusy && ofis.setGuvenliSilOzet(null)}
        onSubmit={(p) => void ofis.guvenliSilGonder(p)}
      />
    </div>
  );
}
