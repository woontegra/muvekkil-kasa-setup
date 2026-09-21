import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { OdemeYontemiKodu } from "@shared/constants/kasa";
import type { KasaHareket, KasaOzet } from "@shared/types/kasa";
import type { GuvenliSilInput } from "@shared/types/guvenliSil";
import type { DosyaKasaGuvenliSilMode } from "@shared/lib/guvenliSil";
import type { DeskGuvenliSilOzet } from "../components/DeskGuvenliSilModal";

type ConfirmState = {
  title: string;
  message: string;
  variant?: "danger" | "primary";
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
};

export function useDosyaKasa(dosyaId: number, muvekkilId: number) {
  const navigate = useNavigate();
  const [ozet, setOzet] = useState<KasaOzet | null>(null);
  const [hareketler, setHareketler] = useState<KasaHareket[]>([]);
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
  const [guvenliSilOzet, setGuvenliSilOzet] = useState<DeskGuvenliSilOzet | null>(null);
  const [guvenliSilErr, setGuvenliSilErr] = useState<string | null>(null);
  const [guvenliSilBusy, setGuvenliSilBusy] = useState(false);

  const yukle = useCallback(async () => {
    if (!window.api) return;
    const [o, h, m] = await Promise.all([
      window.api.kasaOzet(dosyaId),
      window.api.kasaList(dosyaId),
      window.api.masrafTurleri(),
    ]);
    setOzet(o);
    setHareketler(h);
    setMasrafTurleri(m);
  }, [dosyaId]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const kasaHareketleri = hareketler.filter((h) => h.islemTipi !== "MASRAF");
  const masraflar = hareketler.filter((h) => h.islemTipi === "MASRAF");

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
      void yukle();
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
      }
      setMasrafOpen(false);
      setMasrafEdit(null);
      void yukle();
    } finally {
      setSaving(false);
    }
  }

  async function onaylaHareket(id: number) {
    setConfirm({
      title: "İşlemi onayla",
      message: "Bu işlemi onaylamak istediğinize emin misiniz? Onaylanan işlem silinemez.",
      confirmLabel: "Onayla",
      onConfirm: async () => {
        const r = await window.api.kasaOnayla(id);
        if (!r.ok) setFormErr(r.error ?? "Onaylanamadı");
        void yukle();
      },
    });
  }

  async function reddetHareket(id: number) {
    setConfirm({
      title: "İşlemi reddet",
      message: "Bu işlemi reddetmek istediğinize emin misiniz?",
      variant: "danger",
      confirmLabel: "Reddet",
      onConfirm: async () => {
        const r = await window.api.kasaGuncelle(id, { onayDurumu: "REDDEDILDI" });
        if (!r.ok) setFormErr(r.error ?? "Reddedilemedi");
        void yukle();
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
      void yukle();
    } finally {
      setGuvenliSilBusy(false);
    }
  }

  async function silHareket(id: number) {
    setConfirm({
      title: "İşlemi sil",
      message: "Bu işlemi silmek istediğinize emin misiniz?",
      variant: "danger",
      confirmLabel: "Sil",
      onConfirm: async () => {
        const r = await window.api.kasaSil(id);
        if (!r.ok) setFormErr(r.error ?? "Silinemedi");
        void yukle();
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
      void yukle();
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
      setFormErr(r.mesaj ?? r.error ?? "Makbuz açılamadı");
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
    kasaHareketleri,
    masraflar,
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
    setFormErr,
    saving,
    duzeltmeErr,
    duzeltmeSaving,
    masrafFormKey,
    avansFormKey,
    confirm,
    confirmBusy,
    setConfirm,
    confirmOnayla,
    yukle,
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
