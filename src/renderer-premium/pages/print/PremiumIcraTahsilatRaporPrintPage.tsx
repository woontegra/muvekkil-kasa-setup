import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  ICRA_ALACAK_DURUM_ETIKET,
  ICRA_ALACAK_TURU_ETIKET,
} from "@shared/constants/icraTahsilat";
import type { IcraTahsilatListeSatir, IcraTahsilatUstOzet } from "@shared/types/icraTahsilat";
import { formatDateTr, formatTry } from "../../lib/format";
import {
  icraAlacakDurumEtiket,
  icraAlacakTuruEtiket,
  ilgiliMuvekkilDosyaMetni,
} from "../../lib/icraTahsilat";
import { ayBasiSonu } from "../../lib/ofisKasa";
import { PremiumPrintPreviewShell } from "../../components/print/PremiumPrintPreviewShell";

type PrintNavState = { autoPrint?: boolean };

function filtreEtiket(tur: string, durum: string, arama: string): string {
  const parcalar: string[] = [];
  if (tur && tur !== "TUMU") {
    parcalar.push(`Tür: ${ICRA_ALACAK_TURU_ETIKET[tur as keyof typeof ICRA_ALACAK_TURU_ETIKET] ?? tur}`);
  }
  if (durum && durum !== "TUMU") {
    parcalar.push(`Durum: ${ICRA_ALACAK_DURUM_ETIKET[durum as keyof typeof ICRA_ALACAK_DURUM_ETIKET] ?? durum}`);
  }
  if (arama.trim()) parcalar.push(`Arama: ${arama.trim()}`);
  return parcalar.length ? parcalar.join(" · ") : "Tüm kayıtlar";
}

function raporHtml(
  officeName: string,
  tarihBas: string,
  tarihBit: string,
  alacakTuru: string,
  durum: string,
  arama: string,
  ozet: IcraTahsilatUstOzet | null,
  liste: IcraTahsilatListeSatir[],
): string {
  const toplamAlacak = liste.reduce((s, a) => s + a.toplamTutar, 0);
  const toplamOdenen = liste.reduce((s, a) => s + a.odenenToplam, 0);
  const toplamKalan = liste.reduce((s, a) => s + a.kalanTutar, 0);

  const rows = liste
    .map(
      (a) => `<tr>
        <td>${a.id}</td>
        <td>${a.borcluAdi}</td>
        <td>${ilgiliMuvekkilDosyaMetni(a.muvekkilAdi, a.dosyaKonu)}</td>
        <td>${icraAlacakTuruEtiket(a.alacakTuru)}</td>
        <td class="num">${formatTry(a.toplamTutar)}</td>
        <td class="num">${formatTry(a.odenenToplam)}</td>
        <td class="num">${formatTry(a.kalanTutar)}</td>
        <td>${a.taksitSayisi}</td>
        <td>${icraAlacakDurumEtiket(a.durum)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>İcra Tahsilat Raporu</title>
<style>
body{font-family:Segoe UI,sans-serif;padding:24px;font-size:12px;color:#111}
h1{font-size:18px;margin:0 0 8px}
.meta{color:#555;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
th{background:#f4f4f4}
td.num,th.num{text-align:right}
</style></head><body>
<h1>İCRA TAHSİLAT RAPORU</h1>
<p class="meta">${officeName} · ${formatDateTr(tarihBas)} — ${formatDateTr(tarihBit)}</p>
<p class="meta">Filtre: ${filtreEtiket(alacakTuru, durum, arama)}</p>
<h2 style="font-size:14px">Özet</h2>
<table>
${ozet ? `<tr><th>Genel toplam alacak</th><td class="num">${formatTry(ozet.toplamAlacak)}</td></tr>
<tr><th>Genel tahsil edilen</th><td class="num">${formatTry(ozet.tahsilEdilen)}</td></tr>
<tr><th>Genel kalan</th><td class="num">${formatTry(ozet.kalanAlacak)}</td></tr>` : ""}
<tr><th>Listelenen kayıt</th><td>${liste.length}</td></tr>
<tr><th>Listelenen toplam</th><td class="num">${formatTry(toplamAlacak)}</td></tr>
<tr><th>Listelenen ödenen</th><td class="num">${formatTry(toplamOdenen)}</td></tr>
<tr><th>Listelenen kalan</th><td class="num"><strong>${formatTry(toplamKalan)}</strong></td></tr>
</table>
<h2 style="font-size:14px">Alacak listesi</h2>
${
  liste.length === 0
    ? "<p>Filtreye uygun kayıt bulunamadı.</p>"
    : `<table><thead><tr>
  <th>#</th><th>Borçlu</th><th>Müvekkil/Dosya</th><th>Tür</th>
  <th class="num">Toplam</th><th class="num">Ödenen</th><th class="num">Kalan</th><th>Taksit</th><th>Durum</th>
</tr></thead><tbody>${rows}</tbody></table>`
}
</body></html>`;
}

export function PremiumIcraTahsilatRaporPrintPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const autoPrint = Boolean((location.state as PrintNavState | null)?.autoPrint);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);

  const filtre = useMemo(() => {
    const fallback = ayBasiSonu();
    return {
      tarihBas: (params.get("bas") ?? fallback.bas).trim().slice(0, 10),
      tarihBit: (params.get("bit") ?? fallback.bit).trim().slice(0, 10),
      alacakTuru: (params.get("tur") ?? "TUMU").trim(),
      durum: (params.get("durum") ?? "TUMU").trim(),
      q: (params.get("q") ?? "").trim(),
    };
  }, [params]);

  const yukle = useCallback(async () => {
    if (!window.api?.icraTahsilatList) {
      setHata("Rapor servisi kullanılamıyor.");
      setYukleniyor(false);
      return;
    }
    setYukleniyor(true);
    setHata(null);
    setHtml(null);
    try {
      const [officeRow, ustOzet, rows] = await Promise.all([
        window.api.officeGet?.() ?? null,
        window.api.icraTahsilatUstOzet?.() ?? null,
        window.api.icraTahsilatList(filtre),
      ]);
      if (!officeRow) {
        setHata("Ofis bilgisi yüklenemedi.");
        return;
      }
      const officeName = (officeRow.ofisAdi ?? officeRow.avukatAdiSoyadi ?? "Ofis").trim() || "Ofis";
      const liste = Array.isArray(rows) ? rows : [];
      setHtml(
        raporHtml(
          officeName,
          filtre.tarihBas,
          filtre.tarihBit,
          filtre.alacakTuru,
          filtre.durum,
          filtre.q,
          ustOzet ?? null,
          liste,
        ),
      );
    } catch {
      setHata("Rapor verisi alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [filtre]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  return (
    <PremiumPrintPreviewShell
      title="İcra tahsilat raporu"
      subtitle={`${formatDateTr(filtre.tarihBas)} — ${formatDateTr(filtre.tarihBit)}`}
      html={html}
      loading={yukleniyor}
      loadError={hata}
      pdfOpts={{ page: "A4", landscape: false }}
      autoPrint={autoPrint}
    />
  );
}
