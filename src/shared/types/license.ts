import type { LicenseWarningThreshold } from "../lib/licenseExpiry";

export const APP_CODE_MUVEKKIL_KASA_DESKTOP = "MUVEKKIL_KASA_DESKTOP";

export const OFFLINE_GRACE_DAYS = 7;
export const TRIAL_OFFLINE_GRACE_DAYS = 0;

export type LocalLicenseStatus = "ACTIVE" | "LOCKED" | "NONE";
export type LocalLicenseKind = "paid" | "trial";

export type LicensePhase =
  | "needsActivation"
  | "trialActive"
  | "trialNetworkRequired"
  | "trialExpired"
  | "paidActive"
  | "paidOfflineGrace"
  | "locked";

export type LocalLicenseRecord = {
  kind: LocalLicenseKind;
  licenseKey: string | null;
  deviceHash: string;
  productName: string | null;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  offlineGraceUntil: string | null;
  status: LocalLicenseStatus;
};

export type LicenseState = {
  valid: boolean;
  needsActivation: boolean;
  locked: boolean;
  phase: LicensePhase;
  /** Lisans bitiş tarihi geçmiş (sunucu yenilemesi gerekir). */
  isExpired: boolean;
  /** Sunucuya ulaşılamadı; son başarılı doğrulama ile devam. */
  offlineDegraded: boolean;
  daysRemaining: number | null;
  expiresAt: string | null;
  expiryLabel: string | null;
  warningThreshold: LicenseWarningThreshold | null;
  message: string | null;
  record: LocalLicenseRecord | null;
};

export type LicenseActivateInput = {
  licenseKey: string;
  activationPassword: string;
};

export type LicenseStartTrialInput = {
  email: string;
  phone: string;
};

export type LicenseActivateResult =
  | { ok: true; message: string; productName: string; expiresAt: string | null }
  | { ok: false; error: string };

export type LicenseStartTrialResult =
  | { ok: true; message: string; expiresAt: string; resumed: boolean }
  | { ok: false; error: string; code?: string };

export type LicenseValidateResult =
  | {
      ok: true;
      message: string;
      expiresAt: string | null;
      offlineDegraded?: boolean;
    }
  | { ok: false; error: string; locked?: boolean; code?: string };

export type LicenseValidateOptions = {
  /** Manuel “Lisansı Kontrol Et” — günlük sınırı atlar. */
  force?: boolean;
};
