import { useCallback, useEffect, useRef, useState } from "react";
import type { Dosya } from "@shared/types/dosya";
import type { Muvekkil } from "@shared/types/muvekkil";
import { muvekkilGorunenAd } from "../lib/muvekkil";

export function useRaporMuvekkilDosya() {
  const [muvekkilQ, setMuvekkilQ] = useState("");
  const [muvekkiller, setMuvekkiller] = useState<Muvekkil[]>([]);
  const [muvekkilLoading, setMuvekkilLoading] = useState(false);
  const [muvekkilError, setMuvekkilError] = useState<string | null>(null);
  const [muvekkilId, setMuvekkilIdState] = useState<number | "">("");

  const [dosyalar, setDosyalar] = useState<Dosya[]>([]);
  const [dosyaLoading, setDosyaLoading] = useState(false);
  const [dosyaError, setDosyaError] = useState<string | null>(null);
  const [dosyaId, setDosyaIdState] = useState<number | "">("");

  const loadSeq = useRef(0);

  const yukleMuvekkiller = useCallback(async (q: string) => {
    const seq = ++loadSeq.current;
    setMuvekkilLoading(true);
    setMuvekkilError(null);
    try {
      const r = await window.api.muvekkilAraPaged(q.trim(), 1, 100);
      if (seq !== loadSeq.current) return;
      setMuvekkiller(r.items ?? []);
    } catch {
      if (seq !== loadSeq.current) return;
      setMuvekkilError("Müvekkil listesi yüklenemedi.");
      setMuvekkiller([]);
    } finally {
      if (seq === loadSeq.current) setMuvekkilLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void yukleMuvekkiller(muvekkilQ);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [muvekkilQ, yukleMuvekkiller]);

  const setMuvekkilId = useCallback((id: number | "") => {
    setMuvekkilIdState(id);
    setDosyaIdState("");
    setDosyalar([]);
    setDosyaError(null);
  }, []);

  useEffect(() => {
    if (muvekkilId === "") {
      setDosyalar([]);
      setDosyaIdState("");
      return;
    }
    let cancelled = false;
    setDosyaLoading(true);
    setDosyaError(null);
    void (async () => {
      try {
        const rows = await window.api.dosyaList(muvekkilId);
        if (cancelled) return;
        setDosyalar(Array.isArray(rows) ? rows : []);
      } catch {
        if (cancelled) return;
        setDosyaError("Dosya listesi yüklenemedi.");
        setDosyalar([]);
      } finally {
        if (!cancelled) setDosyaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [muvekkilId]);

  const setDosyaId = useCallback((id: number | "") => {
    setDosyaIdState(id);
  }, []);

  const seciliMuvekkil = muvekkiller.find((m) => m.id === muvekkilId) ?? null;
  const seciliDosya = dosyalar.find((d) => d.id === dosyaId) ?? null;

  return {
    muvekkilQ,
    setMuvekkilQ,
    muvekkiller,
    muvekkilLoading,
    muvekkilError,
    muvekkilId,
    setMuvekkilId,
    seciliMuvekkil,
    muvekkilEtiket: seciliMuvekkil ? muvekkilGorunenAd(seciliMuvekkil) : "",
    dosyalar,
    dosyaLoading,
    dosyaError,
    dosyaId,
    setDosyaId,
    seciliDosya,
    yukleMuvekkiller,
  };
}
