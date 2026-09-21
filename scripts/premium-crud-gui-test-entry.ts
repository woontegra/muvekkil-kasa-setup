/**
 * Premium GUI CRUD smoke — geçici MKD_TEST_DB üzerinde modal akışları.
 */
import { app, type BrowserWindow } from "electron";
import { runMigrations } from "../src/main/db/migrate";
import { allMigrations } from "../src/main/migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady } from "../src/main/ipc/handlers";
import { authLogout, setupFirst } from "../src/main/services/auth.service";
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
  shutdownPremiumElectron,
  waitForCondition,
  waitForSelector,
  resetDbConnection,
  type ConsoleCollector,
} from "./lib/premium-e2e-harness";
import { exerciseInput, setInput } from "./lib/parity/ui";
import { cleanupIsolatedEnv, initIsolatedElectronEnv } from "./lib/premium-e2e-isolation";

function pass(msg: string): void {
  console.log(`[PASS] ${msg}`);
}

function countTable(table: string): number {
  return Number(getDb().prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c);
}

async function clickButton(win: BrowserWindow, pattern: string): Promise<void> {
  const ok = await js<boolean>(
    win.webContents,
    `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => ${pattern}.test(b.textContent || ''));
      if (!btn) return false;
      btn.click();
      return true;
    })()`,
  );
  assert(ok, `Buton bulunamadı: ${pattern}`);
}

async function waitModalClosed(win: BrowserWindow, formId: string): Promise<void> {
  const ok = await waitForCondition(win.webContents, `!document.getElementById(${JSON.stringify(formId)})`, 15000);
  assert(ok, `Modal kapanmadı: ${formId}`);
}

async function waitToast(win: BrowserWindow): Promise<void> {
  const ok = await waitForSelector(win.webContents, ".pm-toast", 10000);
  assert(ok, "Başarı toast görünmedi");
}

async function run(): Promise<void> {
  resetDbConnection();
  const env = initIsolatedElectronEnv(`crud-gui-${Date.now()}`);
  let win: BrowserWindow | null = null;
  const bag: ConsoleCollector = { errors: [], warnings: [], sensitive: [] };

  try {
    await app.whenReady();
    app.commandLine.appendSwitch("disable-gpu");
    win = createPremiumWindow(1366, 768);
    Object.assign(bag, attachConsoleCollector(win));

    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    assert(
      Number(
        db.prepare(`SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='vekalet_ucreti_taksit'`).get()
          .c,
      ) === 1,
      "Test DB migration eksik: vekalet_ucreti_taksit",
    );
    seedLicenseActive(db);
    const setup = setupFirst({
      adSoyad: "CRUD GUI",
      kullaniciAdi: "crud_gui",
      sifre: "crud-gui-123",
      guvenlikSorusuKodu: "G1",
      guvenlikCevabi: "test",
    });
    assert(setup.ok, setup.error ?? "setup failed");
    const m = muvekkilEkle({
      muvekkilTuru: "GERCEK_KISI",
      adSoyad: "CRUD GUI Müvekkil",
      telefon: "5554443322",
    });
    registerIpcHandlers();
    initAuthOnReady();
    initLicenseOnReady();
    authLogout();

    await premiumLogin(win, "crud_gui", "crud-gui-123");
    process.env.MKD_TEST_DB = env.dbPath;

    const dosyaBefore = countTable("dosya");
    await js(win.webContents, `location.hash = '#/muvekkil/${m.id}'`);
    const detailReady = await waitForSelector(win.webContents, ".pm-mvk-detail-head", 45000);
    assert(detailReady, `Müvekkil detay yüklenmedi (id=${m.id})`);
    await clickButton(win, "/\\+ Yeni dosya/i");
    await waitForSelector(win.webContents, "#pm-dosya-form", 8000);
    await setInput(win.webContents, "pm-dosya-form-konu", "CRUD GUI Dosya");
    await setInput(win.webContents, "pm-dosya-form-mahkeme", "Ankara 2. İcra");
    await setInput(win.webContents, "pm-dosya-form-no", "2026/CRUD");
    await js(win.webContents, `document.querySelector('button[form="pm-dosya-form"]')?.click()`);
    await waitModalClosed(win, "pm-dosya-form");
    await waitToast(win);
    assert(countTable("dosya") === dosyaBefore + 1, "Dosya tek kayıt oluşturmadı");
    pass("Dosya oluştur");

    const dosyaId = Number(
      db.prepare(`SELECT id FROM dosya WHERE konu_basligi = ?`).get("CRUD GUI Dosya")?.id,
    );
    assert(dosyaId > 0, "Dosya id bulunamadı");

    process.env.MKD_TEST_DB = env.dbPath;
    await loadPremiumRoute(win, `/muvekkil/${m.id}/dosya/${dosyaId}`);
    const islemReady = await waitForCondition(
      win.webContents,
      `Array.from(document.querySelectorAll('button')).some((b) => /İşlem ekle/i.test(b.textContent || ''))`,
      45000,
    );
    if (!islemReady) {
      const body = await js<string>(win.webContents, `(document.body?.innerText || '').slice(0, 400)`);
      assert(false, `Dosya detay açılamadı: ${body}`);
    }
    const kasaBefore = countTable("dosya_kasa_hareket");

    await clickButton(win, "/\\+ İşlem ekle/i");
    await waitForSelector(win.webContents, ".pm-islem-secim-btn--primary", 5000);
    await js(win.webContents, `document.querySelector('.pm-islem-secim-btn--primary')?.click()`);
    await waitForSelector(win.webContents, "#pm-form-avans", 8000);
    await exerciseInput(win.webContents, "pm-avans-tutar", "1.500,00");
    await setInput(win.webContents, "pm-avans-aciklama", "CRUD avans");
    await js(win.webContents, `document.querySelector('button[form="pm-form-avans"]')?.click()`);
    await waitModalClosed(win, "pm-form-avans");
    await waitToast(win);
    assert(countTable("dosya_kasa_hareket") === kasaBefore + 1, "Avans tek kayıt oluşturmadı");
    pass("Avans gir");

    await clickButton(win, "/\\+ İşlem ekle/i");
    await js(
      win.webContents,
      `Array.from(document.querySelectorAll('.pm-islem-secim-btn')).find(b => /Masraf/i.test(b.textContent||''))?.click()`,
    );
    await waitForSelector(win.webContents, "#pm-form-masraf", 8000);
    await exerciseInput(win.webContents, "pm-masraf-tutar", "250,00");
    await setInput(win.webContents, "pm-masraf-aciklama", "CRUD masraf");
    await js(win.webContents, `document.querySelector('button[form="pm-form-masraf"]')?.click()`);
    await waitModalClosed(win, "pm-form-masraf");
    await waitToast(win);
    assert(countTable("dosya_kasa_hareket") === kasaBefore + 2, "Masraf tek kayıt oluşturmadı");
    pass("Masraf gir");

    const vekCountBefore = countTable("anlasilan_vekalet_ucreti");
    const vekTutarBefore = Number(
      (
        db.prepare(`SELECT anlasilan_tutar AS t FROM anlasilan_vekalet_ucreti WHERE dosya_id = ?`).get(dosyaId) as
          | { t: number }
          | undefined
      )?.t ?? 0,
    );
    await clickButton(win, "/Vekalet ücreti tanımla/i");
    await waitForSelector(win.webContents, "#pm-form-vekalet-ucret", 8000);
    await exerciseInput(win.webContents, "pm-vu-tutar", "8.000,00");
    await js(win.webContents, `document.querySelector('button[form="pm-form-vekalet-ucret"]')?.click()`);
    await waitModalClosed(win, "pm-form-vekalet-ucret");
    await waitToast(win);
    assert(
      countTable("anlasilan_vekalet_ucreti") === vekCountBefore,
      "Vekalet ücreti yeni satır eklememeli (panel yüklemesinde getOrCreate ile oluşturulur)",
    );
    const vekTutarAfter = Number(
      (
        db.prepare(`SELECT anlasilan_tutar AS t FROM anlasilan_vekalet_ucreti WHERE dosya_id = ?`).get(dosyaId) as
          | { t: number }
          | undefined
      )?.t ?? 0,
    );
    assert(vekTutarBefore <= 0, "Vekalet ücreti tanımlamadan önce tutar sıfır olmalı");
    assert(vekTutarAfter === 8000, "Vekalet ücreti tutarı kaydedilmedi");
    pass("Vekalet ücreti tanımla");

    const taksitBefore = countTable("vekalet_ucreti_taksit");
    await clickButton(win, "/Tek taksit ekle/i");
    await waitForSelector(win.webContents, "#pm-form-taksit-ekle", 8000);
    await exerciseInput(win.webContents, "pm-te-tutar", "4.000,00");
    await js(win.webContents, `document.querySelector('button[form="pm-form-taksit-ekle"]')?.click()`);
    await waitModalClosed(win, "pm-form-taksit-ekle");
    await waitToast(win);
    assert(countTable("vekalet_ucreti_taksit") === taksitBefore + 1, "Taksit tek kayıt oluşturmadı");
    pass("Tek taksit ekle");

    const ofisBefore = countTable("ofis_kasa_hareketleri");
    await js(win.webContents, `location.hash = '#/ofis-kasasi'`);
    const ofisReady = await waitForSelector(win.webContents, ".pm-ofis-page", 30000);
    assert(ofisReady, "Ofis kasası sayfası yüklenmedi");
    await clickButton(win, "/Gelir ekle/i");
    await waitForSelector(win.webContents, "#pm-ofk-ftut", 8000);
    await exerciseInput(win.webContents, "pm-ofk-ftut", "900,00");
    await setInput(win.webContents, "pm-ofk-fac", "CRUD gelir");
    await clickButton(win, "/^Kaydet$/");
    await waitForCondition(win.webContents, `!document.getElementById('pm-ofk-ftut')`, 15000);
    await waitToast(win);
    assert(countTable("ofis_kasa_hareketleri") === ofisBefore + 1, "Ofis gelir tek kayıt oluşturmadı");
    pass("Ofis kasası gelir");

    await clickButton(win, "/Gider ekle/i");
    await waitForSelector(win.webContents, "#pm-ofk-ftut", 8000);
    await exerciseInput(win.webContents, "pm-ofk-ftut", "150,00");
    await setInput(win.webContents, "pm-ofk-fac", "CRUD gider");
    await clickButton(win, "/^Kaydet$/");
    await waitForCondition(win.webContents, `!document.getElementById('pm-ofk-ftut')`, 15000);
    await waitToast(win);
    assert(countTable("ofis_kasa_hareketleri") === ofisBefore + 2, "Ofis gider tek kayıt oluşturmadı");
    pass("Ofis kasası gider");

    const icraBefore = countTable("icra_tahsilat_alacak");
    const icraOdemeBefore = countTable("icra_tahsilat_odeme");
    await js(win.webContents, `location.hash = '#/icra-tahsilat'`);
    const icraReady = await waitForSelector(win.webContents, ".pm-icra-page", 30000);
    assert(icraReady, "İcra tahsilat sayfası yüklenmedi");
    await clickButton(win, "/Yeni icra tahsilat alacağı/i");
    await waitForSelector(win.webContents, "#pm-icra-alacak-borclu", 10000);
    await setInput(win.webContents, "pm-icra-alacak-borclu", "CRUD Borçlu");
    await exerciseInput(win.webContents, "pm-icra-alacak-toplam", "6.000,00");
    await js(
      win.webContents,
      `(async () => {
        const sel = document.getElementById('pm-icra-alacak-muvekkil');
        if (sel && sel.options.length > 1) { sel.value = sel.options[1].value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        await new Promise(r => setTimeout(r, 400));
        const dsel = document.getElementById('pm-icra-alacak-dosya');
        if (dsel && dsel.options.length > 1) { dsel.value = dsel.options[1].value; dsel.dispatchEvent(new Event('change', { bubbles: true })); }
      })()`,
    );
    await js(win.webContents, `Array.from(document.querySelectorAll('button')).find(b => /Kaydet|Oluştur/i.test(b.textContent||''))?.click()`);
    await waitForCondition(win.webContents, `!document.getElementById('pm-icra-alacak-borclu')`, 20000);
    await waitToast(win);
    assert(countTable("icra_tahsilat_alacak") === icraBefore + 1, "İcra alacağı tek kayıt oluşturmadı");
    pass("İcra alacağı oluştur");

    await waitForSelector(win.webContents, ".pm-icra-action--primary", 10000);
    await js(win.webContents, `document.querySelector('.pm-icra-action--primary')?.click()`);
    await waitForSelector(win.webContents, ".pm-icra-detay-modal, .pm-icra-detay", 10000);
    await js(
      win.webContents,
      `Array.from(document.querySelectorAll('button[title="Ödeme al"]')).find(Boolean)?.click()`,
    );
    await waitForSelector(win.webContents, "#pm-icra-odeme-tutar", 10000);
    await exerciseInput(win.webContents, "pm-icra-odeme-tutar", "1.000,00");
    await clickButton(win, "/Ödemeyi kaydet/i");
    await waitForCondition(win.webContents, `!document.getElementById('pm-icra-odeme-tutar')`, 15000);
    await waitToast(win);
    assert(countTable("icra_tahsilat_odeme") === icraOdemeBefore + 1, "İcra ödeme tek kayıt oluşturmadı");
    pass("Kısmi icra ödemesi");

    const fatal = bag.errors.filter((e) => !/devtools|Autofill|Third-party cookie/i.test(e));
    assert(fatal.length === 0, `Console errors: ${fatal.slice(0, 3).join("; ")}`);
    console.log(
      `[INFO] SQL: dosya=${countTable("dosya")} kasa=${countTable("dosya_kasa_hareket")} vekalet=${countTable("anlasilan_vekalet_ucreti")} ofis=${countTable("ofis_kasa_hareketleri")} icra=${countTable("icra_tahsilat_alacak")}`,
    );

    console.log("\n=== Premium CRUD GUI: TÜM TESTLER GEÇTİ ===\n");
  } finally {
    await shutdownPremiumElectron(win, env.dbPath, true);
    cleanupIsolatedEnv(env);
  }
}

if (process.env.MKD_PREMIUM_CRUD_GUI_TEST === "1") {
  app.on("window-all-closed", () => {});
  void run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[FAIL] Premium CRUD GUI:", e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
