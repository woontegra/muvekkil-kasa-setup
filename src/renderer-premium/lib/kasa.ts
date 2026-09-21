import {
  DIGER_MASRAF_ETIKETI,
  DIGER_ODEME_YONTEMI_ETIKETI,
  MASRAF_ODEME_YONTEMI_SECENEKLERI,
  ODEME_YONTEMI_ETIKET,
} from "@shared/constants/kasa";
import type { KasaHareket, KasaIslemTipi } from "@shared/types/kasa";
import { formatTry } from "./format";

export function tipEtiket(tip: KasaIslemTipi): string {
  if (tip === "AVANS_GIRISI") return "Avans";
  if (tip === "MASRAF") return "Masraf";
  return "Düzeltme";
}

export function odemeEtiket(kod: string): string {
  return ODEME_YONTEMI_ETIKET[kod as keyof typeof ODEME_YONTEMI_ETIKET] ?? kod;
}

export function masrafOdemeFormFromKayit(stored: string | null | undefined): { select: string; diger: string } {
  const raw = String(stored ?? "").trim();
  if (!raw) return { select: "Nakit", diger: "" };
  if (raw === "NAKIT") return { select: "Nakit", diger: "" };
  const presets = MASRAF_ODEME_YONTEMI_SECENEKLERI as readonly string[];
  if (presets.includes(raw) && raw !== DIGER_ODEME_YONTEMI_ETIKETI) {
    return { select: raw, diger: "" };
  }
  const label = odemeEtiket(raw);
  if (label === DIGER_ODEME_YONTEMI_ETIKETI || raw === "DIGER") {
    return { select: DIGER_ODEME_YONTEMI_ETIKETI, diger: "" };
  }
  return { select: DIGER_ODEME_YONTEMI_ETIKETI, diger: label };
}

export function masrafOdemeKayitDegeri(select: string, diger: string): string | null {
  if (select === DIGER_ODEME_YONTEMI_ETIKETI) {
    const t = diger.trim();
    return t || null;
  }
  const s = select.trim();
  return s || null;
}

export function onayBadgeMetni(h: KasaHareket): string {
  if (h.onayDurumu === "ONAYSIZ") return "Onaysız";
  if (h.onayDurumu === "REDDEDILDI") return "Reddedildi";
  if (h.otomatikOnayMi) return "Otomatik onaylı";
  return "Onaylı";
}

export function onayBadgeTone(h: KasaHareket): "warning" | "success" | "default" | "info" {
  if (h.onayDurumu === "ONAYSIZ") return "warning";
  if (h.onayDurumu === "REDDEDILDI") return "default";
  return "success";
}

export function hareketAciklamaMasraf(h: KasaHareket): string {
  if (h.islemTipi === "MASRAF") {
    const tur = (h.masrafTuru ?? "").trim();
    const ac = (h.aciklama ?? "").trim();
    if (tur && ac) return `${tur} — ${ac}`;
    return tur || ac || "—";
  }
  if (h.islemTipi === "DUZELTME") return (h.aciklama ?? "").trim() || "—";
  return (h.aciklama ?? "").trim() || "—";
}

export function masrafKayitTuruFromForm(select: string, diger: string): string | null {
  if (!select.trim()) return null;
  if (select === DIGER_MASRAF_ETIKETI) {
    const t = diger.trim();
    return t || null;
  }
  return select.trim();
}

export function masrafDuzenlemeSelectDiger(
  kayitTuru: string | null | undefined,
  liste: string[],
): { select: string; diger: string } {
  const t = (kayitTuru ?? "").trim();
  if (!t) return { select: liste[0] ?? DIGER_MASRAF_ETIKETI, diger: "" };
  if (liste.includes(t)) return { select: t, diger: "" };
  return { select: DIGER_MASRAF_ETIKETI, diger: t };
}

export function hareketKategori(h: KasaHareket): string {
  if (h.islemTipi === "MASRAF") return (h.masrafTuru ?? "").trim() || "—";
  if (h.islemTipi === "AVANS_GIRISI") return odemeEtiket(h.odemeYontemi);
  return "—";
}

export function hareketGirisCikis(h: KasaHareket): { giris: number | null; cikis: number | null } {
  if (h.islemTipi === "AVANS_GIRISI") return { giris: h.tutar, cikis: null };
  if (h.islemTipi === "MASRAF") return { giris: null, cikis: Math.abs(h.tutar) };
  if (h.tutar >= 0) return { giris: h.tutar, cikis: null };
  return { giris: null, cikis: Math.abs(h.tutar) };
}

export function hareketSatirSinifi(h: KasaHareket): string {
  if (h.duzeltmeMi) return "pm-kasa-row--correction";
  if (h.hasCorrection) return "pm-kasa-row--corrected";
  return "";
}

export function kasaMakbuzGosterilebilir(h: KasaHareket): boolean {
  return (
    h.onayDurumu === "ONAYLI" &&
    (h.islemTipi === "AVANS_GIRISI" || h.islemTipi === "MASRAF" || h.islemTipi === "DUZELTME")
  );
}
