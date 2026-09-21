export const TRIAL_EMAIL_MAX_LENGTH = 200;
export const TRIAL_PHONE_CANONICAL_PATTERN = /^\+905\d{9}$/;
export const TRIAL_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const TRIAL_ALREADY_USED_MESSAGE =
  "Bu cihaz, e-posta adresi veya telefon numarası ile Müvekkil Kasa Defteri ücretsiz denemesi daha önce kullanılmış.";

export const TRIAL_NETWORK_REQUIRED_MESSAGE =
  "Ücretsiz deneme lisansınızı doğrulamak için internet bağlantısı gereklidir.";

export function normalizeTrialEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized.length > TRIAL_EMAIL_MAX_LENGTH) return null;
  if (!TRIAL_EMAIL_PATTERN.test(normalized)) return null;
  return normalized;
}

export function normalizeTurkishMobile(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const compact = raw.trim();
  if (!compact) return null;
  const digits = compact.replace(/\D/g, "");
  if (!digits) return null;

  let national = digits;
  if (national.startsWith("0090")) national = national.slice(4);
  else if (national.startsWith("90") && national.length >= 12) national = national.slice(2);
  else if (national.startsWith("0")) national = national.slice(1);

  const canonical = `+90${national}`;
  if (!TRIAL_PHONE_CANONICAL_PATTERN.test(canonical)) return null;
  return canonical;
}

export function requireTrialEmail(raw: unknown): string {
  const email = normalizeTrialEmail(raw);
  if (!email) throw new Error("Geçerli bir e-posta adresi girin.");
  return email;
}

export function requireTurkishMobile(raw: unknown): string {
  const phone = normalizeTurkishMobile(raw);
  if (!phone) throw new Error("Geçerli bir Türkiye cep telefonu girin.");
  return phone;
}
