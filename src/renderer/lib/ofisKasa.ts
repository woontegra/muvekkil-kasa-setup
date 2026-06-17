import {
  DIGER_GELIR_KOD,
  DIGER_GIDER_KOD,
  isGecerliOfisGelirKategori,
  isGecerliOfisGiderKategori,
  OFIS_GELIR_KATEGORI_ETIKET,
  OFIS_GELIR_KATEGORI_KODLARI,
  OFIS_GIDER_KATEGORI_ETIKET,
  OFIS_GIDER_KATEGORI_KODLARI,
  OFIS_ODEME_YONTEMI_ETIKET,
} from "@shared/constants/ofisKasa";
import {
  duzeltmeFarkTutarFromRow,
  duzeltmeKasaEtkisiFromRow,
  duzeltmeTurEtiketi,
  duzeltmeYonFromRow,
  hesaplaOfisKasaDuzeltme,
  type DuzeltmeTurEtiket,
} from "@shared/ofisKasaDuzeltme";
import type { OfisKasaHareketListeSatir } from "@shared/types/ofisKasa";
import { formatTry } from "./format";

export function ayBasiSonu(d = new Date()): { bas: string; bit: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const bas = `${y}-${pad(m + 1)}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const bit = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
  return { bas, bit };
}

export function ofisKasaKategoriListeEtiketi(kategoriKodu: string, ozelKategoriAdi: string | null): string {
  if (kategoriKodu === "DUZELTME") return "Düzeltme";
  const ozel = (ozelKategoriAdi ?? "").trim();
  if (kategoriKodu === DIGER_GELIR_KOD || kategoriKodu === DIGER_GIDER_KOD) {
    return (
      ozel ||
      (kategoriKodu === DIGER_GELIR_KOD
        ? OFIS_GELIR_KATEGORI_ETIKET[DIGER_GELIR_KOD]
        : OFIS_GIDER_KATEGORI_ETIKET[DIGER_GIDER_KOD])
    );
  }
  if (isGecerliOfisGelirKategori(kategoriKodu)) return OFIS_GELIR_KATEGORI_ETIKET[kategoriKodu] ?? kategoriKodu;
  if (isGecerliOfisGiderKategori(kategoriKodu)) return OFIS_GIDER_KATEGORI_ETIKET[kategoriKodu] ?? kategoriKodu;
  return kategoriKodu;
}

export function tumKategoriSecenekleri(): { kod: string; etiket: string }[] {
  const gelir = OFIS_GELIR_KATEGORI_KODLARI.map((k) => ({ kod: k, etiket: OFIS_GELIR_KATEGORI_ETIKET[k] ?? k }));
  const gider = OFIS_GIDER_KATEGORI_KODLARI.map((k) => ({ kod: k, etiket: OFIS_GIDER_KATEGORI_ETIKET[k] ?? k }));
  return [...gelir, ...gider];
}

export function ofisKasaSatirSinifi(h: OfisKasaHareketListeSatir): string {
  const parcalar: string[] = [];
  if (h.duzeltmeMi || h.islemTipi === "DUZELTME") {
    parcalar.push("desk-row-correction", "ofis-kasa-row--duzeltme");
  } else if (h.hasCorrection) {
    parcalar.push("desk-row-corrected");
  }
  return parcalar.join(" ");
}

export function islemTipiEtiket(t: string): string {
  if (t === "GELIR") return "Gelir";
  if (t === "GIDER") return "Gider";
  return "Düzeltme";
}

export function odemeEtiket(h: { islemTipi: string; odemeYontemi: string }): string {
  if (h.islemTipi === "DUZELTME") return "—";
  return OFIS_ODEME_YONTEMI_ETIKET[h.odemeYontemi] ?? h.odemeYontemi;
}

export function onayBadgeClass(h: OfisKasaHareketListeSatir): string {
  if (h.onayDurumu === "ONAYSIZ") return "badge-onaysiz";
  if (h.otomatikOnayMi) return "badge-otomatik-onay";
  return "badge-onayli";
}

export function onayBadgeMetni(h: OfisKasaHareketListeSatir): string {
  if (h.onayDurumu === "ONAYSIZ") return "Onaysız";
  if (h.otomatikOnayMi) return "Otomatik onaylı";
  return "Onaylı";
}

export function onayEtiket(h: OfisKasaHareketListeSatir): string {
  return onayBadgeMetni(h);
}

export function satirAuditTitle(h: OfisKasaHareketListeSatir): string {
  const p: string[] = [];
  const oa = h.olusturanKullaniciAdi?.trim();
  if (oa) p.push(`Ekleyen: ${oa}`);
  if (h.olusturmaTarihi) p.push(`Kayıt: ${h.olusturmaTarihi.slice(0, 19).replace("T", " ")}`);
  if (h.onayDurumu === "ONAYLI") {
    const ap = h.onaylayanKullaniciAdi?.trim();
    if (ap) p.push(`Onaylayan: ${ap}`);
    if (h.onayTarihi) p.push(`Onay: ${h.onayTarihi.slice(0, 19).replace("T", " ")}`);
  }
  return p.join(" · ");
}

export function parseTutar(raw: string): number {
  return Number(raw.replace(",", ".").trim());
}

export function formatSignedTry(n: number): string {
  if (n > 0) return `+${formatTry(n)}`;
  return formatTry(n);
}

export function duzeltmeTurEtiketForRow(h: OfisKasaHareketListeSatir): DuzeltmeTurEtiket | null {
  if (h.islemTipi !== "DUZELTME") return null;
  if (h.duzeltmeRefTipi) {
    const yon = h.duzeltmeYonu ?? duzeltmeYonFromRow(h, h.duzeltmeRefTipi);
    if (yon) return duzeltmeTurEtiketi(h.duzeltmeRefTipi, yon);
  }
  const etki = duzeltmeKasaEtkisiFromRow(h);
  if (etki > 0) return "Gider azaltma";
  if (etki < 0) return "Gider artırma";
  return null;
}

export function duzeltmeListeTutar(h: OfisKasaHareketListeSatir): number {
  if (h.islemTipi !== "DUZELTME") return h.tutar;
  return duzeltmeKasaEtkisiFromRow(h);
}

export function duzeltmeAltSatir(h: OfisKasaHareketListeSatir): string | null {
  if (h.islemTipi !== "DUZELTME") return null;
  const dogru = h.duzeltmeDogruTutar;
  const fark = duzeltmeFarkTutarFromRow(h);
  const etki = duzeltmeKasaEtkisiFromRow(h);
  if (dogru == null) {
    return `Fark: ${formatTry(fark)} · Kasa etkisi: ${formatSignedTry(etki)}`;
  }
  return `Doğru tutar: ${formatTry(dogru)} · Fark: ${formatTry(fark)} · Kasa etkisi: ${formatSignedTry(etki)}`;
}

/** Tür / Ek kolonu: kategori + ödeme veya düzeltme referansı */
export function ofisKasaTurEkMetni(h: OfisKasaHareketListeSatir): string {
  if (h.islemTipi === "DUZELTME") {
    const parcalar: string[] = [];
    if (h.orijinalHareketId != null) parcalar.push(`Düzeltilen işlem: #${h.orijinalHareketId}`);
    const tur = duzeltmeTurEtiketForRow(h);
    if (tur) parcalar.push(tur);
    return parcalar.join(" · ") || "—";
  }
  const kat = ofisKasaKategoriListeEtiketi(h.kategori, h.ozelKategoriAdi);
  const odeme = odemeEtiket(h);
  if (odeme !== "—") return `${kat} · ${odeme}`;
  return kat;
}

export function ofisKasaAciklamaMetni(h: OfisKasaHareketListeSatir): string {
  const ac = (h.aciklama ?? "").trim();
  if (ac) return ac;
  const not = (h.not ?? "").trim();
  if (not) return not;
  return "—";
}

export { hesaplaOfisKasaDuzeltme };
