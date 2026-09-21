/**
 * Premium MoneyInput + modal input regresyonu.
 */
import { app, type BrowserWindow } from "electron";
import { runMigrations } from "../src/main/db/migrate";
import { allMigrations } from "../src/main/migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady } from "../src/main/ipc/handlers";
import { authLogout, setupFirst } from "../src/main/services/auth.service";
import { dosyaEkle } from "../src/main/services/dosya.service";
import { muvekkilEkle } from "../src/main/services/muvekkil.service";
import { getDb, nowIso } from "../src/main/db/connection";
import {
  assert,
  attachConsoleCollector,
  createPremiumWindow,
  js,
  loadPremiumRoute,
  premiumLogin,
  seedLicenseActive,
  SET_INPUT_VALUE,
  shutdownPremiumElectron,
  waitForCondition,
  waitForSelector,
  resetDbConnection,
  type ConsoleCollector,
} from "./lib/premium-e2e-harness";
import { cleanupIsolatedEnv, initIsolatedElectronEnv } from "./lib/premium-e2e-isolation";

async function exerciseTextInput(win: BrowserWindow, selector: string): Promise<void> {
  await js(
    win.webContents,
    `${SET_INPUT_VALUE}
    const el = document.querySelector(${JSON.stringify(selector)});
    __mkdSetInput(el, 'abc');
    __mkdSetInput(el, '');
    __mkdSetInput(el, 'test123');
    el.focus();
    el.setSelectionRange(0, el.value.length);
    document.execCommand('delete');
    __mkdSetInput(el, 'final');
  `,
  );
  const val = await js<string>(win.webContents, `document.querySelector(${JSON.stringify(selector)})?.value || ''`);
  assert(val === "final", `Input değeri beklenmiyor: ${val}`);
}

async function exerciseMoneyInput(win: BrowserWindow, id: string): Promise<void> {
  const caretStable = await js<boolean>(
    win.webContents,
    `${SET_INPUT_VALUE}
    (() => {
      const el = document.getElementById(${JSON.stringify(id)});
      if (!el) return false;
      __mkdSetInput(el, '1500');
      const v1 = el.value;
      const c1 = el.selectionStart ?? 0;
      __mkdSetInput(el, '1500,50');
      const v2 = el.value;
      const c2 = el.selectionStart ?? 0;
      return v1.length > 0 && v2.includes(',') && Math.abs(c2 - c1) <= 4;
    })()`,
  );
  assert(caretStable, `MoneyInput caret sıçradı: ${id}`);
  await js(
    win.webContents,
    `${SET_INPUT_VALUE}
    const el = document.getElementById(${JSON.stringify(id)});
    __mkdSetInput(el, '');
    __mkdSetInput(el, '2.500,00');
  `,
  );
}

async function run(): Promise<void> {
  resetDbConnection();
  const env = initIsolatedElectronEnv(`input-regression-${Date.now()}`);
  let win: BrowserWindow | null = null;
  const bag: ConsoleCollector = { errors: [], warnings: [], sensitive: [] };

  try {
    await app.whenReady();
    win = createPremiumWindow(1366, 768);
    Object.assign(bag, attachConsoleCollector(win));

    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    seedLicenseActive(db);
    const setup = setupFirst({
      adSoyad: "Input Test",
      kullaniciAdi: "input_e2e",
      sifre: "input-e2e-123",
      guvenlikSorusuKodu: "G1",
      guvenlikCevabi: "test",
    });
    assert(setup.ok, setup.error ?? "setup failed");
    const m = muvekkilEkle({ muvekkilTuru: "GERCEK_KISI", adSoyad: "Input Müvekkil", telefon: "555" });
    const d = dosyaEkle({
      muvekkilId: m.id,
      konuBasligi: "Input Dosya",
      mahkemeAdi: "Test",
      dosyaNumarasi: "1",
    });
    registerIpcHandlers();
    initAuthOnReady();
    initLicenseOnReady();
    authLogout();

    await premiumLogin(win, "input_e2e", "input-e2e-123");
    await loadPremiumRoute(win, `/muvekkil/${m.id}/dosya/${d.id}`, ".pm-dosya-page");

    await js(
      win.webContents,
      `Array.from(document.querySelectorAll('button')).find(b => /\\+ İşlem ekle/i.test(b.textContent||''))?.click()`,
    );
    await js(win.webContents, `document.querySelector('.pm-islem-secim-btn--primary')?.click()`);
    await waitForSelector(win.webContents, "#pm-form-avans", 8000);
    await exerciseMoneyInput(win, "pm-avans-tutar");
    await exerciseTextInput(win, "#pm-avans-aciklama");
    await js(win.webContents, `document.querySelector('.pm-modal-backdrop')?.click()`);
    await waitForCondition(win.webContents, `!document.getElementById('pm-form-avans')`, 8000);

    await js(
      win.webContents,
      `Array.from(document.querySelectorAll('button')).find(b => /\\+ İşlem ekle/i.test(b.textContent||''))?.click()`,
    );
    await js(
      win.webContents,
      `Array.from(document.querySelectorAll('.pm-islem-secim-btn')).find(b => /Masraf/i.test(b.textContent||''))?.click()`,
    );
    await waitForSelector(win.webContents, "#pm-form-masraf", 8000);
    await exerciseMoneyInput(win, "pm-masraf-tutar");
    const before = await js<number>(win.webContents, `document.querySelectorAll('#pm-form-masraf').length`);
    await js(win.webContents, `document.querySelector('button[form="pm-form-masraf"]')?.click()`);
    await js(win.webContents, `document.querySelector('button[form="pm-form-masraf"]')?.click()`);
    await waitForCondition(win.webContents, `!document.getElementById('pm-form-masraf')`, 15000);
    const afterRows = await js<number>(
      win.webContents,
      `document.querySelectorAll('.pm-kasa-table tbody tr, .pm-dosya-kasa-table tbody tr').length`,
    );
    assert(before === 1, "Masraf formu yok");
    assert(afterRows >= 1, "Masraf kaydı listede görünmüyor");

    const fatal = bag.errors.filter((e) => !/devtools|Autofill|Third-party cookie/i.test(e));
    assert(fatal.length === 0, `Console errors: ${fatal.slice(0, 3).join("; ")}`);
    console.log("\n=== Premium input regresyon: TÜM TESTLER GEÇTİ ===\n");
  } finally {
    await shutdownPremiumElectron(win, env.dbPath, true);
    cleanupIsolatedEnv(env);
  }
}

if (process.env.MKD_PREMIUM_INPUT_TEST === "1") {
  app.on("window-all-closed", () => {});
  void run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[FAIL] Premium input:", e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
