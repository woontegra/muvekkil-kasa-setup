import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { useRaporActions } from "../../hooks/useRaporActions";
import { useRaporMuvekkilDosya } from "../../hooks/useRaporMuvekkilDosya";
import { muvekkilGorunenAd } from "../../lib/muvekkil";
import { yukleHesapOzetHtml } from "../../lib/raporPrintHtml";
import { indirPdfFromHtml } from "../../lib/raporOutput";
import { hesapOzetUrl, type RaporPrintNavState } from "../../lib/raporRoutes";
import { RaporMuvekkilDosyaFields } from "./RaporMuvekkilDosyaFields";
import { RaporActionButtons, RaporSectionFrame } from "./RaporSectionFrame";

export function RaporHesapOzetSection() {
  const navigate = useNavigate();
  const { showToast } = usePremiumToast();
  const { busy, run } = useRaporActions(showToast);
  const md = useRaporMuvekkilDosya();
  const [dosyaHata, setDosyaHata] = useState<string | null>(null);

  const muvekkilOptions = useMemo(
    () => md.muvekkiller.map((m) => ({ id: m.id, label: muvekkilGorunenAd(m) })),
    [md.muvekkiller],
  );

  const dosyaOptions = useMemo(
    () =>
      md.dosyalar.map((d) => ({
        id: d.id,
        label: (d.konuBasligi ?? "").trim() || `Dosya #${d.id}`,
      })),
    [md.dosyalar],
  );

  function validate(): boolean {
    if (md.muvekkilId === "") {
      showToast("error", "Müvekkil seçin.");
      return false;
    }
    if (md.dosyaId === "") {
      setDosyaHata("Dosya seçin.");
      showToast("error", "Dosya seçin.");
      return false;
    }
    setDosyaHata(null);
    return true;
  }

  function onizle() {
    if (!validate()) return;
    navigate(hesapOzetUrl(md.dosyaId as number));
    showToast("success", "Önizleme açıldı.");
  }

  async function pdfIndir() {
    if (!validate()) return;
    const dosyaId = md.dosyaId as number;
    await run(async () => {
      const r = await yukleHesapOzetHtml(dosyaId);
      if (!r.ok) {
        showToast("error", r.error);
        return;
      }
      const saved = await indirPdfFromHtml(r.html, `dosya-hesap-ozeti-${dosyaId}.pdf`, {
        page: "A4",
        landscape: false,
      });
      if (saved.ok) showToast("success", "PDF başarıyla oluşturuldu.");
      else showToast("error", saved.error);
    });
  }

  function yazdir() {
    if (!validate()) return;
    navigate(hesapOzetUrl(md.dosyaId as number), { state: { autoPrint: true } satisfies RaporPrintNavState });
  }

  return (
    <RaporSectionFrame
      title="Dosya Hesap Özeti"
      description="Seçilen dosyanın kasa özeti, avans/masraf toplamları ve hareket ekstresini yazdırın."
    >
      <RaporMuvekkilDosyaFields
        muvekkilQ={md.muvekkilQ}
        onMuvekkilQChange={md.setMuvekkilQ}
        muvekkilId={md.muvekkilId}
        onMuvekkilIdChange={md.setMuvekkilId}
        muvekkiller={muvekkilOptions}
        muvekkilLoading={md.muvekkilLoading}
        muvekkilError={md.muvekkilError}
        dosyaId={md.dosyaId}
        onDosyaIdChange={(id) => {
          setDosyaHata(null);
          md.setDosyaId(id);
        }}
        dosyalar={dosyaOptions}
        dosyaLoading={md.dosyaLoading}
        dosyaError={md.dosyaError}
        dosyaFieldError={dosyaHata}
      />
      <RaporActionButtons
        busy={busy}
        disabled={md.dosyaId === ""}
        onPreview={onizle}
        onPdf={() => void pdfIndir()}
        onPrint={yazdir}
      />
    </RaporSectionFrame>
  );
}
