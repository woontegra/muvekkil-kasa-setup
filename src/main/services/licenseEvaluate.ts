import {
  computeDaysRemaining,
  formatLicenseExpiryDate,
  isLicenseExpiredByDate,
  pickWarningThreshold,
} from "@shared/lib/licenseExpiry";
import { TRIAL_NETWORK_REQUIRED_MESSAGE } from "@shared/lib/trialContact";
import type { LicensePhase, LicenseState, LocalLicenseRecord } from "@shared/types/license";

export type LicenseEvaluateFlags = {
  lastTrialOnlineOk: boolean;
  lastOfflineDegraded: boolean;
};

function enrichState(
  record: LocalLicenseRecord | null,
  base: Omit<
    LicenseState,
    "daysRemaining" | "expiresAt" | "expiryLabel" | "warningThreshold" | "isExpired" | "offlineDegraded"
  >,
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
    warningThreshold:
      record?.kind === "paid" && base.valid ? pickWarningThreshold(daysRemaining) : null,
    record,
  };
}

export function evaluateLicenseRecord(
  record: LocalLicenseRecord | null,
  flags: LicenseEvaluateFlags,
  nowMs = Date.now(),
): LicenseState {
  if (!record || record.status === "NONE") {
    return enrichState(null, {
      valid: false,
      needsActivation: true,
      locked: false,
      phase: "needsActivation",
      message: "Lisans aktivasyonu gerekli.",
      record: null,
    });
  }

  const expired = isLicenseExpiredByDate(record.expiresAt, nowMs);
  const kind = record.kind === "trial" ? "trial" : "paid";

  if (kind === "trial") {
    if (record.status === "LOCKED" || expired) {
      return enrichState(record, {
        valid: false,
        needsActivation: false,
        locked: true,
        phase: "trialExpired",
        message: "7 günlük ücretsiz deneme süreniz sona erdi.",
        record,
      });
    }
    if (flags.lastTrialOnlineOk) {
      return enrichState(record, {
        valid: true,
        needsActivation: false,
        locked: false,
        phase: "trialActive",
        message: null,
        record,
      });
    }
    return enrichState(record, {
      valid: false,
      needsActivation: false,
      locked: false,
      phase: "trialNetworkRequired",
      message: TRIAL_NETWORK_REQUIRED_MESSAGE,
      record,
    });
  }

  const graceMs = record.offlineGraceUntil ? new Date(record.offlineGraceUntil).getTime() : null;

  if (record.status === "LOCKED") {
    return enrichState(record, {
      valid: false,
      needsActivation: false,
      locked: true,
      phase: "locked",
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
      phase: "locked",
      message: "Lisans süreniz sona erdi. Programı kullanmaya devam etmek için lisansınızı yenileyin.",
      record,
    });
  }

  if (graceMs != null && graceMs < nowMs) {
    return enrichState(record, {
      valid: false,
      needsActivation: false,
      locked: true,
      phase: "locked",
      message: "Lisans doğrulaması yapılamadı. İnternet bağlantınızı kontrol edin.",
      record,
    });
  }

  const phase: LicensePhase = flags.lastOfflineDegraded ? "paidOfflineGrace" : "paidActive";
  return enrichState(record, {
    valid: true,
    needsActivation: false,
    locked: false,
    phase,
    message: null,
    record,
  });
}

export function isBusinessLicensePhase(phase: LicensePhase): boolean {
  return phase === "trialActive" || phase === "paidActive" || phase === "paidOfflineGrace";
}

export function applyPaidOfflineFlag(state: LicenseState, lastOfflineDegraded: boolean): LicenseState {
  if (!lastOfflineDegraded || !state.valid || state.record?.kind === "trial") return state;
  return { ...state, offlineDegraded: true, phase: "paidOfflineGrace" };
}
