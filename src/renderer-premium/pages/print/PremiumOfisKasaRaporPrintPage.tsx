import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { ayBasiSonu } from "../../lib/ofisKasa";
import { formatDateTr } from "../../lib/format";
import { yukleOfisKasaRaporHtml } from "../../lib/raporPrintHtml";
import { PremiumPrintPreviewShell } from "../../components/print/PremiumPrintPreviewShell";

type PrintNavState = { autoPrint?: boolean };

export function PremiumOfisKasaRaporPrintPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const autoPrint = Boolean((location.state as PrintNavState | null)?.autoPrint);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);

  const { bas, bit } = useMemo(() => {
    const fallback = ayBasiSonu();
    return {
      bas: (params.get("bas") ?? fallback.bas).trim().slice(0, 10),
      bit: (params.get("bit") ?? fallback.bit).trim().slice(0, 10),
    };
  }, [params]);

  const yukle = useCallback(async () => {
    if (!window.api?.ofisKasaRaporPaketi) {
      setHata("Rapor servisi kullanılamıyor.");
      setYukleniyor(false);
      return;
    }
    setYukleniyor(true);
    setHata(null);
    setHtml(null);
    try {
      const loaded = await yukleOfisKasaRaporHtml(bas, bit);
      if (!loaded.ok) {
        setHata(loaded.error);
        return;
      }
      setHtml(loaded.html);
    } catch {
      setHata("Rapor verisi alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [bas, bit]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  return (
    <PremiumPrintPreviewShell
      title="Ofis kasa raporu"
      subtitle={`${formatDateTr(bas)} — ${formatDateTr(bit)}`}
      html={html}
      loading={yukleniyor}
      loadError={hata}
      pdfOpts={{ page: "A4", landscape: false }}
      autoPrint={autoPrint}
    />
  );
}
