import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePremiumPrintPreview } from "../../hooks/usePremiumPrintPreview";
import type { HtmlToPdfOpts } from "../../lib/raporTypes";

type Props = {
  title: string;
  subtitle?: string;
  html: string | null;
  loading?: boolean;
  loadError?: string | null;
  pdfOpts: HtmlToPdfOpts;
  autoPrint?: boolean;
};

export function PremiumPrintPreviewShell({
  title,
  subtitle,
  html,
  loading = false,
  loadError = null,
  pdfOpts,
  autoPrint = false,
}: Props) {
  const navigate = useNavigate();
  const autoPrintedRef = useRef(false);
  const { pdfBase64, pdfLoading, pdfError, printing, hazir, yazdir } = usePremiumPrintPreview(html, pdfOpts);

  useEffect(() => {
    if (!autoPrint || !hazir || autoPrintedRef.current) return;
    autoPrintedRef.current = true;
    void yazdir();
  }, [autoPrint, hazir, yazdir]);

  const hata = loadError ?? pdfError;
  const pdfUrl = pdfBase64 ? `data:application/pdf;base64,${pdfBase64}` : null;

  return (
    <div className="pm-print-page">
      <header className="pm-print-toolbar">
        <div>
          <h1 className="pm-print-title">{title}</h1>
          <p className="pm-muted">Yazdırma önizleme</p>
          {subtitle ? <p className="pm-muted pm-print-subtitle">{subtitle}</p> : null}
        </div>
        <div className="pm-print-actions">
          <button type="button" className="pm-btn pm-btn--ghost" onClick={() => navigate(-1)}>
            Geri
          </button>
          <button type="button" className="pm-btn" onClick={() => void yazdir()} disabled={!hazir || printing}>
            {printing ? "Yazdırılıyor…" : "Yazdır"}
          </button>
        </div>
      </header>
      <main className="pm-print-body">
        {loading ? <p className="pm-muted">Rapor yükleniyor…</p> : null}
        {pdfLoading ? <p className="pm-muted">PDF önizlemesi hazırlanıyor…</p> : null}
        {hata ? <p className="pm-form-error">{hata}</p> : null}
        {pdfUrl ? (
          <embed className="pm-print-preview" title="Önizleme" src={pdfUrl} type="application/pdf" />
        ) : null}
      </main>
    </div>
  );
}
