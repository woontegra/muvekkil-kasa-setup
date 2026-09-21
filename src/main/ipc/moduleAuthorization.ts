import { ipcMain } from "electron";
import { authGetSession } from "../services/auth.service";
import { MODULE_FORBIDDEN_ERROR, decideModuleIpcAccess } from "./moduleAuthorization.policy";

export {
  classifyModuleIpcChannel,
  decideModuleIpcAccess,
  listUnclassifiedModuleIpcChannels,
  MODULE_FORBIDDEN_ERROR,
} from "./moduleAuthorization.policy";

export function assertIpcModuleAuthorized(channel: string): void {
  const session = authGetSession();
  const decision = decideModuleIpcAccess(channel, { rol: session?.rol ?? null });
  if (decision === "DENY") {
    throw new Error(MODULE_FORBIDDEN_ERROR);
  }
}

/**
 * `installIpcLicenseAuthorization()` çağrıldıktan SONRA çağrılmalıdır; böylece
 * kayıt zinciri lisans kontrolünü sarar ve çalışma sırası lisans → rol olur.
 */
export function installIpcModuleAuthorization(): void {
  const previous = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = ((channel: string, listener: (...args: unknown[]) => unknown) => {
    return previous(channel, async (event, ...args) => {
      assertIpcModuleAuthorized(channel);
      return listener(event, ...args);
    });
  }) as typeof ipcMain.handle;
}
