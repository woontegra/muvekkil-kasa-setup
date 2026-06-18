import type { Muvekkil } from "@shared/types/muvekkil";
import { muvekkilGorunenAd, muvekkilListeEposta, muvekkilListeTelefonu } from "./muvekkil";
import { ofisDeger } from "./makbuz";

export type HesapOzetSatir = { etiket: string; deger: string };

export function muvekkilHesapOzetSatirlari(m: Muvekkil): HesapOzetSatir[] {
  if (m.muvekkilTuru === "TUZEL_KISI") {
    return [
      { etiket: "Ad soyad / unvan", deger: muvekkilGorunenAd(m) },
      { etiket: "Telefon", deger: muvekkilListeTelefonu(m) },
      { etiket: "E-posta", deger: muvekkilListeEposta(m) },
      { etiket: "Not", deger: ofisDeger(m.not) },
    ];
  }
  return [
    { etiket: "Ad soyad / unvan", deger: (m.adSoyad ?? "").trim() || "—" },
    { etiket: "Telefon", deger: muvekkilListeTelefonu(m) },
    { etiket: "E-posta", deger: muvekkilListeEposta(m) },
    { etiket: "Not", deger: ofisDeger(m.not) },
  ];
}

export function kasaTurEk(h: { islemTipi: string; masrafTuru: string | null; odemeYontemi: string }, odemeEtiketFn: (k: string) => string): string {
  if (h.islemTipi === "MASRAF") return (h.masrafTuru ?? "").trim() || "—";
  if (h.islemTipi === "AVANS_GIRISI") return odemeEtiketFn(h.odemeYontemi);
  return "—";
}

export function kasaIslemTipiEtiket(tip: string): string {
  if (tip === "AVANS_GIRISI") return "Avans";
  if (tip === "MASRAF") return "Masraf";
  return "Düzeltme";
}
