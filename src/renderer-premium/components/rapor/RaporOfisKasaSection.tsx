import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PremiumFormField } from "../auth/PremiumFormField";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { useRaporActions } from "../../hooks/useRaporActions";
import { useRaporDateRange } from "../../hooks/useRaporDateRange";
import { yukleOfisKasaRaporHtml } from "../../lib/raporPrintHtml";
import { ofisKasaRaporUrl, type RaporPrintNavState } from "../../lib/raporRoutes";
import { indirPdfFromHtml, validateTarihAraligi } from "../../lib/raporOutput";
import { RaporActionButtons, RaporSectionFrame } from "./RaporSectionFrame";

export function RaporOfisKasaSection() {
  const navigate = useNavigate();
  const { showToast } = usePremiumToast();
  const { busy, run } = useRaporActions(showToast);
  const { bas, bit, setBas, setBit } = useRaporDateRange();
  const [tarihHata, setTarihHata] = useState<string | null>(null);

  function validate(): boolean {
    const err = validateTarihAraligi(bas, bit);
    setTarihHata(err);
    if (err) showToast("error", err);
    return !err;
  }

  function onizle() {
    if (!validate()) return;
    navigate(ofisKasaRaporUrl(bas, bit));
    showToast("success", "Önizleme açıldı.");
  }

  async function pdfIndir() {
    if (!validate()) return;
    await run(async () => {
      const r = await yukleOfisKasaRaporHtml(bas, bit);
      if (!r.ok) {
        showToast("error", r.error);
        return;
      }
      const saved = await indirPdfFromHtml(r.html, `ofis-kasa-raporu-${bas}-${bit}.pdf`, {
        page: "A4",
        landscape: false,
      });
      if (saved.ok) showToast("success", "PDF başarıyla oluşturuldu.");
      else showToast("error", saved.error);
    });
  }

  function yazdir() {
    if (!validate()) return;
    navigate(ofisKasaRaporUrl(bas, bit), { state: { autoPrint: true } satisfies RaporPrintNavState });
  }

  return (
    <RaporSectionFrame
      title="Ofis Kasası Raporu"
      description="Seçili tarih aralığındaki ofis kasa hareketleri ve dönem özetini görüntüleyin."
    >
      <div className="pm-rapor-form-grid">
        <PremiumFormField label="Başlangıç tarihi" htmlFor="pm-rapor-ofis-bas" error={tarihHata}>
          <input
            id="pm-rapor-ofis-bas"
            type="date"
            className="pm-input pm-stagger-item"
            value={bas}
            onChange={(e) => {
              setTarihHata(null);
              setBas(e.target.value);
            }}
            disabled={busy}
          />
        </PremiumFormField>
        <PremiumFormField label="Bitiş tarihi" htmlFor="pm-rapor-ofis-bit">
          <input
            id="pm-rapor-ofis-bit"
            type="date"
            className="pm-input pm-stagger-item"
            value={bit}
            onChange={(e) => {
              setTarihHata(null);
              setBit(e.target.value);
            }}
            disabled={busy}
            style={{ animationDelay: "60ms" }}
          />
        </PremiumFormField>
      </div>
      <RaporActionButtons busy={busy} onPreview={onizle} onPdf={() => void pdfIndir()} onPrint={yazdir} />
    </RaporSectionFrame>
  );
}
