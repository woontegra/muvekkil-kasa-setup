import {
  ICRA_ALACAK_DURUM_ETIKET,
  ICRA_ALACAK_TURU_ETIKET,
  type IcraAlacakDurumKodu,
  type IcraAlacakTuruKodu,
} from "@shared/constants/icraTahsilat";
import type { IcraTaksitDurum, IcraTaksitSmmDurum } from "@shared/types/icraTahsilat";

export function icraAlacakTuruEtiket(t: IcraAlacakTuruKodu): string {
  return ICRA_ALACAK_TURU_ETIKET[t] ?? t;
}

export function icraAlacakDurumEtiket(d: IcraAlacakDurumKodu): string {
  return ICRA_ALACAK_DURUM_ETIKET[d] ?? d;
}

export function icraAlacakDurumTone(d: IcraAlacakDurumKodu): "default" | "success" | "warning" | "info" {
  switch (d) {
    case "ODENDI":
      return "success";
    case "GECIKTI":
      return "warning";
    case "KISMI_ODENDI":
      return "info";
    case "IPTAL":
      return "default";
    default:
      return "default";
  }
}

export function icraTaksitDurumEtiket(d: IcraTaksitDurum): string {
  switch (d) {
    case "ODENMEDI":
      return "Ödenmedi";
    case "KISMI_ODENDI":
      return "Kısmi ödendi";
    case "ODENDI":
      return "Ödendi";
    case "GECIKTI":
      return "Gecikti";
    default:
      return d;
  }
}

export function icraTaksitDurumTone(d: IcraTaksitDurum): "default" | "success" | "warning" | "info" {
  switch (d) {
    case "ODENDI":
      return "success";
    case "GECIKTI":
      return "warning";
    case "KISMI_ODENDI":
      return "info";
    default:
      return "default";
  }
}

export function icraTaksitSmmHucre(smm: IcraTaksitSmmDurum): {
  label: string;
  tone: "default" | "success" | "warning";
  blink: boolean;
} {
  if (smm === "BEKLIYOR") {
    return { label: "SMM bekliyor", tone: "warning", blink: true };
  }
  if (smm === "KESILDI") {
    return { label: "SMM kesildi", tone: "success", blink: false };
  }
  return { label: "—", tone: "default", blink: false };
}

export function ilgiliMuvekkilDosyaMetni(muvekkilAdi: string | null, dosyaKonu: string | null): string {
  const m = (muvekkilAdi ?? "").trim();
  const d = (dosyaKonu ?? "").trim();
  if (m && d) return `${m} / ${d}`;
  if (m) return m;
  if (d) return d;
  return "—";
}
