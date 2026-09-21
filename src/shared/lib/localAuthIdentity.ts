import { TRIAL_EMAIL_PATTERN } from "./trialContact";

export function safeTrim(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

export function normalizeLocalEmail(raw: unknown): string {
  return safeTrim(raw).toLowerCase();
}

export function isLocalEmailIdentity(raw: string): boolean {
  const email = normalizeLocalEmail(raw);
  return Boolean(email) && TRIAL_EMAIL_PATTERN.test(email);
}

export type ResolvedInternalUsername =
  | { ok: true; kullaniciAdi: string; eposta: string | null }
  | { ok: false; error: string };

/**
 * Yeni hesap: kullanici_adi = normalize(email).
 * E-posta yoksa (e2e / nadir API) mevcut kullaniciAdi korunur — kolon drop edilmez.
 */
export function resolveInternalUsername(input: {
  eposta?: string | null;
  kullaniciAdi?: string | null;
}): ResolvedInternalUsername {
  const emailRaw = safeTrim(input?.eposta);
  if (emailRaw) {
    const email = normalizeLocalEmail(emailRaw);
    if (!TRIAL_EMAIL_PATTERN.test(email)) {
      return { ok: false, error: "Geçerli bir e-posta adresi girin." };
    }
    return { ok: true, kullaniciAdi: email, eposta: email };
  }
  const ka = safeTrim(input?.kullaniciAdi);
  if (ka) {
    return { ok: true, kullaniciAdi: ka, eposta: null };
  }
  return { ok: false, error: "E-posta zorunludur." };
}

export const LOGIN_IDENTITY_SQL =
  "kullanici_adi = ? COLLATE NOCASE OR (eposta IS NOT NULL AND TRIM(eposta) != '' AND eposta = ? COLLATE NOCASE)";

/** Login / forgot-password boş kimlik — trial setup e-posta doğrulaması buna dahil değil. */
export const LOCAL_AUTH_IDENTITY_EMPTY_ERROR = "E-posta veya kullanıcı adı boş olamaz.";

/** Login başarısız — e-posta veya legacy kullanıcı adı. */
export const LOCAL_AUTH_CREDENTIALS_INVALID_ERROR = "E-posta, kullanıcı adı veya şifre hatalı.";
