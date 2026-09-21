import type { OfficeSettings } from "@shared/types/office";

export type OfficeFormState = {
  ofisAdi: string;
  avukatAdiSoyadi: string;
  telefon: string;
  eposta: string;
  vergiNo: string;
  vergiDairesi: string;
  baroAdi: string;
  baroSicilNo: string;
  adres: string;
  logoPath: string | null;
};

export function bosOfficeForm(): OfficeFormState {
  return {
    ofisAdi: "",
    avukatAdiSoyadi: "",
    telefon: "",
    eposta: "",
    vergiNo: "",
    vergiDairesi: "",
    baroAdi: "",
    baroSicilNo: "",
    adres: "",
    logoPath: null,
  };
}

export function officeFormFromRow(row: OfficeSettings): OfficeFormState {
  return {
    ofisAdi: row.ofisAdi ?? "",
    avukatAdiSoyadi: row.avukatAdiSoyadi ?? "",
    telefon: row.telefon ?? "",
    eposta: row.eposta ?? "",
    vergiNo: row.vergiNo ?? "",
    vergiDairesi: row.vergiDairesi ?? "",
    baroAdi: row.baroAdi ?? "",
    baroSicilNo: row.baroSicilNo ?? "",
    adres: row.adres ?? "",
    logoPath: row.logoPath,
  };
}

export function officeFormEquals(a: OfficeFormState, b: OfficeFormState): boolean {
  return (
    a.ofisAdi === b.ofisAdi &&
    a.avukatAdiSoyadi === b.avukatAdiSoyadi &&
    a.telefon === b.telefon &&
    a.eposta === b.eposta &&
    a.vergiNo === b.vergiNo &&
    a.vergiDairesi === b.vergiDairesi &&
    a.baroAdi === b.baroAdi &&
    a.baroSicilNo === b.baroSicilNo &&
    a.adres === b.adres &&
    (a.logoPath ?? "") === (b.logoPath ?? "")
  );
}

export function officeFormToInput(form: OfficeFormState) {
  return {
    ofisAdi: form.ofisAdi,
    avukatAdiSoyadi: form.avukatAdiSoyadi,
    telefon: form.telefon,
    eposta: form.eposta,
    vergiNo: form.vergiNo,
    vergiDairesi: form.vergiDairesi,
    baroAdi: form.baroAdi,
    baroSicilNo: form.baroSicilNo,
    adres: form.adres,
    logoPath: form.logoPath,
  };
}

/** Genel bakış ve karşılama metinleri için ofis adı (ofis → avukat sırası). */
export function ofisKarsilamaAdi(row: Pick<OfficeSettings, "ofisAdi" | "avukatAdiSoyadi">): string {
  const ofis = (row.ofisAdi ?? "").trim();
  if (ofis) return ofis;
  return (row.avukatAdiSoyadi ?? "").trim();
}
