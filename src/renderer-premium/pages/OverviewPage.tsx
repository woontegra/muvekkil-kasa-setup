import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";
import type { OfisKasaAnaSayfaOzet } from "@shared/types/ofisKasa";
import type { MuvekkilListItem, MuvekkilPagedResult } from "@shared/types/muvekkil";
import type { VekaletTaksitUyariSatir } from "@shared/types/vekalet";
import type { TahsilatMerkeziOzet } from "@shared/types/tahsilatMerkezi";
import { toLocalYmd } from "@shared/lib/accountingPeriod";
import { canMaliKontrol } from "@shared/lib/rolYetki";
import { usePremiumLicense } from "../context/PremiumLicenseContext";
import { usePremiumToast } from "../context/PremiumToastContext";
import { usePremiumAuth } from "../context/PremiumAuthContext";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { PeriodSegmentedSwitch } from "../components/overview/PeriodSegmentedSwitch";
import { MaliKontrolCard } from "../components/overview/MaliKontrolCard";
import { BugunkuRandevularWidget } from "../components/randevu/BugunkuRandevularWidget";
import { PremiumButton } from "../components/PremiumButton";
import { PremiumMuvekkilFormModal } from "../components/muvekkil/PremiumMuvekkilFormModal";
import { CurrencyBalanceCards } from "../components/currency/CurrencyFields";
import { DashboardMetricCard } from "../components/dashboard/DashboardMetricCard";
import { DashboardWorkflowCard } from "../components/dashboard/DashboardWorkflowCard";
import { DashboardQuickActions } from "../components/dashboard/DashboardQuickActions";
import { DashboardWarningCenter } from "../components/dashboard/DashboardWarningCenter";
import { DashboardClientTable } from "../components/dashboard/DashboardClientTable";
import { MKD_MUVEKKIL_CHANGED, MKD_OVERVIEW_REFRESH } from "../lib/events";

async function muvekkilListesiniSayfaliYukle(
  arama: string,
  page: number,
  pageSize: number,
): Promise<MuvekkilPagedResult> {
  return window.api.muvekkilAraPaged(arama, page, pageSize);
}

function donemNetEtiket(n: number): string {
  if (n > 0) return "Dönem kârı";
  if (n < 0) return "Dönem zararı";
  return "Dönem net";
}

export function OverviewPage() {
  const { checkLicense } = usePremiumLicense();
  const { showToast } = usePremiumToast();
  const { user } = usePremiumAuth();
  const location = useLocation();
  const maliKontrolAcik = canMaliKontrol(user?.rol);

  const [tahsilatOzet, setTahsilatOzet] = useState<TahsilatMerkeziOzet | null>(null);

  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sonuc, setSonuc] = useState<MuvekkilListItem[]>([]);
  const [listeTotal, setListeTotal] = useState(0);
  const [listeTotalPages, setListeTotalPages] = useState(0);
  const [listeYukleniyor, setListeYukleniyor] = useState(true);
  const [listeHata, setListeHata] = useState<string | null>(null);

  const [donemMode, setDonemMode] = useState<AccountingPeriodMode>("YEARLY");
  const [donemModeBusy, setDonemModeBusy] = useState(false);
  const [ofisOzet, setOfisOzet] = useState<OfisKasaAnaSayfaOzet | null>(null);
  const [ofisOzetLoading, setOfisOzetLoading] = useState(true);
  const [ofisOzetHata, setOfisOzetHata] = useState<string | null>(null);

  const [smmBekleyenSayisi, setSmmBekleyenSayisi] = useState(0);
  const [taksitOzet, setTaksitOzet] = useState({ vadesiGecmis: 0, bugunOdenecek: 0, odenmemis: 0 });
  const [vadesiGecmisTaksitler, setVadesiGecmisTaksitler] = useState<VekaletTaksitUyariSatir[]>([]);
  const [yanOzetLoading, setYanOzetLoading] = useState(true);
  const [yanOzetHata, setYanOzetHata] = useState<string | null>(null);

  const [lisansKontrol, setLisansKontrol] = useState(false);
  const [muvekkilModalOpen, setMuvekkilModalOpen] = useState(false);
  const [viewingRefDate, setViewingRefDate] = useState<string | null>(null);
  const lastYmdRef = useRef(toLocalYmd());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const yukleOfisOzet = useCallback(async (refDate: string | null) => {
    setOfisOzetLoading(true);
    setOfisOzetHata(null);
    try {
      const oz = await window.api.ofisKasaAnaSayfaOzet({
        referenceDate: refDate ?? undefined,
      });
      if (mountedRef.current) setOfisOzet(oz);
    } catch {
      if (mountedRef.current) {
        setOfisOzet(null);
        setOfisOzetHata("Ofis kasası özeti yüklenemedi.");
        showToast("error", "Ofis kasası özeti yüklenemedi.");
      }
    } finally {
      if (mountedRef.current) setOfisOzetLoading(false);
    }
  }, [showToast]);

  const yukleYanOzetler = useCallback(async () => {
    setYanOzetLoading(true);
    setYanOzetHata(null);
    let hadError = false;
    try {
      const smm = await window.api.vekaletSmmBekleyenler();
      if (mountedRef.current) setSmmBekleyenSayisi(Array.isArray(smm) ? smm.length : 0);
    } catch {
      if (mountedRef.current) setSmmBekleyenSayisi(0);
      hadError = true;
    }
    try {
      const taksit = await window.api.vekaletTaksitUyariOzet();
      if (mountedRef.current && taksit) {
        setTaksitOzet({
          vadesiGecmis: taksit.ozet.vadesiGecmis,
          bugunOdenecek: taksit.ozet.bugunOdenecek,
          odenmemis: taksit.ozet.odenmemis,
        });
        setVadesiGecmisTaksitler(taksit.vadesiGecmisListe ?? []);
      }
    } catch {
      if (mountedRef.current) {
        setTaksitOzet({ vadesiGecmis: 0, bugunOdenecek: 0, odenmemis: 0 });
        setVadesiGecmisTaksitler([]);
      }
      hadError = true;
    }
    try {
      const tahsil = await window.api.tahsilatMerkeziOzet();
      if (mountedRef.current) setTahsilatOzet(tahsil);
    } catch {
      if (mountedRef.current) setTahsilatOzet(null);
    } finally {
      if (mountedRef.current) {
        setYanOzetLoading(false);
        if (hadError) {
          setYanOzetHata("Taksit uyarıları yüklenemedi.");
          showToast("error", "Taksit uyarıları yüklenemedi.");
        }
      }
    }
  }, [showToast]);

  const yukleKayitListesi = useCallback(async () => {
    setListeYukleniyor(true);
    setListeHata(null);
    try {
      const r = await muvekkilListesiniSayfaliYukle(debouncedQ, page, pageSize);
      if (!mountedRef.current) return;
      setSonuc(r.items);
      setListeTotal(r.total);
      setListeTotalPages(r.totalPages);
      if (r.page !== page) setPage(r.page);
    } catch {
      if (mountedRef.current) {
        setSonuc([]);
        setListeTotal(0);
        setListeTotalPages(0);
        setListeHata("Müvekkil listesi yüklenemedi.");
        showToast("error", "Müvekkil listesi yüklenemedi.");
      }
    } finally {
      if (mountedRef.current) setListeYukleniyor(false);
    }
  }, [debouncedQ, page, pageSize, showToast]);

  const reloadAll = useCallback(() => {
    void yukleOfisOzet(viewingRefDate);
    void yukleYanOzetler();
    void yukleKayitListesi();
  }, [viewingRefDate, yukleOfisOzet, yukleYanOzetler, yukleKayitListesi]);

  useEffect(() => {
    void yukleKayitListesi();
  }, [yukleKayitListesi]);

  useEffect(() => {
    void yukleOfisOzet(viewingRefDate);
  }, [viewingRefDate, yukleOfisOzet]);

  useEffect(() => {
    void yukleYanOzetler();
  }, [yukleYanOzetler]);

  useEffect(() => {
    void (async () => {
      try {
        const m = await window.api.getAccountingPeriodMode();
        if (mountedRef.current) setDonemMode(m === "MONTHLY" ? "MONTHLY" : "YEARLY");
      } catch {
        if (mountedRef.current) setDonemMode("YEARLY");
      }
    })();
  }, []);

  useEffect(() => {
    const reloadFinans = () => {
      void yukleOfisOzet(viewingRefDate);
      void yukleYanOzetler();
    };
    const onPeriodChanged = () => {
      setViewingRefDate(null);
      void (async () => {
        try {
          const m = await window.api.getAccountingPeriodMode();
          if (mountedRef.current) setDonemMode(m === "MONTHLY" ? "MONTHLY" : "YEARLY");
        } catch {
          /* ignore */
        }
        void yukleOfisOzet(null);
        void yukleYanOzetler();
      })();
    };
    const onFocus = () => reloadFinans();
    const onVis = () => {
      if (document.visibilityState === "visible") reloadFinans();
    };
    window.addEventListener("mkd:accounting-period-changed", onPeriodChanged);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const timer = window.setInterval(() => {
      const today = toLocalYmd();
      if (today !== lastYmdRef.current) {
        lastYmdRef.current = today;
        setViewingRefDate(null);
        void yukleOfisOzet(null);
        void yukleYanOzetler();
      }
    }, 60_000);
    return () => {
      window.removeEventListener("mkd:accounting-period-changed", onPeriodChanged);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(timer);
    };
  }, [viewingRefDate, yukleOfisOzet, yukleYanOzetler]);

  useEffect(() => {
    if (location.pathname === "/") {
      void yukleKayitListesi();
    }
  }, [location.pathname, yukleKayitListesi]);

  useEffect(() => {
    const onMuvekkilChanged = () => void yukleKayitListesi();
    window.addEventListener(MKD_MUVEKKIL_CHANGED, onMuvekkilChanged);
    return () => window.removeEventListener(MKD_MUVEKKIL_CHANGED, onMuvekkilChanged);
  }, [yukleKayitListesi]);

  useEffect(() => {
    const onOverviewRefresh = () => void yukleYanOzetler();
    window.addEventListener(MKD_OVERVIEW_REFRESH, onOverviewRefresh);
    return () => window.removeEventListener(MKD_OVERVIEW_REFRESH, onOverviewRefresh);
  }, [yukleYanOzetler]);

  async function donemModeSec(mode: AccountingPeriodMode) {
    if (donemModeBusy || mode === donemMode) return;
    setDonemModeBusy(true);
    try {
      const saved = await window.api.setAccountingPeriodMode(mode);
      const next = saved === "MONTHLY" ? "MONTHLY" : "YEARLY";
      setDonemMode(next);
      setViewingRefDate(null);
      window.dispatchEvent(new CustomEvent("mkd:accounting-period-changed"));
      showToast("success", next === "MONTHLY" ? "Aylık hesap dönemi etkinleştirildi." : "Yıllık hesap dönemi etkinleştirildi.");
    } catch {
      showToast("error", "Hesap dönemi kaydedilemedi.");
    } finally {
      setDonemModeBusy(false);
    }
  }

  async function lisansKontrolEt() {
    if (lisansKontrol) return;
    setLisansKontrol(true);
    try {
      const result = await checkLicense();
      if (result.ok) {
        showToast("success", result.message?.trim() || "Lisans doğrulandı.");
      } else {
        showToast("error", result.error?.trim() || "Lisans doğrulanamadı.");
      }
    } catch {
      showToast("error", "Lisans kontrolü sırasında bir hata oluştu.");
    } finally {
      setLisansKontrol(false);
    }
  }

  function yeniMuvekkilAc() {
    setMuvekkilModalOpen(true);
  }

  function handleQueryChange(value: string) {
    setPage(1);
    setQ(value);
  }

  const netLabel = donemNetEtiket(ofisOzet?.donemNetSonucu ?? 0);
  const onayBekleyen = ofisOzet?.onayBekleyenSayisi ?? 0;
  const workflowLoading = ofisOzetLoading || yanOzetLoading;

  return (
    <div className="pm-overview pm-overview--enter">
      <div className="pm-overview-hero">
        <div className="pm-overview-hero-copy">
          <h2 className="pm-overview-welcome">Genel Bakış</h2>
          <p className="pm-overview-sub">Ofis özeti ve güncel durum</p>
        </div>
        <div className="pm-overview-hero-actions">
          <PeriodSegmentedSwitch mode={donemMode} busy={donemModeBusy} onChange={(m) => void donemModeSec(m)} />
          <PremiumButton onClick={yeniMuvekkilAc}>+ Yeni müvekkil</PremiumButton>
        </div>
      </div>

      {(ofisOzetHata || yanOzetHata) && (
        <div className="pm-overview-retry-bar">
          <span>Bazı veriler yüklenemedi.</span>
          <button type="button" className="pm-btn pm-btn--ghost" onClick={reloadAll}>
            Yeniden dene
          </button>
        </div>
      )}

      <section className="pm-finance-strip" aria-label="Finans özeti">
        <div className="pm-finance-strip-head">
          <h2 className="pm-overview-section-title">
            {ofisOzet?.period?.etiket ? `Ofis kasası — ${ofisOzet.period.etiket}` : "Ofis kasası özeti"}
          </h2>
        </div>
        <div className="pm-finance-grid">
          <DashboardMetricCard
            label="Devreden bakiye"
            hint="Önceki dönemden"
            value={ofisOzet?.devredenBakiye ?? 0}
            loading={ofisOzetLoading}
            staggerIndex={0}
            tone="balance"
            icon={<span>↺</span>}
          />
          <DashboardMetricCard
            label="Dönem geliri"
            hint="Seçili dönem"
            value={ofisOzet?.donemGelir ?? 0}
            loading={ofisOzetLoading}
            tone="income"
            staggerIndex={1}
            icon={<span>↑</span>}
          />
          <DashboardMetricCard
            label="Dönem gideri"
            hint="Seçili dönem"
            value={ofisOzet?.donemGider ?? 0}
            loading={ofisOzetLoading}
            tone="expense"
            staggerIndex={2}
            icon={<span>↓</span>}
          />
          <DashboardMetricCard
            label={netLabel}
            hint="Gelir − gider"
            value={ofisOzet?.donemNetSonucu ?? 0}
            loading={ofisOzetLoading}
            signed
            tone={(ofisOzet?.donemNetSonucu ?? 0) > 0 ? "net-pos" : (ofisOzet?.donemNetSonucu ?? 0) < 0 ? "net-neg" : "neutral"}
            staggerIndex={3}
            icon={<span>∑</span>}
          />
          <CurrencyBalanceCards bakiyeler={ofisOzet?.bakiyeler} loading={ofisOzetLoading} />
          <DashboardMetricCard
            label="SMM bekleyen tahsilat"
            hint="Kesim bekleyen kayıt"
            value={smmBekleyenSayisi}
            loading={ofisOzetLoading || yanOzetLoading}
            format="count"
            tone="pending"
            staggerIndex={5}
            icon={<span>!</span>}
          />
        </div>
      </section>

      <div className="pm-overview-grid">
        <div className="pm-overview-main">
          <section className="pm-dash-workflow" aria-label="Güncel iş akışı">
            <div className="pm-dash-workflow-head">
              <h2 className="pm-overview-section-title">Güncel iş akışı</h2>
              <p className="pm-dash-workflow-sub">Takip gerektiren ofis kayıtları</p>
            </div>
            <div className="pm-dash-workflow-grid">
              <DashboardWorkflowCard
                title="Onay bekleyen işlemler"
                value={onayBekleyen}
                hint="Ofis kasası onayı"
                tone="approval"
                loading={workflowLoading}
                to="/ofis-kasasi"
                staggerIndex={0}
                emptyLabel="Onay bekleyen yok"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                }
              />
              <DashboardWorkflowCard
                title="Vadesi geçmiş taksitler"
                value={taksitOzet.vadesiGecmis}
                hint="Acil takip"
                tone="overdue"
                loading={workflowLoading}
                to="/tahsilat-merkezi"
                staggerIndex={1}
                emptyLabel="Gecikmiş yok"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                }
              />
              <DashboardWorkflowCard
                title="Ödenmemiş taksitler"
                value={taksitOzet.odenmemis}
                hint="Açık bakiyeler"
                tone="unpaid"
                loading={workflowLoading}
                to="/tahsilat-merkezi"
                staggerIndex={2}
                emptyLabel="Ödenmemiş yok"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 10h18" />
                  </svg>
                }
              />
              <DashboardWorkflowCard
                title="SMM bekleyen tahsilatlar"
                value={smmBekleyenSayisi}
                hint="Kesim bekleyen"
                tone="smm"
                loading={workflowLoading}
                to="/tahsilat-merkezi"
                staggerIndex={3}
                emptyLabel="SMM bekleyen yok"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 2v6h6M9 15h6M9 11h6" />
                  </svg>
                }
              />
            </div>
          </section>

          <DashboardClientTable
            items={sonuc}
            loading={listeYukleniyor}
            total={listeTotal}
            totalPages={listeTotalPages}
            page={page}
            pageSize={pageSize}
            query={q}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPage(1);
              setPageSize(n);
            }}
            onNewMuvekkil={yeniMuvekkilAc}
            onQueryChange={handleQueryChange}
            error={listeHata}
            onRetry={() => void yukleKayitListesi()}
          />
        </div>

        <aside className="pm-overview-side">
          <DashboardQuickActions
            donemMode={donemMode}
            donemBusy={donemModeBusy}
            licenseBusy={lisansKontrol}
            onNewMuvekkil={yeniMuvekkilAc}
            onDonemChange={(m) => void donemModeSec(m)}
            onLicenseCheck={() => void lisansKontrolEt()}
          />
          <MaliKontrolCard enabled={maliKontrolAcik} />
          <section className="pm-overview-panel pm-tahsilat-side pm-dash-side-card" aria-label="Tahsilat Merkezi özeti">
            <div className="pm-overview-panel-head">
              <h3 className="pm-overview-panel-title">Tahsilat Merkezi</h3>
              <Link to="/tahsilat-merkezi" className="pm-btn pm-btn--sm pm-btn--ghost">
                Aç
              </Link>
            </div>
            <div className="pm-tahsilat-side-grid">
              {yanOzetLoading && !tahsilatOzet ? (
                <p className="pm-muted">Yükleniyor…</p>
              ) : (
                <>
                  <div className="pm-tahsilat-side-stat pm-tahsilat-side-stat--danger">
                    <span className="pm-tahsilat-side-label">Gecikmiş</span>
                    <strong className="pm-tahsilat-side-value">{tahsilatOzet?.gecikmisAdet ?? 0}</strong>
                  </div>
                  <div className="pm-tahsilat-side-stat pm-tahsilat-side-stat--pending">
                    <span className="pm-tahsilat-side-label">Bugün</span>
                    <strong className="pm-tahsilat-side-value">{tahsilatOzet?.bugunAdet ?? 0}</strong>
                  </div>
                  <div className="pm-tahsilat-side-stat pm-tahsilat-side-stat--info">
                    <span className="pm-tahsilat-side-label">7 gün</span>
                    <strong className="pm-tahsilat-side-value">{tahsilatOzet?.yakin7GunAdet ?? 0}</strong>
                  </div>
                  <div className="pm-tahsilat-side-stat pm-tahsilat-side-stat--neutral">
                    <span className="pm-tahsilat-side-label">Kısmi</span>
                    <strong className="pm-tahsilat-side-value">{tahsilatOzet?.kismiAdet ?? 0}</strong>
                  </div>
                </>
              )}
            </div>
          </section>
          <DashboardWarningCenter
            vadesiGecmis={taksitOzet.vadesiGecmis}
            bugunOdenecek={taksitOzet.bugunOdenecek}
            odenmemis={taksitOzet.odenmemis}
            smmBekleyen={smmBekleyenSayisi}
            vadesiGecmisListe={vadesiGecmisTaksitler}
            loading={yanOzetLoading}
          />
          <BugunkuRandevularWidget />
        </aside>
      </div>

      <PremiumMuvekkilFormModal
        open={muvekkilModalOpen}
        onClose={() => setMuvekkilModalOpen(false)}
        onSuccess={() => void yukleKayitListesi()}
      />
    </div>
  );
}
