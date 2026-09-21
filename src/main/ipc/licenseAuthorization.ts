import { ipcMain } from "electron";
import { authGetSession } from "../services/auth.service";
import { isBusinessLicenseAuthorized, isSetupLicenseAuthorized } from "../services/license.service";
import { decideLicenseIpcAccess } from "./licenseAuthorization.policy";

export { classifyLicenseIpcChannel, listUnclassifiedIpcChannels, decideLicenseIpcAccess } from "./licenseAuthorization.policy";

export function assertIpcLicenseAuthorized(channel: string): void {
  const decision = decideLicenseIpcAccess(channel, {
    businessAuthorized: isBusinessLicenseAuthorized(),
    setupAuthorized: isSetupLicenseAuthorized(),
    hasSession: Boolean(authGetSession()),
  });
  if (decision === "DENY") {
    throw new Error("LICENSE_REQUIRED");
  }
}

export function installIpcLicenseAuthorization(): void {
  const original = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = ((channel: string, listener: (...args: unknown[]) => unknown) => {
    return original(channel, async (event, ...args) => {
      assertIpcLicenseAuthorized(channel);
      return listener(event, ...args);
    });
  }) as typeof ipcMain.handle;
}
