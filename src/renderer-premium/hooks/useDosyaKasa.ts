import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { OdemeYontemiKodu } from "@shared/constants/kasa";
import type { KasaHareket, KasaOzet } from "@shared/types/kasa";
import type { GuvenliSilInput } from "@shared/types/guvenliSil";
import type { DosyaKasaGuvenliSilMode } from "@shared/lib/guvenliSil";
import type { GuvenliSilModalOzet } from "../components/kasa/GuvenliSilModal";
import type { PremiumToastTone } from "../context/PremiumToastContext";

type ConfirmState = {
  title: string;
  message: string;
  variant?: "danger" | "primary";
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
};

type ToastFn = (tone: PremiumToastTone, message: string) => void;

export function useDosyaKasa(dosyaId: number, muvekkilId: number, showToast: ToastFn) {
  const navigate = useNavigate();
  const loadSeq = useRef(0);

  const [ozet, setOzet] = useState<KasaOzet | null>(null);
  const [ozetLoading, setOzetLoading] = useState(true);
  const [ozetError, setOzetError] = useState<string | null>(null);

  const [hareketler, setHareketler] = useState<KasaHareket[]>([]);
  const [listeLoading, setListeLoading] = useState(true);
  const [listeError, setListeError] = useState<string | null>(null);

  const [masrafTurleri, setMasrafTurleri] = useState<string[]>([]);

  const [avansOpen, setAvansOpen] = useState(false);
  const [masrafOpen, setMasrafOpen] = useState(false);
  const [masrafEdit, setMasrafEdit] = useState<KasaHareket | null>(null);
  const [duzeltmeHedef, setDuzeltmeHedef] = useState<KasaHareket | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [duzeltmeErr, setDuzeltmeErr] = useState<string | null>(null);
  const [duzeltmeSaving, setDuzeltmeSaving] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [masrafFormKey, setMasrafFormKey] = useState(0);
  const [avansFormKey, setAvansFormKey] = useState(0);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [guvenliSilOzet, setGuvenliSilOzet] = useState<GuvenliSilModalOzet | null>(null);
  const [guvenliSilErr, setGuvenliSilErr] = useState<string | null>(null);
  const [guvenliSilBusy, setGuvenliSilBusy] = useState(false);

  const yukleOzet = useCallback(async () => {
    if (!window.api) return;
    setOzetLoading(true);
    setOzetError(null);
    try {
      const o = await window.api.kasaOzet(dosyaId);
      setOzet(o);
    } catch {
      setOzetError("Kasa özeti yüklenemedi.");
    } finally {
      setOzetLoading(false);
    }
  }, [dosyaId]);

  const yukleListe = useCallback(async () => {
    if (!window.api) return;
    const seq = ++loadSeq.current;
    setListeLoading(true);
    setListeError(null);
    try {
      const [h, m] = await Promise.all([window.api.kasaList(dosyaId), window.api.masrafTurleri()]);
      if (seq !== loadSeq.current) return;
      setHareketler(h);
      setMasrafTurleri(m);
    } catch {
      if (seq !== loadSeq.current) return;
      setListeError("Kasa hareketleri yüklenemedi.");
    } finally {
      if (seq === loadSeq.current) setListeLoading(false);
    }
  }, [dosyaId]);

  const yukle = useCallback(async () => {
    await Promise.all([yukleOzet(), yukleListe()]);
  }, [yukleOzet, yukleListe]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  useEffect(() => {
    if (highlightId == null) return;
    const t = window.setTimeout(() => setHighlightId(null), 2400);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  async function kaydetAvans(data: {
    tarih: string;
    tutar: number;
    odemeYontemi: OdemeYontemiKodu;
    aciklama: string | null;
  }) {
    if (saving) return;
    setFormErr(null);
    setSaving(true);
    try {
      const res = await window.api.kasaEkle({
        dosyaId,
        muvekkilId,
        islemTipi: "AVANS_GIRISI",
        tutar: data.tutar,
        tarih: data.tarih,
        odemeYontemi: data.odemeYontemi,
        aciklama: data.aciklama,
      });
      if (!res.ok) {
        setFormErr(res.error);
        throw new Error(res.error);
      }
      setAvansOpen(false);
      setHighlightId(res.row.id);
      showToast("success", "Avans girişi başarıyla kaydedildi.");
      await yukle();
    } finally {
      setSaving(false);
    }
  }

  async function kaydetMasraf(data: {
    tarih: string;
    tutar: number;
    odemeYontemi: string;
    masrafTuru: string;
    aciklama: string | null;
  }) {
    if (saving) return;
    setFormErr(null);
    setSaving(true);
    try {
      if (masrafEdit) {
        const res = await window.api.kasaGuncelle(masrafEdit.id, {
          tutar: data.tutar,
          tarih: data.tarih,
          masrafTuru: data.masrafTuru,
          odemeYontemi: data.odemeYontemi,
          aciklama: data.aciklama,
        });
        if (!res.ok) {
          setFormErr(res.error);
          throw new Error(res.error);
        }
        setHighlightId(masrafEdit.id);
        showToast("success", "Masraf kaydı güncellendi.");
      } else {
        const res = await window.api.kasaEkle({
          dosyaId,
          muvekkilId,
          islemTipi: "MASRAF",
          tutar: data.tutar,
          tarih: data.tarih,
          masrafTuru: data.masrafTuru,
          odemeYontemi: data.odemeYontemi,
          aciklama: data.aciklama,
        });
        if (!res.ok) {
          setFormErr(res.error);
          throw new Error(res.error);
        }
        setHighlightId(res.row.id);
        showToast("success", "Masraf girişi başarıyla kaydedildi.");
      }
      setMasrafOpen(false);
      setMasrafEdit(null);
      await yukle();
    } finally {
      setSaving(false);
    }
  }

  function onaylaHareket(id: number) {
    setConfirm({
      title: "İşlemi onayla",
      message: "Bu işlemi onaylamak istediğinize emin misiniz? Onaylanan işlem silinemez.",
      confirmLabel: "Onayla",
      onConfirm: async () => {
        const r = await window.api.kasaOnayla(id);
        if (!r.ok) {
          showToast("error", r.error ?? "Onaylanamadı");
          return;
        }
        showToast("success", "Kasa hareketi onaylandı.");
        await yukle();
      },
    });
  }

  function reddetHareket(id: number) {
    setConfirm({
      title: "İşlemi reddet",
      message: "Bu işlemi reddetmek istediğinize emin misiniz?",
      variant: "danger",
      confirmLabel: "Reddet",
      onConfirm: async () => {
        const r = await window.api.kasaGuncelle(id, { onayDurumu: "REDDEDILDI" });
        if (!r.ok) {
          showToast("error", r.error ?? "Reddedilemedi");
          return;
        }
        await yukle();
      },
    });
  }

  function acGuvenliSil(h: KasaHareket, mode: DosyaKasaGuvenliSilMode) {
    setGuvenliSilErr(null);
    setGuvenliSilOzet({
      id: h.id,
      tarih: h.tarih,
      aciklama: h.aciklama?.trim() || (h.islemTipi === "MASRAF" ? h.masrafTuru ?? "" : "Avans girişi"),
      tutar: h.tutar,
      odemeYontemi: h.odemeYontemi,
      belgeNo: h.belgeNo,
      mode,
    });
  }

  async function guvenliSilGonder(payload: GuvenliSilInput) {
    if (!guvenliSilOzet || guvenliSilBusy) return;
    setGuvenliSilErr(null);
    setGuvenliSilBusy(true);
    try {
      const r = await window.api.kasaGuvenliSil(guvenliSilOzet.id, payload);
      if (!r.ok) {
        setGuvenliSilErr(r.error ?? "Silinemedi");
        return;
      }
      setGuvenliSilOzet(null);
      showToast("success", r.auditMessage ?? "Kayıt güvenli sil ile kaldırıldı.");
      await yukle();
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
        const r = await window.api.kasaSil(id);
        if (!r.ok) {
          showToast("error", r.error ?? "Silinemedi");
          return;
        }
        showToast("success", "Kasa hareketi silindi.");
        await yukle();
      },
    });
  }

  async function kaydetDuzeltme(data: { tutar: number; tarih: string; aciklama: string }) {
    if (!duzeltmeHedef) return;
    setDuzeltmeErr(null);
    setDuzeltmeSaving(true);
    try {
      const res = await window.api.kasaEkle({
        dosyaId,
        muvekkilId,
        islemTipi: "DUZELTME",
        tutar: data.tutar,
        tarih: data.tarih,
        aciklama: data.aciklama,
        duzeltilenIslemId: duzeltmeHedef.id,
      });
      if (!res.ok) {
        setDuzeltmeErr(res.error);
        throw new Error(res.error);
      }
      setDuzeltmeHedef(null);
      setHighlightId(res.row.id);
      showToast("success", "Kasa düzeltmesi kaydedildi.");
      await yukle();
    } finally {
      setDuzeltmeSaving(false);
    }
  }

  function makbuzGosterilebilir(h: KasaHareket): boolean {
    return (
      h.onayDurumu === "ONAYLI" &&
      (h.islemTipi === "AVANS_GIRISI" || h.islemTipi === "MASRAF" || h.islemTipi === "DUZELTME")
    );
  }

  async function makbuzAc(hid: number) {
    if (!window.api) return;
    const r = await window.api.makbuzYazdirmaPaketi(hid);
    if (!r.ok) {
      showToast("error", r.mesaj ?? r.error ?? "Makbuz açılamadı");
      return;
    }
    navigate(`/print/makbuz/kasa/${hid}`);
  }

  function openIslemEkle() {
    setFormErr(null);
    setAvansFormKey((k) => k + 1);
    setAvansOpen(true);
  }

  function openMasrafEkle() {
    setFormErr(null);
    setMasrafEdit(null);
    setMasrafFormKey((k) => k + 1);
    setMasrafOpen(true);
  }

  function openMasrafDuzenle(h: KasaHareket) {
    setFormErr(null);
    setMasrafEdit(h);
    setMasrafFormKey((k) => k + 1);
    setMasrafOpen(true);
  }

  async function confirmOnayla() {
    if (!confirm || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await confirm.onConfirm();
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  return {
    ozet,
    ozetLoading,
    ozetError,
    hareketler,
    listeLoading,
    listeError,
    masrafTurleri,
    avansOpen,
    setAvansOpen,
    masrafOpen,
    setMasrafOpen,
    masrafEdit,
    setMasrafEdit,
    duzeltmeHedef,
    setDuzeltmeHedef,
    formErr,
    saving,
    duzeltmeErr,
    duzeltmeSaving,
    masrafFormKey,
    avansFormKey,
    confirm,
    confirmBusy,
    setConfirm,
    confirmOnayla,
    highlightId,
    yukle,
    yukleOzet,
    yukleListe,
    kaydetAvans,
    kaydetMasraf,
    onaylaHareket,
    reddetHareket,
    silHareket,
    kaydetDuzeltme,
    makbuzGosterilebilir,
    makbuzAc,
    openIslemEkle,
    openMasrafEkle,
    openMasrafDuzenle,
    guvenliSilOzet,
    setGuvenliSilOzet,
    guvenliSilErr,
    guvenliSilBusy,
    acGuvenliSil,
    guvenliSilGonder,
  };
}
