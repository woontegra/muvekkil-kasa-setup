import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { OdemeYontemiKodu } from "@shared/constants/kasa";
import type { KasaHareket, KasaOzet } from "@shared/types/kasa";

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
    odemeYontemi: OdemeYontemiKodu;
    masrafTuru: string;
    aciklama: string | null;
  }) {
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
    if (!confirm("Bu işlemi onaylamak istediğinize emin misiniz? Onaylanan işlem silinemez.")) return;
    const r = await window.api.kasaOnayla(id);
    if (!r.ok) alert(r.error ?? "Onaylanamadı");
    void yukle();
  }

  async function reddetHareket(id: number) {
    if (!confirm("Bu işlemi reddetmek istediğinize emin misiniz?")) return;
    const r = await window.api.kasaGuncelle(id, { onayDurumu: "REDDEDILDI" });
    if (!r.ok) alert(r.error ?? "Reddedilemedi");
    void yukle();
  }

  async function silHareket(id: number) {
    if (!confirm("Bu işlemi silmek istediğinize emin misiniz?")) return;
    const r = await window.api.kasaSil(id);
    if (!r.ok) alert(r.error ?? "Silinemedi");
    void yukle();
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
      alert(r.mesaj ?? r.error ?? "Makbuz açılamadı");
      return;
    }
    navigate(`/print/makbuz/${hid}`);
  }

  function openIslemEkle() {
    setFormErr(null);
    setAvansOpen(true);
  }

  function openMasrafEkle() {
    setFormErr(null);
    setMasrafEdit(null);
    setMasrafOpen(true);
  }

  function openMasrafDuzenle(h: KasaHareket) {
    setFormErr(null);
    setMasrafEdit(h);
    setMasrafOpen(true);
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
    saving,
    duzeltmeErr,
    duzeltmeSaving,
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
  };
}
