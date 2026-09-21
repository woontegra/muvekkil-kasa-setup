import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { OdemeYontemiKodu } from "@shared/constants/kasa";
import type {
  TaksitEkleInput,
  TaksitGuncelleInput,
  VekaletTaksit,
  VekaletTaksitOdeme,
  VekaletUcreti,
} from "@shared/types/vekalet";
import { kurusBuyuktur, kurusFarkTl } from "@shared/lib/moneyKurus";
import { formatTry } from "../lib/format";
import type { ParaBirimi } from "@shared/lib/paraBirimi";
import type { TaksitOdemeAlInput } from "@shared/types/vekalet";
import { notifyOverviewRefresh } from "../lib/events";
import type { PremiumToastTone } from "../context/PremiumToastContext";
import {
  hesaplaSabitTaksitPlani,
  taksitPlaniToplamDurumu,
  taksitPlaniToplamMesaj,
  vekaletAcikTaksitVarMi,
  vekaletOzetFromTaksitler,
  vadeEkleAy,
  yuvarlaTaksitToplam,
  siralaVekaletTaksitleriVadeAsc,
} from "../lib/vekalet";

export type TaksitPlaniKayit =
  | { tip: "ESIT"; taksitTutari: number; adet: number; baslangicTarihi: string }
  | { tip: "OZEL"; satirlar: { tutar: number; vadeTarihi: string; aciklama: string | null }[] };

type ToastFn = (tone: PremiumToastTone, message: string) => void;

const TOPLU_SIL_ENGEL =
  "Ödeme alınmış taksitler bulunduğu için taksitlerin tamamı silinemez. Önce ilgili ödeme kayıtları mevcut kurallara göre düzeltilmelidir.";

export function useVekaletTaksit(dosyaId: number, muvekkilId: number, showToast: ToastFn) {
  const navigate = useNavigate();

  const [vekalet, setVekalet] = useState<VekaletUcreti | null>(null);
  const [taksitler, setTaksitler] = useState<VekaletTaksit[]>([]);
  const [smmBekleyenCount, setSmmBekleyenCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [ucretOpen, setUcretOpen] = useState(false);
  const [taksitOpen, setTaksitOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [duzenleTaksit, setDuzenleTaksit] = useState<VekaletTaksit | null>(null);
  const [odemeTaksit, setOdemeTaksit] = useState<VekaletTaksit | null>(null);
  const [gecmisTaksit, setGecmisTaksit] = useState<VekaletTaksit | null>(null);
  const [gecmis, setGecmis] = useState<VekaletTaksitOdeme[]>([]);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [siliniyor, setSiliniyor] = useState(false);
  const [silinecekTaksit, setSilinecekTaksit] = useState<VekaletTaksit | null>(null);
  const [taksitFormKey, setTaksitFormKey] = useState(0);
  const [topluSilOpen, setTopluSilOpen] = useState(false);
  const [guvenliIptalTaksit, setGuvenliIptalTaksit] = useState<VekaletTaksit | null>(null);
  const [guvenliIptalOdemeId, setGuvenliIptalOdemeId] = useState<number | null>(null);
  const [guvenliIptalOdemeler, setGuvenliIptalOdemeler] = useState<VekaletTaksitOdeme[]>([]);
  const [guvenliIptalSaving, setGuvenliIptalSaving] = useState(false);

  const yukle = useCallback(async () => {
    if (!window.api) return;
    setLoading(true);
    try {
      const v = await window.api.vekaletGetOrCreate(dosyaId, muvekkilId);
      setVekalet(v);
      const [t, smm] = await Promise.all([
        window.api.vekaletTaksitList(v.id),
        window.api.vekaletSmmBekleyenler(dosyaId),
      ]);
      setTaksitler(siralaVekaletTaksitleriVadeAsc(t));
      setSmmBekleyenCount(smm.length);
    } finally {
      setLoading(false);
    }
  }, [dosyaId, muvekkilId]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const ozet = useMemo(
    () => vekaletOzetFromTaksitler(vekalet?.anlasilanTutar ?? 0, taksitler),
    [vekalet, taksitler],
  );

  const mevcutTaksitToplam = useMemo(
    () => yuvarlaTaksitToplam(taksitler.map((t) => t.tutar)),
    [taksitler],
  );

  const kalanTaksitlendirme = useMemo(() => {
    const anlasilan = vekalet?.anlasilanTutar ?? 0;
    return kurusFarkTl(anlasilan, mevcutTaksitToplam);
  }, [vekalet, mevcutTaksitToplam]);

  const taksitAsimi = useMemo(() => {
    const anlasilan = vekalet?.anlasilanTutar ?? 0;
    if (anlasilan <= 0) return null;
    if (!kurusBuyuktur(mevcutTaksitToplam, anlasilan)) return null;
    return {
      anlasilan,
      mevcutTaksitToplam,
      asan: kurusFarkTl(mevcutTaksitToplam, anlasilan),
    };
  }, [vekalet, mevcutTaksitToplam]);

  const yeniTaksitEngeli = !!taksitAsimi || kalanTaksitlendirme <= 0;

  const acikTaksitVar = useMemo(() => vekaletAcikTaksitVarMi(taksitler), [taksitler]);

  const odemeBulunanTaksitVar = useMemo(
    () =>
      taksitler.some(
        (t) =>
          t.odenenToplam > 0.005 ||
          t.smmDurumu !== "YOK" ||
          !!t.sonOdemeId ||
          !!(t.sonMakbuzNo && t.sonMakbuzNo.trim()),
      ),
    [taksitler],
  );

  const inlineErrGoster = useMemo(
    () =>
      !!formErr &&
      !ucretOpen &&
      !taksitOpen &&
      !planOpen &&
      !duzenleTaksit &&
      !odemeTaksit &&
      !topluSilOpen &&
      !silinecekTaksit &&
      !gecmisTaksit &&
      !guvenliIptalTaksit,
    [formErr, ucretOpen, taksitOpen, planOpen, duzenleTaksit, odemeTaksit, topluSilOpen, silinecekTaksit, gecmisTaksit, guvenliIptalTaksit],
  );

  const vekaletMakbuzAc = useCallback(
    async (odemeId: number) => {
      if (!window.api) return;
      const r = await window.api.getVekaletPrintPackageByOdemeId(odemeId);
      if (!r.ok) {
        setFormErr(r.mesaj ?? r.error ?? "Makbuz açılamadı");
        showToast("error", r.mesaj ?? r.error ?? "Makbuz açılamadı");
        return;
      }
      navigate(`/print/makbuz/vekalet/${odemeId}`);
    },
    [navigate, showToast],
  );

  const tumTaksitleriSil = useCallback(async () => {
    if (!vekalet) return;
    setFormErr(null);
    if (taksitler.length === 0) {
      setTopluSilOpen(false);
      return;
    }
    if (odemeBulunanTaksitVar) {
      setFormErr(TOPLU_SIL_ENGEL);
      showToast("error", TOPLU_SIL_ENGEL);
      setTopluSilOpen(false);
      return;
    }
    const beklenenAdet = taksitler.length;
    setSaving(true);
    try {
      const res = await window.api.vekaletTaksitleriTopluSil(vekalet.id);
      if (!res.ok) {
        setFormErr(res.error);
        showToast("error", res.error);
        await yukle();
        setTopluSilOpen(false);
        return;
      }
      setTopluSilOpen(false);
      const adet = res.silinenAdet || beklenenAdet;
      showToast("success", `${adet} taksit başarıyla silindi.`);
      await yukle();
    } catch {
      const msg = "Taksitler silinemedi.";
      setFormErr(msg);
      showToast("error", msg);
      await yukle();
      setTopluSilOpen(false);
    } finally {
      setSaving(false);
    }
  }, [vekalet, taksitler.length, odemeBulunanTaksitVar, yukle, showToast]);

  const topluSilAc = useCallback(() => {
    setFormErr(null);
    if (odemeBulunanTaksitVar) {
      setFormErr(TOPLU_SIL_ENGEL);
      showToast("error", TOPLU_SIL_ENGEL);
      return;
    }
    setTopluSilOpen(true);
  }, [odemeBulunanTaksitVar, showToast]);

  const taksitPlaniniKaydet = useCallback(
    async (plan: TaksitPlaniKayit) => {
      if (!vekalet) return;
      setFormErr(null);

      if (taksitAsimi) {
        const msg = "Taksit toplamı anlaşılan vekalet ücretini aşıyor. Önce hatalı taksitleri düzeltin.";
        setFormErr(msg);
        throw new Error("Taksit aşımı");
      }

      if (acikTaksitVar) {
        const msg =
          "Mevcut açık taksitler var. Yeni plan oluşturmadan önce mevcut açık taksitleri silin veya düzenleyin.";
        setFormErr(msg);
        throw new Error("Açık taksit var");
      }

      setSaving(true);
      try {
        let kayitlar: { tutar: number; vadeTarihi: string; aciklama: string | null }[] = [];

        if (plan.tip === "ESIT") {
          const tutarlar = hesaplaSabitTaksitPlani(plan.taksitTutari, plan.adet);
          if (!tutarlar || tutarlar.length === 0) {
            setFormErr("Geçerli bir taksit planı oluşturulamadı");
            throw new Error("Geçersiz plan");
          }
          const toplam = yuvarlaTaksitToplam(tutarlar);
          if (kurusBuyuktur(toplam, kalanTaksitlendirme)) {
            setFormErr("Yeni taksitlerin toplamı, taksitlendirilebilir kalan tutarı aşamaz.");
            throw new Error("Plan toplamı fazla");
          }
          kayitlar = tutarlar.map((tutar, i) => ({
            tutar,
            vadeTarihi: vadeEkleAy(plan.baslangicTarihi, i),
            aciklama: null,
          }));
        } else {
          if (plan.satirlar.length < 1 || plan.satirlar.length > 120) {
            setFormErr("Geçerli bir taksit planı oluşturulamadı");
            throw new Error("Geçersiz plan");
          }
          const toplam = yuvarlaTaksitToplam(plan.satirlar.map((s) => s.tutar));
          const durum = taksitPlaniToplamDurumu(kalanTaksitlendirme, toplam);
          if (durum !== "UYGUN") {
            setFormErr(taksitPlaniToplamMesaj(durum) ?? "Taksit toplamı kalan vekalet tutarıyla eşleşmiyor.");
            throw new Error("Plan toplamı uyumsuz");
          }
          kayitlar = plan.satirlar;
        }

        for (const satir of kayitlar) {
          const res = await window.api.vekaletTaksitEkle(vekalet.id, {
            tutar: satir.tutar,
            vadeTarihi: satir.vadeTarihi,
            aciklama: satir.aciklama,
          });
          if (!res.ok) {
            setFormErr(res.error);
            throw new Error(res.error);
          }
        }
        setPlanOpen(false);
        await yukle();
      } finally {
        setSaving(false);
      }
    },
    [vekalet, taksitAsimi, acikTaksitVar, kalanTaksitlendirme, yukle],
  );

  const kaydetUcret = useCallback(
    async (anlasilanTutar: number, paraBirimi: ParaBirimi, aciklama: string | null) => {
      const yeniKayit = (vekalet?.anlasilanTutar ?? 0) <= 0;
      setFormErr(null);
      setSaving(true);
      try {
        const res = await window.api.vekaletKaydet(dosyaId, muvekkilId, { anlasilanTutar, paraBirimi, aciklama });
        if (!res.ok) {
          setFormErr(res.error);
          showToast("error", res.error);
          throw new Error(res.error);
        }
        setUcretOpen(false);
        showToast("success", yeniKayit ? "Vekalet ücreti tanımlandı." : "Vekalet ücreti güncellendi.");
        await yukle();
      } finally {
        setSaving(false);
      }
    },
    [dosyaId, muvekkilId, vekalet, yukle, showToast],
  );

  const kaydetTaksit = useCallback(
    async (input: TaksitEkleInput) => {
      if (!vekalet) return;
      setFormErr(null);
      if (taksitAsimi) {
        const msg = "Taksit toplamı anlaşılan vekalet ücretini aşıyor. Önce hatalı taksitleri düzeltin.";
        setFormErr(msg);
        throw new Error("Taksit aşımı");
      }
      if (kurusBuyuktur(input.tutar, kalanTaksitlendirme)) {
        const msg = `Taksit tutarı, taksitlendirilebilir kalan ${formatTry(kalanTaksitlendirme)} tutarını aşamaz.`;
        setFormErr(msg);
        throw new Error("Taksit tutarı fazla");
      }
      setSaving(true);
      try {
        const res = await window.api.vekaletTaksitEkle(vekalet.id, input);
        if (!res.ok) {
          setFormErr(res.error);
          throw new Error(res.error);
        }
        setTaksitOpen(false);
        await yukle();
      } finally {
        setSaving(false);
      }
    },
    [vekalet, taksitAsimi, kalanTaksitlendirme, yukle],
  );

  const kaydetTaksitDuzenle = useCallback(
    async (id: number, patch: TaksitGuncelleInput) => {
      setFormErr(null);
      setSaving(true);
      try {
        const res = await window.api.vekaletTaksitGuncelle(id, patch);
        if (!res.ok) {
          setFormErr(res.error);
          showToast("error", res.error);
          throw new Error(res.error);
        }
        setDuzenleTaksit(null);
        showToast("success", "Taksit bilgileri güncellendi.");
        await yukle();
      } finally {
        setSaving(false);
      }
    },
    [yukle, showToast],
  );

  const kaydetOdeme = useCallback(
    async (data: TaksitOdemeAlInput) => {
      if (!odemeTaksit) return;
      setFormErr(null);
      setSaving(true);
      try {
        const res = await window.api.vekaletTaksitOdemeAl(odemeTaksit.id, data);
        if (!res.ok) {
          setFormErr(res.error);
          showToast("error", res.error);
          throw new Error(res.error);
        }
        setOdemeTaksit(null);
        showToast("success", "Ödeme başarıyla kaydedildi.");
        notifyOverviewRefresh();
        await yukle();
      } finally {
        setSaving(false);
      }
    },
    [odemeTaksit, yukle, showToast],
  );

  const acGecmis = useCallback(async (t: VekaletTaksit) => {
    setGecmisTaksit(t);
    const list = await window.api.vekaletTaksitOdemeGecmisi(t.id);
    setGecmis(list);
  }, []);

  const smmKes = useCallback(
    async (odemeId: number) => {
      const res = await window.api.vekaletSmmKesildi(odemeId);
      if (!res.ok) {
        const msg = res.error ?? "SMM güncellenemedi";
        setFormErr(msg);
        showToast("error", msg);
        return;
      }
      if (gecmisTaksit) {
        const list = await window.api.vekaletTaksitOdemeGecmisi(gecmisTaksit.id);
        setGecmis(list);
      }
      notifyOverviewRefresh();
      await yukle();
    },
    [gecmisTaksit, yukle, showToast],
  );

  const silTaksitIste = useCallback(
    (t: VekaletTaksit) => {
      if (siliniyor || saving) return;
      setFormErr(null);
      setSilinecekTaksit(t);
    },
    [siliniyor, saving],
  );

  const silTaksitIptal = useCallback(() => {
    if (siliniyor) return;
    setSilinecekTaksit(null);
  }, [siliniyor]);

  const silTaksitOnayla = useCallback(async () => {
    if (!silinecekTaksit || siliniyor) return;
    const id = silinecekTaksit.id;
    setFormErr(null);
    setSiliniyor(true);
    try {
      const res = await window.api.vekaletTaksitSil(id);
      if (!res.ok) {
        const msg = res.error ?? "Silinemedi";
        setFormErr(msg);
        showToast("error", msg);
        return;
      }
      setSilinecekTaksit(null);
      showToast("success", "Taksit silindi.");
      await yukle();
    } catch {
      const msg = "Taksit silinemedi.";
      setFormErr(msg);
      showToast("error", msg);
    } finally {
      setSiliniyor(false);
    }
  }, [silinecekTaksit, siliniyor, yukle, showToast]);

  const tekTaksitAc = useCallback(() => {
    if (!vekalet || vekalet.anlasilanTutar <= 0 || yeniTaksitEngeli || siliniyor) return;
    setFormErr(null);
    setSilinecekTaksit(null);
    setTaksitFormKey((k) => k + 1);
    setTaksitOpen(true);
  }, [vekalet, yeniTaksitEngeli, siliniyor]);

  const smmKesTablodan = useCallback(
    async (odemeId: number) => {
      await smmKes(odemeId);
    },
    [smmKes],
  );

  const guvenliIptalAc = useCallback(async (t: VekaletTaksit, odemeId?: number) => {
    setFormErr(null);
    setGuvenliIptalTaksit(t);
    setGuvenliIptalOdemeId(odemeId ?? null);
    const list = await window.api.vekaletTaksitOdemeGecmisi(t.id);
    setGuvenliIptalOdemeler(list);
  }, []);

  const guvenliIptalKapat = useCallback(() => {
    if (guvenliIptalSaving) return;
    setGuvenliIptalTaksit(null);
    setGuvenliIptalOdemeId(null);
    setGuvenliIptalOdemeler([]);
  }, [guvenliIptalSaving]);

  const guvenliIptalTaksitOnay = useCallback(
    async (payload: { sifre: string; silmeNedeni: string }) => {
      if (!guvenliIptalTaksit) return;
      setGuvenliIptalSaving(true);
      setFormErr(null);
      try {
        const res = await window.api.vekaletGuvenliSilTaksit(guvenliIptalTaksit.id, payload);
        if (!res.ok) {
          setFormErr(res.error);
          showToast("error", res.error);
          return;
        }
        showToast("success", res.auditMessage ?? "Taksit iptal edildi.");
        guvenliIptalKapat();
        notifyOverviewRefresh();
        await yukle();
      } finally {
        setGuvenliIptalSaving(false);
      }
    },
    [guvenliIptalTaksit, guvenliIptalKapat, yukle, showToast],
  );

  const guvenliIptalTahsilatOnay = useCallback(
    async (odemeId: number, payload: { sifre: string; silmeNedeni: string }) => {
      setGuvenliIptalSaving(true);
      setFormErr(null);
      try {
        const res = await window.api.vekaletGuvenliSilTahsilat(odemeId, payload);
        if (!res.ok) {
          setFormErr(res.error);
          showToast("error", res.error);
          return;
        }
        showToast("success", res.auditMessage ?? "Tahsilat iptal edildi.");
        if (gecmisTaksit) {
          const list = await window.api.vekaletTaksitOdemeGecmisi(gecmisTaksit.id);
          setGecmis(list);
        }
        guvenliIptalKapat();
        notifyOverviewRefresh();
        await yukle();
      } finally {
        setGuvenliIptalSaving(false);
      }
    },
    [gecmisTaksit, guvenliIptalKapat, yukle, showToast],
  );

  return {
    vekalet,
    taksitler,
    smmBekleyenCount,
    loading,
    ozet,
    mevcutTaksitToplam,
    kalanTaksitlendirme,
    taksitAsimi,
    yeniTaksitEngeli,
    acikTaksitVar,
    odemeBulunanTaksitVar,
    formErr,
    saving,
    siliniyor,
    inlineErrGoster,
    ucretOpen,
    setUcretOpen,
    taksitOpen,
    setTaksitOpen,
    planOpen,
    setPlanOpen,
    duzenleTaksit,
    setDuzenleTaksit,
    odemeTaksit,
    setOdemeTaksit,
    gecmisTaksit,
    setGecmisTaksit,
    gecmis,
    silinecekTaksit,
    taksitFormKey,
    topluSilOpen,
    setTopluSilOpen,
    yukle,
    vekaletMakbuzAc,
    tumTaksitleriSil,
    topluSilAc,
    taksitPlaniniKaydet,
    kaydetUcret,
    kaydetTaksit,
    kaydetTaksitDuzenle,
    kaydetOdeme,
    acGecmis,
    smmKes,
    smmKesTablodan,
    silTaksitIste,
    silTaksitIptal,
    silTaksitOnayla,
    tekTaksitAc,
    guvenliIptalTaksit,
    guvenliIptalOdemeId,
    guvenliIptalOdemeler,
    guvenliIptalSaving,
    guvenliIptalAc,
    guvenliIptalKapat,
    guvenliIptalTaksitOnay,
    guvenliIptalTahsilatOnay,
  };
}

export type UseVekaletTaksitReturn = ReturnType<typeof useVekaletTaksit>;
