import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  DIGER_GELIR_KOD,
  DIGER_GIDER_KOD,
  PERSONEL_MAAS_KOD,
  OFIS_GELIR_KATEGORI_KODLARI,
  OFIS_GIDER_KATEGORI_KODLARI,
  OFIS_ODEME_YONTEMI_KODLARI,
  OFIS_ODEME_YONTEMI_ETIKET,
  ofisKategoriOzelAdGerekli,
} from "@shared/constants/ofisKasa";
import { getActiveAccountingPeriodRange } from "@shared/lib/accountingPeriod";
import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";
import type { OfisKasaHareketListeSatir, OfisKasaUstOzet } from "@shared/types/ofisKasa";
import { bugunYmd, formatDateTr, formatTry, formatCurrencyInputTR } from "../lib/format";
import {
  ayBasiSonu,
  duzeltmeListeTutar,
  formatSignedTry,
  hesaplaOfisKasaDuzeltme,
  islemTipiEtiket,
  ofisKasaAciklamaMetni,
  ofisKasaKategoriListeEtiketi,
  ofisKasaSatirSinifi,
  ofisKasaTurEkMetni,
  onayBadgeClass,
  onayBadgeMetni,
  parseTutar,
  satirAuditTitle,
  tumKategoriSecenekleri,
} from "../lib/ofisKasa";
import { DeskTableIconBtn } from "../components/DeskTableIconBtn";
import { IconDuzenle, IconDuzeltme, IconOnayla, IconSil } from "../components/DeskTableIcons";
import { DeskModalPortal } from "../components/DeskModalPortal";
import { DeskModalBackdrop } from "../components/DeskModalBackdrop";
import { DeskConfirmDialog } from "../components/DeskConfirmDialog";
import { DeskGuvenliSilModal, type DeskGuvenliSilOzet } from "../components/DeskGuvenliSilModal";
import { canShowOfisGuvenliSil, type OfisGuvenliSilMode } from "@shared/lib/guvenliSil";
import type { GuvenliSilInput } from "@shared/types/guvenliSil";
import { MoneyInput } from "../components/MoneyInput";
import { ParaBirimiSelect } from "../components/currency/CurrencyFields";
import { PARA_BIRIMLERI, formatMoney, type ParaBirimi } from "@shared/lib/paraBirimi";
import { DovizDonusumModal } from "../components/currency/DovizDonusumModal";

type ConfirmState = {
  title: string;
  message: string;
  variant?: "danger" | "primary";
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
};

export function OfisKasaPage() {
  const navigate = useNavigate();
  const fallbackAy = useMemo(() => ayBasiSonu(), []);
  const [tb, setTb] = useState(fallbackAy.bas);
  const [te, setTe] = useState(fallbackAy.bit);
  const [periodEtiket, setPeriodEtiket] = useState("");
  const [tip, setTip] = useState("TUMU");
  const [katSel, setKatSel] = useState("");
  const [q, setQ] = useState("");
  const [hareketler, setHareketler] = useState<OfisKasaHareketListeSatir[]>([]);
  const [ust, setUst] = useState<OfisKasaUstOzet | null>(null);
  const [listeYukleniyor, setListeYukleniyor] = useState(false);

  const filtre = useMemo(
    () => ({
      tarihBas: tb,
      tarihBit: te,
      islemTipi: tip,
      kategori: katSel,
      q: q.trim(),
    }),
    [tb, te, tip, katSel, q]
  );

  const kategoriSecenekleri = useMemo(() => tumKategoriSecenekleri(), []);

  const yukleUst = useCallback(async () => {
    try {
      const r = await window.api.ofisKasaUstOzet();
      setUst(r);
    } catch (e) {
      console.error("[ofisKasaUstOzet]", e);
      setUst(null);
    }
  }, []);

  const yukleListe = useCallback(async () => {
    setListeYukleniyor(true);
    try {
      const rows = await window.api.ofisKasaList(filtre);
      setHareketler(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error("[ofisKasaList]", e);
      setHareketler([]);
    } finally {
      setListeYukleniyor(false);
    }
  }, [filtre]);

  useEffect(() => {
    const applyPeriod = async () => {
      try {
        const mode = (await window.api.getAccountingPeriodMode?.()) as AccountingPeriodMode | undefined;
        const range = getActiveAccountingPeriodRange(mode === "MONTHLY" ? "MONTHLY" : "YEARLY");
        setTb(range.bas);
        setTe(range.bit);
        setPeriodEtiket(range.etiket);
      } catch {
        /* ayBasiSonu fallback already set */
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
  }, [yukleUst]);

  useEffect(() => {
    void yukleListe();
  }, [yukleListe]);

  async function tumunuYenile() {
    await Promise.all([yukleUst(), yukleListe()]);
  }

  const [modalAcik, setModalAcik] = useState(false);
  const [duzenleId, setDuzenleId] = useState<number | null>(null);
  const [fTip, setFTip] = useState<"GELIR" | "GIDER">("GIDER");
  const [fTarih, setFTarih] = useState(bugunYmd());
  const [fKat, setFKat] = useState<string>(OFIS_GIDER_KATEGORI_KODLARI[0]);
  const [fKalemId, setFKalemId] = useState<number | null>(null);
  const [fKalemler, setFKalemler] = useState<
    { id: number; kod: string | null; ad: string; tur: "GELIR" | "GIDER" }[]
  >([]);
  const [fMuvekkilId, setFMuvekkilId] = useState<number | null>(null);
  const [fMuvekkilQ, setFMuvekkilQ] = useState("");
  const [fMuvekkilOpts, setFMuvekkilOpts] = useState<{ id: number; label: string }[]>([]);
  const [fTahsilUserId, setFTahsilUserId] = useState<number | null>(null);
  const [fKullanicilar, setFKullanicilar] = useState<{ id: number; adSoyad: string }[]>([]);
  const [fOzelKat, setFOzelKat] = useState("");
  const [fAciklama, setFAciklama] = useState("");
  const [fTutar, setFTutar] = useState("");
  const [fParaBirimi, setFParaBirimi] = useState<ParaBirimi>("TRY");
  const [fOdeme, setFOdeme] = useState<string>(OFIS_ODEME_YONTEMI_KODLARI[0]);
  const [fBelge, setFBelge] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formKaydediyor, setFormKaydediyor] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [guvenliSilOzet, setGuvenliSilOzet] = useState<DeskGuvenliSilOzet | null>(null);
  const [guvenliSilErr, setGuvenliSilErr] = useState<string | null>(null);
  const [guvenliSilBusy, setGuvenliSilBusy] = useState(false);
  const [sayfaUyari, setSayfaUyari] = useState<string | null>(null);
  const [dovizOpen, setDovizOpen] = useState(false);
  const selectedKalemKod = fKalemler.find((k) => k.id === fKalemId)?.kod ?? fKat;
  const digerSecili = selectedKalemKod === DIGER_GELIR_KOD || selectedKalemKod === DIGER_GIDER_KOD;
  const personelMaasSecili = selectedKalemKod === PERSONEL_MAAS_KOD;
  const ozelAlanGerekli = digerSecili || personelMaasSecili || ofisKategoriOzelAdGerekli(selectedKalemKod);

  async function loadFormLookups(tip: "GELIR" | "GIDER") {
    try {
      const kalems = await window.api.finansKalemiList({ tur: tip, forForm: true });
      setFKalemler(kalems.map((k) => ({ id: k.id, kod: k.kod, ad: k.ad, tur: k.tur })));
      if (kalems.length > 0) {
        setFKalemId(kalems[0].id);
        setFKat(kalems[0].kod ?? kalems[0].ad);
      }
    } catch {
      setFKalemler([]);
      setFKalemId(null);
    }
    try {
      const users = await window.api.kullaniciYonetimList();
      setFKullanicilar(users.filter((u) => u.aktifMi).map((u) => ({ id: u.id, adSoyad: u.adSoyad })));
    } catch {
      setFKullanicilar([]);
    }
  }

  function modalSifirlaYeni(tip: "GELIR" | "GIDER" = "GIDER") {
    setDuzenleId(null);
    setFormErr(null);
    setFTip(tip);
    setFTarih(bugunYmd());
    setFKat(tip === "GELIR" ? OFIS_GELIR_KATEGORI_KODLARI[0] : OFIS_GIDER_KATEGORI_KODLARI[0]);
    setFKalemId(null);
    setFOzelKat("");
    setFAciklama("");
    setFTutar("");
    setFParaBirimi("TRY");
    setFOdeme(OFIS_ODEME_YONTEMI_KODLARI[0]);
    setFBelge("");
    setFMuvekkilId(null);
    setFMuvekkilQ("");
    setFMuvekkilOpts([]);
    setFTahsilUserId(null);
    void loadFormLookups(tip);
  }

  function modalAcYeni() {
    modalSifirlaYeni("GIDER");
    setModalAcik(true);
  }

  function modalKapat() {
    if (formKaydediyor) return;
    setModalAcik(false);
    setFormErr(null);
  }

  function modalAcDuzenle(h: OfisKasaHareketListeSatir) {
    if (h.islemTipi === "DUZELTME") return;
    setFormErr(null);
    setDuzenleId(h.id);
    const tip = h.islemTipi === "GELIR" ? "GELIR" : "GIDER";
    setFTip(tip);
    setFTarih(h.tarih.slice(0, 10));
    setFKat(h.kategori);
    setFKalemId(h.kalemId);
    setFOzelKat(h.ozelKategoriAdi?.trim() ?? "");
    setFAciklama((h.aciklama ?? "").trim() || (h.not ?? "").trim() || "");
    setFTutar(formatCurrencyInputTR(h.tutar));
    setFParaBirimi(h.paraBirimi);
    setFOdeme(h.odemeYontemi);
    setFBelge(h.belgeNo ?? "");
    setFMuvekkilId(h.muvekkilId);
    setFMuvekkilQ(h.muvekkilAdiSnapshot ?? "");
    setFTahsilUserId(h.tahsilatiYapanKullaniciId);
    setModalAcik(true);
    void loadFormLookups(tip);
  }

  async function araMuvekkilForForm(q: string) {
    setFMuvekkilQ(q);
    if (!window.api?.muvekkilAra || q.trim().length < 1) {
      setFMuvekkilOpts([]);
      return;
    }
    try {
      const rows = await window.api.muvekkilAra(q.trim());
      setFMuvekkilOpts(
        rows.slice(0, 20).map((m) => ({
          id: m.id,
          label:
            m.muvekkilTuru === "TUZEL_KISI" && m.sirketUnvani?.trim()
              ? m.sirketUnvani.trim()
              : m.adSoyad.trim() || `Müvekkil #${m.id}`,
        })),
      );
    } catch {
      setFMuvekkilOpts([]);
    }
  }

  async function formKaydet() {
    if (formKaydediyor) return;
    setFormErr(null);
    const tutar = parseTutar(fTutar);
    const selectedKalem = fKalemler.find((k) => k.id === fKalemId);
    const katKod = selectedKalem?.kod ?? fKat;
    const diger = katKod === DIGER_GELIR_KOD || katKod === DIGER_GIDER_KOD;
    const personel = katKod === PERSONEL_MAAS_KOD;
    const ozelGerekli = diger || personel || ofisKategoriOzelAdGerekli(katKod);
    if (!Number.isFinite(tutar) || tutar <= 0) {
      setFormErr("Tutar sıfırdan büyük ve geçerli olmalıdır.");
      return;
    }
    if (personel && !fOzelKat.trim()) {
      setFormErr("Personel ismi zorunludur.");
      return;
    }
    if (diger && !fOzelKat.trim()) {
      setFormErr("Özel kategori adı zorunludur.");
      return;
    }
    setFormKaydediyor(true);
    try {
      if (duzenleId != null) {
        const res = await window.api.ofisKasaGuncelle(duzenleId, {
          tarih: fTarih,
          kategori: katKod,
          kalemId: fKalemId,
          ozelKategoriAdi: ozelGerekli ? fOzelKat.trim() : null,
          aciklama: fAciklama.trim() || null,
          tutar,
          odemeYontemi: fOdeme,
          belgeNo: fBelge.trim() || null,
          not: null,
          muvekkilId: fMuvekkilId,
          tahsilatiYapanKullaniciId: fTip === "GELIR" ? fTahsilUserId : null,
        });
        if (!res.ok) {
          setFormErr(res.error);
          return;
        }
      } else {
        const res = await window.api.ofisKasaEkle({
          islemTipi: fTip,
          tarih: fTarih,
          kategori: katKod,
          kalemId: fKalemId,
          ozelKategoriAdi: ozelGerekli ? fOzelKat.trim() : null,
          aciklama: fAciklama.trim() || null,
          tutar,
          paraBirimi: fParaBirimi,
          odemeYontemi: fOdeme,
          belgeNo: fBelge.trim() || null,
          not: null,
          muvekkilId: fMuvekkilId,
          tahsilatiYapanKullaniciId: fTip === "GELIR" ? fTahsilUserId : null,
        });
        if (!res.ok) {
          setFormErr(res.error);
          return;
        }
      }
      setModalAcik(false);
      await tumunuYenile();
    } catch (e) {
      console.error("[ofisKasa formKaydet]", e);
      setFormErr("Kayıt sırasında hata oluştu.");
    } finally {
      setFormKaydediyor(false);
    }
  }

  async function onaylaHareket(id: number) {
    setConfirm({
      title: "İşlemi onayla",
      message: "Bu işlemi onaylamak istediğinize emin misiniz? Onaylanan işlem silinemez.",
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          const r = await window.api.ofisKasaOnayla(id);
          if (!r.ok) {
            setSayfaUyari(r.error ?? "Onaylanamadı");
            return;
          }
          setConfirm(null);
          await tumunuYenile();
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  }

  async function silHareket(id: number) {
    setConfirm({
      title: "İşlemi sil",
      message: "Bu işlemi silmek istediğinize emin misiniz?",
      variant: "danger",
      confirmLabel: "Sil",
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          const r = await window.api.ofisKasaSil(id);
          if (!r.ok) {
            setSayfaUyari(r.error ?? "Silinemedi");
            return;
          }
          setConfirm(null);
          await tumunuYenile();
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  }

  function acGuvenliSil(h: OfisKasaHareketListeSatir, mode: OfisGuvenliSilMode) {
    setGuvenliSilErr(null);
    setGuvenliSilOzet({
      id: h.id,
      tarih: h.tarih,
      aciklama: h.aciklama?.trim() || ofisKasaKategoriListeEtiketi(h),
      tutar: h.tutar,
      odemeYontemi: h.odemeYontemi,
      mode,
    });
  }

  async function guvenliSilGonder(payload: GuvenliSilInput) {
    if (!guvenliSilOzet || guvenliSilBusy) return;
    setGuvenliSilErr(null);
    setGuvenliSilBusy(true);
    try {
      const r = await window.api.ofisKasaGuvenliSil(guvenliSilOzet.id, payload);
      if (!r.ok) {
        setGuvenliSilErr(r.error ?? "Silinemedi");
        return;
      }
      setGuvenliSilOzet(null);
      await tumunuYenile();
    } finally {
      setGuvenliSilBusy(false);
    }
  }

  const [duzeltmeHedef, setDuzeltmeHedef] = useState<OfisKasaHareketListeSatir | null>(null);
  const [dDogruTutar, setDDogruTutar] = useState("");
  const [dTarih, setDTarih] = useState(bugunYmd());
  const [dNot, setDNot] = useState("");
  const [dErr, setDErr] = useState<string | null>(null);
  const [dKaydediyor, setDKaydediyor] = useState(false);

  const duzeltmeOnizleme = useMemo(() => {
    if (!duzeltmeHedef) return null;
    const dogru = parseTutar(dDogruTutar);
    if (!Number.isFinite(dogru) || dDogruTutar.trim() === "") return null;
    const refTip = duzeltmeHedef.islemTipi === "GELIR" ? "GELIR" : "GIDER";
    return hesaplaOfisKasaDuzeltme(refTip, duzeltmeHedef.tutar, dogru);
  }, [duzeltmeHedef, dDogruTutar]);

  function acDuzeltme(h: OfisKasaHareketListeSatir) {
    if (h.hasCorrection) {
      setSayfaUyari("Bu kayıt için zaten düzeltme yapılmış.");
      return;
    }
    setDErr(null);
    setDuzeltmeHedef(h);
    setDDogruTutar("");
    setDTarih(bugunYmd());
    setDNot("");
  }

  function kapatDuzeltme() {
    if (dKaydediyor) return;
    setDuzeltmeHedef(null);
    setDErr(null);
  }

  async function duzeltmeKaydet() {
    if (!duzeltmeHedef || dKaydediyor) return;
    setDErr(null);
    const dogruTutar = parseTutar(dDogruTutar);
    if (!Number.isFinite(dogruTutar) || dDogruTutar.trim() === "") {
      setDErr("Doğru tutar girin.");
      return;
    }
    const refTip = duzeltmeHedef.islemTipi === "GELIR" ? "GELIR" : "GIDER";
    const oniz = hesaplaOfisKasaDuzeltme(refTip, duzeltmeHedef.tutar, dogruTutar);
    if (!oniz.ok) {
      setDErr(oniz.error);
      return;
    }
    setDKaydediyor(true);
    try {
      const res = await window.api.ofisKasaDuzeltmeEkle({
        orijinalHareketId: duzeltmeHedef.id,
        dogruTutar,
        tarih: dTarih,
        not: dNot.trim() || null,
      });
      if (!res.ok) {
        setDErr(res.error);
        return;
      }
      setDuzeltmeHedef(null);
      await tumunuYenile();
    } catch (e) {
      console.error("[ofisKasa duzeltmeKaydet]", e);
      setDErr("Düzeltme kaydedilemedi.");
    } finally {
      setDKaydediyor(false);
    }
  }

  function islemRowActions(h: OfisKasaHareketListeSatir) {
    if (h.onayDurumu === "ONAYSIZ") {
      return (
        <>
          {h.islemTipi !== "DUZELTME" ? (
            <DeskTableIconBtn title="Düzenle" onClick={() => modalAcDuzenle(h)}>
              <IconDuzenle />
            </DeskTableIconBtn>
          ) : null}
          <DeskTableIconBtn title="Onayla" variant="primary" onClick={() => void onaylaHareket(h.id)}>
            <IconOnayla />
          </DeskTableIconBtn>
          <DeskTableIconBtn title="Sil" variant="danger" onClick={() => void silHareket(h.id)}>
            <IconSil />
          </DeskTableIconBtn>
        </>
      );
    }
    if (h.onayDurumu === "ONAYLI") {
      if (h.islemTipi === "DUZELTME") {
        return <span className="muted">—</span>;
      }
      if (h.hasCorrection) {
        return (
          <span className="muted" title="Bu kayıt için zaten düzeltme yapılmış">
            Düzeltildi
          </span>
        );
      }
      const guvenliMode = canShowOfisGuvenliSil(h);
      return (
        <>
          <DeskTableIconBtn title="Düzeltme ekle" onClick={() => acDuzeltme(h)}>
            <IconDuzeltme />
          </DeskTableIconBtn>
          {guvenliMode ? (
            <DeskTableIconBtn title="Güvenli sil" variant="danger" onClick={() => acGuvenliSil(h, guvenliMode)}>
              <IconSil />
            </DeskTableIconBtn>
          ) : null}
        </>
      );
    }
    return null;
  }

  function islemTipiHucre(h: OfisKasaHareketListeSatir) {
    const ana = h.islemTipi === "DUZELTME" ? "Düzeltme" : islemTipiEtiket(h.islemTipi);
    return (
      <div className="desk-kasa-tip-cell">
        <span>{ana}</span>
        {h.islemTipi !== "DUZELTME" && h.hasCorrection ? (
          <span className="desk-badge-duzeltildi" title="Bu işlem için düzeltme kaydı var">
            Düzeltildi
          </span>
        ) : null}
      </div>
    );
  }

  function raporYazdir() {
    const { bas: ayBas, bit: ayBit } = ayBasiSonu();
    const bas = (tb || ayBas).trim().slice(0, 10);
    const bit = (te || ayBit).trim().slice(0, 10);
    navigate(`/print/ofis-kasa-raporu?bas=${encodeURIComponent(bas)}&bit=${encodeURIComponent(bit)}`);
  }

  return (
    <div className="desk-page desk-page-shell desk-app-page desk-page--ofis-kasa">
      <header className="desk-app-page-header">
        <div className="desk-app-page-header-main">
          <Link className="desk-app-page-back" to="/">
            ← Müvekkil Kasa
          </Link>
          <h1 className="desk-app-page-title">Ofis kasası</h1>
        </div>
        <div className="desk-app-page-header-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => modalAcYeni()}>
            Yeni hareket
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setDovizOpen(true)}>
            Döviz dönüşümü
          </button>
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => raporYazdir()}>
            Rapor yazdır
          </button>
        </div>
      </header>

      {sayfaUyari ? (
        <p className="form-error desk-page-banner-error" role="alert">
          {sayfaUyari}
          <button type="button" className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => setSayfaUyari(null)}>
            Kapat
          </button>
        </p>
      ) : null}

      {ust ? (
        <section className="desk-ofis-kpi-section" aria-label="Ofis kasası özeti">
          <h2 className="desk-ofis-kpi-section-title">
            Kasa özeti{ust.period?.etiket || periodEtiket ? ` — ${ust.period?.etiket || periodEtiket}` : ""}
          </h2>
          <div className="desk-ofis-kpi-grid">
            {PARA_BIRIMLERI.map((pb) => (
              <article key={pb} className="desk-ofis-kpi-card desk-ofis-kpi-card--balance">
                <span className="desk-ofis-kpi-label">Güncel bakiye · {pb}</span>
                <span className="desk-ofis-kpi-value desk-num">{formatMoney(ust.bakiyeler[pb], pb)}</span>
              </article>
            ))}
            <article className="desk-ofis-kpi-card">
              <span className="desk-ofis-kpi-label">Devreden bakiye</span>
              <span className="desk-ofis-kpi-value desk-num">{formatTry(ust.devredenBakiye)}</span>
            </article>
            <article className="desk-ofis-kpi-card desk-ofis-kpi-card--gelir">
              <span className="desk-ofis-kpi-label">Dönem geliri</span>
              <span className="desk-ofis-kpi-value desk-num">{formatTry(ust.donemGelir ?? ust.buAyGelir)}</span>
            </article>
            <article className="desk-ofis-kpi-card desk-ofis-kpi-card--gider">
              <span className="desk-ofis-kpi-label">Dönem gideri</span>
              <span className="desk-ofis-kpi-value desk-num">{formatTry(ust.donemGider ?? ust.buAyGider)}</span>
            </article>
            <article className="desk-ofis-kpi-card desk-ofis-kpi-card--duzeltme">
              <span className="desk-ofis-kpi-label">Dönem düzeltme etkisi</span>
              <span className="desk-ofis-kpi-value desk-num">
                {formatSignedTry(ust.donemDuzeltmeEtkisi ?? ust.buAyDuzeltmeEtkisi)}
              </span>
            </article>
            <article className="desk-ofis-kpi-card desk-ofis-kpi-card--balance">
              <span className="desk-ofis-kpi-label">Güncel kasa bakiyesi</span>
              <span className="desk-ofis-kpi-value desk-num">{formatTry(ust.kasaBakiyesi)}</span>
            </article>
          </div>
        </section>
      ) : null}

      <section className="section-card desk-panel">
        <div className="desk-panel-head">
          <span>Filtreler</span>
          <span className="desk-panel-meta">
            {listeYukleniyor ? "Yükleniyor…" : `${hareketler.length} kayıt`}
          </span>
        </div>
        <div className="desk-panel-body desk-panel-body--pad-sm">
          <div className="desk-form-grid desk-ofis-filtre-grid">
            <div className="field">
              <label htmlFor="ofk-tb">Tarih başı</label>
              <input id="ofk-tb" className="desk-input" type="date" value={tb} onChange={(e) => setTb(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ofk-te">Tarih sonu</label>
              <input id="ofk-te" className="desk-input" type="date" value={te} onChange={(e) => setTe(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ofk-tip">İşlem tipi</label>
              <select id="ofk-tip" value={tip} onChange={(e) => setTip(e.target.value)}>
                <option value="TUMU">Tümü</option>
                <option value="GELIR">Gelir</option>
                <option value="GIDER">Gider</option>
                <option value="DUZELTME">Düzeltme</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="ofk-kat">Kategori</label>
              <select id="ofk-kat" value={katSel} onChange={(e) => setKatSel(e.target.value)}>
                <option value="">Tümü</option>
                {kategoriSecenekleri.map((x) => (
                  <option key={x.kod} value={x.kod}>
                    {x.etiket}
                  </option>
                ))}
              </select>
            </div>
            <div className="field desk-form-span2">
              <label htmlFor="ofk-q">Arama</label>
              <input
                id="ofk-q"
                className="desk-input"
                placeholder="Açıklama, belge, not veya özel kategori…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section-card desk-panel desk-panel--grow desk-panel--ofis-liste">
        <div className="desk-panel-head">
          <span>İşlem listesi</span>
          <span className="desk-panel-meta">
            {listeYukleniyor
              ? "Yükleniyor…"
              : hareketler.length === 1
                ? "1 kayıt"
                : `${hareketler.length} kayıt`}
          </span>
        </div>
        <div className="desk-panel-body desk-table-wrap desk-ofis-kasa-table-wrap">
          {hareketler.length === 0 ? (
            <p className="desk-muted-compact">Bu filtrelere uygun kayıt yok.</p>
          ) : (
            <table className="desk-table desk-table--striped desk-table--page desk-table--ofis-kasa data-table">
              <thead>
                <tr>
                  <th className="desk-col-id">#</th>
                  <th>Tarih</th>
                  <th>Tip</th>
                  <th className="desk-num">Tutar</th>
                  <th>Tür / Ek</th>
                  <th>Müvekkil</th>
                  <th>Personel</th>
                  <th>Açıklama</th>
                  <th>Belge</th>
                  <th>Onay</th>
                  <th style={{ minWidth: "120px" }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {hareketler.map((h) => (
                  <tr key={h.id} className={ofisKasaSatirSinifi(h)} title={satirAuditTitle(h)}>
                    <td className="desk-col-id">{h.id}</td>
                    <td>{formatDateTr(h.tarih)}</td>
                    <td>{islemTipiHucre(h)}</td>
                    <td className="desk-num">{formatMoney(duzeltmeListeTutar(h), h.paraBirimi)}</td>
                    <td className="desk-ofis-tur-ek-cell">{ofisKasaTurEkMetni(h)}</td>
                    <td>{h.muvekkilAdiSnapshot?.trim() || "—"}</td>
                    <td>{h.tahsilatiYapanKullaniciAdi?.trim() || "—"}</td>
                    <td className={h.islemTipi === "DUZELTME" ? "desk-kasa-aciklama-correction" : undefined}>
                      {ofisKasaAciklamaMetni(h)}
                    </td>
                    <td>{h.belgeNo?.trim() ? h.belgeNo : "—"}</td>
                    <td>
                      <span className={`badge ${onayBadgeClass(h)}`}>{onayBadgeMetni(h)}</span>
                    </td>
                    <td>
                      <div className="row-actions">{islemRowActions(h)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {modalAcik ? (
        <DeskModalPortal>
          <DeskModalBackdrop onClose={() => modalKapat()}>
            <div className="modal modal-desk modal-desk--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="modal-head">
                <h2>{duzenleId != null ? "Ofis kasa hareketini düzenle" : "Yeni Ofis Kasa Hareketi"}</h2>
              </div>
              <div className="modal-body">
                {formErr ? <p className="form-error modal-form-error">{formErr}</p> : null}
                <div className="desk-form-grid">
                  <div className="field">
                    <label htmlFor="ofk-ftip">İşlem tipi</label>
                    <select
                      id="ofk-ftip"
                      className="desk-input"
                      value={fTip}
                      disabled={duzenleId != null}
                      onChange={(e) => {
                        const t = e.target.value as "GELIR" | "GIDER";
                        setFTip(t);
                        setFOzelKat("");
                        setFTahsilUserId(null);
                        void loadFormLookups(t);
                      }}
                    >
                      <option value="GELIR">Gelir</option>
                      <option value="GIDER">Gider</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="ofk-fpb">Para birimi</label>
                    <ParaBirimiSelect id="ofk-fpb" value={fParaBirimi} onChange={setFParaBirimi} disabled={duzenleId != null} />
                  </div>
                  <div className="field">
                    <label htmlFor="ofk-ftar">Tarih</label>
                    <input
                      id="ofk-ftar"
                      className="desk-input"
                      type="date"
                      value={fTarih}
                      onChange={(e) => setFTarih(e.target.value)}
                    />
                  </div>
                  <div className="field desk-form-span2">
                    <label htmlFor="ofk-fkat">Kalem</label>
                    <select
                      id="ofk-fkat"
                      className="desk-input"
                      value={fKalemId ?? ""}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setFKalemId(Number.isFinite(id) ? id : null);
                        const k = fKalemler.find((x) => x.id === id);
                        if (k) setFKat(k.kod ?? k.ad);
                        setFOzelKat("");
                      }}
                    >
                      {fKalemler.length === 0 ? <option value="">Kalem yükleniyor…</option> : null}
                      {fKalemler.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.ad}
                        </option>
                      ))}
                    </select>
                  </div>
                  {ozelAlanGerekli ? (
                    <div className="field desk-form-span2">
                      <label htmlFor="ofk-fozel">{personelMaasSecili ? "Personel ismi" : "Özel kategori adı"}</label>
                      <input
                        id="ofk-fozel"
                        className="desk-input"
                        value={fOzelKat}
                        onChange={(e) => setFOzelKat(e.target.value)}
                        placeholder={personelMaasSecili ? "Örn. Ayşe Demir" : "Listede görünecek ad"}
                        maxLength={200}
                      />
                    </div>
                  ) : null}
                  <div className="field desk-form-span2">
                    <label htmlFor="ofk-fac">Açıklama</label>
                    <textarea
                      id="ofk-fac"
                      className="desk-input"
                      value={fAciklama}
                      onChange={(e) => setFAciklama(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="ofk-ftut">Tutar</label>
                    <MoneyInput id="ofk-ftut" value={fTutar} onChange={setFTutar} />
                  </div>
                  <div className="field">
                    <label htmlFor="ofk-fod">Ödeme yöntemi</label>
                    <select id="ofk-fod" className="desk-input" value={fOdeme} onChange={(e) => setFOdeme(e.target.value)}>
                      {OFIS_ODEME_YONTEMI_KODLARI.map((k) => (
                        <option key={k} value={k}>
                          {OFIS_ODEME_YONTEMI_ETIKET[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field desk-form-span2">
                    <label htmlFor="ofk-fmv">İlgili müvekkil (isteğe bağlı)</label>
                    <input
                      id="ofk-fmv"
                      className="desk-input"
                      value={fMuvekkilQ}
                      onChange={(e) => void araMuvekkilForForm(e.target.value)}
                      placeholder="Müvekkil ara…"
                      list="ofk-muvekkil-list"
                    />
                    <datalist id="ofk-muvekkil-list">
                      {fMuvekkilOpts.map((o) => (
                        <option key={o.id} value={o.label} />
                      ))}
                    </datalist>
                    <div className="desk-ofis-muvekkil-pick" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      {fMuvekkilOpts.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className={`btn btn-sm ${fMuvekkilId === o.id ? "btn-primary" : ""}`}
                          onClick={() => {
                            setFMuvekkilId(o.id);
                            void araMuvekkilForForm(o.label);
                          }}
                        >
                          {o.label}
                        </button>
                      ))}
                      {fMuvekkilId != null ? (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => {
                            setFMuvekkilId(null);
                            void araMuvekkilForForm("");
                          }}
                        >
                          Temizle
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {fTip === "GELIR" ? (
                    <div className="field desk-form-span2">
                      <label htmlFor="ofk-ftahsil">Tahsilatı yapan personel (isteğe bağlı)</label>
                      <select
                        id="ofk-ftahsil"
                        className="desk-input"
                        value={fTahsilUserId ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFTahsilUserId(v ? Number(v) : null);
                        }}
                      >
                        <option value="">— Seçilmedi —</option>
                        {fKullanicilar.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.adSoyad}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div className="field desk-form-span2">
                    <label htmlFor="ofk-fbel">Belge no / fiş no / dekont no</label>
                    <input id="ofk-fbel" className="desk-input" value={fBelge} onChange={(e) => setFBelge(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => modalKapat()}>
                  Vazgeç
                </button>
                <button type="button" className="btn btn-primary" disabled={formKaydediyor} onClick={() => void formKaydet()}>
                  Kaydet
                </button>
              </div>
            </div>
          </DeskModalBackdrop>
        </DeskModalPortal>
      ) : null}

      {duzeltmeHedef ? (
        <DeskModalPortal>
          <DeskModalBackdrop onClose={() => kapatDuzeltme()}>
            <div className="modal modal-desk modal-desk--wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Düzeltme ekle</h2>
            </div>
            <div className="modal-body">
              {dErr ? <p className="form-error modal-form-error">{dErr}</p> : null}
              <fieldset className="desk-duzeltme-readonly">
                <legend>Orijinal işlem</legend>
                <div className="desk-form-grid">
                  <div className="field">
                    <label>Tarih</label>
                    <input readOnly value={formatDateTr(duzeltmeHedef.tarih)} />
                  </div>
                  <div className="field">
                    <label>Tip</label>
                    <input readOnly value={duzeltmeHedef.islemTipi === "GELIR" ? "Gelir" : "Gider"} />
                  </div>
                  <div className="field desk-form-span2">
                    <label>Kategori</label>
                    <input
                      readOnly
                      value={ofisKasaKategoriListeEtiketi(duzeltmeHedef.kategori, duzeltmeHedef.ozelKategoriAdi)}
                    />
                  </div>
                  <div className="field desk-form-span2">
                    <label>Açıklama</label>
                    <input readOnly value={duzeltmeHedef.aciklama?.trim() ? duzeltmeHedef.aciklama : "—"} />
                  </div>
                  <div className="field">
                    <label>Eski tutar</label>
                    <input readOnly value={formatTry(duzeltmeHedef.tutar)} />
                  </div>
                </div>
              </fieldset>
              <div className="desk-form-grid" style={{ marginTop: 12 }}>
                <div className="field">
                  <label>Düzeltme tarihi</label>
                  <input className="desk-input" type="date" value={dTarih} onChange={(e) => setDTarih(e.target.value)} />
                </div>
                <div className="field">
                  <label>Doğru tutar</label>
                  <MoneyInput
                    value={dDogruTutar}
                    onChange={setDDogruTutar}
                    placeholder="Orijinal tutardan farklı tutar"
                  />
                </div>
                <div className="field desk-form-span2">
                  <label>Not</label>
                  <textarea className="desk-input" value={dNot} onChange={(e) => setDNot(e.target.value)} rows={2} />
                </div>
                {duzeltmeOnizleme?.ok ? (
                  <div className="field desk-form-span2 desk-duzeltme-onizleme">
                    <label>Hesaplanan düzeltme</label>
                    <div className="desk-duzeltme-onizleme-body">
                      <span className="desk-badge-duzeltme-tur">{duzeltmeOnizleme.turEtiket}</span>
                      <span>
                        Fark: {formatTry(duzeltmeOnizleme.farkTutar)} · Kasa etkisi:{" "}
                        {formatSignedTry(duzeltmeOnizleme.kasaEtkisi)}
                      </span>
                    </div>
                  </div>
                ) : duzeltmeOnizleme && !duzeltmeOnizleme.ok ? (
                  <p className="form-error desk-form-span2">{duzeltmeOnizleme.error}</p>
                ) : null}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => kapatDuzeltme()}>
                Vazgeç
              </button>
              <button type="button" className="btn btn-primary" disabled={dKaydediyor} onClick={() => void duzeltmeKaydet()}>
                Düzeltmeyi kaydet
              </button>
            </div>
          </div>
        </DeskModalBackdrop>
        </DeskModalPortal>
      ) : null}

      <DeskGuvenliSilModal
        ozet={guvenliSilOzet}
        loading={guvenliSilBusy}
        error={guvenliSilErr}
        onClose={() => !guvenliSilBusy && setGuvenliSilOzet(null)}
        onSubmit={(p) => void guvenliSilGonder(p)}
      />

      <DeskConfirmDialog
        open={confirm != null}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        variant={confirm?.variant}
        confirmLabel={confirm?.confirmLabel}
        busy={confirmBusy}
        onConfirm={() => void confirm?.onConfirm()}
        onCancel={() => {
          if (!confirmBusy) setConfirm(null);
        }}
      />
      <DovizDonusumModal open={dovizOpen} onClose={() => setDovizOpen(false)} onSaved={() => void tumunuYenile()} />
    </div>
  );
}
