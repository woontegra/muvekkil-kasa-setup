import type { MuvekkilEkstrePayload } from "@shared/types/muvekkilEkstre";
import { formatMoney, PARA_BIRIMLERI, tryResolveParaBirimi } from "@shared/lib/paraBirimi";
import { formatDateTr } from "./format";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function odemeYontemLabel(v: string): string {
  switch (v) {
    case "NAKIT":
      return "Nakit";
    case "BANKA":
      return "Banka";
    case "KREDI_KARTI":
      return "Kredi kartı";
    case "DIGER":
      return "Diğer";
    default:
      return v;
  }
}

export function buildMuvekkilEkstrePrintHtml(ekstre: MuvekkilEkstrePayload): string {
  const v = ekstre.vekaletOzeti;
  const vekPb = tryResolveParaBirimi(v.paraBirimi);
  const a = ekstre.masrafAvansiOzeti;
  const mahkemeIcra = [ekstre.dosya.mahkeme, ekstre.dosya.icraDairesi].filter(Boolean).join(" / ");

  const taksitRows = ekstre.taksitler
    .map((t) => {
      const odemeRows = t.odemeler
        .map(
          (o) =>
            `<tr><td>${formatDateTr(o.odemeTarihi)}</td><td>${formatMoney(Number(o.tutar), o.alacakParaBirimi)}</td><td>${esc(o.makbuzNo)}</td><td>${odemeYontemLabel(o.odemeYontemi)}</td><td>${o.caprazOzet ? esc(o.caprazOzet) : "—"}</td></tr>`,
        )
        .join("");
      return `<tr>
        <td>${t.taksitNo}</td>
        <td>${formatDateTr(t.vadeTarihi)}</td>
        <td>${formatMoney(Number(t.taksitTutari), vekPb)}</td>
        <td>${formatMoney(Number(t.odenenToplam), vekPb)}</td>
        <td>${formatMoney(Number(t.kalanTutar), vekPb)}</td>
        <td>${esc(t.durum)}</td>
      </tr>
      ${odemeRows ? `<tr><td colspan="6"><table class="sub"><thead><tr><th>Ödeme tarihi</th><th>Mahsup</th><th>Makbuz</th><th>Yöntem</th><th>Çapraz</th></tr></thead><tbody>${odemeRows}</tbody></table></td></tr>` : ""}`;
    })
    .join("");

  const kasaRows = ekstre.masrafHareketleri
    .map(
      (h) =>
        `<tr><td>${formatDateTr(h.tarih)}</td><td>${esc(h.belgeNo)}</td><td>${esc(h.islemTuru)}</td><td>${h.giris !== "0.00" ? formatMoney(Number(h.giris), "TRY") : "—"}</td><td>${h.cikis !== "0.00" ? formatMoney(Number(h.cikis), "TRY") : "—"}</td><td>${formatMoney(Number(h.bakiyeSonrasi), "TRY")}</td><td>${h.aciklama ? esc(h.aciklama) : "—"}</td></tr>`,
    )
    .join("");

  const ofisTotals = PARA_BIRIMLERI.map((pb) => {
    const bucket = ekstre.dosyaDisiOfisGelirleri.byCurrency[pb];
    if (!bucket || Number(bucket.toplam) === 0) return "";
    return `<li>${pb}: ${formatMoney(Number(bucket.toplam), pb)}</li>`;
  }).join("");

  const ofisRows = ekstre.dosyaDisiOfisGelirleri.hareketler
    .map(
      (h) =>
        `<tr><td>${formatDateTr(h.tarih)}</td><td>${esc(h.belgeNo)}</td><td>${esc(h.kategori)}</td><td>${formatMoney(Number(h.tutar), h.paraBirimi)}</td><td>${odemeYontemLabel(h.odemeYontemi)}</td><td>${h.personelAd ? esc(h.personelAd) : "—"}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Müvekkil Ekstresi</title>
<style>
body{font-family:Segoe UI,sans-serif;padding:24px;color:#111;font-size:12px;line-height:1.4}
h1{font-size:18px;margin:0 0 8px}
h2{font-size:14px;margin:20px 0 8px}
.meta{color:#444;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin:8px 0 16px}
th,td{border:1px solid #ccc;padding:5px 7px;text-align:left;vertical-align:top}
th{background:#f4f4f4}
.sub{margin:4px 0;font-size:11px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.footnote{margin-top:20px;font-size:10px;color:#555}
@media print{body{padding:12px}}
</style></head><body>
<h1>MÜVEKKİL EKSTRESİ</h1>
<p class="meta">${esc(ekstre.itibariyleAciklama)} · Ref: ${esc(ekstre.belgeRef)} · Ekstre tarihi: ${formatDateTr(ekstre.ekstreTarihi)}</p>
<p class="meta"><strong>${esc(ekstre.buro.buroAdi)}</strong>${ekstre.buro.telefon ? ` · ${esc(ekstre.buro.telefon)}` : ""}${ekstre.buro.eposta ? ` · ${esc(ekstre.buro.eposta)}` : ""}</p>
${ekstre.buro.adres ? `<p class="meta">${esc(ekstre.buro.adres)}</p>` : ""}

<div class="grid">
<table><caption style="caption-side:top;font-weight:bold;text-align:left;margin-bottom:4px">Müvekkil / dosya</caption><tbody>
<tr><th>Müvekkil</th><td>${esc(ekstre.muvekkil.gorunenAd)}</td></tr>
<tr><th>Dosya</th><td>${esc(ekstre.dosya.konuBasligi)}</td></tr>
<tr><th>Dosya no</th><td>${ekstre.dosya.dosyaNo ? esc(ekstre.dosya.dosyaNo) : "—"}</td></tr>
<tr><th>Mahkeme / icra</th><td>${mahkemeIcra ? esc(mahkemeIcra) : "—"}</td></tr>
</tbody></table>

<table><caption style="caption-side:top;font-weight:bold;text-align:left;margin-bottom:4px">Vekalet özeti (${vekPb})</caption><tbody>
<tr><th>Kararlaştırılan</th><td>${formatMoney(Number(v.kararlastirilanToplam), vekPb)}</td></tr>
<tr><th>Tahsil edilen</th><td>${formatMoney(Number(v.tahsilEdilenToplam), vekPb)}</td></tr>
<tr><th>Kalan</th><td>${formatMoney(Number(v.kalanToplam), vekPb)}</td></tr>
<tr><th>Tahsilat oranı</th><td>%${v.tahsilatOrani.toLocaleString("tr-TR")}</td></tr>
<tr><th>Gecikmiş toplam</th><td>${formatMoney(Number(v.gecikmisToplam), vekPb)}</td></tr>
<tr><th>Sonraki taksit</th><td>${v.sonrakiTaksitVade && v.sonrakiTaksitTutar ? `${formatDateTr(v.sonrakiTaksitVade)} · ${formatMoney(Number(v.sonrakiTaksitTutar), vekPb)}` : "—"}</td></tr>
</tbody></table>
</div>

<table><caption style="caption-side:top;font-weight:bold;text-align:left;margin-bottom:4px">Masraf avansı (TRY)</caption><tbody>
<tr><th>Alınan avans</th><td>${formatMoney(Number(a.toplamAlinanAvans), "TRY")}</td></tr>
<tr><th>Toplam masraf</th><td>${formatMoney(Number(a.toplamMasraf), "TRY")}</td></tr>
<tr><th>Güncel bakiye</th><td>${formatMoney(Number(a.guncelBakiye), "TRY")}</td></tr>
</tbody></table>

<h2>Taksitler</h2>
<table><thead><tr><th>No</th><th>Vade</th><th>Tutar</th><th>Ödenen</th><th>Kalan</th><th>Durum</th></tr></thead><tbody>${taksitRows || `<tr><td colspan="6">Taksit kaydı yok.</td></tr>`}</tbody></table>

${ekstre.masrafHareketleri.length ? `<h2>Masraf hareketleri</h2>
<table><thead><tr><th>Tarih</th><th>Belge</th><th>Tür</th><th>Giriş</th><th>Çıkış</th><th>Bakiye</th><th>Açıklama</th></tr></thead><tbody>${kasaRows}</tbody></table>` : ""}

${ekstre.dosyaDisiOfisGelirleri.hareketler.length ? `<h2>Dosya dışı ofis gelirleri (bilgi)</h2>
<ul>${ofisTotals}</ul>
<p><em>Vekalet ve masraf toplamlarına dahil edilmez.</em></p>
<table><thead><tr><th>Tarih</th><th>Belge</th><th>Kategori</th><th>Tutar</th><th>Ödeme</th><th>Personel</th></tr></thead><tbody>${ofisRows}</tbody></table>` : ""}

<p class="footnote">${esc(ekstre.dipnot)}</p>
</body></html>`;
}
