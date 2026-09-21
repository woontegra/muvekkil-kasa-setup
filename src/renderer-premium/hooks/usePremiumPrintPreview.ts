import { useCallback, useEffect, useState } from "react";
import type { HtmlToPdfOpts } from "../lib/raporTypes";

export function usePremiumPrintPreview(html: string | null, opts: HtmlToPdfOpts) {
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!html) {
      setPdfBase64(null);
      setPdfError(null);
      return;
    }
    let cancelled = false;
    setPdfLoading(true);
    setPdfError(null);
    setPdfBase64(null);

    void (async () => {
      try {
        if (!window.api?.printHtmlToPdf) {
          if (!cancelled) setPdfError("PDF önizleme servisi kullanılamıyor.");
          return;
        }
        const r = await window.api.printHtmlToPdf({
          html,
          page: opts.page,
          landscape: opts.landscape,
        });
        if (cancelled) return;
        if (!r.ok) {
          setPdfError(r.error ?? "PDF oluşturulamadı.");
          return;
        }
        setPdfBase64(r.pdfBase64);
      } catch {
        if (!cancelled) setPdfError("PDF oluşturulamadı.");
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [html, opts.page, opts.landscape]);

  const yazdir = useCallback(async (): Promise<boolean> => {
    if (!pdfBase64 || !window.api?.printPdf) return false;
    setPrinting(true);
    try {
      const r = await window.api.printPdf({ pdfBase64, landscape: opts.landscape });
      return r.ok;
    } finally {
      setPrinting(false);
    }
  }, [pdfBase64, opts.landscape]);

  return {
    pdfBase64,
    pdfLoading,
    pdfError,
    printing,
    hazir: !!pdfBase64 && !pdfLoading,
    yazdir,
  };
}
