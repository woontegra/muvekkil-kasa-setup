import { mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { app, BrowserWindow, type WebContents } from "electron";
import { runMigrations } from "../../src/main/db/migrate";
import { allMigrations } from "../../src/main/migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady } from "../../src/main/ipc/handlers";
import { authLogout, setupFirst } from "../../src/main/services/auth.service";
import { computeDeviceHash } from "../../src/main/services/deviceHash.service";

export { initIsolatedElectronEnv, cleanupIsolatedEnv, type IsolatedEnv } from "./premium-e2e-isolation";
import { closeDb, getDb, nowIso } from "../../src/main/db/connection";

export const PROJECT_ROOT = join(__dirname, "..", "..");
export const PREMIUM_HTML = join(PROJECT_ROOT, "out", "renderer-premium", "index.html");
export const LEGACY_HTML = join(PROJECT_ROOT, "out", "renderer", "index.html");
export const PRELOAD_PATH = join(PROJECT_ROOT, "out", "preload", "index.mjs");

export type ConsoleCollector = {
  errors: string[];
  warnings: string[];
  sensitive: string[];
};

export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitForSelector(
  wc: WebContents,
  selector: string,
  timeoutMs = 30000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = await wc.executeJavaScript(`!!document.querySelector(${JSON.stringify(selector)})`, true);
    if (found) return true;
    await sleep(120);
  }
  return false;
}

export async function waitForCondition(
  wc: WebContents,
  jsExpr: string,
  timeoutMs = 30000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await wc.executeJavaScript(`!!(${jsExpr})`, true);
    if (ok) return true;
    await sleep(120);
  }
  return false;
}

export async function js<T>(wc: WebContents, code: string): Promise<T> {
  return wc.executeJavaScript(code, true) as Promise<T>;
}

export async function getRouteDiagnostics(win: BrowserWindow): Promise<{
  hash: string;
  href: string;
  title: string;
  bodySnippet: string;
  visibleError: string;
}> {
  return js(win.webContents, `(() => {
    const err =
      document.querySelector('.pm-form-error, .pm-alert--error, .pm-auth-error')?.textContent?.trim() ||
      document.querySelector('[role="alert"]')?.textContent?.trim() ||
      '';
    return {
      hash: location.hash || '',
      href: location.href || '',
      title: document.title || '',
      bodySnippet: (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 280),
      visibleError: err,
    };
  })()`);
}

export async function waitForRoute(
  win: BrowserWindow,
  route: string,
  selector: string,
  timeoutMs = 45000,
): Promise<void> {
  const fragment = route.startsWith("/") ? route : `/${route}`;
  const hashNeedle = JSON.stringify(`#${fragment}`);
  const hashPrefix = JSON.stringify(`#${fragment}?`);
  const ok = await waitForCondition(
    win.webContents,
    `(() => {
      const hash = location.hash || '';
      const routeOk = ${JSON.stringify(fragment)} === '/'
        ? hash === '#/' || hash === '' || hash === '#'
        : hash === ${hashNeedle} || hash.startsWith(${hashPrefix}) || hash.startsWith(${hashNeedle} + '/');
      const el = document.querySelector(${JSON.stringify(selector)});
      return routeOk && !!el;
    })()`,
    timeoutMs,
  );
  if (!ok) {
    const diag = await getRouteDiagnostics(win);
    throw new Error(
      `Route hazır değil: ${route} (${selector}) — hash=${diag.hash} error=${diag.visibleError || "—"} body=${diag.bodySnippet}`,
    );
  }
}

export async function navigatePremiumHash(
  win: BrowserWindow,
  route: string,
  selector: string,
  timeoutMs = 45000,
): Promise<void> {
  const fragment = route.startsWith("/") ? route : `/${route}`;
  const hashTarget = `#${fragment}`;
  const shellReady = await waitForSelector(win.webContents, ".pm-shell", 15000);
  assert(shellReady, "Premium shell hazır değil (hash navigasyonu)");
  await js(
    win.webContents,
    `(() => {
      const target = ${JSON.stringify(hashTarget)};
      if (location.hash !== target) location.hash = target;
    })()`,
  );
  await waitForRoute(win, route, selector, timeoutMs);
}

export const SET_INPUT_VALUE = `
function __mkdSetInput(el, value) {
  if (!el) throw new Error('input yok');
  el.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(value) }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
`;

export function attachConsoleCollector(win: BrowserWindow): ConsoleCollector {
  const bag: ConsoleCollector = { errors: [], warnings: [], sensitive: [] };
  win.webContents.on("console-message", (_e, level, message) => {
    if (level >= 2) bag.errors.push(message);
    else if (level === 1) bag.warnings.push(message);
    const lower = String(message).toLowerCase();
    if (
      lower.includes("password") ||
      lower.includes("şifre") ||
      lower.includes("license_key") ||
      lower.includes("activationpassword") ||
      lower.includes("devicehash")
    ) {
      bag.sensitive.push(message);
    }
  });
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    bag.errors.push(`did-fail-load ${code} ${desc} ${url}`);
  });
  return bag;
}

export function createPremiumWindow(width = 1280, height = 800): BrowserWindow {
  return new BrowserWindow({
    width,
    height,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
}

export async function loadPremiumRoute(
  win: BrowserWindow,
  route: string,
  readySelector?: string,
): Promise<void> {
  const hash = route.startsWith("/") ? route : `/${route}`;
  await win.loadFile(PREMIUM_HTML, { hash });
  await win.webContents.executeJavaScript(
    `new Promise((resolve) => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', () => resolve(), { once: true });
    })`,
    true,
  );
  if (readySelector) {
    const ok = await waitForSelector(win.webContents, readySelector, 45000);
    assert(ok, `Sayfa hazır değil: ${route} (${readySelector})`);
  }
}

export async function loadLegacyRoute(
  win: BrowserWindow,
  route: string,
  readySelector?: string,
): Promise<void> {
  const hash = route.startsWith("/") ? route : `/${route}`;
  await win.loadFile(LEGACY_HTML, { hash });
  await win.webContents.executeJavaScript(
    `new Promise((resolve) => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', () => resolve(), { once: true });
    })`,
    true,
  );
  if (readySelector) {
    const ok = await waitForSelector(win.webContents, readySelector, 45000);
    assert(ok, `Legacy sayfa hazır değil: ${route} (${readySelector})`);
  }
}

export function seedLicenseActive(db: ReturnType<typeof getDb>): void {
  const t = nowIso();
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  const grace = new Date();
  grace.setDate(grace.getDate() + 30);
  const deviceHash = computeDeviceHash();
  db.prepare(
    `INSERT INTO yerel_lisans (
      id, license_key, device_hash, product_name, expires_at,
      last_validated_at, offline_grace_until, status, kayit_tarihi, guncelleme_tarihi
    ) VALUES (1, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      license_key = excluded.license_key,
      device_hash = excluded.device_hash,
      expires_at = excluded.expires_at,
      last_validated_at = excluded.last_validated_at,
      offline_grace_until = excluded.offline_grace_until,
      status = excluded.status,
      guncelleme_tarihi = excluded.guncelleme_tarihi`,
  ).run("PREMIUM-E2E-KEY", deviceHash, "Müvekkil Kasa Defteri", expires.toISOString(), t, grace.toISOString(), t, t);
}

export function seedLicenseExpired(db: ReturnType<typeof getDb>): void {
  const t = nowIso();
  const expired = new Date();
  expired.setFullYear(expired.getFullYear() - 1);
  const deviceHash = computeDeviceHash();
  db.prepare(`DELETE FROM yerel_lisans`).run();
  db.prepare(
    `INSERT INTO yerel_lisans (
      id, license_key, device_hash, product_name, expires_at,
      last_validated_at, offline_grace_until, status, kayit_tarihi, guncelleme_tarihi
    ) VALUES (1, ?, ?, ?, ?, ?, ?, 'EXPIRED', ?, ?)`,
  ).run("EXPIRED-KEY", deviceHash, "Müvekkil Kasa Defteri", expired.toISOString(), t, expired.toISOString(), t, t);
}

export function clearLicense(db: ReturnType<typeof getDb>): void {
  db.prepare(`DELETE FROM yerel_lisans`).run();
}

export type SeedUser = { user: string; pass: string; ad: string };

export function seedDefaultUser(db: ReturnType<typeof getDb>): SeedUser {
  const cred: SeedUser = { user: "premium_e2e", pass: "premium-e2e-123", ad: "Premium E2E" };
  const setup = setupFirst({
    adSoyad: cred.ad,
    kullaniciAdi: cred.user,
    sifre: cred.pass,
    guvenlikSorusuKodu: "G1",
    guvenlikCevabi: "test",
  });
  assert(setup.ok, setup.error ?? "setup failed");
  return cred;
}

export async function initPremiumElectronApp(dbPath: string, license: "active" | "none" | "expired" = "active"): Promise<SeedUser | null> {
  process.env.MKD_TEST_DB = dbPath;
  if (!app.isReady()) await app.whenReady();
  app.commandLine.appendSwitch("disable-gpu");
  const db = getDb();
  runMigrations(db, allMigrations, nowIso);
  if (license === "active") seedLicenseActive(db);
  else if (license === "expired") seedLicenseExpired(db);
  else clearLicense(db);
  let cred: SeedUser | null = null;
  if (license !== "none" || db.prepare(`SELECT COUNT(*) AS c FROM kullanici`).get().c === 0) {
    /* setup only when we want auth */
  }
  registerIpcHandlers();
  initAuthOnReady();
  initLicenseOnReady();
  return cred;
}

export async function seedUserIfNeeded(): Promise<SeedUser> {
  const db = getDb();
  const count = Number(db.prepare(`SELECT COUNT(*) AS c FROM kullanici`).get().c);
  if (count === 0) return seedDefaultUser(db);
  return { user: "premium_e2e", pass: "premium-e2e-123", ad: "Premium E2E" };
}

export function resetDbConnection(): void {
  closeDb();
  delete process.env.MKD_TEST_DB;
}

export async function shutdownPremiumElectron(
  win: BrowserWindow | null,
  dbPath: string,
  removeDb = true,
): Promise<void> {
  if (win && !win.isDestroyed()) win.destroy();
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.destroy();
  }
  closeDb();
  delete process.env.MKD_TEST_DB;
  if (removeDb) {
    try {
      unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
  }
}

export async function captureScreenshot(win: BrowserWindow, filePath: string): Promise<void> {
  mkdirSync(join(filePath, ".."), { recursive: true });
  const img = await win.webContents.capturePage();
  writeFileSync(filePath, img.toPNG());
}

export function verifyFreshScreenshot(filePath: string, runStartedMs: number): void {
  assert(statSync(filePath).size > 0, `Screenshot boş: ${filePath}`);
  assert(statSync(filePath).mtimeMs >= runStartedMs - 2000, `Screenshot bu çalıştırmada üretilmedi: ${filePath}`);
}

export async function horizontalOverflowPx(win: BrowserWindow): Promise<number> {
  return js<number>(
    win.webContents,
    `Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, 0)`,
  );
}

export async function premiumLogin(win: BrowserWindow, user: string, pass: string): Promise<void> {
  await loadPremiumRoute(win, "/login");
  await waitForRoute(win, "/login", ".pm-login-panel");
  await js(win.webContents, `${SET_INPUT_VALUE}
    __mkdSetInput(document.querySelector('.pm-login-form input[autocomplete="username"]'), ${JSON.stringify(user)});
    __mkdSetInput(document.querySelector('.pm-login-form input[autocomplete="current-password"]'), ${JSON.stringify(pass)});
  `);
  await js(win.webContents, `document.querySelector('.pm-login-submit')?.click()`);
  const ok = await waitForSelector(win.webContents, ".pm-shell", 25000);
  assert(ok, "Premium giriş sonrası shell yüklenmedi");
}

export function newTestDbPath(prefix: string): string {
  return join(tmpdir(), `${prefix}-${Date.now()}.sqlite`);
}

export async function freshAppForScenario(
  license: "active" | "none" | "expired",
  withUser: boolean,
): Promise<{ dbPath: string; cred: SeedUser | null }> {
  const dbPath = newTestDbPath("mkd-premium-e2e");
  process.env.MKD_TEST_DB = dbPath;
  if (!app.isReady()) await app.whenReady();
  const db = getDb();
  runMigrations(db, allMigrations, nowIso);
  if (license === "active") seedLicenseActive(db);
  else if (license === "expired") seedLicenseExpired(db);
  else clearLicense(db);
  let cred: SeedUser | null = null;
  if (withUser) cred = seedDefaultUser(db);
  registerIpcHandlers();
  initAuthOnReady();
  initLicenseOnReady();
  authLogout();
  return { dbPath, cred };
}
