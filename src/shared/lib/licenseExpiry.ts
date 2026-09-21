/** Uyarı gösterilecek kalan gün eşikleri (büyükten küçüğe). */
export const LICENSE_WARNING_THRESHOLDS = [30, 15, 7, 3, 1] as const;

export type LicenseWarningThreshold = (typeof LICENSE_WARNING_THRESHOLDS)[number];

/** Bitiş tarihine kalan gün sayısı (lisansın toplam süresi değil; geçen günler düşülmüş halidir). */
export function computeDaysRemaining(expiresAt: string | null | undefined, now = Date.now()): number | null {
  if (!expiresAt?.trim()) return null;
  const ms = new Date(expiresAt).getTime();
  if (!Number.isFinite(ms)) return null;
  const diff = ms - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isLicenseExpiredByDate(expiresAt: string | null | undefined, now = Date.now()): boolean {
  const days = computeDaysRemaining(expiresAt, now);
  return days != null && days <= 0;
}

/** Gösterilecek uyarı eşiği (30→15→7→3→1 aralıklarına göre). */
export function pickWarningThreshold(daysRemaining: number | null): LicenseWarningThreshold | null {
  if (daysRemaining == null || daysRemaining <= 0) return null;
  const sorted = [...LICENSE_WARNING_THRESHOLDS].sort((a, b) => b - a);
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const lower = sorted[i + 1] ?? 0;
    if (daysRemaining <= t && daysRemaining > lower) return t;
  }
  return null;
}

/** Paid renewal modalı yalnızca ücretli ve geçerli lisans + eşik + kurulum tamam için. */
export function isPaidRenewalReminderEligible(input: {
  valid: boolean;
  kind?: string | null;
  warningThreshold: LicenseWarningThreshold | null;
  needsSetup?: boolean;
}): boolean {
  if (input.needsSetup === true) return false;
  if (!input.valid) return false;
  if (input.kind !== "paid") return false;
  return input.warningThreshold != null;
}

export function desktopLicenseKindLabel(kind?: string | null): string | null {
  if (kind === "trial") return "7 Günlük Ücretsiz Deneme";
  if (kind === "paid") return "Yıllık Lisans";
  return null;
}

/** Settings CTA: paid renews; trial upgrades in-app. No invented shop URL. */
export function desktopLicenseActionCta(kind?: string | null): "renew" | "upgrade" | null {
  if (kind === "trial") return "upgrade";
  if (kind === "paid") return "renew";
  return null;
}

/** Renderer contexts refresh local license state after in-app activate (trial→paid). */
export const DESKTOP_LICENSE_UPDATED_EVENT = "mkd-license-updated";

export function formatLicenseExpiryDate(expiresAt: string | null | undefined): string | null {
  if (!expiresAt?.trim()) return null;
  const d = new Date(expiresAt);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Otomatik validate: son doğrulamadan bu kadar süre geçmediyse atla. */
export function shouldRunAutomaticValidate(lastValidatedAt: string | null | undefined, now = Date.now()): boolean {
  if (!lastValidatedAt?.trim()) return true;
  const ms = new Date(lastValidatedAt).getTime();
  if (!Number.isFinite(ms)) return true;
  return now - ms >= MS_PER_DAY;
}
