import { createHash } from "node:crypto";
import os from "node:os";

/** Ham makine verisi API'ye gönderilmez; yalnızca stabil SHA-256 özeti kullanılır. */
export function computeDeviceHash(): string {
  const parts = [
    os.hostname(),
    os.platform(),
    os.arch(),
    process.env.COMPUTERNAME ?? "",
    process.env.PROCESSOR_IDENTIFIER ?? "",
    "woontegra-muvekkil-kasa-desktop-v1",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function getDeviceName(): string {
  return (os.hostname() || "Desktop").slice(0, 200);
}

export function getPlatformLabel(): string {
  return `${os.platform()}-${os.arch()}`;
}
