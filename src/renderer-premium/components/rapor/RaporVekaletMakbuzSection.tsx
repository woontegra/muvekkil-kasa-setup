import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { VekaletTaksit, VekaletTaksitOdeme } from "@shared/types/vekalet";
import { PremiumFormField } from "../auth/PremiumFormField";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { useRaporActions } from "../../hooks/useRaporActions";
import { useRaporMuvekkilDosya } from "../../hooks/useRaporMuvekkilDosya";
import { formatDateTr, formatTry } from "../../lib/format";
import { muvekkilGorunenAd } from "../../lib/muvekkil";
import { yukleVekaletMakbuzHtml } from "../../lib/raporPrintHtml";
import { indirPdfFromHtml } from "../../lib/raporOutput";
import { vekaletMakbuzUrl, type RaporPrintNavState } from "../../lib/raporRoutes";
import { RaporMuvekkilDosyaFields } from "./RaporMuvekkilDosyaFields";
import { RaporActionButtons, RaporSectionFrame } from "./RaporSectionFrame";

type OdemeSatir = VekaletTaksitOdeme & { taksitNo: number };

export function RaporVekaletMakbuzSection() {
  const navigate = useNavigate();
  const { showToast } = usePremiumToast();
  const { busy, run } = useRaporActions(showToast);
  const md = useRaporMuvekkilDosya();
  const [odemeler, setOdemeler] = useState<OdemeSatir[]>([]);
  const [odemeLoading, setOdemeLoading] = useState(false);
  const [odemeError, setOdemeError] = useState<string | null>(null);
  const [odemeId, setOdemeId] = useState<number | "">("");
  const [odemeHata, setOdemeHata] = useState<string | null>(null);

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

  useEffect(() => {
    setOdemeId("");
    setOdemeHata(null);
    if (md.dosyaId === "" || md.muvekkilId === "") {
      setOdemeler([]);
      return;
    }
    let cancelled = false;
    setOdemeLoading(true);
    setOdemeError(null);
    void (async () => {
      try {
        const vekalet = await window.api.vekaletGetOrCreate(md.dosyaId as number, md.muvekkilId as number);
        const taksitler: VekaletTaksit[] = await window.api.vekaletTaksitList(vekalet.id);
        const odemeSatirlari: OdemeSatir[] = [];
        for (const t of taksitler) {
          if ((t.odenenToplam ?? 0) <= 0) continue;
          const gecmis = await window.api.vekaletTaksitOdemeGecmisi(t.id);
          for (const o of gecmis) {
            odemeSatirlari.push({ ...o, taksitNo: t.taksitNo });
          }
        }
        if (cancelled) return;
        odemeSatirlari.sort((a, b) => (b.odemeTarihi > a.odemeTarihi ? 1 : -1));
        setOdemeler(odemeSatirlari);
      } catch {
        if (cancelled) return;
        setOdemeError("Ödeme kayıtları yüklenemedi.");
        setOdemeler([]);
      } finally {
        if (!cancelled) setOdemeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [md.dosyaId, md.muvekkilId]);

  function validate(): boolean {
    if (md.muvekkilId === "") {
      showToast("error", "Müvekkil seçin.");
      return false;
    }
    if (md.dosyaId === "") {
      showToast("error", "Dosya seçin.");
      return false;
    }
    if (odemeId === "") {
      setOdemeHata("Vekalet ödeme kaydı seçin.");
      showToast("error", "Hareket veya ödeme seçilmeden makbuz üretilemez.");
      return false;
    }
    setOdemeHata(null);
    return true;
  }

  async function paketDogrula(id: number): Promise<boolean> {
    const r = await window.api.getVekaletPrintPackageByOdemeId(id);
    if (!r.ok) {
      showToast("error", r.mesaj ?? r.error ?? "Makbuz hazırlanamadı.");
      return false;
    }
    return true;
  }

  function onizle() {
    if (!validate()) return;
    const id = odemeId as number;
    void (async () => {
      if (!(await paketDogrula(id))) return;
      navigate(vekaletMakbuzUrl(id));
      showToast("success", "Önizleme açıldı.");
    })();
  }

  async function pdfIndir() {
    if (!validate()) return;
    const id = odemeId as number;
    await run(async () => {
      const r = await yukleVekaletMakbuzHtml(id);
      if (!r.ok) {
        showToast("error", r.error);
        return;
      }
      const saved = await indirPdfFromHtml(r.html, `vekalet-makbuzu-${id}.pdf`, { page: "A5", landscape: true });
      if (saved.ok) showToast("success", "PDF başarıyla oluşturuldu.");
      else showToast("error", saved.error);
    });
  }

  function yazdir() {
    if (!validate()) return;
    const id = odemeId as number;
    void (async () => {
      if (!(await paketDogrula(id))) return;
      navigate(vekaletMakbuzUrl(id), { state: { autoPrint: true } satisfies RaporPrintNavState });
    })();
  }

  return (
    <RaporSectionFrame
      title="Vekalet Ödeme Makbuzu"
      description="Vekalet taksit ödemeleri için tahsilat makbuzu oluşturun."
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
        onDosyaIdChange={md.setDosyaId}
        dosyalar={dosyaOptions}
        dosyaLoading={md.dosyaLoading}
        dosyaError={md.dosyaError}
      />
      <PremiumFormField label="Ödeme kaydı" htmlFor="pm-rapor-vekalet-odeme" error={odemeHata ?? odemeError}>
        <select
          id="pm-rapor-vekalet-odeme"
          className="pm-input pm-stagger-item"
          value={odemeId === "" ? "" : String(odemeId)}
          onChange={(e) => {
            setOdemeHata(null);
            setOdemeId(e.target.value ? Number(e.target.value) : "");
          }}
          disabled={busy || odemeLoading || md.dosyaId === ""}
          style={{ animationDelay: "160ms" }}
        >
          <option value="">
            {md.dosyaId === ""
              ? "Önce dosya seçin"
              : odemeLoading
                ? "Yükleniyor…"
                : odemeler.length === 0
                  ? "Makbuz üretilebilir ödeme yok"
                  : "Ödeme kaydı seçin"}
          </option>
          {odemeler.map((o) => (
            <option key={o.id} value={o.id}>
              {formatDateTr(o.odemeTarihi)} · Taksit #{o.taksitNo} · {formatTry(o.tutar)}
              {o.makbuzNo ? ` · Makbuz ${o.makbuzNo}` : ""}
            </option>
          ))}
        </select>
      </PremiumFormField>
      <RaporActionButtons
        busy={busy}
        disabled={odemeId === ""}
        onPreview={onizle}
        onPdf={() => void pdfIndir()}
        onPrint={yazdir}
      />
    </RaporSectionFrame>
  );
}
