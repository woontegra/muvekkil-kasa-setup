import bcrypt from "bcryptjs";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { getDb, nowIso } from "../db/connection";
import type { AuthUser, LoginInput, RememberedLogin, SetupInput } from "@shared/types/auth";
import { GUVENLIK_SORU_KODLARI, GUVENLIK_SORULARI } from "@shared/types/auth";

let session: AuthUser | null = null;

const REMEMBERED_LOGIN_FILE = "remembered-login.json";
const LEGACY_REMEMBER_FILE = "auth-remember.json";

function normalizeGuvenlikCevabi(raw: string): string {
  return raw.trim().toLocaleLowerCase("tr-TR");
}

function rowToUser(r: {
  id: number;
  ad_soyad: string;
  kullanici_adi: string;
  eposta: string | null;
}): AuthUser {
  const ep = r.eposta;
  return {
    id: r.id,
    adSoyad: String(r.ad_soyad ?? ""),
    kullaniciAdi: String(r.kullanici_adi ?? ""),
    eposta: ep == null || String(ep).trim() === "" ? null : String(ep),
  };
}

export function authGetSession(): AuthUser | null {
  return session;
}

export function authLoginSuccess(user: AuthUser): void {
  session = user;
}

export function authLogout(): void {
  session = null;
}

export function uygulamaKullaniciSayisi(): number {
  const row = getDb().prepare(`SELECT COUNT(*) AS c FROM uygulama_kullanici`).get() as { c: number };
  return Number(row.c);
}

export function needsSetup(): boolean {
  return uygulamaKullaniciSayisi() === 0;
}

export function setupFirst(input: SetupInput): { ok: true; user: AuthUser } | { ok: false; error: string } {
  if (uygulamaKullaniciSayisi() > 0) {
    return { ok: false, error: "İlk kurulum zaten tamamlandı." };
  }
  const adSoyad = input.adSoyad.trim();
  const kullaniciAdi = input.kullaniciAdi.trim();
  const soruKodu = input.guvenlikSorusuKodu.trim();
  if (!adSoyad || !kullaniciAdi || !input.sifre) {
    return { ok: false, error: "Lütfen tüm alanları doldurun." };
  }
  if (!GUVENLIK_SORU_KODLARI.includes(soruKodu)) {
    return { ok: false, error: "Güvenlik sorusu seçilmelidir." };
  }
  const cevapNorm = normalizeGuvenlikCevabi(input.guvenlikCevabi);
  if (!cevapNorm) return { ok: false, error: "Güvenlik cevabı zorunludur." };
  if (kullaniciAdi.length < 3) {
    return { ok: false, error: "Kullanıcı adı en az 3 karakter olmalıdır." };
  }
  if (input.sifre.length < 6) {
    return { ok: false, error: "Şifre en az 6 karakter olmalıdır." };
  }
  const hash = bcrypt.hashSync(input.sifre, 12);
  const cevapHash = bcrypt.hashSync(cevapNorm, 12);
  const t = nowIso();
  try {
    const info = getDb()
      .prepare(
        `INSERT INTO uygulama_kullanici (ad_soyad, kullanici_adi, eposta, sifre_hash, guvenlik_sorusu_kodu, guvenlik_cevap_hash, aktif_mi, kayit_tarihi)
         VALUES (?, ?, NULL, ?, ?, ?, 1, ?)`
      )
      .run(adSoyad, kullaniciAdi, hash, soruKodu, cevapHash, t);
    const id = Number(info.lastInsertRowid);
    const user: AuthUser = { id, adSoyad, kullaniciAdi, eposta: null };
    authLoginSuccess(user);
    clearRememberedLogin();
    return { ok: true, user };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toUpperCase().includes("UNIQUE")) {
      return { ok: false, error: "Bu kullanıcı adı zaten kayıtlı." };
    }
    return { ok: false, error: "Hesap oluşturulamadı." };
  }
}

export function login(input: LoginInput): { ok: true; user: AuthUser } | { ok: false; error: string } {
  const ka = input.kullaniciAdi.trim();
  if (!ka || !input.password) {
    return { ok: false, error: "Lütfen tüm alanları doldurun." };
  }
  const r = getDb()
    .prepare(
      `SELECT id, ad_soyad, kullanici_adi, eposta, sifre_hash, aktif_mi
       FROM uygulama_kullanici WHERE kullanici_adi = ? COLLATE NOCASE`
    )
    .get(ka) as
    | {
        id: number;
        ad_soyad: string;
        kullanici_adi: string;
        eposta: string | null;
        sifre_hash: string;
        aktif_mi: number;
      }
    | undefined;
  if (!r) return { ok: false, error: "Kullanıcı adı veya şifre hatalı." };
  if (!Number(r.aktif_mi)) return { ok: false, error: "Bu kullanıcı pasif durumda." };
  if (!bcrypt.compareSync(input.password, r.sifre_hash)) {
    return { ok: false, error: "Kullanıcı adı veya şifre hatalı." };
  }
  const user = rowToUser(r);
  authLoginSuccess(user);
  return { ok: true, user };
}

export function forgotPasswordGetQuestion(kullaniciAdi: string) {
  const ka = kullaniciAdi.trim();
  if (!ka) return { ok: false as const, error: "Kullanıcı adı boş olamaz." };
  const r = getDb()
    .prepare(
      `SELECT guvenlik_sorusu_kodu, guvenlik_cevap_hash, aktif_mi FROM uygulama_kullanici WHERE kullanici_adi = ? COLLATE NOCASE`
    )
    .get(ka) as { guvenlik_sorusu_kodu: string | null; guvenlik_cevap_hash: string | null; aktif_mi: number } | undefined;
  if (!r || !Number(r.aktif_mi)) return { ok: false as const, error: "Kullanıcı bulunamadı." };
  const kod = r.guvenlik_sorusu_kodu?.trim() ?? "";
  if (!kod) {
    return { ok: false as const, error: "Bu hesap için güvenlik sorusu tanımlı değil." };
  }
  const soru = GUVENLIK_SORULARI[kod];
  if (!soru) return { ok: false as const, error: "Bu hesap için güvenlik sorusu tanımlı değil." };
  return { ok: true as const, soruMetni: soru };
}

export function forgotPasswordSubmit(input: {
  kullaniciAdi: string;
  guvenlikCevabi: string;
  yeniSifre: string;
}) {
  const ka = input.kullaniciAdi.trim();
  if (!ka) return { ok: false as const, error: "Kullanıcı adı boş olamaz." };
  if (input.yeniSifre.length < 6) {
    return { ok: false as const, error: "Yeni şifre en az 6 karakter olmalıdır." };
  }
  const r = getDb()
    .prepare(`SELECT id, guvenlik_cevap_hash FROM uygulama_kullanici WHERE kullanici_adi = ? COLLATE NOCASE AND aktif_mi = 1`)
    .get(ka) as { id: number; guvenlik_cevap_hash: string | null } | undefined;
  if (!r?.guvenlik_cevap_hash) {
    return { ok: false as const, error: "Kullanıcı bulunamadı veya güvenlik cevabı tanımlı değil." };
  }
  const norm = normalizeGuvenlikCevabi(input.guvenlikCevabi);
  if (!bcrypt.compareSync(norm, r.guvenlik_cevap_hash)) {
    return { ok: false as const, error: "Güvenlik cevabı hatalı." };
  }
  const yeniHash = bcrypt.hashSync(input.yeniSifre, 12);
  getDb().prepare(`UPDATE uygulama_kullanici SET sifre_hash = ? WHERE id = ?`).run(yeniHash, r.id);
  return { ok: true as const };
}

function rememberPath(): string {
  return join(app.getPath("userData"), REMEMBERED_LOGIN_FILE);
}

function legacyRememberPath(): string {
  return join(app.getPath("userData"), LEGACY_REMEMBER_FILE);
}

function readRememberedFromFile(path: string): RememberedLogin | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      v?: number;
      kullaniciAdi?: string;
      rememberMe?: boolean;
    };
    const ka = raw.kullaniciAdi?.trim();
    if (!ka) return null;
    return { kullaniciAdi: ka, rememberMe: raw.rememberMe !== false };
  } catch {
    return null;
  }
}

export function saveRememberedLogin(kullaniciAdi: string): { ok: boolean; error?: string } {
  const ka = kullaniciAdi.trim();
  if (!ka) return { ok: false, error: "Kullanıcı adı boş olamaz." };
  const payload = { v: 2, kullaniciAdi: ka, rememberMe: true as const };
  try {
    writeFileSync(rememberPath(), JSON.stringify(payload), "utf8");
    if (existsSync(legacyRememberPath())) {
      try {
        unlinkSync(legacyRememberPath());
      } catch {
        /* ignore */
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Hatırlanan kullanıcı adı kaydedilemedi." };
  }
}

export function getRememberedLogin(): RememberedLogin | null {
  return readRememberedFromFile(rememberPath()) ?? readRememberedFromFile(legacyRememberPath());
}

export function clearRememberedLogin(): void {
  for (const p of [rememberPath(), legacyRememberPath()]) {
    if (!existsSync(p)) continue;
    try {
      unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
}

export function authRestoreRemembered(): void {
  /* Oturum otomatik açılmaz; yalnızca login formu doldurulur */
}

export function authGuvenlikBilgisi(
  userId: number
): { ok: true; guvenlikSorusuKodu: string | null } | { ok: false; error: string } {
  const r = getDb()
    .prepare(`SELECT guvenlik_sorusu_kodu FROM uygulama_kullanici WHERE id = ? AND aktif_mi = 1`)
    .get(userId) as { guvenlik_sorusu_kodu: string | null } | undefined;
  if (!r) return { ok: false, error: "Kullanıcı bulunamadı." };
  const kod = r.guvenlik_sorusu_kodu?.trim() ?? "";
  return { ok: true, guvenlikSorusuKodu: kod || null };
}

export function authGuvenlikGuncelle(
  userId: number,
  input: { mevcutSifre: string; guvenlikSorusuKodu: string; guvenlikCevabi: string }
): { ok: true } | { ok: false; error: string } {
  const r = getDb()
    .prepare(`SELECT sifre_hash FROM uygulama_kullanici WHERE id = ? AND aktif_mi = 1`)
    .get(userId) as { sifre_hash: string } | undefined;
  if (!r) return { ok: false, error: "Kullanıcı bulunamadı." };
  if (!input.mevcutSifre) return { ok: false, error: "Mevcut şifre zorunludur." };
  if (!bcrypt.compareSync(input.mevcutSifre, r.sifre_hash)) {
    return { ok: false, error: "Mevcut şifre hatalı." };
  }
  const soruKodu = input.guvenlikSorusuKodu.trim();
  if (!GUVENLIK_SORU_KODLARI.includes(soruKodu)) {
    return { ok: false, error: "Güvenlik sorusu seçilmelidir." };
  }
  const cevapNorm = normalizeGuvenlikCevabi(input.guvenlikCevabi);
  if (!cevapNorm) return { ok: false, error: "Güvenlik cevabı zorunludur." };
  const cevapHash = bcrypt.hashSync(cevapNorm, 12);
  getDb()
    .prepare(`UPDATE uygulama_kullanici SET guvenlik_sorusu_kodu = ?, guvenlik_cevap_hash = ? WHERE id = ?`)
    .run(soruKodu, cevapHash, userId);
  return { ok: true };
}

export function authSifreGuncelle(
  userId: number,
  input: { mevcutSifre: string; yeniSifre: string }
): { ok: true } | { ok: false; error: string } {
  const r = getDb()
    .prepare(`SELECT sifre_hash FROM uygulama_kullanici WHERE id = ? AND aktif_mi = 1`)
    .get(userId) as { sifre_hash: string } | undefined;
  if (!r) return { ok: false, error: "Kullanıcı bulunamadı." };
  if (!input.mevcutSifre) return { ok: false, error: "Mevcut şifre zorunludur." };
  if (!bcrypt.compareSync(input.mevcutSifre, r.sifre_hash)) {
    return { ok: false, error: "Mevcut şifre hatalı." };
  }
  const yeniSifre = (input.yeniSifre ?? "").trim();
  if (!yeniSifre) return { ok: false, error: "Yeni şifre boş olamaz." };
  if (yeniSifre.length < 6) {
    return { ok: false, error: "Yeni şifre en az 6 karakter olmalıdır." };
  }
  const yeniHash = bcrypt.hashSync(yeniSifre, 12);
  getDb().prepare(`UPDATE uygulama_kullanici SET sifre_hash = ? WHERE id = ?`).run(yeniHash, userId);
  return { ok: true };
}
