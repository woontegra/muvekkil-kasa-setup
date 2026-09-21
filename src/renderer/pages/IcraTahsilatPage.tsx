import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ICRA_ALACAK_DURUM_ETIKET,
  ICRA_ALACAK_DURUM_KODLARI,
  ICRA_ALACAK_TURU_ETIKET,
  ICRA_ALACAK_TURU_KODLARI,
} from "@shared/constants/icraTahsilat";
import { getActiveAccountingPeriodRange } from "@shared/lib/accountingPeriod";
import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";
import type { IcraTahsilatListeSatir, IcraTahsilatUstOzet } from "@shared/types/icraTahsilat";
import { IcraTahsilatAlacakModal } from "../components/icraTahsilat/IcraTahsilatAlacakModal";
import { IcraTahsilatDetayModal } from "../components/icraTahsilat/IcraTahsilatDetayModal";
import { DeskTableIconBtn } from "../components/DeskTableIconBtn";
import { IconAc } from "../components/DeskTableIcons";
import { formatTry } from "../lib/format";
import { ayBasiSonu } from "../lib/ofisKasa";
import {
  icraAlacakDurumBadgeClass,
  icraAlacakDurumEtiket,
  icraAlacakTuruEtiket,
  ilgiliMuvekkilDosyaMetni,
} from "../lib/icraTahsilat";

export function IcraTahsilatPage() {
  const navigate = useNavigate();
  const fallbackAy = useMemo(() => ayBasiSonu(), []);
  const [tb, setTb] = useState(fallbackAy.bas);
  const [te, setTe] = useState(fallbackAy.bit);
  const [tur, setTur] = useState("TUMU");
  const [durum, setDurum] = useState("TUMU");
  const [q, setQ] = useState("");
  const [ust, setUst] = useState<IcraTahsilatUstOzet | null>(null);
  const [liste, setListe] = useState<IcraTahsilatListeSatir[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [modalAcik, setModalAcik] = useState(false);
  const [detay, setDetay] = useState<IcraTahsilatListeSatir | null>(null);

  const filtre = useMemo(
    () => ({
      tarihBas: tb,
      tarihBit: te,
      alacakTuru: tur,
      durum,
      q: q.trim(),
    }),
    [tb, te, tur, durum, q],
  );

  const yukleUst = useCallback(async () => {
    try {
      const r = await window.api?.icraTahsilatUstOzet?.();
      setUst(r ?? null);
    } catch {
      setUst(null);
    }
  }, []);

  const yukleListe = useCallback(async () => {
    setYukleniyor(true);
    try {
      const rows = await window.api?.icraTahsilatList?.(filtre);
      setListe(Array.isArray(rows) ? rows : []);
    } catch {
      setListe([]);
    } finally {
      setYukleniyor(false);
    }
  }, [filtre]);

  useEffect(() => {
    const applyPeriod = async () => {
      try {
        const mode = (await window.api.getAccountingPeriodMode?.()) as AccountingPeriodMode | undefined;
        const range = getActiveAccountingPeriodRange(mode === "MONTHLY" ? "MONTHLY" : "YEARLY");
        setTb(range.bas);
        setTe(range.bit);
      } catch {
        /* fallback already set */
      }
    };
    void applyPeriod();
    const onPeriodChanged = () => {
      void applyPeriod();
      void yukleUst();
    };
    window.addEventListener("mkd:accounting-period-changed", onPeriodChanged);
    return () => window.removeEventListener("mkd:accounting-period-changed", onPeriodChanged);
  }, [yukleUst]);
  useEffect(() => {
    void yukleUst();
    void yukleListe();
  }, [yukleUst, yukleListe]);

  function yenile() {
    void yukleUst();
    void yukleListe();
  }

  function raporYazdir() {
    const qs = new URLSearchParams({
      bas: tb,
      bit: te,
      tur,
      durum,
      q: q.trim(),
    });
    navigate(`/print/icra-tahsilat-raporu?${qs.toString()}`);
  }

  return (
    <div className="desk-page desk-page-shell desk-app-page desk-page--icra-tahsilat">
      <header className="desk-app-page-header">
        <div className="desk-app-page-header-main">
          <Link className="desk-app-page-back" to="/">
            ← Müvekkil Kasa
          </Link>
          <h1 className="desk-app-page-title">İcra tahsilat</h1>
        </div>
        <div className="desk-app-page-header-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setModalAcik(true)}>
            Yeni icra tahsilat alacağı
          </button>
          <button type="button" className="btn btn-outline-primary btn-sm no-print" onClick={raporYazdir}>
            İcra tahsilat raporu yazdır
          </button>
        </div>
      </header>

      {ust ? (
        <section className="desk-ofis-kpi-section desk-icra-kpi-section" aria-label="İcra tahsilat özeti">
          <h2 className="desk-ofis-kpi-section-title">Alacak özeti</h2>
          <div className="desk-ofis-kpi-grid desk-icra-kpi-grid">
            <article className="desk-ofis-kpi-card">
              <span className="desk-ofis-kpi-label">Toplam alacak</span>
              <span className="desk-ofis-kpi-value desk-num">{formatTry(ust.toplamAlacak)}</span>
            </article>
            <article className="desk-ofis-kpi-card desk-ofis-kpi-card--gelir">
              <span className="desk-ofis-kpi-label">Tahsil edilen</span>
              <span className="desk-ofis-kpi-value desk-num">{formatTry(ust.tahsilEdilen)}</span>
            </article>
            <article className="desk-ofis-kpi-card">
              <span className="desk-ofis-kpi-label">Kalan alacak</span>
              <span className="desk-ofis-kpi-value desk-num">{formatTry(ust.kalanAlacak)}</span>
            </article>
            <article className="desk-ofis-kpi-card desk-ofis-kpi-card--gider">
              <span className="desk-ofis-kpi-label">Vadesi geçmiş taksit</span>
              <span className="desk-ofis-kpi-value">{ust.vadesiGecmisTaksit}</span>
            </article>
            <article className="desk-ofis-kpi-card desk-ofis-kpi-card--gelir">
              <span className="desk-ofis-kpi-label">Dönem tahsilatı</span>
              <span className="desk-ofis-kpi-value desk-num">{formatTry(ust.buAyTahsilat)}</span>
            </article>
          </div>
        </section>
      ) : null}

      <section className="section-card desk-panel desk-icra-filtre-panel no-print">
        <div className="desk-panel-body desk-panel-body--pad-sm">
          <div className="desk-kasa-toolbar desk-icra-filtre-bar">
            <label>
              Başlangıç
              <input className="desk-input form-input" type="date" value={tb} onChange={(e) => setTb(e.target.value)} />
            </label>
            <label>
              Bitiş
              <input className="desk-input form-input" type="date" value={te} onChange={(e) => setTe(e.target.value)} />
            </label>
            <label>
              Alacak türü
              <select className="desk-input form-input" value={tur} onChange={(e) => setTur(e.target.value)}>
                <option value="TUMU">Tümü</option>
                {ICRA_ALACAK_TURU_KODLARI.map((k) => (
                  <option key={k} value={k}>
                    {ICRA_ALACAK_TURU_ETIKET[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Durum
              <select className="desk-input form-input" value={durum} onChange={(e) => setDurum(e.target.value)}>
                <option value="TUMU">Tümü</option>
                {ICRA_ALACAK_DURUM_KODLARI.map((k) => (
                  <option key={k} value={k}>
                    {ICRA_ALACAK_DURUM_ETIKET[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="desk-icra-arama-field">
              Arama
              <input
                className="desk-input form-input"
                placeholder="Borçlu, müvekkil, dosya…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="section-card desk-panel desk-icra-liste-panel" id="icra-tahsilat-rapor">
        <div className="desk-panel-head">
          <span>İcra tahsilat alacakları</span>
          <span className="desk-panel-meta">{liste.length} kayıt</span>
        </div>
        <div className="desk-panel-body desk-panel-body--pad-0">
          <div className="desk-table-wrap desk-icra-liste-table-wrap">
            {yukleniyor ? (
              <p className="empty-state">Yükleniyor…</p>
            ) : liste.length === 0 ? (
              <p className="empty-state">Kayıt bulunamadı.</p>
            ) : (
              <table className="desk-table desk-table--striped desk-icra-liste-table data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Borçlu / karşı taraf</th>
                    <th>İlgili müvekkil / dosya</th>
                    <th>Alacak türü</th>
                    <th className="num">Toplam</th>
                    <th className="num">Ödenen</th>
                    <th className="num">Kalan</th>
                    <th>Taksit</th>
                    <th>Durum</th>
                    <th className="no-print">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {liste.map((a) => (
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td className="desk-home-cell-name">{a.borcluAdi}</td>
                      <td className="desk-home-cell-ellipsis" title={ilgiliMuvekkilDosyaMetni(a.muvekkilAdi, a.dosyaKonu)}>
                        {ilgiliMuvekkilDosyaMetni(a.muvekkilAdi, a.dosyaKonu)}
                      </td>
                      <td>{icraAlacakTuruEtiket(a.alacakTuru)}</td>
                      <td className="num desk-num">
                        <span className="desk-icra-money">{formatTry(a.toplamTutar)}</span>
                      </td>
                      <td className="num desk-num">
                        <span className="desk-icra-money">{formatTry(a.odenenToplam)}</span>
                      </td>
                      <td className="num desk-num">
                        <span className="desk-icra-money">{formatTry(a.kalanTutar)}</span>
                      </td>
                      <td className="col-center">{a.taksitSayisi}</td>
                      <td>
                        <span className={icraAlacakDurumBadgeClass(a.durum)}>{icraAlacakDurumEtiket(a.durum)}</span>
                      </td>
                      <td className="no-print">
                        <DeskTableIconBtn title="Detay" variant="primary" onClick={() => setDetay(a)}>
                          <IconAc />
                        </DeskTableIconBtn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      <IcraTahsilatAlacakModal open={modalAcik} onClose={() => setModalAcik(false)} onSaved={yenile} />
      <IcraTahsilatDetayModal
        open={detay != null}
        alacak={detay}
        onClose={() => setDetay(null)}
        onChanged={yenile}
      />
    </div>
  );
}
