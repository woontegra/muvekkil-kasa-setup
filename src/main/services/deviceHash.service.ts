import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";

const LEGACY_DEVICE_SALT = "woontegra-muvekkil-kasa-desktop-v1";
const MACOS_DEVICE_SALT = "woontegra-muvekkil-kasa-desktop-macos-v1";
const IOREG_PATH = "/usr/sbin/ioreg";
const UUID_PATTERN = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

export const DEVICE_IDENTITY_UNAVAILABLE_MESSAGE =
  "Bu Mac'in donanım kimliği okunamadı. Lisans işlemi güvenlik nedeniyle durduruldu.";

export class DeviceIdentityUnavailableError extends Error {
  readonly code = "DEVICE_IDENTITY_UNAVAILABLE";

  constructor() {
    super(DEVICE_IDENTITY_UNAVAILABLE_MESSAGE);
    this.name = "DeviceIdentityUnavailableError";
  }
}

export type LegacyDeviceHashInput = {
  hostname: string;
  platform: string;
  arch: string;
  computerName: string;
  processorIdentifier: string;
};

/** Windows (ve darwin dışı) formülü; mevcut lisans kayıtlarıyla birebir aynı kalmalı. */
export function computeLegacyDeviceHash(input: LegacyDeviceHashInput): string {
  const parts = [
    input.hostname,
    input.platform,
    input.arch,
    input.computerName,
    input.processorIdentifier,
    LEGACY_DEVICE_SALT,
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function computeMacDeviceHash(platformUuid: string): string {
  const uuid = normalizePlatformUuid(platformUuid);
  if (!uuid) throw new DeviceIdentityUnavailableError();
  return createHash("sha256").update(["darwin", uuid, MACOS_DEVICE_SALT].join("|")).digest("hex");
}

export function normalizePlatformUuid(raw: string): string | null {
  const uuid = raw.trim().toUpperCase();
  if (!UUID_PATTERN.test(uuid) || uuid === ZERO_UUID) return null;
  return uuid;
}

export function parseIoPlatformUuid(ioregOutput: string): string | null {
  const match = /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(ioregOutput);
  return match ? normalizePlatformUuid(match[1]) : null;
}

function readMacPlatformUuid(): string {
  let output: string;
  try {
    output = execFileSync(IOREG_PATH, ["-rd1", "-c", "IOPlatformExpertDevice"], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new DeviceIdentityUnavailableError();
  }
  const uuid = parseIoPlatformUuid(output);
  if (!uuid) throw new DeviceIdentityUnavailableError();
  return uuid;
}

/**
 * Ham makine verisi API'ye gönderilmez; yalnızca stabil SHA-256 özeti kullanılır.
 * macOS'ta hostname değişebildiği için IOPlatformUUID kullanılır; okunamazsa
 * DeviceIdentityUnavailableError fırlatılır (hostname'e geri dönülmez).
 */
export function computeDeviceHash(): string {
  if (process.platform === "darwin") {
    return computeMacDeviceHash(readMacPlatformUuid());
  }
  return computeLegacyDeviceHash({
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    computerName: process.env.COMPUTERNAME ?? "",
    processorIdentifier: process.env.PROCESSOR_IDENTIFIER ?? "",
  });
}

export function getDeviceName(): string {
  return (os.hostname() || "Desktop").slice(0, 200);
}

export function getPlatformLabel(): string {
  return `${os.platform()}-${os.arch()}`;
}
