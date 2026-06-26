import type { LicenseWarningThreshold } from "@shared/lib/licenseExpiry";

const STORAGE_KEY = "mkd-license-warnings-v1";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** Aynı gün içinde aynı eşik uyarısı tekrar gösterilmesin. */
export function shouldShowExpiryWarning(threshold: LicenseWarningThreshold): boolean {
  const map = readMap();
  return map[String(threshold)] !== todayKey();
}

export function markExpiryWarningShown(threshold: LicenseWarningThreshold): void {
  const map = readMap();
  map[String(threshold)] = todayKey();
  writeMap(map);
}

export async function openLicenseRenewalPage(): Promise<void> {
  await window.api.licenseOpenRenewalUrl();
}
