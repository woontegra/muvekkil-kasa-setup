import { useCallback, useEffect, useState } from "react";
import type { OnizlemeOlcek } from "../components/print/BelgeOnizlemeCanvas";
import { handlePrintResult, htmlToPdfDocument, silentPrintPdf } from "../lib/printDocument";
import { useBelgeYazicilar } from "./useBelgeYazicilar";

type Defaults = { page: "A4" | "A5"; landscape: boolean };

export function useBelgeOnizleme(defaults: Defaults) {
  const [sourceHtml, setSourceHtml] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfOlusturuluyor, setPdfOlusturuluyor] = useState(false);
  const [pdfHata, setPdfHata] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [visiblePage, setVisiblePage] = useState(1);
  const [yazdiriliyor, setYazdiriliyor] = useState(false);
  const [basariMesaji, setBasariMesaji] = useState<string | null>(null);
  const [kopya, setKopya] = useState(1);
  const [olcek, setOlcek] = useState<OnizlemeOlcek>("sigdir");
  const [kagit, setKagit] = useState<"A4" | "A5">(defaults.page);
  const [yatay, setYatay] = useState(defaults.landscape);

  const { yazicilar, seciliYazici, setSeciliYazici } = useBelgeYazicilar(true);

  const resetPdf = useCallback(() => {
    setSourceHtml(null);
    setPdfBase64(null);
    setPageCount(0);
    setVisiblePage(1);
    setPdfOlusturuluyor(false);
    setPdfHata(null);
  }, []);
  useEffect(() => {
    setKagit(defaults.page);
    setYatay(defaults.landscape);
  }, [defaults.page, defaults.landscape]);

  useEffect(() => {
    if (!sourceHtml) return;
    let cancelled = false;
    setPdfOlusturuluyor(true);
    setPdfBase64(null);
    setPageCount(0);
    setVisiblePage(1);
    setPdfHata(null);

    void (async () => {
      try {
        const r = await htmlToPdfDocument(sourceHtml, { page: kagit, landscape: yatay });
        if (cancelled) return;
        if (!r.ok) {
          setPdfHata(r.error ?? "PDF oluşturulamadı");
          return;
        }
        setPdfBase64(r.pdfBase64);
        setPageCount(r.pageCount);
      } catch {
        if (!cancelled) setPdfHata("PDF oluşturulamadı");
      } finally {
        if (!cancelled) setPdfOlusturuluyor(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceHtml, kagit, yatay]);

  const yazdir = useCallback(async () => {
    if (!pdfBase64) return;
    setYazdiriliyor(true);
    setBasariMesaji(null);
    try {
      const r = await silentPrintPdf({
        pdfBase64,
        deviceName: seciliYazici || undefined,
        copies: kopya,
        landscape: yatay,
      });
      handlePrintResult(r, (msg) => {
        setBasariMesaji(msg);
        window.setTimeout(() => setBasariMesaji(null), 2500);
      });
    } finally {
      setYazdiriliyor(false);
    }
  }, [pdfBase64, seciliYazici, kopya, yatay]);

  const hazir = !!pdfBase64 && !pdfOlusturuluyor;

  return {
    sourceHtml,
    setSourceHtml,
    pdfBase64,
    pdfOlusturuluyor,
    pageCount,
    visiblePage,
    setPageCount,
    setVisiblePage,
    yazdiriliyor,
    basariMesaji,
    kopya,
    setKopya,
    olcek,
    setOlcek,
    kagit,
    setKagit,
    yatay,
    setYatay,
    yazicilar,
    seciliYazici,
    setSeciliYazici,
    resetPdf,
    yazdir,
    hazir,
    pdfHata,
  };
}
