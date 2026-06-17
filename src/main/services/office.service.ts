import { app, dialog } from "electron";
import { copyFileSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { getDb, nowIso } from "../db/connection";
import type { OfficeSettings, OfficeSettingsInput, OfficeSettingsSaveSonuc } from "@shared/types/office";
import { DEFAULT_OFIS_ADI } from "@shared/types/officeDefaults";

export { DEFAULT_OFIS_ADI };

function ensureOfficeRow(): OfficeSettings {
  const d = getDb();
  let r = d.prepare(`SELECT * FROM office_settings WHERE id = 1`).get() as Record<string, unknown> | undefined;
  if (!r) {
    const t = nowIso();
    d.prepare(
      `INSERT INTO office_settings (id, ofis_adi, avukat_adi_soyadi, telefon, eposta, adres, vergi_no, vergi_dairesi, baro_adi, baro_sicil_no, logo_path, kayit_tarihi, guncelleme_tarihi)
       VALUES (1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`
    ).run(t, t);
    r = d.prepare(`SELECT * FROM office_settings WHERE id = 1`).get() as Record<string, unknown>;
  }
  return rowOffice(r);
}

function rowOffice(r: Record<string, unknown>): OfficeSettings {
  return {
    ofisAdi: r.ofis_adi == null ? null : String(r.ofis_adi),
    avukatAdiSoyadi: r.avukat_adi_soyadi == null ? null : String(r.avukat_adi_soyadi),
    telefon: r.telefon == null ? null : String(r.telefon),
    eposta: r.eposta == null ? null : String(r.eposta),
    adres: r.adres == null ? null : String(r.adres),
    vergiNo: r.vergi_no == null ? null : String(r.vergi_no),
    vergiDairesi: r.vergi_dairesi == null ? null : String(r.vergi_dairesi),
    baroAdi: r.baro_adi == null ? null : String(r.baro_adi),
    baroSicilNo: r.baro_sicil_no == null ? null : String(r.baro_sicil_no),
    logoPath: r.logo_path == null ? null : String(r.logo_path),
    kayitTarihi: String(r.kayit_tarihi ?? ""),
    guncellemeTarihi: String(r.guncelleme_tarihi ?? ""),
  };
}

/** Makbuz için ofis bilgisi — eksik alanlarda varsayılan/boş, hata fırlatmaz */
export function officeSettingsGetForMakbuz(): OfficeSettings {
  const r = getDb().prepare(`SELECT * FROM office_settings WHERE id = 1`).get() as Record<string, unknown> | undefined;
  if (!r) {
    const t = nowIso();
    return {
      ofisAdi: DEFAULT_OFIS_ADI,
      avukatAdiSoyadi: null,
      telefon: null,
      eposta: null,
      adres: null,
      vergiNo: null,
      vergiDairesi: null,
      baroAdi: null,
      baroSicilNo: null,
      logoPath: null,
      kayitTarihi: t,
      guncellemeTarihi: t,
    };
  }
  const o = rowOffice(r);
  if (!(o.ofisAdi ?? "").trim() && !(o.avukatAdiSoyadi ?? "").trim()) {
    return { ...o, ofisAdi: DEFAULT_OFIS_ADI };
  }
  return o;
}

export function officeSettingsGet(): OfficeSettings {
  return ensureOfficeRow();
}

export function officeSettingsSave(input: OfficeSettingsInput): OfficeSettingsSaveSonuc {
  const ofisAdi = (input.ofisAdi ?? "").trim();
  const avukatAdiSoyadi = (input.avukatAdiSoyadi ?? "").trim();
  if (!ofisAdi && !avukatAdiSoyadi) {
    return { ok: false, error: "Ofis adı veya avukat adı soyadından en az biri zorunludur." };
  }
  ensureOfficeRow();
  const t = nowIso();
  const logoPath = input.logoPath !== undefined ? (input.logoPath?.trim() || null) : undefined;
  const d = getDb();
  const fields = [
    "ofis_adi = ?",
    "avukat_adi_soyadi = ?",
    "telefon = ?",
    "eposta = ?",
    "adres = ?",
    "vergi_no = ?",
    "vergi_dairesi = ?",
    "baro_adi = ?",
    "baro_sicil_no = ?",
    "guncelleme_tarihi = ?",
  ];
  const vals: unknown[] = [
    ofisAdi || null,
    avukatAdiSoyadi || null,
    (input.telefon ?? "").trim() || null,
    (input.eposta ?? "").trim() || null,
    (input.adres ?? "").trim() || null,
    (input.vergiNo ?? "").trim() || null,
    (input.vergiDairesi ?? "").trim() || null,
    (input.baroAdi ?? "").trim() || null,
    (input.baroSicilNo ?? "").trim() || null,
    t,
  ];
  if (logoPath !== undefined) {
    fields.push("logo_path = ?");
    vals.push(logoPath);
  }
  vals.push(1);
  d.prepare(`UPDATE office_settings SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
  return { ok: true, row: officeSettingsGet() };
}

export async function officePickLogo(): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Ofis logosu seç",
    filters: [{ name: "Resim", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"] }],
    properties: ["openFile"],
  });
  if (canceled || !filePaths[0]?.trim()) {
    return { ok: false, error: "Logo seçimi iptal edildi." };
  }
  try {
    const src = filePaths[0];
    const logosDir = join(app.getPath("userData"), "logos");
    mkdirSync(logosDir, { recursive: true });
    const ext = extname(src).toLowerCase() || ".png";
    const dest = join(logosDir, `office-logo${ext}`);
    copyFileSync(src, dest);
    return { ok: true, path: dest };
  } catch (e) {
    console.error("[officePickLogo]", e);
    return { ok: false, error: "Logo kopyalanamadı." };
  }
}
