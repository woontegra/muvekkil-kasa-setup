import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { PremiumPrintPreviewShell } from "../../components/print/PremiumPrintPreviewShell";
import { buildMuvekkilEkstrePrintHtml } from "../../lib/muvekkilEkstrePrintHtml";

type PrintNavState = { autoPrint?: boolean };

export function PremiumMuvekkilEkstrePrintPage() {
  const { dosyaId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const autoPrint = Boolean((location.state as PrintNavState | null)?.autoPrint);
  const did = Number(dosyaId);
  const itibariyle = searchParams.get("itibariyle") ?? undefined;

  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);

  const pdfOpts = useMemo(() => ({ page: "A4" as const, landscape: false }), []);

  const yukle = useCallback(async () => {
    if (!Number.isFinite(did) || !window.api) return;
    setYukleniyor(true);
    setHata(null);
    setHtml(null);
    try {
      const r = await window.api.dosyaMuvekkilEkstre(did, { itibariyleTarih: itibariyle });
      if (!r.ok) {
        setHata(r.mesaj ?? r.error ?? "Ekstre yüklenemedi");
        return;
      }
      setHtml(buildMuvekkilEkstrePrintHtml(r.data));
    } catch {
      setHata("Ekstre yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  }, [did, itibariyle]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  if (!Number.isFinite(did)) {
    return (
      <div className="pm-print-page">
        <p className="pm-form-error">Geçersiz önizleme adresi.</p>
      </div>
    );
  }

  return (
    <PremiumPrintPreviewShell
      title="Müvekkil ekstresi"
      html={html}
      loading={yukleniyor}
      loadError={hata}
      pdfOpts={pdfOpts}
      autoPrint={autoPrint}
    />
  );
}
