import { IPC } from "@shared/ipc";

export type LicenseIpcClass = "PUBLIC" | "SETUP" | "LICENSED";

function flattenIpcValues(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") {
    out.push(node);
    return out;
  }
  if (node && typeof node === "object") {
    for (const value of Object.values(node as Record<string, unknown>)) {
      flattenIpcValues(value, out);
    }
  }
  return out;
}

export const ALL_IPC_CHANNELS = flattenIpcValues(IPC);

const PUBLIC_CHANNELS = new Set<string>([
  IPC.app.quit,
  IPC.app.getVersion,
  IPC.auth.needsSetup,
  IPC.auth.getSession,
  IPC.auth.login,
  IPC.auth.logout,
  IPC.auth.forgotPasswordGetQuestion,
  IPC.auth.forgotPasswordSubmit,
  IPC.auth.getRememberedLogin,
  IPC.auth.saveRememberedLogin,
  IPC.auth.clearRememberedLogin,
  IPC.license.getState,
  IPC.license.activate,
  IPC.license.validate,
  IPC.license.startTrial,
  IPC.license.openRenewalUrl,
  IPC.util.pathToFileUrl,
]);

const SETUP_CHANNELS = new Set<string>([IPC.auth.setupFirst]);

const LICENSED_NAMESPACES = new Set([
  "office",
  "backup",
  "ofisKasa",
  "muvekkil",
  "dosya",
  "kasa",
  "vekalet",
  "print",
  "makbuz",
  "vekaletMakbuz",
  "masrafTurleri",
]);

export function classifyLicenseIpcChannel(channel: string): LicenseIpcClass | "UNKNOWN" {
  if (PUBLIC_CHANNELS.has(channel)) return "PUBLIC";
  if (SETUP_CHANNELS.has(channel)) return "SETUP";
  if (channel === IPC.auth.guvenlikGuncelle || channel === IPC.auth.guvenlikBilgisi || channel === IPC.auth.sifreGuncelle) {
    return "LICENSED";
  }
  const ns = channel.includes(":") ? channel.split(":")[0] : channel;
  if (LICENSED_NAMESPACES.has(ns) || LICENSED_NAMESPACES.has(channel)) return "LICENSED";
  if (ALL_IPC_CHANNELS.includes(channel)) return "LICENSED";
  return "UNKNOWN";
}

export function listUnclassifiedIpcChannels(): string[] {
  return ALL_IPC_CHANNELS.filter((ch) => classifyLicenseIpcChannel(ch) === "UNKNOWN");
}

export function decideLicenseIpcAccess(
  channel: string,
  ctx: { businessAuthorized: boolean; setupAuthorized: boolean; hasSession: boolean },
): "ALLOW" | "DENY" {
  const cls = classifyLicenseIpcChannel(channel);
  if (cls === "PUBLIC") return "ALLOW";
  if (cls === "SETUP") return ctx.setupAuthorized ? "ALLOW" : "DENY";
  if (cls === "UNKNOWN") return "DENY";
  return ctx.businessAuthorized && ctx.hasSession ? "ALLOW" : "DENY";
}
