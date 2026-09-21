import { app, dialog, nativeImage } from "electron";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { getDb, nowIso } from "../db/connection";
import type { OfficeSettings, OfficeSettingsInput, OfficeSettingsSaveSonuc } from "@shared/types/office";
import { DEFAULT_OFIS_ADI } from "@shared/types/officeDefaults";

export { DEFAULT_OFIS_ADI };

const ALLOWED_LOGO_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function logosDir(): string {
  return join(app.getPath("userData"), "logos");
}

function logoMime(ext: string): string {
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function isAllowedLogoPath(filePath: string): boolean {
  const resolved = resolve(filePath);
  const base = resolve(logosDir());
  const rel = relative(base, resolved);
  if (!rel || rel.startsWith("..") || rel.includes("..")) return false;
  return ALLOWED_LOGO_EXT.has(extname(resolved).toLowerCase());
}

/** Güvenli logos klasöründeki dosyayı data URL olarak okur (önizleme / makbuz). */
export function officeLogoDataUrl(filePath: string | null | undefined): string | null {
  const p = (filePath ?? "").trim();
  if (!p || !isAllowedLogoPath(p) || !existsSync(p)) return null;
  try {
    const ext = extname(p).toLowerCase();
    const buf = readFileSync(p);
    if (ext === ".webp") {
      const img = nativeImage.createFromBuffer(buf);
      if (!img.isEmpty()) {
        return `data:image/png;base64,${img.toPNG().toString("base64")}`;
      }
    }
    return `data:${logoMime(ext)};base64,${buf.toString("base64")}`;
  } catch (e) {
    console.error("[officeLogoDataUrl]", e);
    return null;
  }
}

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
    if (logoPath && !isAllowedLogoPath(logoPath)) {
      return { ok: false, error: "Logo dosyası geçersiz veya güvenli klasör dışında." };
    }
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
    filters: [{ name: "Resim", extensions: ["png", "jpg", "jpeg", "webp"] }],
    properties: ["openFile"],
  });
  if (canceled || !filePaths[0]?.trim()) {
    return { ok: false, error: "Logo seçimi iptal edildi." };
  }
  try {
    const src = filePaths[0];
    const dir = logosDir();
    mkdirSync(dir, { recursive: true });
    const ext = extname(src).toLowerCase();
    if (!ALLOWED_LOGO_EXT.has(ext)) {
      return { ok: false, error: "Desteklenmeyen dosya türü. PNG, JPG, JPEG veya WEBP seçin." };
    }
    const dest = join(dir, `office-logo${ext}`);
    copyFileSync(src, dest);
    return { ok: true, path: dest };
  } catch (e) {
    console.error("[officePickLogo]", e);
    return { ok: false, error: "Logo kopyalanamadı." };
  }
}
