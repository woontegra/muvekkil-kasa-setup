import { BrowserWindow, type WebContents } from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { js, LEGACY_HTML, PRELOAD_PATH, sleep } from "../premium-e2e-harness";
import { PARITY_OUT } from "./constants";

export type LegacyScreen =
  | "license-loading"
  | "license-locked"
  | "license-activate"
  | "setup"
  | "login"
  | "home"
  | "loading"
  | "unknown";

export type LegacyProbe = {
  href: string;
  hash: string;
  title: string;
  bodySnippet: string;
  route: string;
  screen: LegacyScreen;
  selectors: {
    login: boolean;
    setup: boolean;
    license: boolean;
    home: boolean;
  };
  inputs: string[];
  buttons: string[];
  activeTag: string;
  activeId: string;
};

const PROBE_JS = `(() => {
  const body = (document.body?.innerText || '').replace(/\\s+/g, ' ').trim();
  const hash = location.hash || '';
  const route = hash.replace(/^#/, '') || '/';
  const login = !!document.querySelector('.auth-card-title, .auth-card button[type="submit"]');
  const setup = !!document.querySelector('#setup-form, form[id*="setup"], .setup-page, h2') && /kurulum|ilk kullanıcı|setup/i.test(body);
  const license = /lisans/i.test(body) && !login;
  const home = !!document.querySelector('.desk-home-dashboard, .desk-app-shell');
  let screen = 'unknown';
  if (body.includes('Lisans durumu kontrol ediliyor')) screen = 'license-loading';
  else if (document.querySelector('.license-expired, .desk-license-expired')) screen = 'license-locked';
  else if (route === '/lisans' || /lisans.*aktiv/i.test(body)) screen = 'license-activate';
  else if (setup && route.includes('setup')) screen = 'setup';
  else if (login && /giriş/i.test(body)) screen = 'login';
  else if (home) screen = 'home';
  else if (!body) screen = 'loading';
  const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
    .slice(0, 30)
    .map(el => {
      const id = el.id ? '#' + el.id : el.tagName.toLowerCase();
      const name = el.getAttribute('name');
      const type = el.getAttribute('type');
      return [id, name, type].filter(Boolean).join('|');
    });
  const buttons = Array.from(document.querySelectorAll('button, a.btn, .btn'))
    .slice(0, 30)
    .map(el => (el.textContent || '').trim().slice(0, 40))
    .filter(Boolean);
  const active = document.activeElement;
  return {
    href: location.href || '',
    hash,
    title: document.title || '',
    bodySnippet: body.slice(0, 500),
    route,
    screen,
    selectors: { login, setup, license, home },
    inputs,
    buttons,
    activeTag: active?.tagName || '',
    activeId: (active && 'id' in active && active.id) ? String(active.id) : '',
  };
})()`;

export async function probeLegacyScreen(wc: WebContents): Promise<LegacyProbe> {
  return js<LegacyProbe>(wc, PROBE_JS);
}

export function logLegacyProbe(tick: number, p: LegacyProbe): void {
  console.log(`[DIAG t=${tick}s] hash=${p.hash} route=${p.route} title=${JSON.stringify(p.title)}`);
  console.log(`[DIAG t=${tick}s] screen=${p.screen} selectors=${JSON.stringify(p.selectors)}`);
  console.log(`[DIAG t=${tick}s] body=${JSON.stringify(p.bodySnippet)}`);
}

export async function loadLegacyBoot(win: BrowserWindow, route = "/"): Promise<void> {
  const hash = route.startsWith("/") ? route : `/${route}`;
  await win.loadFile(LEGACY_HTML, { hash });
  await win.webContents.executeJavaScript(
    `new Promise((resolve) => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', () => resolve(), { once: true });
    })`,
    true,
  );
}

export async function waitLegacyScreen(
  wc: WebContents,
  want: LegacyScreen | LegacyScreen[],
  timeoutMs: number,
): Promise<LegacyProbe> {
  const wants = Array.isArray(want) ? want : [want];
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const p = await probeLegacyScreen(wc);
    if (wants.includes(p.screen)) return p;
    if (p.screen === "license-loading" || p.screen === "loading") {
      await sleep(200);
      continue;
    }
    if (wants.includes("login") && p.selectors.login) return p;
    if (wants.includes("home") && p.selectors.home) return p;
    await sleep(250);
  }
  return probeLegacyScreen(wc);
}

export async function captureLegacyFailure(
  win: BrowserWindow,
  label: string,
  consoleErrors: string[],
  ipcErrors: string[],
): Promise<string> {
  mkdirSync(PARITY_OUT, { recursive: true });
  const stamp = Date.now();
  const png = join(PARITY_OUT, `legacy-fail-${label}-${stamp}.png`);
  const json = join(PARITY_OUT, `legacy-fail-${label}-${stamp}.json`);
  const probe = await probeLegacyScreen(win.webContents);
  const img = await win.webContents.capturePage();
  writeFileSync(png, img.toPNG());
  writeFileSync(
    json,
    JSON.stringify({ probe, consoleErrors, ipcErrors }, null, 2),
    "utf8",
  );
  console.error(`[FAIL] screenshot=${png}`);
  console.error(`[FAIL] dump=${json}`);
  return png;
}

export function createVisibleLegacyWindow(width = 1280, height = 900): BrowserWindow {
  return new BrowserWindow({
    width,
    height,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
}
