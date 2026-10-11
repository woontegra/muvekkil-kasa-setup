import { app, dialog, session, shell } from "electron";
import log from "electron-log";
import { join, resolve } from "node:path";

/**
 * Yalnızca `MAIN_VITE_MKD_TEST_PACKAGE=1` ile derlenen yerel test paketinde etkindir; üretim derlemesinde
 * bayrak tanımsız olduğundan hiçbir şey yapmaz. Bu modül ana süreçte ilk içe aktarılan modül olmalıdır:
 * userData ve ağ kısıtları, diğer modüller yol veya lisans adresi okumadan önce kurulur.
 */
export const IS_TEST_PACKAGE = import.meta.env.MAIN_VITE_MKD_TEST_PACKAGE === "1";

export const TEST_PACKAGE_USER_DATA_NAME = "muvekkil-kasa-defteri-TEST-PAKETI-V3";
/** Gerçek kurulumun ve önceki test paketlerinin klasörleri; test paketi bunlardan hiçbirini kullanamaz. */
const FORBIDDEN_USER_DATA_NAMES = [
  "muvekkil-kasa-defteri",
  "muvekkil-kasa-defteri-TEST-PAKETI",
  "muvekkil-kasa-defteri-TEST-PAKETI-V2",
];
const BLOCKED_LICENSE_API_BASE = "http://127.0.0.1:9/api/public/license";

function failClosed(reason: string): never {
  dialog.showErrorBox("Test paketi güvenli başlatılamadı", `${reason}\n\nProgram kapatılıyor; hiçbir veriye dokunulmadı.`);
  app.exit(1);
  throw new Error(reason);
}

function blockedFetch(): Promise<Response> {
  return Promise.reject(new TypeError("Test paketi: ağ erişimi kapalı"));
}

if (IS_TEST_PACKAGE) {
  const appData = app.getPath("appData");
  const testUserData = join(appData, TEST_PACKAGE_USER_DATA_NAME);
  app.setPath("userData", testUserData);
  app.setPath("sessionData", testUserData);
  app.setPath("logs", join(testUserData, "logs"));
  app.setPath("crashDumps", join(testUserData, "crashDumps"));
  log.transports.file.resolvePathFn = () => join(testUserData, "logs", "main.log");

  const forbidden = FORBIDDEN_USER_DATA_NAMES.map((name) => resolve(join(appData, name)));
  if (resolve(app.getPath("userData")) !== resolve(testUserData) || forbidden.includes(resolve(testUserData))) {
    failClosed("Test userData klasörü doğrulanamadı.");
  }

  delete process.env.MKD_TEST_DB;
  process.env.LICENSE_API_BASE = BLOCKED_LICENSE_API_BASE;
  globalThis.fetch = blockedFetch as typeof fetch;
  shell.openExternal = async (url: string) => {
    console.warn("[test-paketi] dış bağlantı engellendi:", url.slice(0, 120));
  };

  app.whenReady().then(() => {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
      (_details, callback) => callback({ cancel: true }),
    );
  });
}
