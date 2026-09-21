import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DIGER_GELIR_KOD,
  DIGER_GIDER_KOD,
  OFIS_GIDER_KATEGORI_KODLARI,
  OFIS_GELIR_KATEGORI_KODLARI,
  OFIS_ODEME_YONTEMI_KODLARI,
  PERSONEL_MAAS_KOD,
  ofisKategoriOzelAdGerekli,
} from "@shared/constants/ofisKasa";
import { getActiveAccountingPeriodRange } from "@shared/lib/accountingPeriod";
import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";
import type { OfisKasaHareketListeSatir, OfisKasaListFilter, OfisKasaUstOzet } from "@shared/types/ofisKasa";
import type { GuvenliSilInput } from "@shared/types/guvenliSil";
import type { OfisGuvenliSilMode } from "@shared/lib/guvenliSil";
import type { GuvenliSilModalOzet } from "../components/kasa/GuvenliSilModal";
import { ofisKasaKategoriListeEtiketi } from "../lib/ofisKasa";
import type { PremiumToastTone } from "../context/PremiumToastContext";
import { notifyOverviewRefresh } from "../lib/events";
import { ayBasiSonu, hesaplaOfisKasaDuzeltme, parseTutar } from "../lib/ofisKasa";
import { bugunYmd, formatCurrencyInputTR } from "../lib/format";
import type { ParaBirimi } from "@shared/lib/paraBirimi";

type ConfirmState = {
  title: string;
  message: string;
  variant?: "danger" | "primary";
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
};

type ToastFn = (tone: PremiumToastTone, message: string) => void;

export function useOfisKasa(showToast: ToastFn) {
  const navigate = useNavigate();
  const loadSeq = useRef(0);
  const fallbackAy = useMemo(() => ayBasiSonu(), []);

  const [tb, setTb] = useState(fallbackAy.bas);
  const [te, setTe] = useState(fallbackAy.bit);
  const [periodEtiket, setPeriodEtiket] = useState("");
  const [tip, setTip] = useState("TUMU");
  const [katSel, setKatSel] = useState("");
  const [q, setQ] = useState("");

  const [ust, setUst] = useState<OfisKasaUstOzet | null>(null);
  const [ustLoading, setUstLoading] = useState(true);
  const [ustError, setUstError] = useState<string | null>(null);

  const [hareketler, setHareketler] = useState<OfisKasaHareketListeSatir[]>([]);
  const [listeLoading, setListeLoading] = useState(true);
  const [listeError, setListeError] = useState<string | null>(null);

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

  const [duzeltmeHedef, setDuzeltmeHedef] = useState<OfisKasaHareketListeSatir | null>(null);
  const [dDogruTutar, setDDogruTutar] = useState("");
  const [dTarih, setDTarih] = useState(bugunYmd());
  const [dNot, setDNot] = useState("");
  const [dErr, setDErr] = useState<string | null>(null);
  const [dKaydediyor, setDKaydediyor] = useState(false);

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [guvenliSilOzet, setGuvenliSilOzet] = useState<GuvenliSilModalOzet | null>(null);
  const [guvenliSilErr, setGuvenliSilErr] = useState<string | null>(null);
  const [guvenliSilBusy, setGuvenliSilBusy] = useState(false);

  const filtre: OfisKasaListFilter = useMemo(
    () => ({
      tarihBas: tb,
      tarihBit: te,
      islemTipi: tip,
      kategori: katSel,
      q: q.trim(),
    }),
    [tb, te, tip, katSel, q],
  );

  const applyPeriod = useCallback(async () => {
    try {
      const mode = (await window.api.getAccountingPeriodMode?.()) as AccountingPeriodMode | undefined;
      const range = getActiveAccountingPeriodRange(mode === "MONTHLY" ? "MONTHLY" : "YEARLY");
      setTb(range.bas);
      setTe(range.bit);
      setPeriodEtiket(range.etiket);
    } catch {
      /* fallback already set */
    }
  }, []);

  const yukleUst = useCallback(async () => {
    if (!window.api?.ofisKasaUstOzet) return;
    setUstLoading(true);
    setUstError(null);
    try {
      const r = await window.api.ofisKasaUstOzet();
      setUst(r);
    } catch {
      setUstError("Finans özeti yüklenemedi.");
      setUst(null);
    } finally {
      setUstLoading(false);
    }
  }, []);

  const yukleListe = useCallback(async () => {
    if (!window.api?.ofisKasaList) return;
    const seq = ++loadSeq.current;
    setListeLoading(true);
    setListeError(null);
    try {
      const rows = await window.api.ofisKasaList(filtre);
      if (seq !== loadSeq.current) return;
      setHareketler(Array.isArray(rows) ? rows : []);
    } catch {
      if (seq !== loadSeq.current) return;
      setListeError("Hareket listesi yüklenemedi.");
      setHareketler([]);
    } finally {
      if (seq === loadSeq.current) setListeLoading(false);
    }
  }, [filtre]);

  const tumunuYenile = useCallback(async () => {
    await Promise.all([yukleUst(), yukleListe()]);
  }, [yukleUst, yukleListe]);

  useEffect(() => {
    void applyPeriod();
    const onPeriodChanged = () => {
      void applyPeriod();
      void yukleUst();
    };
    window.addEventListener("mkd:accounting-period-changed", onPeriodChanged);
    return () => window.removeEventListener("mkd:accounting-period-changed", onPeriodChanged);
  }, [applyPeriod, yukleUst]);

  useEffect(() => {
    void yukleUst();
  }, [yukleUst]);

  useEffect(() => {
    void yukleListe();
  }, [yukleListe]);

  useEffect(() => {
    if (highlightId == null) return;
    const t = window.setTimeout(() => setHighlightId(null), 2400);
    return () => window.clearTimeout(t);
  }, [highlightId]);

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

  function modalSifirla(tip: "GELIR" | "GIDER") {
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

  function openGelirEkle() {
    modalSifirla("GELIR");
    setModalAcik(true);
  }

  function openGiderEkle() {
    modalSifirla("GIDER");
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
    const digerSecili = katKod === DIGER_GELIR_KOD || katKod === DIGER_GIDER_KOD;
    const personelMaasSecili = katKod === PERSONEL_MAAS_KOD;
    const ozelAlanGerekli = digerSecili || personelMaasSecili || ofisKategoriOzelAdGerekli(katKod);

    if (!Number.isFinite(tutar) || tutar <= 0) {
      setFormErr("Tutar sıfırdan büyük ve geçerli olmalıdır.");
      return;
    }
    if (personelMaasSecili && !fOzelKat.trim()) {
      setFormErr("Personel ismi zorunludur.");
      return;
    }
    if (digerSecili && !fOzelKat.trim()) {
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
          ozelKategoriAdi: ozelAlanGerekli ? fOzelKat.trim() : null,
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
        setModalAcik(false);
        setHighlightId(duzenleId);
        showToast("success", "Ofis Kasası kaydı güncellendi.");
      } else {
        const res = await window.api.ofisKasaEkle({
          islemTipi: fTip,
          tarih: fTarih,
          kategori: katKod,
          kalemId: fKalemId,
          ozelKategoriAdi: ozelAlanGerekli ? fOzelKat.trim() : null,
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
        setModalAcik(false);
        setHighlightId(res.row.id);
        showToast("success", fTip === "GELIR" ? "Gelir kaydı oluşturuldu." : "Gider kaydı oluşturuldu.");
      }
      notifyOverviewRefresh();
      await tumunuYenile();
    } catch {
      setFormErr("Kayıt sırasında hata oluştu.");
    } finally {
      setFormKaydediyor(false);
    }
  }

  function onaylaHareket(id: number) {
    setConfirm({
      title: "İşlemi onayla",
      message: "Bu işlemi onaylamak istediğinize emin misiniz? Onaylanan işlem silinemez.",
      onConfirm: async () => {
        if (confirmBusy) return;
        setConfirmBusy(true);
        try {
          const r = await window.api.ofisKasaOnayla(id);
          if (!r.ok) {
            showToast("error", r.error ?? "Onaylanamadı");
            return;
          }
          setConfirm(null);
          setHighlightId(id);
          showToast("success", "Kasa hareketi onaylandı.");
          notifyOverviewRefresh();
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
      belgeNo: h.belgeNo,
      mode,
      muvekkilAdi: h.muvekkilAdiSnapshot,
      kategori: ofisKasaKategoriListeEtiketi(h),
      paraBirimi: h.paraBirimi,
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
      showToast("success", r.auditMessage ?? "Kayıt güvenli sil ile kaldırıldı.");
      notifyOverviewRefresh();
      await tumunuYenile();
    } finally {
      setGuvenliSilBusy(false);
    }
  }

  function silHareket(id: number) {
    setConfirm({
      title: "İşlemi sil",
      message: "Bu işlemi silmek istediğinize emin misiniz?",
      variant: "danger",
      confirmLabel: "Sil",
      onConfirm: async () => {
        if (confirmBusy) return;
        setConfirmBusy(true);
        try {
          const r = await window.api.ofisKasaSil(id);
          if (!r.ok) {
            showToast("error", r.error ?? "Silinemedi");
            return;
          }
          setConfirm(null);
          showToast("success", "Kasa hareketi silindi.");
          notifyOverviewRefresh();
          await tumunuYenile();
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  }

  function acDuzeltme(h: OfisKasaHareketListeSatir) {
    if (h.hasCorrection) {
      showToast("warning", "Bu kayıt için zaten düzeltme yapılmış.");
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
      setHighlightId(res.row.id);
      showToast("success", "Kasa düzeltmesi kaydedildi.");
      notifyOverviewRefresh();
      await tumunuYenile();
    } catch {
      setDErr("Düzeltme kaydedilemedi.");
    } finally {
      setDKaydediyor(false);
    }
  }

  function raporYazdir() {
    const { bas: ayBas, bit: ayBit } = ayBasiSonu();
    const bas = (tb || ayBas).trim().slice(0, 10);
    const bit = (te || ayBit).trim().slice(0, 10);
    navigate(`/print/ofis-kasa-raporu?bas=${encodeURIComponent(bas)}&bit=${encodeURIComponent(bit)}`);
  }

  const selectedKalemKod = fKalemler.find((k) => k.id === fKalemId)?.kod ?? fKat;
  const digerSecili = selectedKalemKod === DIGER_GELIR_KOD || selectedKalemKod === DIGER_GIDER_KOD;
  const personelMaasSecili = selectedKalemKod === PERSONEL_MAAS_KOD;
  const ozelAlanGerekli = digerSecili || personelMaasSecili || ofisKategoriOzelAdGerekli(selectedKalemKod);

  return {
    tb,
    setTb,
    te,
    setTe,
    periodEtiket,
    tip,
    setTip,
    katSel,
    setKatSel,
    q,
    setQ,
    ust,
    ustLoading,
    ustError,
    hareketler,
    listeLoading,
    listeError,
    yukleUst,
    yukleListe,
    tumunuYenile,
    modalAcik,
    duzenleId,
    fTip,
    setFTip,
    fTarih,
    setFTarih,
    fKat,
    setFKat,
    fKalemId,
    setFKalemId,
    fKalemler,
    fMuvekkilId,
    setFMuvekkilId,
    fMuvekkilQ,
    fMuvekkilOpts,
    araMuvekkilForForm,
    fTahsilUserId,
    setFTahsilUserId,
    fKullanicilar,
    loadFormLookups,
    fOzelKat,
    setFOzelKat,
    fAciklama,
    setFAciklama,
    fTutar,
    setFTutar,
    fParaBirimi,
    setFParaBirimi,
    fOdeme,
    setFOdeme,
    fBelge,
    setFBelge,
    formErr,
    formKaydediyor,
    digerSecili,
    personelMaasSecili,
    ozelAlanGerekli,
    openGelirEkle,
    openGiderEkle,
    modalKapat,
    modalAcDuzenle,
    formKaydet,
    onaylaHareket,
    silHareket,
    duzeltmeHedef,
    dDogruTutar,
    setDDogruTutar,
    dTarih,
    setDTarih,
    dNot,
    setDNot,
    dErr,
    dKaydediyor,
    acDuzeltme,
    kapatDuzeltme,
    duzeltmeKaydet,
    confirm,
    setConfirm,
    confirmBusy,
    highlightId,
    raporYazdir,
    guvenliSilOzet,
    setGuvenliSilOzet,
    guvenliSilErr,
    guvenliSilBusy,
    acGuvenliSil,
    guvenliSilGonder,
  };
}
