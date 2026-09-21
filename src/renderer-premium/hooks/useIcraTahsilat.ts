import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getActiveAccountingPeriodRange } from "@shared/lib/accountingPeriod";
import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";
import type { IcraTahsilatListeSatir, IcraTahsilatUstOzet } from "@shared/types/icraTahsilat";
import type { PremiumToastTone } from "../context/PremiumToastContext";
import { notifyOverviewRefresh } from "../lib/events";
import { ayBasiSonu } from "../lib/ofisKasa";

type ToastFn = (tone: PremiumToastTone, message: string) => void;

export function useIcraTahsilat(showToast: ToastFn) {
  const navigate = useNavigate();
  const loadSeq = useRef(0);
  const fallbackAy = useMemo(() => ayBasiSonu(), []);

  const [tb, setTb] = useState(fallbackAy.bas);
  const [te, setTe] = useState(fallbackAy.bit);
  const [tur, setTur] = useState("TUMU");
  const [durum, setDurum] = useState("TUMU");
  const [q, setQ] = useState("");

  const [ust, setUst] = useState<IcraTahsilatUstOzet | null>(null);
  const [ustLoading, setUstLoading] = useState(true);
  const [ustError, setUstError] = useState<string | null>(null);

  const [liste, setListe] = useState<IcraTahsilatListeSatir[]>([]);
  const [listeLoading, setListeLoading] = useState(true);
  const [listeError, setListeError] = useState<string | null>(null);

  const [alacakModalAcik, setAlacakModalAcik] = useState(false);
  const [detay, setDetay] = useState<IcraTahsilatListeSatir | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);

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
    if (!window.api?.icraTahsilatUstOzet) return;
    setUstLoading(true);
    setUstError(null);
    try {
      const r = await window.api.icraTahsilatUstOzet();
      setUst(r ?? null);
    } catch {
      setUstError("Alacak özeti yüklenemedi.");
      setUst(null);
    } finally {
      setUstLoading(false);
    }
  }, []);

  const yukleListe = useCallback(async () => {
    if (!window.api?.icraTahsilatList) return;
    const seq = ++loadSeq.current;
    setListeLoading(true);
    setListeError(null);
    try {
      const rows = await window.api.icraTahsilatList(filtre);
      if (seq !== loadSeq.current) return;
      setListe(Array.isArray(rows) ? rows : []);
    } catch {
      if (seq !== loadSeq.current) return;
      setListeError("Alacak listesi yüklenemedi.");
      setListe([]);
    } finally {
      if (seq === loadSeq.current) setListeLoading(false);
    }
  }, [filtre]);

  const yenile = useCallback(async () => {
    await Promise.all([yukleUst(), yukleListe()]);
  }, [yukleUst, yukleListe]);

  const applyPeriod = useCallback(async () => {
    try {
      const mode = (await window.api.getAccountingPeriodMode?.()) as AccountingPeriodMode | undefined;
      const range = getActiveAccountingPeriodRange(mode === "MONTHLY" ? "MONTHLY" : "YEARLY");
      setTb(range.bas);
      setTe(range.bit);
    } catch {
      /* fallback */
    }
  }, []);

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

  function onAlacakKaydedildi(id: number) {
    setHighlightId(id);
    showToast("success", "İcra tahsilat alacağı oluşturuldu.");
    notifyOverviewRefresh();
    void yenile();
  }

  function onDetayDegisti() {
    notifyOverviewRefresh();
    void yenile();
  }

  function raporYazdir() {
    const qs = new URLSearchParams({ bas: tb, bit: te, tur, durum, q: q.trim() });
    navigate(`/print/icra-tahsilat-raporu?${qs.toString()}`);
  }

  return {
    tb,
    setTb,
    te,
    setTe,
    tur,
    setTur,
    durum,
    setDurum,
    q,
    setQ,
    ust,
    ustLoading,
    ustError,
    liste,
    listeLoading,
    listeError,
    yukleUst,
    yukleListe,
    yenile,
    alacakModalAcik,
    setAlacakModalAcik,
    detay,
    setDetay,
    highlightId,
    onAlacakKaydedildi,
    onDetayDegisti,
    raporYazdir,
    showToast,
  };
}
