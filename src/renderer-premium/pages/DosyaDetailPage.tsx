import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Dosya } from "@shared/types/dosya";
import type { Muvekkil } from "@shared/types/muvekkil";
import { PremiumDosyaFormModal } from "../components/dosya/PremiumDosyaFormModal";
import { DosyaInfoPanel } from "../components/dosya/DosyaInfoPanel";
import { DosyaKasaHareketleriTable } from "../components/dosya/DosyaKasaHareketleriTable";
import { DosyaKasaSummaryStrip } from "../components/dosya/DosyaKasaSummaryStrip";
import { PremiumConfirmDialog } from "../components/dosya/PremiumConfirmDialog";
import { PremiumIslemEkleModal } from "../components/dosya/PremiumIslemEkleModal";
import { PremiumKasaAvansModal } from "../components/dosya/PremiumKasaAvansModal";
import { PremiumKasaDuzeltmeModal } from "../components/dosya/PremiumKasaDuzeltmeModal";
import { GuvenliSilModal } from "../components/kasa/GuvenliSilModal";
import { PremiumKasaMasrafModal } from "../components/dosya/PremiumKasaMasrafModal";
import { usePremiumPageMeta } from "../context/PremiumPageMetaContext";
import { usePremiumToast } from "../context/PremiumToastContext";
import { useDosyaKasa } from "../hooks/useDosyaKasa";
import { useVekaletTaksit } from "../hooks/useVekaletTaksit";
import { PremiumVekaletTaksitPanel } from "../components/vekalet/PremiumVekaletTaksitPanel";
import { DosyaDetailTabBar, type DosyaDetailTab } from "../components/dosya/DosyaDetailTabBar";
import { DosyaMaliOzetSection } from "../components/dosya/DosyaMaliOzetSection";
import { MuvekkilEkstreSection } from "../components/dosya/MuvekkilEkstreSection";
import { muvekkilGorunenAd } from "../lib/muvekkil";

export function DosyaDetailPage() {
  const navigate = useNavigate();
  const { showToast } = usePremiumToast();
  const { setMeta } = usePremiumPageMeta();
  const { muvekkilId, dosyaId } = useParams();
  const mid = Number(muvekkilId);
  const did = Number(dosyaId);

  const [muvekkil, setMuvekkil] = useState<Muvekkil | null>(null);
  const [dosya, setDosya] = useState<Dosya | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [islemSecimOpen, setIslemSecimOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DosyaDetailTab>("genel");

  const kasa = useDosyaKasa(did, mid, showToast);
  const vekalet = useVekaletTaksit(did, mid, showToast);

  const yukleInfo = useCallback(async () => {
    if (!window.api || !Number.isFinite(mid) || !Number.isFinite(did)) {
      setInfoLoading(false);
      setInfoError("Geçersiz adres.");
      return;
    }
    setInfoLoading(true);
    setInfoError(null);
    try {
      const [mu, d] = await Promise.all([window.api.muvekkilGet(mid), window.api.dosyaGet(did)]);
      setMuvekkil(mu);
      setDosya(d);
      if (!d) setInfoError("Dosya bulunamadı.");
    } catch {
      setInfoError("Dosya bilgileri yüklenemedi.");
    } finally {
      setInfoLoading(false);
    }
  }, [mid, did]);

  useEffect(() => {
    void yukleInfo();
  }, [yukleInfo]);

  useEffect(() => {
    if (!dosya) {
      setMeta(null);
      return;
    }
    const konu = (dosya.konuBasligi ?? "").trim() || "Dosya";
    const desc = muvekkil ? muvekkilGorunenAd(muvekkil) : "Dosya kasa ve işlem kayıtları";
    setMeta({ title: konu, desc });
    return () => setMeta(null);
  }, [dosya, muvekkil, setMeta]);

  function hesapOzetiYazdir() {
    navigate(`/print/hesap-ozeti/${did}`);
  }

  if (!Number.isFinite(did) || !Number.isFinite(mid)) {
    return <p className="pm-muted">Geçersiz adres.</p>;
  }

  if (infoLoading) {
    return (
      <div className="pm-dosya-page pm-dosya-page--loading">
        <div className="pm-dosya-info-skeleton" />
        <div className="pm-dosya-summary-skeleton" />
        <div className="pm-kasa-skeleton" />
      </div>
    );
  }

  if (infoError || !dosya || !muvekkil) {
    return (
      <div className="pm-dosya-page">
        <p className="pm-form-error">{infoError ?? "Dosya yüklenemedi."}</p>
        <button type="button" className="pm-btn pm-btn--ghost" onClick={() => void yukleInfo()}>
          Yeniden dene
        </button>
      </div>
    );
  }

  return (
    <div className="pm-dosya-page pm-page-enter">
      <DosyaInfoPanel
        muvekkil={muvekkil}
        dosya={dosya}
        muvekkilId={mid}
        onEdit={() => setEditOpen(true)}
        onIslemEkle={() => setIslemSecimOpen(true)}
        onHesapOzeti={hesapOzetiYazdir}
        onMaliOzet={() => setActiveTab("maliOzet")}
        onEkstre={() => setActiveTab("ekstre")}
      />

      <DosyaDetailTabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === "genel" ? (
        <>
          <DosyaKasaSummaryStrip
            ozet={kasa.ozet}
            loading={kasa.ozetLoading}
            error={kasa.ozetError}
            onRetry={() => void kasa.yukleOzet()}
          />

          <DosyaKasaHareketleriTable kasa={kasa} />

          <PremiumVekaletTaksitPanel dosyaId={did} muvekkilId={mid} vekalet={vekalet} />
        </>
      ) : null}

      {activeTab === "maliOzet" ? (
        <DosyaMaliOzetSection dosyaId={did} vekaletParaBirimi={vekalet.vekalet?.paraBirimi} />
      ) : null}

      {activeTab === "ekstre" ? <MuvekkilEkstreSection dosyaId={did} /> : null}

      <PremiumConfirmDialog
        open={kasa.confirm != null}
        title={kasa.confirm?.title ?? ""}
        message={kasa.confirm?.message ?? ""}
        variant={kasa.confirm?.variant}
        confirmLabel={kasa.confirm?.confirmLabel}
        busy={kasa.confirmBusy}
        onConfirm={() => void kasa.confirmOnayla()}
        onCancel={() => !kasa.confirmBusy && kasa.setConfirm(null)}
      />

      <PremiumIslemEkleModal
        open={islemSecimOpen}
        onClose={() => setIslemSecimOpen(false)}
        onAvans={() => kasa.openIslemEkle()}
        onMasraf={() => kasa.openMasrafEkle()}
      />

      <PremiumKasaAvansModal
        key={kasa.avansFormKey}
        open={kasa.avansOpen}
        saving={kasa.saving}
        error={kasa.formErr}
        onClose={() => !kasa.saving && kasa.setAvansOpen(false)}
        onSave={kasa.kaydetAvans}
      />

      <PremiumKasaMasrafModal
        key={kasa.masrafFormKey}
        open={kasa.masrafOpen}
        saving={kasa.saving}
        error={kasa.formErr}
        masrafTurleri={kasa.masrafTurleri}
        editHareket={kasa.masrafEdit}
        onClose={() => {
          if (kasa.saving) return;
          kasa.setMasrafOpen(false);
          kasa.setMasrafEdit(null);
        }}
        onSave={kasa.kaydetMasraf}
      />

      <PremiumKasaDuzeltmeModal
        hedef={kasa.duzeltmeHedef}
        saving={kasa.duzeltmeSaving}
        error={kasa.duzeltmeErr}
        onClose={() => !kasa.duzeltmeSaving && kasa.setDuzeltmeHedef(null)}
        onSave={kasa.kaydetDuzeltme}
      />

      <PremiumDosyaFormModal
        open={editOpen}
        initial={dosya}
        onClose={() => setEditOpen(false)}
        onSuccess={() => void yukleInfo()}
      />

      <GuvenliSilModal
        ozet={kasa.guvenliSilOzet}
        loading={kasa.guvenliSilBusy}
        error={kasa.guvenliSilErr}
        onClose={() => !kasa.guvenliSilBusy && kasa.setGuvenliSilOzet(null)}
        onSubmit={(p) => void kasa.guvenliSilGonder(p)}
      />
    </div>
  );
}
