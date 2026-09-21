import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { KasaHareket } from "@shared/types/kasa";
import { PremiumFormField } from "../auth/PremiumFormField";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { useRaporActions } from "../../hooks/useRaporActions";
import { useRaporMuvekkilDosya } from "../../hooks/useRaporMuvekkilDosya";
import { formatDateTr, formatTry } from "../../lib/format";
import { hareketAciklamaMasraf, kasaMakbuzGosterilebilir, tipEtiket } from "../../lib/kasa";
import { muvekkilGorunenAd } from "../../lib/muvekkil";
import { yukleKasaMakbuzHtml } from "../../lib/raporPrintHtml";
import { indirPdfFromHtml } from "../../lib/raporOutput";
import { kasaMakbuzUrl, type RaporPrintNavState } from "../../lib/raporRoutes";
import { RaporMuvekkilDosyaFields } from "./RaporMuvekkilDosyaFields";
import { RaporActionButtons, RaporSectionFrame } from "./RaporSectionFrame";

export function RaporKasaMakbuzSection() {
  const navigate = useNavigate();
  const { showToast } = usePremiumToast();
  const { busy, run } = useRaporActions(showToast);
  const md = useRaporMuvekkilDosya();
  const [hareketler, setHareketler] = useState<KasaHareket[]>([]);
  const [hareketLoading, setHareketLoading] = useState(false);
  const [hareketError, setHareketError] = useState<string | null>(null);
  const [hareketId, setHareketId] = useState<number | "">("");
  const [hareketHata, setHareketHata] = useState<string | null>(null);

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

  const makbuzHareketler = useMemo(() => hareketler.filter(kasaMakbuzGosterilebilir), [hareketler]);

  useEffect(() => {
    setHareketId("");
    setHareketHata(null);
    if (md.dosyaId === "") {
      setHareketler([]);
      return;
    }
    let cancelled = false;
    setHareketLoading(true);
    setHareketError(null);
    void (async () => {
      try {
        const rows = await window.api.kasaList(md.dosyaId as number);
        if (cancelled) return;
        setHareketler(Array.isArray(rows) ? rows : []);
      } catch {
        if (cancelled) return;
        setHareketError("Kasa hareketleri yüklenemedi.");
        setHareketler([]);
      } finally {
        if (!cancelled) setHareketLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [md.dosyaId]);

  function validate(): boolean {
    if (md.muvekkilId === "") {
      showToast("error", "Müvekkil seçin.");
      return false;
    }
    if (md.dosyaId === "") {
      showToast("error", "Dosya seçin.");
      return false;
    }
    if (hareketId === "") {
      setHareketHata("Kasa hareketi seçin.");
      showToast("error", "Hareket veya ödeme seçilmeden makbuz üretilemez.");
      return false;
    }
    setHareketHata(null);
    return true;
  }

  async function paketDogrula(id: number): Promise<boolean> {
    const r = await window.api.makbuzYazdirmaPaketi(id);
    if (!r.ok) {
      showToast("error", r.mesaj ?? r.error ?? "Makbuz hazırlanamadı.");
      return false;
    }
    return true;
  }

  function onizle() {
    if (!validate()) return;
    const id = hareketId as number;
    void (async () => {
      if (!(await paketDogrula(id))) return;
      navigate(kasaMakbuzUrl(id));
      showToast("success", "Önizleme açıldı.");
    })();
  }

  async function pdfIndir() {
    if (!validate()) return;
    const id = hareketId as number;
    await run(async () => {
      const r = await yukleKasaMakbuzHtml(id);
      if (!r.ok) {
        showToast("error", r.error);
        return;
      }
      const saved = await indirPdfFromHtml(r.html, `kasa-makbuzu-${id}.pdf`, { page: "A5", landscape: true });
      if (saved.ok) showToast("success", "PDF başarıyla oluşturuldu.");
      else showToast("error", saved.error);
    });
  }

  function yazdir() {
    if (!validate()) return;
    const id = hareketId as number;
    void (async () => {
      if (!(await paketDogrula(id))) return;
      navigate(kasaMakbuzUrl(id), { state: { autoPrint: true } satisfies RaporPrintNavState });
    })();
  }

  return (
    <RaporSectionFrame
      title="Kasa Makbuzu"
      description="Onaylı avans, masraf veya düzeltme hareketleri için tahsilat makbuzu oluşturun."
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
      <PremiumFormField label="Kasa hareketi" htmlFor="pm-rapor-kasa-hareket" error={hareketHata ?? hareketError}>
        <select
          id="pm-rapor-kasa-hareket"
          className="pm-input pm-stagger-item"
          value={hareketId === "" ? "" : String(hareketId)}
          onChange={(e) => {
            setHareketHata(null);
            setHareketId(e.target.value ? Number(e.target.value) : "");
          }}
          disabled={busy || hareketLoading || md.dosyaId === ""}
          style={{ animationDelay: "160ms" }}
        >
          <option value="">
            {md.dosyaId === ""
              ? "Önce dosya seçin"
              : hareketLoading
                ? "Yükleniyor…"
                : makbuzHareketler.length === 0
                  ? "Makbuz üretilebilir hareket yok"
                  : "Hareket seçin"}
          </option>
          {makbuzHareketler.map((h) => (
            <option key={h.id} value={h.id}>
              {formatDateTr(h.tarih)} · {tipEtiket(h.islemTipi)} · {formatTry(h.tutar)} · {hareketAciklamaMasraf(h)}
            </option>
          ))}
        </select>
      </PremiumFormField>
      <RaporActionButtons
        busy={busy}
        disabled={hareketId === ""}
        onPreview={onizle}
        onPdf={() => void pdfIndir()}
        onPrint={yazdir}
      />
    </RaporSectionFrame>
  );
}
