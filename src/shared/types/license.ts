export const APP_CODE_MUVEKKIL_KASA_DESKTOP = "MUVEKKIL_KASA_DESKTOP";

export const OFFLINE_GRACE_DAYS = 7;

export type LocalLicenseStatus = "ACTIVE" | "LOCKED" | "NONE";

export type LocalLicenseRecord = {
  licenseKey: string;
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
  message: string | null;
  record: LocalLicenseRecord | null;
};

export type LicenseActivateInput = {
  licenseKey: string;
  activationPassword: string;
};

export type LicenseActivateResult =
  | { ok: true; message: string; productName: string; expiresAt: string | null }
  | { ok: false; error: string };

export type LicenseValidateResult =
  | { ok: true; message: string; expiresAt: string | null }
  | { ok: false; error: string; locked?: boolean };
