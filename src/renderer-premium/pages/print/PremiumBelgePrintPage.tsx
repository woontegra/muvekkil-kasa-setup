import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import type { DosyaHesapOzetPaketi } from "@shared/types/hesapOzet";
import type { KasaMakbuzPaketi, VekaletMakbuzPaketi } from "@shared/types/makbuz";
import { formatDateTr, formatSignedTry, formatTry } from "../../lib/format";
import { hareketAciklamaMasraf, hareketKategori, odemeEtiket, onayBadgeMetni, tipEtiket } from "../../lib/kasa";
import { muvekkilGorunenAd } from "../../lib/muvekkil";
import { taksitDurumEtiket } from "../../lib/vekalet";
import { PremiumPrintPreviewShell } from "../../components/print/PremiumPrintPreviewShell";
import { formatMoney } from "@shared/lib/paraBirimi";

type Kind = "hesap-ozeti" | "kasa-makbuz" | "vekalet-makbuz";
type PrintNavState = { autoPrint?: boolean };

function useRoute(): { kind: Kind; id: number } | null {
  const { dosyaId, hareketId, odemeId } = useParams();
  return useMemo(() => {
    if (dosyaId && Number.isFinite(Number(dosyaId))) return { kind: "hesap-ozeti", id: Number(dosyaId) };
    if (hareketId && Number.isFinite(Number(hareketId))) return { kind: "kasa-makbuz", id: Number(hareketId) };
    if (odemeId && Number.isFinite(Number(odemeId))) return { kind: "vekalet-makbuz", id: Number(odemeId) };
    return null;
  }, [dosyaId, hareketId, odemeId]);
}

function hesapOzetHtml(p: Extract<DosyaHesapOzetPaketi, { ok: true }>): string {
  const vekaletPb = p.vekalet.paraBirimi;
  const rows = p.hareketler
    .map(
      (h) =>
        `<tr><td>${formatDateTr(h.tarih)}</td><td>${tipEtiket(h.islemTipi)}</td><td>${hareketKategori(h)}</td><td>${h.islemTipi === "DUZELTME" ? formatSignedTry(h.tutar) : formatTry(h.tutar)}</td><td>${hareketAciklamaMasraf(h)}</td><td>${onayBadgeMetni(h)}</td></tr>`,
    )
    .join("");
  const taksitRows = p.taksitler
    .map(
      (t) =>
        `<tr><td>${t.taksitNo}</td><td>${t.vadeTarihi ? formatDateTr(t.vadeTarihi) : "—"}</td><td>${formatMoney(t.tutar, t.paraBirimi)}</td><td>${taksitDurumEtiket(t.durum)}</td><td>${t.sonOdemeTarihi ? formatDateTr(t.sonOdemeTarihi) : "—"}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Dosya Hesap Özeti</title>
<style>body{font-family:Segoe UI,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px}th{background:#f4f4f4;text-align:left}h1{font-size:18px}</style></head><body>
<h1>DOSYA HESAP ÖZETİ / EKSTRE</h1>
<p>Düzenleme tarihi: ${formatDateTr(p.duzenlemeTarihi)}</p>
<p>Müvekkil: ${muvekkilGorunenAd(p.muvekkil)}</p>
<p>Dosya: ${(p.dosya.konuBasligi ?? "").trim() || "—"}</p>
<table><tbody>
<tr><th>Toplam alınan avans</th><td>${formatTry(p.kasaOzet.toplamAlinanAvans)}</td></tr>
<tr><th>Toplam yapılan masraf</th><td>${formatTry(p.kasaOzet.toplamYapilanMasraf)}</td></tr>
<tr><th>Düzeltmeler toplamı (net)</th><td>${formatSignedTry(p.kasaOzet.duzeltmelerNet)}</td></tr>
<tr><th>Kalan avans</th><td>${formatTry(p.kasaOzet.kalanAvans)}</td></tr>
</tbody></table>
<table><thead><tr><th>Tarih</th><th>Tip</th><th>Tür</th><th>Tutar</th><th>Açıklama</th><th>Onay</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Vekalet ücreti (${vekaletPb})</h2>
<table><tbody>
<tr><th>Anlaşılan vekalet ücreti</th><td>${formatMoney(p.vekaletOzet.anlasilanTutar, vekaletPb)}</td></tr>
<tr><th>Ödenen toplam</th><td>${formatMoney(p.vekaletOzet.odenenToplam, vekaletPb)}</td></tr>
<tr><th>Kalan vekalet ücreti</th><td>${formatMoney(p.vekaletOzet.kalanVekalet, vekaletPb)}</td></tr>
</tbody></table>
<table><thead><tr><th>Taksit no</th><th>Vade</th><th>Tutar</th><th>Durum</th><th>Ödeme tarihi</th></tr></thead><tbody>${taksitRows}</tbody></table>
<p>Dosya avans bakiyesi: ${formatTry(p.kasaOzet.kalanAvans)}</p>
<p>Kalan vekalet ücreti: ${formatMoney(p.vekaletOzet.kalanVekalet, vekaletPb)}</p>
</body></html>`;
}

function vekaletMakbuzHtml(p: Extract<VekaletMakbuzPaketi, { ok: true }>): string {
  const { odeme, muvekkil, dosya, taksit, vekalet, odenenToplam, kalanVekalet } = p;
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Vekalet Makbuzu</title>
<style>body{font-family:Segoe UI,sans-serif;padding:24px}h1{font-size:16px}</style></head><body>
<h1>VEKALET TAHSİLAT MAKBUZU</h1>
<p>Makbuz no: ${odeme.makbuzNo ?? "—"} · Tarih: ${formatDateTr(odeme.odemeTarihi)}</p>
<p>Müvekkil: ${muvekkilGorunenAd(muvekkil)}</p>
<p>Dosya: ${(dosya.konuBasligi ?? "").trim() || "—"}</p>
<p>Taksit #${taksit.taksitNo} · Taksit tutarı: ${formatMoney(taksit.tutar, taksit.paraBirimi)}</p>
<p>Bu makbuzdaki mahsup: ${formatMoney(odeme.tutar, odeme.alacakParaBirimi)}</p>
${odeme.odemeParaBirimi !== odeme.alacakParaBirimi ? `<p>Kasaya giren: ${formatMoney(odeme.kasaTutari, odeme.odemeParaBirimi)} · Kur: 1 ${odeme.alacakParaBirimi} = ${odeme.kur?.toFixed(8) ?? "—"} ${odeme.odemeParaBirimi}</p>` : ""}
<p>Anlaşılan vekalet: ${formatMoney(vekalet.anlasilanTutar, vekalet.paraBirimi)}</p>
<p>Ödenen toplam: ${formatMoney(odenenToplam, vekalet.paraBirimi)}</p>
<p>Kalan vekalet: ${formatMoney(kalanVekalet, vekalet.paraBirimi)}</p>
<p>Ödeme: ${odemeEtiket(odeme.odemeYontemi)}</p>
</body></html>`;
}

function makbuzHtml(p: Extract<KasaMakbuzPaketi, { ok: true }>): string {
  const { hareket, muvekkil, dosya } = p;
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Makbuz</title>
<style>body{font-family:Segoe UI,sans-serif;padding:24px}h1{font-size:16px}</style></head><body>
<h1>TAHSİLAT MAKBUZU</h1>
<p>Makbuz no: ${hareket.makbuzNo ?? "—"} · Tarih: ${formatDateTr(hareket.makbuzTarihi ?? hareket.tarih)}</p>
<p>Müvekkil: ${muvekkilGorunenAd(muvekkil)}</p>
<p>Dosya: ${(dosya.konuBasligi ?? "").trim() || "—"}</p>
<p>İşlem: ${tipEtiket(hareket.islemTipi)} · ${formatTry(hareket.tutar)}</p>
<p>Ödeme: ${odemeEtiket(hareket.odemeYontemi)}</p>
</body></html>`;
}

export function PremiumBelgePrintPage() {
  const route = useRoute();
  const location = useLocation();
  const autoPrint = Boolean((location.state as PrintNavState | null)?.autoPrint);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);

  const pdfOpts = useMemo(
    () =>
      route?.kind === "hesap-ozeti"
        ? ({ page: "A4" as const, landscape: false })
        : ({ page: "A5" as const, landscape: true }),
    [route?.kind],
  );

  const baslik = useMemo(() => {
    if (!route) return "Belge";
    if (route.kind === "hesap-ozeti") return "Dosya hesap özeti";
    if (route.kind === "vekalet-makbuz") return "Vekalet tahsilat makbuzu";
    return "Tahsilat makbuzu";
  }, [route]);

  const yukle = useCallback(async () => {
    if (!route || !window.api) return;
    setYukleniyor(true);
    setHata(null);
    setHtml(null);
    try {
      if (route.kind === "hesap-ozeti") {
        const r = await window.api.dosyaHesapOzetPaketi(route.id);
        if (!r.ok) {
          setHata(r.mesaj ?? r.error ?? "Hesap özeti yüklenemedi");
          return;
        }
        setHtml(hesapOzetHtml(r));
        return;
      }
      if (route.kind === "vekalet-makbuz") {
        const r = await window.api.getVekaletPrintPackageByOdemeId(route.id);
        if (!r.ok) {
          setHata(r.mesaj ?? r.error ?? "Makbuz yüklenemedi");
          return;
        }
        setHtml(vekaletMakbuzHtml(r));
        return;
      }
      const r = await window.api.makbuzYazdirmaPaketi(route.id);
      if (!r.ok) {
        setHata(r.mesaj ?? r.error ?? "Makbuz yüklenemedi");
        return;
      }
      setHtml(makbuzHtml(r));
    } catch {
      setHata("Belge yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  }, [route]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  if (!route) {
    return (
      <div className="pm-print-page">
        <p className="pm-form-error">Geçersiz önizleme adresi.</p>
      </div>
    );
  }

  return (
    <PremiumPrintPreviewShell
      title={baslik}
      html={html}
      loading={yukleniyor}
      loadError={hata}
      pdfOpts={pdfOpts}
      autoPrint={autoPrint}
    />
  );
}
