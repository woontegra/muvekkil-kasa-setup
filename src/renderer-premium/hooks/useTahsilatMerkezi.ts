import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  TahsilatMerkeziGorunumFilter,
  TahsilatMerkeziListeParams,
  TahsilatMerkeziOzet,
  TahsilatMerkeziSatir,
} from "@shared/types/tahsilatMerkezi";
import type { TaksitDurum, TaksitOdemeAlInput, VekaletTaksit } from "@shared/types/vekalet";
import type { PremiumToastTone } from "../context/PremiumToastContext";
import { notifyOverviewRefresh } from "../lib/events";

type ToastFn = (tone: PremiumToastTone, message: string) => void;

const PAGE_SIZE = 50;

export function useTahsilatMerkezi(showToast: ToastFn) {
  const navigate = useNavigate();
  const loadSeq = useRef(0);

  const [gorunum, setGorunum] = useState<TahsilatMerkeziGorunumFilter>("GECIKENLER");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [muvekkilId, setMuvekkilId] = useState<number | "">("");
  const [dosyaId, setDosyaId] = useState<number | "">("");
  const [durum, setDurum] = useState<TaksitDurum | "">("");
  const [vadeBas, setVadeBas] = useState("");
  const [vadeBit, setVadeBit] = useState("");
  const [page, setPage] = useState(1);

  const [ozet, setOzet] = useState<TahsilatMerkeziOzet | null>(null);
  const [ozetLoading, setOzetLoading] = useState(true);
  const [ozetError, setOzetError] = useState<string | null>(null);

  const [items, setItems] = useState<TahsilatMerkeziSatir[]>([]);
  const [total, setTotal] = useState(0);
  const [listeLoading, setListeLoading] = useState(true);
  const [listeError, setListeError] = useState<string | null>(null);

  const [odemeSatir, setOdemeSatir] = useState<TahsilatMerkeziSatir | null>(null);
  const [odemeSaving, setOdemeSaving] = useState(false);
  const [odemeError, setOdemeError] = useState<string | null>(null);
  const [smmSavingId, setSmmSavingId] = useState<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [gorunum, debouncedQ, muvekkilId, dosyaId, durum, vadeBas, vadeBit]);

  const listParams = useMemo((): TahsilatMerkeziListeParams => {
    const p: TahsilatMerkeziListeParams = {
      gorunum,
      page,
      limit: PAGE_SIZE,
    };
    if (debouncedQ) p.q = debouncedQ;
    if (muvekkilId !== "") p.muvekkilId = muvekkilId;
    if (dosyaId !== "") p.dosyaId = dosyaId;
    if (durum !== "") p.durum = durum;
    if (vadeBas) p.vadeBas = vadeBas;
    if (vadeBit) p.vadeBit = vadeBit;
    return p;
  }, [gorunum, debouncedQ, muvekkilId, dosyaId, durum, vadeBas, vadeBit, page]);

  const yukleOzet = useCallback(async () => {
    if (!window.api?.tahsilatMerkeziOzet) return;
    setOzetLoading(true);
    setOzetError(null);
    try {
      const r = await window.api.tahsilatMerkeziOzet();
      setOzet(r ?? null);
    } catch {
      setOzetError("Tahsilat özeti yüklenemedi.");
      setOzet(null);
    } finally {
      setOzetLoading(false);
    }
  }, []);

  const yukleListe = useCallback(async () => {
    if (!window.api?.tahsilatMerkeziList) return;
    const seq = ++loadSeq.current;
    setListeLoading(true);
    setListeError(null);
    try {
      const r = await window.api.tahsilatMerkeziList(listParams);
      if (seq !== loadSeq.current) return;
      setItems(Array.isArray(r.items) ? r.items : []);
      setTotal(Number(r.total ?? 0));
      setOzet(r.ozet ?? null);
    } catch {
      if (seq !== loadSeq.current) return;
      setListeError("Tahsilat listesi yüklenemedi.");
      setItems([]);
      setTotal(0);
    } finally {
      if (seq === loadSeq.current) setListeLoading(false);
    }
  }, [listParams]);

  const yenile = useCallback(async () => {
    await Promise.all([yukleOzet(), yukleListe()]);
  }, [yukleOzet, yukleListe]);

  useEffect(() => {
    void yukleOzet();
  }, [yukleOzet]);

  useEffect(() => {
    void yukleListe();
  }, [yukleListe]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function odemeKaydet(data: TaksitOdemeAlInput) {
    if (!odemeSatir || !window.api?.vekaletTaksitOdemeAl) return;
    setOdemeSaving(true);
    setOdemeError(null);
    try {
      const r = await window.api.vekaletTaksitOdemeAl(odemeSatir.id, data);
      if (!r.ok) {
        setOdemeError(r.error);
        return;
      }
      showToast("success", "Tahsilat kaydedildi.");
      setOdemeSatir(null);
      notifyOverviewRefresh();
      await yenile();
      if (r.row.taksit.smmBekleyenOdemeId != null) {
        showToast("info", "SMM kesildi işaretlemeyi unutmayın.");
      }
    } catch {
      setOdemeError("Ödeme kaydedilemedi.");
    } finally {
      setOdemeSaving(false);
    }
  }

  async function smmKes(odemeId: number) {
    if (!window.api?.vekaletSmmKesildi) return;
    setSmmSavingId(odemeId);
    try {
      const r = await window.api.vekaletSmmKesildi(odemeId);
      if (!r.ok) {
        showToast("error", r.error);
        return;
      }
      showToast("success", "SMM kesildi olarak işaretlendi.");
      notifyOverviewRefresh();
      await yenile();
    } catch {
      showToast("error", "SMM durumu güncellenemedi.");
    } finally {
      setSmmSavingId(null);
    }
  }

  function dosyayaGit(row: TahsilatMerkeziSatir) {
    navigate(`/muvekkil/${row.muvekkilId}/dosya/${row.dosyaId}`);
  }

  function odemeAc(row: TahsilatMerkeziSatir) {
    setOdemeError(null);
    setOdemeSatir(row);
  }

  const odemeTaksit: VekaletTaksit | null = odemeSatir?.taksit ?? null;

  return {
    gorunum,
    setGorunum,
    q,
    setQ,
    muvekkilId,
    setMuvekkilId,
    dosyaId,
    setDosyaId,
    durum,
    setDurum,
    vadeBas,
    setVadeBas,
    vadeBit,
    setVadeBit,
    page,
    setPage,
    totalPages,
    total,
    ozet,
    ozetLoading,
    ozetError,
    items,
    listeLoading,
    listeError,
    odemeSatir,
    setOdemeSatir,
    odemeTaksit,
    odemeSaving,
    odemeError,
    smmSavingId,
    yenile,
    yukleOzet,
    yukleListe,
    odemeKaydet,
    smmKes,
    dosyayaGit,
    odemeAc,
  };
}

export type UseTahsilatMerkeziReturn = ReturnType<typeof useTahsilatMerkezi>;
