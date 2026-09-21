import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ICRA_ALACAK_DURUM_ETIKET,
  ICRA_ALACAK_DURUM_KODLARI,
  ICRA_ALACAK_TURU_ETIKET,
  ICRA_ALACAK_TURU_KODLARI,
} from "@shared/constants/icraTahsilat";
import { PremiumFormField } from "../auth/PremiumFormField";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { useRaporActions } from "../../hooks/useRaporActions";
import { useRaporDateRange } from "../../hooks/useRaporDateRange";
import { yukleIcraRaporHtml } from "../../lib/raporPrintHtml";
import { indirPdfFromHtml, validateTarihAraligi } from "../../lib/raporOutput";
import { icraTahsilatRaporUrl, type RaporPrintNavState } from "../../lib/raporRoutes";
import { RaporActionButtons, RaporSectionFrame } from "./RaporSectionFrame";

export function RaporIcraSection() {
  const navigate = useNavigate();
  const { showToast } = usePremiumToast();
  const { busy, run } = useRaporActions(showToast);
  const { bas, bit, setBas, setBit } = useRaporDateRange();
  const [tur, setTur] = useState("TUMU");
  const [durum, setDurum] = useState("TUMU");
  const [q, setQ] = useState("");
  const [tarihHata, setTarihHata] = useState<string | null>(null);

  const filtre = { tarihBas: bas, tarihBit: bit, alacakTuru: tur, durum, q: q.trim() };

  function validate(): boolean {
    const err = validateTarihAraligi(bas, bit);
    setTarihHata(err);
    if (err) showToast("error", err);
    return !err;
  }

  function onizle() {
    if (!validate()) return;
    navigate(icraTahsilatRaporUrl(filtre));
    showToast("success", "Önizleme açıldı.");
  }

  async function pdfIndir() {
    if (!validate()) return;
    await run(async () => {
      const r = await yukleIcraRaporHtml(filtre);
      if (!r.ok) {
        showToast("error", r.error);
        return;
      }
      const saved = await indirPdfFromHtml(r.html, `icra-tahsilat-raporu-${bas}-${bit}.pdf`, {
        page: "A4",
        landscape: false,
      });
      if (saved.ok) showToast("success", "PDF başarıyla oluşturuldu.");
      else showToast("error", saved.error);
    });
  }

  function yazdir() {
    if (!validate()) return;
    navigate(icraTahsilatRaporUrl(filtre), { state: { autoPrint: true } satisfies RaporPrintNavState });
  }

  return (
    <RaporSectionFrame
      title="İcra Tahsilat Raporu"
      description="Alacak türü, durum ve arama filtreleriyle icra tahsilat listesini dışa aktarın."
    >
      <div className="pm-rapor-form-grid">
        <PremiumFormField label="Başlangıç tarihi" htmlFor="pm-rapor-icra-bas" error={tarihHata}>
          <input
            id="pm-rapor-icra-bas"
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
        <PremiumFormField label="Bitiş tarihi" htmlFor="pm-rapor-icra-bit">
          <input
            id="pm-rapor-icra-bit"
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
        <PremiumFormField label="Alacak türü" htmlFor="pm-rapor-icra-tur">
          <select
            id="pm-rapor-icra-tur"
            className="pm-input pm-stagger-item"
            value={tur}
            onChange={(e) => setTur(e.target.value)}
            disabled={busy}
            style={{ animationDelay: "100ms" }}
          >
            <option value="TUMU">Tümü</option>
            {ICRA_ALACAK_TURU_KODLARI.map((k) => (
              <option key={k} value={k}>
                {ICRA_ALACAK_TURU_ETIKET[k]}
              </option>
            ))}
          </select>
        </PremiumFormField>
        <PremiumFormField label="Durum" htmlFor="pm-rapor-icra-durum">
          <select
            id="pm-rapor-icra-durum"
            className="pm-input pm-stagger-item"
            value={durum}
            onChange={(e) => setDurum(e.target.value)}
            disabled={busy}
            style={{ animationDelay: "140ms" }}
          >
            <option value="TUMU">Tümü</option>
            {ICRA_ALACAK_DURUM_KODLARI.map((k) => (
              <option key={k} value={k}>
                {ICRA_ALACAK_DURUM_ETIKET[k]}
              </option>
            ))}
          </select>
        </PremiumFormField>
        <div className="pm-rapor-form-full pm-stagger-item" style={{ animationDelay: "180ms" }}>
          <PremiumFormField label="Arama" htmlFor="pm-rapor-icra-q">
            <input
              id="pm-rapor-icra-q"
              className="pm-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Borçlu, müvekkil veya dosya…"
              disabled={busy}
            />
          </PremiumFormField>
        </div>
      </div>
      <RaporActionButtons busy={busy} onPreview={onizle} onPdf={() => void pdfIndir()} onPrint={yazdir} />
    </RaporSectionFrame>
  );
}
