export type OfficeSettings = {
  ofisAdi: string | null;
  avukatAdiSoyadi: string | null;
  telefon: string | null;
  eposta: string | null;
  adres: string | null;
  vergiNo: string | null;
  vergiDairesi: string | null;
  baroAdi: string | null;
  baroSicilNo: string | null;
  logoPath: string | null;
  kayitTarihi: string;
  guncellemeTarihi: string;
};

export type OfficeSettingsInput = {
  ofisAdi?: string | null;
  avukatAdiSoyadi?: string | null;
  telefon?: string | null;
  eposta?: string | null;
  adres?: string | null;
  vergiNo?: string | null;
  vergiDairesi?: string | null;
  baroAdi?: string | null;
  baroSicilNo?: string | null;
  logoPath?: string | null;
};

export type OfficeSettingsSaveSonuc =
  | { ok: true; row: OfficeSettings }
  | { ok: false; error: string };
