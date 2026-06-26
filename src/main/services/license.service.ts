import { app } from "electron";
import { getDb, nowIso } from "../db/connection";
import { computeDeviceHash, getDeviceName, getPlatformLabel } from "./deviceHash.service";
import {
  computeDaysRemaining,
  formatLicenseExpiryDate,
  isLicenseExpiredByDate,
  pickWarningThreshold,
  shouldRunAutomaticValidate,
} from "@shared/lib/licenseExpiry";
import {
  APP_CODE_MUVEKKIL_KASA_DESKTOP,
  OFFLINE_GRACE_DAYS,
  type LicenseActivateInput,
  type LicenseActivateResult,
  type LicenseState,
  type LicenseValidateOptions,
  type LicenseValidateResult,
  type LocalLicenseRecord,
  type LocalLicenseStatus,
} from "@shared/types/license";

const LICENSE_API_BASE = (
  process.env.LICENSE_API_BASE ??
  "https://lisans-server-backend-production.up.railway.app/api/public/license"
).replace(/\/$/, "");

/** Son doğrulama çevrimdışı toleransla mı tamamlandı (DB şeması değiştirmeden). */
let lastOfflineDegraded = false;

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function rowToRecord(r: {
  license_key: string;
  device_hash: string;
  product_name: string | null;
  expires_at: string | null;
  last_validated_at: string | null;
  offline_grace_until: string | null;
  status: string;
}): LocalLicenseRecord {
  return {
    licenseKey: r.license_key,
    deviceHash: r.device_hash,
    productName: r.product_name,
    expiresAt: r.expires_at,
    lastValidatedAt: r.last_validated_at,
    offlineGraceUntil: r.offline_grace_until,
    status: r.status as LocalLicenseStatus,
  };
}

function readLocalLicense(): LocalLicenseRecord | null {
  const row = getDb()
    .prepare(
      `SELECT license_key, device_hash, product_name, expires_at, last_validated_at, offline_grace_until, status
       FROM yerel_lisans WHERE id = 1`,
    )
    .get() as
    | {
        license_key: string;
        device_hash: string;
        product_name: string | null;
        expires_at: string | null;
        last_validated_at: string | null;
        offline_grace_until: string | null;
        status: string;
      }
    | undefined;
  return row ? rowToRecord(row) : null;
}

function saveLocalLicense(input: {
  licenseKey: string;
  deviceHash: string;
  productName: string | null;
  expiresAt: string | null;
  lastValidatedAt: string;
  status: LocalLicenseStatus;
  offlineGraceDays?: number;
}): void {
  const now = nowIso();
  const graceDays = input.offlineGraceDays ?? OFFLINE_GRACE_DAYS;
  const offlineGraceUntil = addDaysIso(input.lastValidatedAt, graceDays);
  getDb()
    .prepare(
      `INSERT INTO yerel_lisans (
        id, license_key, device_hash, product_name, expires_at,
        last_validated_at, offline_grace_until, status, kayit_tarihi, guncelleme_tarihi
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        license_key = excluded.license_key,
        device_hash = excluded.device_hash,
        product_name = excluded.product_name,
        expires_at = excluded.expires_at,
        last_validated_at = excluded.last_validated_at,
        offline_grace_until = excluded.offline_grace_until,
        status = excluded.status,
        guncelleme_tarihi = excluded.guncelleme_tarihi`,
    )
    .run(
      input.licenseKey,
      input.deviceHash,
      input.productName,
      input.expiresAt,
      input.lastValidatedAt,
      offlineGraceUntil,
      input.status,
      now,
      now,
    );
}

function enrichState(
  record: LocalLicenseRecord | null,
  base: Omit<LicenseState, "daysRemaining" | "expiresAt" | "expiryLabel" | "warningThreshold" | "isExpired" | "offlineDegraded">,
  offlineDegraded = false,
): LicenseState {
  const expiresAt = record?.expiresAt ?? null;
  const daysRemaining = computeDaysRemaining(expiresAt);
  const isExpired = isLicenseExpiredByDate(expiresAt);
  return {
    ...base,
    isExpired,
    offlineDegraded: base.valid && offlineDegraded,
    daysRemaining,
    expiresAt,
    expiryLabel: formatLicenseExpiryDate(expiresAt),
    warningThreshold: pickWarningThreshold(daysRemaining),
    record,
  };
}

function evaluateLocal(record: LocalLicenseRecord | null): LicenseState {
  if (!record || record.status === "NONE") {
    return enrichState(null, {
      valid: false,
      needsActivation: true,
      locked: false,
      message: "Lisans aktivasyonu gerekli.",
      record: null,
    });
  }

  const now = Date.now();
  const expired = isLicenseExpiredByDate(record.expiresAt, now);
  const graceMs = record.offlineGraceUntil ? new Date(record.offlineGraceUntil).getTime() : null;

  if (record.status === "LOCKED") {
    return enrichState(record, {
      valid: false,
      needsActivation: false,
      locked: true,
      message: expired
        ? "Lisans süreniz sona erdi. Yenileme için lisansınızı kontrol edin."
        : "Lisans geçerli değil. Lisansı Kontrol Et ile tekrar deneyin.",
      record,
    });
  }

  if (expired) {
    return enrichState(record, {
      valid: false,
      needsActivation: false,
      locked: true,
      message: "Lisans süreniz sona erdi. Programı kullanmaya devam etmek için lisansınızı yenileyin.",
      record,
    });
  }

  if (graceMs != null && graceMs < now) {
    return enrichState(record, {
      valid: false,
      needsActivation: false,
      locked: true,
      message: "Lisans doğrulaması yapılamadı. İnternet bağlantınızı kontrol edin.",
      record,
    });
  }

  return enrichState(record, {
    valid: true,
    needsActivation: false,
    locked: false,
    message: null,
    record,
  });
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${LICENSE_API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("SERVER_UNREACHABLE");
  }
  return (await res.json()) as T;
}

export function licenseGetState(): LicenseState {
  return evaluateLocal(readLocalLicense());
}

function stateWithOfflineFlag(state: LicenseState): LicenseState {
  if (!lastOfflineDegraded || !state.valid) return state;
  return { ...state, offlineDegraded: true };
}

export async function licenseActivate(input: LicenseActivateInput): Promise<LicenseActivateResult> {
  const licenseKey = input.licenseKey.replace(/\s+/g, "").toUpperCase();
  const activationPassword = input.activationPassword.trim();
  if (!licenseKey || !activationPassword) {
    return { ok: false, error: "Lisans anahtarı ve aktivasyon şifresi zorunludur." };
  }

  const deviceHash = computeDeviceHash();
  try {
    const out = await postJson<{
      success: boolean;
      message?: string;
      expiresAt?: string | null;
    }>("/activate", {
      licenseKey,
      activationPassword,
      deviceHash,
      appCode: APP_CODE_MUVEKKIL_KASA_DESKTOP,
      deviceName: getDeviceName(),
      platform: getPlatformLabel(),
      appVersion: app.getVersion(),
    });

    if (!out.success) {
      return {
        ok: false,
        error: out.message?.trim() || "Lisans aktivasyonu başarısız. Bilgileri kontrol edip tekrar deneyin.",
      };
    }

    const validatedAt = new Date().toISOString();
    saveLocalLicense({
      licenseKey,
      deviceHash,
      productName: "Müvekkil Kasa Defteri",
      expiresAt: out.expiresAt ?? null,
      lastValidatedAt: validatedAt,
      status: "ACTIVE",
    });
    lastOfflineDegraded = false;

    return {
      ok: true,
      message: out.message ?? "Lisans aktifleştirildi.",
      productName: "Müvekkil Kasa Defteri",
      expiresAt: out.expiresAt ?? null,
    };
  } catch (e) {
    if (e instanceof Error && e.message === "SERVER_UNREACHABLE") {
      return { ok: false, error: "Lisans sunucusuna ulaşılamadı. İnternet bağlantınızı ve lisans sunucusunu kontrol edin." };
    }
    return { ok: false, error: "Lisans sunucusuna ulaşılamadı. İnternet bağlantınızı ve lisans sunucusunu kontrol edin." };
  }
}

export async function licenseValidate(options?: LicenseValidateOptions): Promise<LicenseValidateResult> {
  const record = readLocalLicense();
  if (!record) {
    return { ok: false, error: "Lisans kaydı bulunamadı.", locked: false };
  }

  if (!options?.force && !shouldRunAutomaticValidate(record.lastValidatedAt)) {
    const local = evaluateLocal(record);
    if (local.valid) {
      return {
        ok: true,
        message: lastOfflineDegraded
          ? "Lisans sunucusuna ulaşılamadı. Son doğrulama bilgisiyle devam ediyorsunuz."
          : "Son lisans doğrulaması bugün yapıldı.",
        expiresAt: record.expiresAt,
        offlineDegraded: lastOfflineDegraded || undefined,
      };
    }
  }

  const localState = evaluateLocal(record);
  if (localState.locked && localState.isExpired) {
    getDb()
      .prepare(`UPDATE yerel_lisans SET status = 'LOCKED', guncelleme_tarihi = ? WHERE id = 1`)
      .run(nowIso());
    return { ok: false, error: localState.message ?? "Lisans süreniz sona erdi.", locked: true };
  }

  try {
    const out = await postJson<{
      valid: boolean;
      message?: string;
      expiresAt?: string | null;
      offlineGraceDays?: number;
      status?: string;
    }>("/validate", {
      licenseKey: record.licenseKey,
      deviceHash: record.deviceHash,
      appCode: APP_CODE_MUVEKKIL_KASA_DESKTOP,
    });

    if (!out.valid) {
      getDb()
        .prepare(`UPDATE yerel_lisans SET status = 'LOCKED', guncelleme_tarihi = ? WHERE id = 1`)
        .run(nowIso());
      return { ok: false, error: out.message ?? "Lisans doğrulanamadı.", locked: true };
    }

    const validatedAt = new Date().toISOString();
    saveLocalLicense({
      licenseKey: record.licenseKey,
      deviceHash: record.deviceHash,
      productName: record.productName,
      expiresAt: out.expiresAt ?? record.expiresAt,
      lastValidatedAt: validatedAt,
      status: "ACTIVE",
      offlineGraceDays: out.offlineGraceDays,
    });
    lastOfflineDegraded = false;

    return {
      ok: true,
      message: out.message ?? "Lisans doğrulandı.",
      expiresAt: out.expiresAt ?? record.expiresAt,
    };
  } catch (e) {
    const unreachable = e instanceof Error && e.message === "SERVER_UNREACHABLE";
    const expired = isLicenseExpiredByDate(record.expiresAt);

    if (expired) {
      getDb()
        .prepare(`UPDATE yerel_lisans SET status = 'LOCKED', guncelleme_tarihi = ? WHERE id = 1`)
        .run(nowIso());
      return {
        ok: false,
        error: "Lisans süreniz sona erdi. Yenileme sonrası Lisansı Kontrol Et ile tekrar deneyin.",
        locked: true,
      };
    }

    const graceMs = record.offlineGraceUntil ? new Date(record.offlineGraceUntil).getTime() : 0;
    if (graceMs >= Date.now()) {
      lastOfflineDegraded = true;
      return {
        ok: true,
        message: "Lisans sunucusuna ulaşılamadı. Son doğrulama bilgisiyle devam ediyorsunuz.",
        expiresAt: record.expiresAt,
        offlineDegraded: true,
      };
    }

    getDb()
      .prepare(`UPDATE yerel_lisans SET status = 'LOCKED', guncelleme_tarihi = ? WHERE id = 1`)
      .run(nowIso());
    return {
      ok: false,
      error: unreachable
        ? "Lisans sunucusuna ulaşılamadı ve çevrimdışı süre doldu."
        : "Lisans doğrulanamadı ve çevrimdışı süre doldu.",
      locked: true,
    };
  }
}

/** Uygulama açılışında arka planda çağrılır (günde en fazla 1 otomatik validate). */
export async function licenseValidateOnStartup(): Promise<LicenseState> {
  const state = licenseGetState();
  if (state.needsActivation) return state;
  await licenseValidate();
  return stateWithOfflineFlag(licenseGetState());
}

export function licenseGetStateForRenderer(): LicenseState {
  return stateWithOfflineFlag(licenseGetState());
}
