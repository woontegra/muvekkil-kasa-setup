import {
  ICRA_ALACAK_DURUM_ETIKET,
  ICRA_ALACAK_TURU_ETIKET,
} from "@shared/constants/icraTahsilat";
import type { DosyaHesapOzetPaketi } from "@shared/types/hesapOzet";
import type { IcraTahsilatListeSatir, IcraTahsilatUstOzet } from "@shared/types/icraTahsilat";
import type { KasaMakbuzPaketi, VekaletMakbuzPaketi } from "@shared/types/makbuz";
import type { OfisKasaRaporPaketi } from "@shared/types/ofisKasa";
import { formatDateTr, formatTry } from "./format";
import { PARA_BIRIMLERI, formatMoney } from "@shared/lib/paraBirimi";
import {
  icraAlacakDurumEtiket,
  icraAlacakTuruEtiket,
  ilgiliMuvekkilDosyaMetni,
} from "./icraTahsilat";
import { hareketAciklamaMasraf, odemeEtiket, onayBadgeMetni, tipEtiket } from "./kasa";
import { muvekkilGorunenAd } from "./muvekkil";
import {
  duzeltmeListeTutar,
  duzeltmeTurEtiketForRow,
  formatSignedTry,
  islemTipiEtiket,
  odemeEtiket as ofisOdemeEtiket,
  ofisKasaKategoriListeEtiketi,
} from "./ofisKasa";

type OfisPaket = Extract<OfisKasaRaporPaketi, { ok: true }>;

function duzeltmeAltSatir(h: OfisPaket["hareketler"][number]): string | null {
  if (h.islemTipi !== "DUZELTME") return null;
  const dogru = h.duzeltmeDogruTutar;
  const fark = h.duzeltmeFarkTutar ?? 0;
  const etki = h.duzeltmeKasaEtkisi ?? 0;
  if (dogru == null) {
    return `Fark: ${formatTry(fark)} · Kasa etkisi: ${formatSignedTry(etki)}`;
  }
  return `Doğru tutar: ${formatTry(dogru)} · Fark: ${formatTry(fark)} · Kasa etkisi: ${formatSignedTry(etki)}`;
}

export function ofisKasaRaporHtml(paket: OfisPaket, officeName: string): string {
  const rows = paket.hareketler
    .map((h) => {
      const tip =
        h.islemTipi === "DUZELTME" ? (duzeltmeTurEtiketForRow(h) ?? "Düzeltme") : islemTipiEtiket(h.islemTipi);
      const aciklama =
        h.islemTipi === "DUZELTME"
          ? `${h.aciklama?.trim() || "—"}${duzeltmeAltSatir(h) ? ` (${duzeltmeAltSatir(h)})` : ""}`
          : h.aciklama?.trim() || "—";
      return `<tr>
        <td>${formatDateTr(h.tarih)}</td>
        <td>${tip}</td>
        <td>${h.paraBirimi}</td>
        <td>${ofisKasaKategoriListeEtiketi(h.kategori, h.ozelKategoriAdi)}</td>
        <td>${aciklama}</td>
        <td>${ofisOdemeEtiket(h)}</td>
        <td>${h.belgeNo?.trim() || "—"}</td>
        <td class="num">${formatMoney(duzeltmeListeTutar(h), h.paraBirimi)}</td>
        <td>${onayBadgeMetni(h)}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Ofis Kasa Raporu</title>
<style>
body{font-family:Segoe UI,sans-serif;padding:24px;color:#111;font-size:12px}
h1{font-size:18px;margin:0 0 8px}
.meta{color:#555;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
th{background:#f4f4f4;font-weight:600}
td.num,th.num{text-align:right}
.ozet{margin:16px 0}
.ozet table{max-width:480px}
</style></head><body>
<h1>OFİS KASA RAPORU</h1>
<p class="meta">${officeName} · Tarih aralığı: ${formatDateTr(paket.tarihBas)} — ${formatDateTr(paket.tarihBit)}</p>
<section class="ozet">
  <table>
    <tr><th>Devreden bakiye (TRY)</th><td class="num">${formatTry(paket.devredenBakiye)}</td></tr>
    <tr><th>Dönem geliri (TRY)</th><td class="num">${formatTry(paket.donemGelir)}</td></tr>
    <tr><th>Dönem gideri (TRY)</th><td class="num">${formatTry(paket.donemGider)}</td></tr>
    <tr><th>Dönem düzeltme etkisi (TRY)</th><td class="num">${formatSignedTry(paket.donemDuzeltmeEtkisi)}</td></tr>
    <tr><th>Kasa bakiyesi (TRY)</th><td class="num"><strong>${formatTry(paket.kasaBakiyesi)}</strong></td></tr>
    ${PARA_BIRIMLERI.map((pb) => {
      const b = paket.byCurrency[pb];
      return `<tr><th>${pb} — gelir / gider / bakiye</th><td class="num">${formatMoney(b.donemGelir, pb)} / ${formatMoney(b.donemGider, pb)} / <strong>${formatMoney(paket.bakiyeler[pb], pb)}</strong></td></tr>`;
    }).join("")}
  </table>
</section>
<h2 style="font-size:14px">Hareket listesi</h2>
${
  paket.hareketler.length === 0
    ? "<p>Bu tarih aralığında ofis kasa hareketi bulunamadı.</p>"
    : `<table>
  <thead><tr>
    <th>Tarih</th><th>Tip</th><th>PB</th><th>Kategori</th><th>Açıklama</th><th>Ödeme</th><th>Belge no</th><th class="num">Tutar</th><th>Durum</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`
}
</body></html>`;
}

function icraFiltreEtiket(tur: string, durum: string, arama: string): string {
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

export function icraTahsilatRaporHtml(
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
        <td class="num">${formatMoney(a.toplamTutar, a.paraBirimi)}</td>
        <td class="num">${formatMoney(a.odenenToplam, a.paraBirimi)}</td>
        <td class="num">${formatMoney(a.kalanTutar, a.paraBirimi)}</td>
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
<p class="meta">Filtre: ${icraFiltreEtiket(alacakTuru, durum, arama)}</p>
<h2 style="font-size:14px">Özet</h2>
<table>
${ozet ? `${PARA_BIRIMLERI.map((pb) => `<tr><th>${pb} toplam / tahsil / kalan</th><td class="num">${formatMoney(ozet.byCurrency[pb].toplamAlacak, pb)} / ${formatMoney(ozet.byCurrency[pb].tahsilEdilen, pb)} / ${formatMoney(ozet.byCurrency[pb].kalanAlacak, pb)}</td></tr>`).join("")}
<tr><th>Genel toplam alacak (TRY)</th><td class="num">${formatTry(ozet.toplamAlacak)}</td></tr>
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

export function hesapOzetHtml(p: Extract<DosyaHesapOzetPaketi, { ok: true }>): string {
  const vekaletPb = p.vekalet.paraBirimi;
  const rows = p.hareketler
    .map(
      (h) =>
        `<tr><td>${formatDateTr(h.tarih)}</td><td>${tipEtiket(h.islemTipi)}</td><td>${formatTry(h.tutar)}</td><td>${hareketAciklamaMasraf(h)}</td><td>${onayBadgeMetni(h)}</td></tr>`,
    )
    .join("");
  const taksitRows = p.taksitler
    .map(
      (t) =>
        `<tr><td>${t.taksitNo}</td><td>${t.vadeTarihi ? formatDateTr(t.vadeTarihi) : "—"}</td><td class="num">${formatMoney(t.tutar, t.paraBirimi)}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Dosya Hesap Özeti</title>
<style>body{font-family:Segoe UI,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px}th{background:#f4f4f4;text-align:left}h1{font-size:18px}td.num,th.num{text-align:right}</style></head><body>
<h1>DOSYA HESAP ÖZETİ / EKSTRE</h1>
<p>Müvekkil: ${muvekkilGorunenAd(p.muvekkil)}</p>
<p>Dosya: ${(p.dosya.konuBasligi ?? "").trim() || "—"}</p>
<p>Toplam avans: ${formatTry(p.kasaOzet.toplamAlinanAvans)} · Toplam masraf: ${formatTry(p.kasaOzet.toplamYapilanMasraf)} · Kalan avans: ${formatTry(p.kasaOzet.kalanAvans)}</p>
<table><thead><tr><th>Tarih</th><th>Tip</th><th>Tutar</th><th>Açıklama</th><th>Onay</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Vekalet ücreti (${vekaletPb})</h2>
<p>Anlaşılan: ${formatMoney(p.vekaletOzet.anlasilanTutar, vekaletPb)} · Ödenen: ${formatMoney(p.vekaletOzet.odenenToplam, vekaletPb)} · Kalan: ${formatMoney(p.vekaletOzet.kalanVekalet, vekaletPb)}</p>
<table><thead><tr><th>Taksit no</th><th>Vade</th><th class="num">Tutar</th></tr></thead><tbody>${taksitRows}</tbody></table>
</body></html>`;
}

export function vekaletMakbuzHtml(p: Extract<VekaletMakbuzPaketi, { ok: true }>): string {
  const { odeme, muvekkil, dosya, taksit } = p;
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Vekalet Makbuzu</title>
<style>body{font-family:Segoe UI,sans-serif;padding:24px}h1{font-size:16px}</style></head><body>
<h1>VEKALET TAHSİLAT MAKBUZU</h1>
<p>Makbuz no: ${odeme.makbuzNo ?? "—"} · Tarih: ${formatDateTr(odeme.odemeTarihi)}</p>
<p>Müvekkil: ${muvekkilGorunenAd(muvekkil)}</p>
<p>Dosya: ${(dosya.konuBasligi ?? "").trim() || "—"}</p>
<p>Taksit #${taksit.taksitNo} · Mahsup: ${formatMoney(odeme.tutar, odeme.alacakParaBirimi)}</p>
${odeme.odemeParaBirimi !== odeme.alacakParaBirimi ? `<p>Kasaya giren: ${formatMoney(odeme.kasaTutari, odeme.odemeParaBirimi)} · Kur: 1 ${odeme.alacakParaBirimi} = ${odeme.kur?.toFixed(8) ?? "—"} ${odeme.odemeParaBirimi}${odeme.kurKaynagi ? ` (${odeme.kurKaynagi})` : ""}</p>` : ""}
<p>Ödeme: ${odemeEtiket(odeme.odemeYontemi)}</p>
</body></html>`;
}

export function kasaMakbuzHtml(p: Extract<KasaMakbuzPaketi, { ok: true }>): string {
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

export async function yukleOfisKasaRaporHtml(bas: string, bit: string): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const r = await window.api.ofisKasaRaporPaketi({ bas, bit });
  if (!r.ok) return { ok: false, error: r.mesaj ?? "Rapor verisi alınamadı." };
  const officeName = (r.office.ofisAdi ?? r.office.avukatAdiSoyadi ?? "Ofis").trim() || "Ofis";
  return { ok: true, html: ofisKasaRaporHtml(r, officeName) };
}

export async function yukleIcraRaporHtml(filtre: {
  tarihBas: string;
  tarihBit: string;
  alacakTuru: string;
  durum: string;
  q: string;
}): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const [officeRow, ustOzet, rows] = await Promise.all([
    window.api.officeGet(),
    window.api.icraTahsilatUstOzet(),
    window.api.icraTahsilatList(filtre),
  ]);
  const officeName = (officeRow.ofisAdi ?? officeRow.avukatAdiSoyadi ?? "Ofis").trim() || "Ofis";
  const liste = Array.isArray(rows) ? rows : [];
  return {
    ok: true,
    html: icraTahsilatRaporHtml(
      officeName,
      filtre.tarihBas,
      filtre.tarihBit,
      filtre.alacakTuru,
      filtre.durum,
      filtre.q,
      ustOzet ?? null,
      liste,
    ),
  };
}

export async function yukleHesapOzetHtml(dosyaId: number): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const r = await window.api.dosyaHesapOzetPaketi(dosyaId);
  if (!r.ok) return { ok: false, error: r.mesaj ?? r.error ?? "Hesap özeti yüklenemedi" };
  return { ok: true, html: hesapOzetHtml(r) };
}

export async function yukleKasaMakbuzHtml(hareketId: number): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const r = await window.api.makbuzYazdirmaPaketi(hareketId);
  if (!r.ok) return { ok: false, error: r.mesaj ?? r.error ?? "Makbuz yüklenemedi" };
  return { ok: true, html: kasaMakbuzHtml(r) };
}

export async function yukleVekaletMakbuzHtml(odemeId: number): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const r = await window.api.getVekaletPrintPackageByOdemeId(odemeId);
  if (!r.ok) return { ok: false, error: r.mesaj ?? r.error ?? "Makbuz yüklenemedi" };
  return { ok: true, html: vekaletMakbuzHtml(r) };
}
