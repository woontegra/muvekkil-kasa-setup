import { app } from "electron";
import { getDb, nowIso } from "../db/connection";
import { computeDeviceHash, getDeviceName, getPlatformLabel } from "./deviceHash.service";
import { isLicenseExpiredByDate, shouldRunAutomaticValidate } from "@shared/lib/licenseExpiry";
import { DESKTOP_LICENSE_RENEWAL_LINK_URL } from "@shared/constants/licenseRenewal";
import { requireTrialEmail, requireTurkishMobile, TRIAL_NETWORK_REQUIRED_MESSAGE } from "@shared/lib/trialContact";
import { applyPaidOfflineFlag, evaluateLicenseRecord, isBusinessLicensePhase } from "./licenseEvaluate";
import {
  APP_CODE_MUVEKKIL_KASA_DESKTOP,
  OFFLINE_GRACE_DAYS,
  type LicenseActivateInput,
  type LicenseActivateResult,
  type LicenseStartTrialInput,
  type LicenseStartTrialResult,
  type LicenseState,
  type LicenseValidateOptions,
  type LicenseValidateResult,
  type LocalLicenseKind,
  type LocalLicenseRecord,
  type LocalLicenseStatus,
} from "@shared/types/license";

const LICENSE_API_BASE = (
  process.env.LICENSE_API_BASE ??
  "https://lisans-server-backend-production.up.railway.app/api/public/license"
).replace(/\/$/, "");

/** Son doğrulama çevrimdışı toleransla mı tamamlandı (DB şeması değiştirmeden). */
let lastOfflineDegraded = false;
/** Bu process'te /trial/validate başarılı oldu mu — local expiresAt tek başına yetmez. */
let lastTrialOnlineOk = false;
/** Central trial alındı, local admin henüz yok. */
let trialGrantedPendingSetup = false;

export function isTrialGrantedPendingSetup(): boolean {
  return trialGrantedPendingSetup;
}

export function clearTrialGrantedPendingSetup(): void {
  trialGrantedPendingSetup = false;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function rowToRecord(r: {
  kind?: string | null;
  license_key: string | null;
  device_hash: string;
  product_name: string | null;
  expires_at: string | null;
  last_validated_at: string | null;
  offline_grace_until: string | null;
  status: string;
}): LocalLicenseRecord {
  const kind: LocalLicenseKind = r.kind === "trial" ? "trial" : "paid";
  return {
    kind,
    licenseKey: r.license_key,
    deviceHash: r.device_hash,
    productName: r.product_name,
    expiresAt: r.expires_at,
    lastValidatedAt: r.last_validated_at,
    offlineGraceUntil: r.offline_grace_until,
    status: r.status as LocalLicenseStatus,
  };
}

export function readLocalLicense(): LocalLicenseRecord | null {
  const row = getDb()
    .prepare(
      `SELECT kind, license_key, device_hash, product_name, expires_at, last_validated_at, offline_grace_until, status
       FROM yerel_lisans WHERE id = 1`,
    )
    .get() as
    | {
        kind?: string | null;
        license_key: string | null;
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
  kind: LocalLicenseKind;
  licenseKey: string | null;
  deviceHash: string;
  productName: string | null;
  expiresAt: string | null;
  lastValidatedAt: string;
  status: LocalLicenseStatus;
  offlineGraceDays?: number | null;
}): void {
  const now = nowIso();
  const offlineGraceUntil =
    input.kind === "trial"
      ? null
      : addDaysIso(input.lastValidatedAt, input.offlineGraceDays ?? OFFLINE_GRACE_DAYS);
  getDb()
    .prepare(
      `INSERT INTO yerel_lisans (
        id, kind, license_key, device_hash, product_name, expires_at,
        last_validated_at, offline_grace_until, status, kayit_tarihi, guncelleme_tarihi
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind,
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
      input.kind,
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

function lockLocal(statusMessage?: string): void {
  getDb()
    .prepare(`UPDATE yerel_lisans SET status = 'LOCKED', guncelleme_tarihi = ? WHERE id = 1`)
    .run(nowIso());
  void statusMessage;
}

function evaluateLocal(record: LocalLicenseRecord | null): LicenseState {
  return evaluateLicenseRecord(record, {
    lastTrialOnlineOk,
    lastOfflineDegraded,
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

export async function licenseRequestRenewalLink(): Promise<
  { ok: true; purchaseUrl: string } | { ok: false; error: string }
> {
  const record = readLocalLicense();
  if (!record?.licenseKey) {
    return { ok: false, error: "Lisans kaydı bulunamadı. Önce lisansınızı aktifleştirin." };
  }

  try {
    const res = await fetch(DESKTOP_LICENSE_RENEWAL_LINK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        licenseKey: record.licenseKey,
        deviceHash: record.deviceHash,
        appCode: APP_CODE_MUVEKKIL_KASA_DESKTOP,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      purchaseUrl?: string;
      message?: string;
    };
    if (!res.ok || data.ok !== true || !data.purchaseUrl?.trim()) {
      return {
        ok: false,
        error: data.message?.trim() || "Lisans yenileme bağlantısı oluşturulamadı.",
      };
    }
    return { ok: true, purchaseUrl: data.purchaseUrl.trim() };
  } catch {
    return { ok: false, error: "Yenileme sunucusuna ulaşılamadı. İnternet bağlantınızı kontrol edin." };
  }
}

export function licenseGetState(): LicenseState {
  return evaluateLocal(readLocalLicense());
}

function stateWithOfflineFlag(state: LicenseState): LicenseState {
  return applyPaidOfflineFlag(state, lastOfflineDegraded);
}

export function isBusinessLicenseAuthorized(): boolean {
  const state = stateWithOfflineFlag(licenseGetState());
  return state.valid && isBusinessLicensePhase(state.phase);
}

export function isSetupLicenseAuthorized(): boolean {
  return isBusinessLicenseAuthorized() || trialGrantedPendingSetup;
}

export async function licenseStartTrial(input: LicenseStartTrialInput): Promise<LicenseStartTrialResult> {
  let email: string;
  let phone: string;
  try {
    email = requireTrialEmail(input.email);
    phone = requireTurkishMobile(input.phone);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "İletişim bilgileri geçersiz." };
  }

  const deviceHash = computeDeviceHash();
  try {
    const out = await postJson<{
      success?: boolean;
      resumed?: boolean;
      trial?: boolean;
      expiresAt?: string;
      message?: string;
      code?: string;
    }>("/trial", {
      appCode: APP_CODE_MUVEKKIL_KASA_DESKTOP,
      deviceHash,
      email,
      phone,
      deviceName: getDeviceName(),
      platform: getPlatformLabel(),
      appVersion: app.getVersion(),
    });

    if (!out.success || !out.trial || !out.expiresAt) {
      return {
        ok: false,
        error: out.message?.trim() || "Ücretsiz deneme başlatılamadı.",
        code: out.code,
      };
    }

    const validatedAt = new Date().toISOString();
    saveLocalLicense({
      kind: "trial",
      licenseKey: null,
      deviceHash,
      productName: "Müvekkil Kasa Defteri",
      expiresAt: out.expiresAt,
      lastValidatedAt: validatedAt,
      status: "ACTIVE",
      offlineGraceDays: null,
    });
    lastTrialOnlineOk = true;
    lastOfflineDegraded = false;
    trialGrantedPendingSetup = true;

    return {
      ok: true,
      message: out.message ?? "7 günlük deneme başlatıldı.",
      expiresAt: out.expiresAt,
      resumed: out.resumed === true,
    };
  } catch (e) {
    if (e instanceof Error && e.message === "SERVER_UNREACHABLE") {
      return { ok: false, error: TRIAL_NETWORK_REQUIRED_MESSAGE, code: "NETWORK_ERROR" };
    }
    return { ok: false, error: "Ücretsiz deneme başlatılamadı.", code: "NETWORK_ERROR" };
  }
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
      kind: "paid",
      licenseKey,
      deviceHash,
      productName: "Müvekkil Kasa Defteri",
      expiresAt: out.expiresAt ?? null,
      lastValidatedAt: validatedAt,
      status: "ACTIVE",
    });
    lastOfflineDegraded = false;
    lastTrialOnlineOk = false;
    trialGrantedPendingSetup = false;

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

async function licenseValidateTrial(record: LocalLicenseRecord): Promise<LicenseValidateResult> {
  if (isLicenseExpiredByDate(record.expiresAt)) {
    lockLocal();
    lastTrialOnlineOk = false;
    return { ok: false, error: "7 günlük ücretsiz deneme süreniz sona erdi.", locked: true, code: "TRIAL_EXPIRED" };
  }

  try {
    const out = await postJson<{
      success?: boolean;
      valid?: boolean;
      message?: string;
      expiresAt?: string | null;
      code?: string;
    }>("/trial/validate", {
      appCode: APP_CODE_MUVEKKIL_KASA_DESKTOP,
      deviceHash: record.deviceHash,
    });

    if (!out.success || !out.valid) {
      lastTrialOnlineOk = false;
      if (out.code === "TRIAL_EXPIRED") {
        lockLocal();
        return { ok: false, error: "7 günlük ücretsiz deneme süreniz sona erdi.", locked: true, code: "TRIAL_EXPIRED" };
      }
      return {
        ok: false,
        error: out.message?.trim() || TRIAL_NETWORK_REQUIRED_MESSAGE,
        locked: false,
        code: out.code ?? "TRIAL_INVALID",
      };
    }

    const validatedAt = new Date().toISOString();
    saveLocalLicense({
      kind: "trial",
      licenseKey: null,
      deviceHash: record.deviceHash,
      productName: record.productName,
      expiresAt: out.expiresAt ?? record.expiresAt,
      lastValidatedAt: validatedAt,
      status: "ACTIVE",
      offlineGraceDays: null,
    });
    lastTrialOnlineOk = true;
    lastOfflineDegraded = false;
    return {
      ok: true,
      message: out.message ?? "Deneme lisansı geçerli.",
      expiresAt: out.expiresAt ?? record.expiresAt,
    };
  } catch {
    lastTrialOnlineOk = false;
    return { ok: false, error: TRIAL_NETWORK_REQUIRED_MESSAGE, locked: false, code: "NETWORK_ERROR" };
  }
}

export async function licenseValidate(options?: LicenseValidateOptions): Promise<LicenseValidateResult> {
  const record = readLocalLicense();
  if (!record) {
    return { ok: false, error: "Lisans kaydı bulunamadı.", locked: false };
  }

  if (record.kind === "trial") {
    return licenseValidateTrial(record);
  }

  if (!record.licenseKey) {
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
    lockLocal();
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
      lockLocal();
      return { ok: false, error: out.message ?? "Lisans doğrulanamadı.", locked: true };
    }

    const validatedAt = new Date().toISOString();
    saveLocalLicense({
      kind: "paid",
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
      lockLocal();
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

    lockLocal();
    return {
      ok: false,
      error: unreachable
        ? "Lisans sunucusuna ulaşılamadı ve çevrimdışı süre doldu."
        : "Lisans doğrulanamadı ve çevrimdışı süre doldu.",
      locked: true,
    };
  }
}

/** Uygulama açılışında arka planda çağrılır (paid: günde en fazla 1 otomatik validate). */
export async function licenseValidateOnStartup(): Promise<LicenseState> {
  const state = licenseGetState();
  if (state.needsActivation) return state;
  await licenseValidate();
  return stateWithOfflineFlag(licenseGetState());
}

export function licenseGetStateForRenderer(): LicenseState {
  return stateWithOfflineFlag(licenseGetState());
}

/** Test helper — process state'ini sıfırlar. */
export function resetLicenseRuntimeFlagsForTests(): void {
  lastOfflineDegraded = false;
  lastTrialOnlineOk = false;
  trialGrantedPendingSetup = false;
}

export function markTrialOnlineOkForTests(value: boolean): void {
  lastTrialOnlineOk = value;
}

export function markPaidOfflineDegradedForTests(value: boolean): void {
  lastOfflineDegraded = value;
}
