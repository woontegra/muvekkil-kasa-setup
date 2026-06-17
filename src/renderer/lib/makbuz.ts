import type { Muvekkil } from "@shared/types/muvekkil";
import type { OfficeSettings } from "@shared/types/office";
import { DEFAULT_OFIS_ADI } from "@shared/types/officeDefaults";

export type MakbuzSatir = { etiket: string; deger: string };

export function ofisAdiGoster(o: OfficeSettings): string {
  return (o.ofisAdi ?? "").trim() || DEFAULT_OFIS_ADI;
}

export function ofisDeger(v: string | null | undefined): string {
  const t = (v ?? "").trim();
  return t || "—";
}

export function muvekkilMakbuzSatirlari(m: Muvekkil): MakbuzSatir[] {
  if (m.muvekkilTuru === "TUZEL_KISI") {
    return [
      { etiket: "Müvekkil ünvanı", deger: (m.sirketUnvani ?? "").trim() || "—" },
      { etiket: "Yetkili kişi", deger: (m.yetkiliAdSoyad ?? "").trim() || "—" },
      { etiket: "Yetkili telefon", deger: (m.yetkiliTelefon ?? "").trim() || "—" },
      { etiket: "E-posta", deger: (m.eposta ?? "").trim() || "—" },
    ];
  }
  return [
    { etiket: "Müvekkil adı soyadı", deger: (m.adSoyad ?? "").trim() || "—" },
    { etiket: "Telefon", deger: (m.telefon ?? "").trim() || "—" },
    { etiket: "E-posta", deger: (m.eposta ?? "").trim() || "—" },
  ];
}
