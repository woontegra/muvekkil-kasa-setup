import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";
import type { OfisKasaAnaSayfaOzet } from "@shared/types/ofisKasa";
import type { MuvekkilInput, MuvekkilListItem, MuvekkilPagedResult } from "@shared/types/muvekkil";
import type { VekaletTaksitUyariSatir } from "@shared/types/vekalet";
import { toLocalYmd } from "@shared/lib/accountingPeriod";
import { MuvekkilFormModal } from "../components/MuvekkilFormModal";
import { DeskTableIconLink } from "../components/DeskTableIconBtn";
import { IconAc } from "../components/DeskTableIcons";
import {
  IconAlert,
  IconBalance,
  IconCalendar,
  IconLicense,
  IconMail,
  IconPhone,
  IconPlus,
  IconSearch,
  IconUser,
  IconWallet,
} from "../components/icons/HomeIcons";
import { useLicenseStatus } from "../hooks/useLicenseStatus";
import { formatDateTr, formatTry } from "../lib/format";
import { PARA_BIRIMLERI, formatMoney } from "@shared/lib/paraBirimi";
import { taksitDurumBadgeClass, taksitDurumEtiket } from "../lib/vekalet";
import {
  MUVEKKIL_PAGE_SIZES,
  muvekkilGorunenAd,
  muvekkilListeEposta,
  muvekkilListeSayfaNumaralari,
  muvekkilListeTelefonu,
  muvekkilTurEtiket,
} from "../lib/muvekkil";
import { LegacyMaliKontrolCard } from "../components/LegacyMaliKontrolCard";

async function muvekkilListesiniSayfaliYukle(
  arama: string,
  page: number,
  pageSize: number
): Promise<MuvekkilPagedResult> {
  if (!window.api?.muvekkilAraPaged) {
    return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
  return window.api.muvekkilAraPaged(arama, page, pageSize);
}

function bugunTarihi(): string {
  return new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function donemNetEtiket(n: number): string {
  if (n > 0) return "Dönem net (kâr)";
  if (n < 0) return "Dönem net (zarar)";
  return "Dönem net";
}

export function HomePage() {
  const { state: licenseState, loading: licenseLoading, checkLicense } = useLicenseStatus();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [sonuc, setSonuc] = useState<MuvekkilListItem[]>([]);
  const [listeTotal, setListeTotal] = useState(0);
  const [listeTotalPages, setListeTotalPages] = useState(0);
  const [listeYukleniyor, setListeYukleniyor] = useState(false);
  const [modal, setModal] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [lisansKontrol, setLisansKontrol] = useState(false);
  const [viewingRefDate, setViewingRefDate] = useState<string | null>(null);
  const [donemMode, setDonemMode] = useState<AccountingPeriodMode>("YEARLY");
  const [donemModeBusy, setDonemModeBusy] = useState(false);
  const [ofisOzet, setOfisOzet] = useState<OfisKasaAnaSayfaOzet | null>(null);
  const [smmBekleyenSayisi, setSmmBekleyenSayisi] = useState(0);
  const [taksitOzet, setTaksitOzet] = useState({ vadesiGecmis: 0, bugunOdenecek: 0, odenmemis: 0 });
  const [vadesiGecmisTaksitler, setVadesiGecmisTaksitler] = useState<VekaletTaksitUyariSatir[]>([]);
  const lastYmdRef = useRef(toLocalYmd());

  const ilkKullanim = listeTotal === 0 && !listeYukleniyor && !q.trim();
  const aramaSonucuBos = listeTotal === 0 && !listeYukleniyor && q.trim().length > 0;

  const yukleKayitListesi = useCallback(async () => {
    setListeYukleniyor(true);
    try {
      const r = await muvekkilListesiniSayfaliYukle(q, page, pageSize);
      setSonuc(r.items);
      setListeTotal(r.total);
      setListeTotalPages(r.totalPages);
      if (r.page !== page) setPage(r.page);
    } catch (e) {
      console.error("muvekkil sayfalı arama", e);
      setSonuc([]);
      setListeTotal(0);
      setListeTotalPages(0);
    } finally {
      setListeYukleniyor(false);
    }
  }, [q, page, pageSize]);

  useEffect(() => {
    void yukleKayitListesi();
  }, [yukleKayitListesi]);

  const yukleOfisOzet = useCallback(async (refDate: string | null) => {
    try {
      const oz = await window.api.ofisKasaAnaSayfaOzet({
        referenceDate: refDate ?? undefined,
      });
      setOfisOzet(oz);
    } catch {
      setOfisOzet(null);
    }
  }, []);

  const yukleYanOzetler = useCallback(async () => {
    try {
      const smm = await window.api?.vekaletSmmBekleyenler?.();
      setSmmBekleyenSayisi(Array.isArray(smm) ? smm.length : 0);
    } catch {
      setSmmBekleyenSayisi(0);
    }
    try {
      const taksit = await window.api?.vekaletTaksitUyariOzet?.();
      if (taksit) {
        setTaksitOzet({
          vadesiGecmis: taksit.ozet.vadesiGecmis,
          bugunOdenecek: taksit.ozet.bugunOdenecek,
          odenmemis: taksit.ozet.odenmemis,
        });
        setVadesiGecmisTaksitler(taksit.vadesiGecmisListe ?? []);
      }
    } catch {
      setTaksitOzet({ vadesiGecmis: 0, bugunOdenecek: 0, odenmemis: 0 });
      setVadesiGecmisTaksitler([]);
    }
  }, []);

  useEffect(() => {
    void yukleOfisOzet(viewingRefDate);
  }, [viewingRefDate, yukleOfisOzet]);

  useEffect(() => {
    void yukleYanOzetler();
  }, [yukleYanOzetler]);

  useEffect(() => {
    const reload = () => {
      void yukleOfisOzet(viewingRefDate);
      void yukleYanOzetler();
    };
  const onPeriodChanged = () => {
      setViewingRefDate(null);
      void (async () => {
        try {
          const m = await window.api.getAccountingPeriodMode?.();
          setDonemMode(m === "MONTHLY" ? "MONTHLY" : "YEARLY");
        } catch {
          /* ignore */
        }
        void yukleOfisOzet(null);
        void yukleYanOzetler();
      })();
    };
    const onFocus = () => reload();
    const onVis = () => {
      if (document.visibilityState === "visible") reload();
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

  async function yeniKaydet(input: MuvekkilInput) {
    if (kaydediyor) return;
    setErr(null);
    if (!window.api?.muvekkilEkle) {
      setErr("Müvekkil kaydedilemedi.");
      return;
    }
    setKaydediyor(true);
    try {
      await window.api.muvekkilEkle(input);
      setModal(false);
      const guncel = await muvekkilListesiniSayfaliYukle(q, 1, pageSize);
      setPage(1);
      setSonuc(guncel.items);
      setListeTotal(guncel.total);
      setListeTotalPages(guncel.totalPages);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Müvekkil kaydedilemedi.");
      throw e;
    } finally {
      setKaydediyor(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const m = await window.api.getAccountingPeriodMode?.();
        setDonemMode(m === "MONTHLY" ? "MONTHLY" : "YEARLY");
      } catch {
        setDonemMode("YEARLY");
      }
    })();
  }, []);

  async function donemModeSec(mode: AccountingPeriodMode) {
    if (donemModeBusy || mode === donemMode) return;
    setDonemModeBusy(true);
    try {
      const saved = await window.api.setAccountingPeriodMode(mode);
      setDonemMode(saved === "MONTHLY" ? "MONTHLY" : "YEARLY");
      setViewingRefDate(null);
      window.dispatchEvent(new CustomEvent("mkd:accounting-period-changed"));
      await yukleOfisOzet(null);
    } catch (e) {
      console.error("[setAccountingPeriodMode]", e);
    } finally {
      setDonemModeBusy(false);
    }
  }

  async function lisansKontrolEt() {
    setLisansKontrol(true);
    try {
      await checkLicense();
    } finally {
      setLisansKontrol(false);
    }
  }

  const listeMeta = listeYukleniyor
    ? "Yükleniyor…"
    : listeTotal === 1
      ? "1 kayıt"
      : `Toplam ${listeTotal} kayıt`;

  const kpiTitle = ofisOzet?.period?.etiket
    ? `Ofis kasası özeti — ${ofisOzet.period.etiket}`
    : "Ofis kasası özeti";

  return (
    <div className={`desk-page desk-page-shell desk-app-page desk-page--home-dashboard${ilkKullanim ? " desk-page--home-empty" : ""}`}>
      <header className="desk-home-page-header">
        <div className="desk-home-page-header-text">
          <h1 className="desk-page-title">Müvekkil Kasa</h1>
          <p className="desk-page-sub">Müvekkil arama, ofis kasası ve taksit takibi.</p>
        </div>
        <div className="desk-home-page-date" aria-label="Bugünün tarihi">
          Bugün: <strong>{bugunTarihi()}</strong>
        </div>
      </header>

      <div className="desk-home-dashboard">
        <div className="desk-home-dashboard-main">
          <section className="desk-home-kpi-section" aria-label="Ofis kasası özeti">
            <div className="desk-home-kpi-section-head">
              <h2 className="desk-home-kpi-section-title">{kpiTitle}</h2>
            </div>
            <div className="desk-home-kpi-grid">
              <article className="kpi-card desk-home-kpi-card desk-home-kpi-card--ay">
                <div className="desk-home-kpi-icon" aria-hidden>
                  <IconBalance />
                </div>
                <div className="desk-home-kpi-body">
                  <span className="desk-home-kpi-label">Devreden bakiye</span>
                  <span className="desk-home-kpi-value desk-num">{formatTry(ofisOzet?.devredenBakiye ?? 0)}</span>
                  <span className="desk-home-kpi-hint">Önceki dönemden</span>
                </div>
              </article>
              <article className="kpi-card desk-home-kpi-card desk-home-kpi-card--bakiye">
                <div className="desk-home-kpi-icon" aria-hidden>
                  <IconWallet />
                </div>
                <div className="desk-home-kpi-body">
                  <span className="desk-home-kpi-label">Dönem geliri</span>
                  <span className="desk-home-kpi-value desk-num desk-home-kpi-value--success">
                    {formatTry(ofisOzet?.donemGelir ?? 0)}
                  </span>
                  <span className="desk-home-kpi-hint">Seçili dönem</span>
                </div>
              </article>
              <article className="kpi-card desk-home-kpi-card desk-home-kpi-card--gider">
                <div className="desk-home-kpi-icon" aria-hidden>
                  <IconWallet />
                </div>
                <div className="desk-home-kpi-body">
                  <span className="desk-home-kpi-label">Dönem gideri</span>
                  <span className="desk-home-kpi-value desk-num">{formatTry(ofisOzet?.donemGider ?? 0)}</span>
                  <span className="desk-home-kpi-hint">Seçili dönem</span>
                </div>
              </article>
              <article className="kpi-card desk-home-kpi-card desk-home-kpi-card--ay">
                <div className="desk-home-kpi-icon" aria-hidden>
                  <IconCalendar />
                </div>
                <div className="desk-home-kpi-body">
                  <span className="desk-home-kpi-label">{donemNetEtiket(ofisOzet?.donemNetSonucu ?? 0)}</span>
                  <span className="desk-home-kpi-value desk-num">{formatTry(ofisOzet?.donemNetSonucu ?? 0)}</span>
                  <span className="desk-home-kpi-hint">Gelir − gider</span>
                </div>
              </article>
              {PARA_BIRIMLERI.map((pb) => (
                <article key={pb} className="kpi-card desk-home-kpi-card desk-home-kpi-card--bakiye">
                  <div className="desk-home-kpi-icon" aria-hidden><IconBalance /></div>
                  <div className="desk-home-kpi-body">
                    <span className="desk-home-kpi-label">Güncel kasa · {pb}</span>
                    <span className="desk-home-kpi-value desk-num desk-home-kpi-value--success">
                      {formatMoney(ofisOzet?.bakiyeler?.[pb] ?? 0, pb)}
                    </span>
                    <span className="desk-home-kpi-hint">Tüm zamanlar</span>
                  </div>
                </article>
              ))}
              <article className="kpi-card desk-home-kpi-card desk-home-kpi-card--smm">
                <div className="desk-home-kpi-icon" aria-hidden>
                  <IconAlert />
                </div>
                <div className="desk-home-kpi-body">
                  <span className="desk-home-kpi-label">SMM bekleyen tahsilat</span>
                  <span className="desk-home-kpi-value">{smmBekleyenSayisi}</span>
                  <span className="desk-home-kpi-hint">Kesim bekleyen kayıt</span>
                </div>
              </article>
            </div>
          </section>

          <section className="card desk-home-search-card" aria-label="Müvekkil arama">
            <div className="desk-home-search-inner">
              <label htmlFor="home-ara" className="desk-home-search-label">
                Müvekkil ara
              </label>
              <div className="desk-home-search-row">
                <div className="desk-home-search-field">
                  <IconSearch className="desk-home-search-icon" />
                  <input
                    id="home-ara"
                    className="desk-input form-input desk-home-search-input"
                    placeholder="Müvekkil adı, şirket adı veya telefon ara..."
                    value={q}
                    onChange={(e) => {
                      setPage(1);
                      setQ(e.target.value);
                    }}
                  />
                </div>
                <button type="button" className="btn btn-primary desk-home-search-btn" onClick={() => setModal(true)}>
                  <IconPlus className="desk-home-search-btn-icon" />
                  Yeni müvekkil
                </button>
              </div>
              {q.trim() ? (
                <p className="desk-home-search-status">
                  Arama: <strong>{q.trim()}</strong>
                </p>
              ) : null}
            </div>
          </section>

          <div className="section-card desk-panel desk-panel--home-liste">
            <div className="desk-panel-head desk-panel-head--mvk-liste">
              <span>Kayıt listesi</span>
              <span className="desk-panel-meta">{listeMeta}</span>
            </div>
            <div className="desk-panel-body desk-panel-body--pad-0 desk-home-mvk-liste-body">
              {q.trim() ? (
                <div className="desk-home-liste-filter-bar">
                  Filtre: <strong>{q.trim()}</strong>
                </div>
              ) : null}
              <div
                className={`desk-table-wrap desk-home-muvekkil-table-wrap${ilkKullanim || aramaSonucuBos ? " desk-home-muvekkil-table-wrap--bos" : ""}`}
              >
                {sonuc.length === 0 && !listeYukleniyor ? (
                  ilkKullanim ? (
                    <div className="empty-state desk-home-mvk-empty-state">
                      <div className="desk-home-mvk-empty-icon" aria-hidden>
                        <IconUser />
                      </div>
                      <h3 className="desk-home-mvk-empty-title">Henüz müvekkil kaydı yok</h3>
                      <p className="desk-home-mvk-empty-desc">
                        İlk müvekkilinizi ekleyerek dosya, kasa ve taksit takibine başlayabilirsiniz.
                      </p>
                      <button type="button" className="btn btn-primary" onClick={() => setModal(true)}>
                        <IconPlus className="desk-home-search-btn-icon" />
                        İlk müvekkili ekle
                      </button>
                    </div>
                  ) : aramaSonucuBos ? (
                    <p className="empty-state desk-home-mvk-liste-empty">Aramanızla eşleşen kayıt bulunamadı.</p>
                  ) : (
                    <p className="empty-state desk-home-mvk-liste-empty">Kayıt bulunamadı.</p>
                  )
                ) : sonuc.length === 0 && listeYukleniyor ? (
                  <p className="empty-state desk-home-mvk-liste-empty">Yükleniyor…</p>
                ) : (
                  <table className="desk-table desk-table--striped desk-table--home data-table">
                    <thead>
                      <tr>
                        <th style={{ width: "52px" }}>#</th>
                        <th style={{ width: "100px" }}>Tür</th>
                        <th style={{ minWidth: "160px" }}>Müvekkil</th>
                        <th style={{ width: "128px" }}>Telefon</th>
                        <th style={{ minWidth: "140px" }}>E-posta</th>
                        <th style={{ width: "88px" }}>Not</th>
                        <th style={{ width: "84px" }}>İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sonuc.map((m) => (
                        <tr key={m.id}>
                          <td>{m.id}</td>
                          <td>{muvekkilTurEtiket(m.muvekkilTuru)}</td>
                          <td className="desk-home-cell-name">{muvekkilGorunenAd(m)}</td>
                          <td>{muvekkilListeTelefonu(m)}</td>
                          <td className="desk-home-cell-ellipsis">{muvekkilListeEposta(m)}</td>
                          <td className="desk-home-cell-ellipsis">{(m.not ?? "").trim() || "—"}</td>
                          <td>
                            <DeskTableIconLink to={`/muvekkil/${m.id}`} title="Aç" variant="primary">
                              <IconAc />
                            </DeskTableIconLink>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {listeTotal > 0 ? (
                <div className="desk-mvk-pagination" aria-label="Kayıt listesi sayfalama">
                  <div className="desk-mvk-pagination-top">
                    <span className="desk-mvk-pagination-summary">
                      {listeTotalPages > 0
                        ? `Sayfa ${page} / ${listeTotalPages} — Toplam ${listeTotal} kayıt`
                        : `Toplam ${listeTotal} kayıt`}
                    </span>
                    <label className="desk-mvk-pagination-pagesize">
                      <span className="desk-mvk-pagination-pagesize-lbl">Sayfa başına</span>
                      <select
                        className="desk-input desk-input--tiny form-input"
                        value={pageSize}
                        onChange={(e) => {
                          setPage(1);
                          setPageSize(Number(e.target.value));
                        }}
                        aria-label="Sayfa başına kayıt"
                      >
                        {MUVEKKIL_PAGE_SIZES.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="desk-mvk-pagination-bar">
                    <button
                      type="button"
                      className="btn btn-sm desk-mvk-page-btn"
                      disabled={page <= 1 || listeYukleniyor}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Önceki
                    </button>
                    <div className="desk-mvk-page-nums" role="group">
                      {muvekkilListeSayfaNumaralari(page, listeTotalPages).map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`btn btn-sm desk-mvk-page-num${n === page ? " desk-mvk-page-num--aktif" : ""}`}
                          disabled={listeYukleniyor}
                          onClick={() => setPage(n)}
                          aria-current={n === page ? "page" : undefined}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm desk-mvk-page-btn"
                      disabled={listeTotalPages <= 0 || page >= listeTotalPages || listeYukleniyor}
                      onClick={() => setPage((p) => Math.min(listeTotalPages, p + 1))}
                    >
                      Sonraki
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="section-card desk-panel desk-panel--home-taksit-uyari">
            <div className="desk-panel-head">
              <span>Taksit uyarıları</span>
            </div>
            <div className="desk-panel-body desk-panel-body--pad-sm">
              <div className="desk-taksit-alert-metrics desk-taksit-alert-metrics--three">
                <div className="desk-taksit-alert-metric desk-taksit-alert-metric--gecmis">
                  <span className="desk-taksit-metric-pill desk-taksit-metric-pill--danger">Vadesi geçmiş</span>
                  <span className="v">{taksitOzet.vadesiGecmis}</span>
                  <span className="desk-taksit-metric-sub">Gecikmiş taksit</span>
                </div>
                <div className="desk-taksit-alert-metric desk-taksit-alert-metric--bugun">
                  <span className="desk-taksit-metric-pill desk-taksit-metric-pill--warning">Bugün ödenecek</span>
                  <span className="v">{taksitOzet.bugunOdenecek}</span>
                  <span className="desk-taksit-metric-sub">Vadesi bugün</span>
                </div>
                <div className="desk-taksit-alert-metric desk-taksit-alert-metric--odenmemis">
                  <span className="desk-taksit-metric-pill desk-taksit-metric-pill--info">Ödenmemiş</span>
                  <span className="v">{taksitOzet.odenmemis}</span>
                  <span className="desk-taksit-metric-sub">Toplam bekleyen</span>
                </div>
              </div>
              <div className="desk-home-smm-band" aria-label="SMM bekleyen tahsilatlar">
                <span className="desk-home-smm-band-title">SMM bekleyen tahsilatlar</span>
                <span className="desk-home-smm-band-num" aria-live="polite">
                  {smmBekleyenSayisi}
                </span>
              </div>
              <p className="desk-home-taksit-list-caption">Vadesi geçmiş taksitler</p>
              <div
                className={`desk-table-wrap desk-home-taksit-table-wrap${vadesiGecmisTaksitler.length === 0 ? " desk-home-taksit-table-wrap--bos" : ""}`}
              >
                {vadesiGecmisTaksitler.length === 0 ? (
                  <p className="empty-state desk-home-taksit-empty">Henüz vadesi geçmiş taksit yok.</p>
                ) : (
                  <table className="desk-table desk-table--striped desk-table--home desk-home-taksit-gecmis-table data-table">
                    <colgroup>
                      <col className="col-muvekkil" />
                      <col className="col-dosya" />
                      <col className="col-taksit" />
                      <col className="col-vade" />
                      <col className="col-tutar" />
                      <col className="col-odenen" />
                      <col className="col-kalan" />
                      <col className="col-durum" />
                      <col className="col-islem" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="col-text">Müvekkil</th>
                        <th className="col-text">Dosya</th>
                        <th className="col-center">Taksit</th>
                        <th className="col-center">Vade</th>
                        <th className="col-num">Tutar</th>
                        <th className="col-num">Ödenen</th>
                        <th className="col-num">Kalan</th>
                        <th className="col-center col-durum">Durum</th>
                        <th className="col-center col-islem">İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vadesiGecmisTaksitler.map((t) => (
                        <tr key={t.taksitId}>
                          <td className="col-text desk-home-cell-name" title={t.muvekkilAdi}>
                            {t.muvekkilAdi}
                          </td>
                          <td className="col-text desk-home-cell-ellipsis" title={t.dosyaKonu}>
                            {t.dosyaKonu}
                          </td>
                          <td className="col-center">{t.taksitNo}</td>
                          <td className="col-center">{formatDateTr(t.vadeTarihi)}</td>
                          <td className="col-num desk-num">
                            <span className="desk-home-taksit-money">{formatTry(t.tutar)}</span>
                          </td>
                          <td className="col-num desk-num">
                            <span className="desk-home-taksit-money">{formatTry(t.odenen)}</span>
                          </td>
                          <td className="col-num desk-num">
                            <span className="desk-home-taksit-money">{formatTry(t.kalan)}</span>
                          </td>
                          <td className="col-center col-durum">
                            <span className={taksitDurumBadgeClass(t.durum)}>{taksitDurumEtiket(t.durum)}</span>
                          </td>
                          <td className="col-center col-islem">
                            <DeskTableIconLink
                              to={`/muvekkil/${t.muvekkilId}/dosya/${t.dosyaId}`}
                              title="Aç"
                              variant="primary"
                            >
                              <IconAc />
                            </DeskTableIconLink>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="desk-home-dashboard-side" aria-label="Hızlı erişim ve özet">
          <LegacyMaliKontrolCard />
          <section className="card desk-home-side-card">
            <h2 className="desk-home-side-title">Tahsilat Merkezi</h2>
            <p className="desk-home-side-text">
              Gecikmiş taksitler ve tahsilat takibi için merkezi liste.
            </p>
            <Link className="btn btn-sm btn-outline-primary" to="/tahsilat-merkezi">
              Tahsilat Merkezi’ni aç
            </Link>
          </section>
          <section className="card desk-home-side-card">
            <h2 className="desk-home-side-title">Hızlı işlemler</h2>
            <div className="desk-home-quick-actions">
              <button type="button" className="desk-home-quick-btn" onClick={() => setModal(true)}>
                <IconPlus className="desk-home-quick-icon" />
                Yeni müvekkil
              </button>
              <Link to="/ofis-kasasi" className="desk-home-quick-btn">
                <IconWallet className="desk-home-quick-icon" />
                Ofis kasasına git
              </Link>
              <div className="desk-home-quick-row desk-home-quick-row--donem" role="group" aria-label="Hesap dönemi">
                <span className="desk-home-quick-row-label">
                  <IconCalendar className="desk-home-quick-icon" />
                  Hesap dönemi
                </span>
                <div className="desk-home-donem-switch" role="radiogroup" aria-label="Dönem tipi">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={donemMode === "MONTHLY"}
                    className={`desk-home-donem-switch-btn${donemMode === "MONTHLY" ? " is-active" : ""}`}
                    disabled={donemModeBusy}
                    onClick={() => void donemModeSec("MONTHLY")}
                  >
                    Aylık
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={donemMode === "YEARLY"}
                    className={`desk-home-donem-switch-btn${donemMode === "YEARLY" ? " is-active" : ""}`}
                    disabled={donemModeBusy}
                    onClick={() => void donemModeSec("YEARLY")}
                  >
                    Yıllık
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="desk-home-quick-btn"
                onClick={() => void lisansKontrolEt()}
                disabled={lisansKontrol || licenseLoading}
              >
                <IconLicense className="desk-home-quick-icon" />
                {lisansKontrol ? "Kontrol ediliyor…" : "Lisansı kontrol et"}
              </button>
            </div>
          </section>

          <section className="card desk-home-side-card desk-home-side-card--license">
            <h2 className="desk-home-side-title">Lisans durumu</h2>
            {licenseLoading && !licenseState ? (
              <p className="desk-home-side-text">Yükleniyor…</p>
            ) : licenseState?.valid && licenseState.expiryLabel ? (
              <p className="desk-home-side-license-ok">
                <IconLicense className="desk-home-side-license-icon" />
                <span>
                  <strong>{licenseState.expiryLabel}</strong> tarihine kadar aktif
                </span>
              </p>
            ) : (
              <p className="desk-home-side-text">Lisans bilgisi alınamadı.</p>
            )}
          </section>

          <section className="card desk-home-side-card">
            <h2 className="desk-home-side-title">Randevular</h2>
            <p className="desk-home-side-text">Takvim ve planlanan görüşmeler.</p>
            <Link className="btn btn-sm btn-outline-primary" to="/randevular">
              Randevuları aç
            </Link>
          </section>
          <section className="card desk-home-side-card">
            <h2 className="desk-home-side-title">Bugünkü özet</h2>
            <ul className="desk-home-side-stats">
              <li>
                <span>Bugün ödenecek</span>
                <strong>{taksitOzet.bugunOdenecek}</strong>
              </li>
              <li>
                <span>Vadesi geçmiş</span>
                <strong className="desk-home-side-stat--danger">{taksitOzet.vadesiGecmis}</strong>
              </li>
              <li>
                <span>SMM bekleyen</span>
                <strong>{smmBekleyenSayisi}</strong>
              </li>
              <li>
                <span>Kayıt sayısı</span>
                <strong>{listeYukleniyor ? "…" : listeTotal}</strong>
              </li>
            </ul>
          </section>

          <section className="card desk-home-side-card desk-home-side-card--help">
            <h2 className="desk-home-side-title">Destek</h2>
            <p className="desk-home-side-text">
              Sorun yaşarsanız Woontegra destek ekibiyle iletişime geçin.
            </p>
            <ul className="desk-home-support-contacts">
              <li>
                <button
                  type="button"
                  className="desk-home-support-link"
                  onClick={() => void window.api.openContactLink("tel:+902526060650")}
                >
                  <IconPhone className="desk-home-support-icon" />
                  <span>0252 606 06 50</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="desk-home-support-link"
                  onClick={() => void window.api.openContactLink("mailto:info@woontegra.com")}
                >
                  <IconMail className="desk-home-support-icon" />
                  <span>info@woontegra.com</span>
                </button>
              </li>
            </ul>
          </section>
        </aside>
      </div>

      <MuvekkilFormModal
        title="Yeni müvekkil"
        open={modal}
        saving={kaydediyor}
        error={err}
        onClose={() => !kaydediyor && setModal(false)}
        onSave={yeniKaydet}
      />
    </div>
  );
}
