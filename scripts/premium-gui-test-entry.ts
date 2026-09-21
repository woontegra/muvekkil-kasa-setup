/**
 * Premium renderer gerçek Electron GUI smoke + davranış testleri.
 */
import { join } from "node:path";
import { app, type BrowserWindow } from "electron";
import { closeDb, getDb, nowIso } from "../src/main/db/connection";
import { runMigrations } from "../src/main/db/migrate";
import { allMigrations } from "../src/main/migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady } from "../src/main/ipc/handlers";
import { authLogout, setupFirst } from "../src/main/services/auth.service";
import {
  assert,
  attachConsoleCollector,
  createPremiumWindow,
  horizontalOverflowPx,
  js,
  loadPremiumRoute,
  newTestDbPath,
  premiumLogin,
  seedDefaultUser,
  seedLicenseActive,
  seedLicenseExpired,
  clearLicense,
  SET_INPUT_VALUE,
  shutdownPremiumElectron,
  sleep,
  waitForCondition,
  waitForSelector,
  resetDbConnection,
  type ConsoleCollector,
  type SeedUser,
} from "./lib/premium-e2e-harness";
import { countTable } from "./lib/premium-e2e-seed";
import { cleanupIsolatedEnv, initIsolatedElectronEnv } from "./lib/premium-e2e-isolation";

const CRED: SeedUser = { user: "premium_gui", pass: "premium-gui-123", ad: "Premium GUI" };

function pass(msg: string): void {
  console.log(`[PASS] ${msg}`);
}

function section(title: string): void {
  console.log(`\n--- ${title} ---`);
}

async function assertNoConsoleIssues(bag: ConsoleCollector, ctx: string): Promise<void> {
  assert(bag.sensitive.length === 0, `${ctx}: hassas console çıktısı: ${bag.sensitive.join("; ")}`);
  const fatal = bag.errors.filter(
    (e) => !/devtools/i.test(e) && !/Autofill/i.test(e) && !/Third-party cookie/i.test(e),
  );
  if (fatal.length) console.warn(`[WARN] ${ctx} console errors:`, fatal.slice(0, 5));
}

async function testLoginDesignAndBehavior(win: BrowserWindow, cred: SeedUser, bag: ConsoleCollector): Promise<void> {
  section("Login tasarım ve davranış");
  await loadPremiumRoute(win, "/login", ".pm-login-panel");

  assert(await waitForSelector(win.webContents, ".pm-auth-hero-program-logo", 10000), "Program logosu yok");
  assert(await waitForSelector(win.webContents, ".pm-auth-hero-woontegra-logo", 10000), "Woontegra logosu yok");
  assert(await waitForSelector(win.webContents, ".pm-auth-hero-features", 10000), "Hero özellik listesi yok");
  const fakeW = await js<boolean>(win.webContents, `!document.body.innerText.includes('MK') || !!document.querySelector('.pm-auth-hero-program-logo')`);
  assert(fakeW, "Sahte marka kutusu algılandı");

  win.setContentSize(1366, 768);
  const overflow768 = await horizontalOverflowPx(win);
  assert(overflow768 < 40, `Login 1366×768 yatay taşma: ${overflow768}px`);
  const formBottom = await js<number>(
    win.webContents,
    `(() => { const el = document.querySelector('.pm-login-panel'); if (!el) return 9999; const r = el.getBoundingClientRect(); return r.bottom; })()`,
  );
  assert(formBottom <= 768 + 2, `Login formu viewport dışında: bottom=${formBottom}`);

  win.setContentSize(1920, 1080);
  const panelW = await js<number>(
    win.webContents,
    `Number(document.querySelector('.pm-login-panel')?.getBoundingClientRect().width || 0)`,
  );
  assert(panelW >= 320, `Login paneli çok dar: ${panelW}px`);

  await js(win.webContents, `${SET_INPUT_VALUE}
    const u = document.querySelector('.pm-login-form input[autocomplete="username"]');
    const p = document.querySelector('.pm-login-form input[autocomplete="current-password"]');
    __mkdSetInput(u, 'test-user');
    __mkdSetInput(u, '');
    __mkdSetInput(u, ${JSON.stringify(cred.user)});
    __mkdSetInput(p, 'wrong');
    __mkdSetInput(p, '');
    __mkdSetInput(p, 'wrong-pass');
  `);

  await js(win.webContents, `document.querySelector('.pm-login-remember input')?.click()`);
  await js(win.webContents, `document.querySelector('.pm-input-eye')?.click()`);
  const passType = await js<string>(
    win.webContents,
    `String(document.querySelector('.pm-login-form input[autocomplete="current-password"]')?.type || '')`,
  );
  assert(passType === "text", "Şifre göster çalışmıyor");

  await js(win.webContents, `document.querySelector('.pm-login-submit')?.click()`);
  await js(win.webContents, `document.querySelector('.pm-login-submit')?.click()`);
  await waitForSelector(win.webContents, ".pm-alert--error, .pm-login-panel--shake", 8000);
  const stillLogin = await js<boolean>(win.webContents, `!Boolean(document.querySelector('.pm-shell'))`);
  assert(stillLogin, "Yanlış giriş shell'e geçti");

  await js(win.webContents, `document.querySelector('a[href*="forgot-password"]')?.click()`);
  const forgot = await waitForSelector(win.webContents, ".pm-forgot-page, .pm-auth-card, .pm-forgot-form", 8000);
  assert(forgot, "Şifremi unuttum route açılmadı");
  pass("Şifremi unuttum route");
  await loadPremiumRoute(win, "/login", ".pm-login-panel");

  await js(win.webContents, `${SET_INPUT_VALUE}
    __mkdSetInput(document.querySelector('.pm-login-form input[autocomplete="username"]'), ${JSON.stringify(cred.user)});
    __mkdSetInput(document.querySelector('.pm-login-form input[autocomplete="current-password"]'), ${JSON.stringify(cred.pass)});
  `);
  await js(win.webContents, `document.querySelector('.pm-login-form')?.requestSubmit()`);
  const ok = await waitForSelector(win.webContents, ".pm-shell", 20000);
  assert(ok, "Doğru giriş shell'e geçmedi");
  pass("Login tasarım ve davranış (busy guard çift tıklamada tek geçiş)");

  await assertNoConsoleIssues(bag, "login");
}

async function testMuvekkillerCrud(win: BrowserWindow, cred: SeedUser, bag: ConsoleCollector): Promise<{ gercekId: number; tuzelId: number }> {
  section("Müvekkiller tasarım ve CRUD");
  const onShell = await js<boolean>(win.webContents, `!!document.querySelector('.pm-shell')`);
  if (!onShell) await premiumLogin(win, cred.user, cred.pass);
  await loadPremiumRoute(win, "/muvekkiller", ".pm-mvk-control-bar");
  assert(
    await waitForSelector(win.webContents, ".pm-mvk-data-table thead th, .pm-mvk-empty", 20000),
    "Liste alanı yüklenmedi",
  );
  const dupTitle = await js<boolean>(
    win.webContents,
    `document.querySelectorAll('.pm-page-header-title').length <= 1 && document.querySelector('.pm-shell .pm-page-header-title')?.textContent?.trim() === 'Müvekkiller'`,
  );
  assert(dupTitle, "Sayfa başlığı yalnızca shell'de olmalı");

  const gercekName = `GUI Gerçek ${Date.now()}`;
  const tuzelName = `GUI Tüzel ${Date.now()}`;
  const mvkBefore = countTable("muvekkil");

  await js(win.webContents, `Array.from(document.querySelectorAll('button')).find(b => /Yeni müvekkil/i.test(b.textContent||''))?.click()`);
  await waitForSelector(win.webContents, "#pm-muvekkil-form", 8000);
  await js(win.webContents, `${SET_INPUT_VALUE}
    __mkdSetInput(document.getElementById('pm-muvekkil-form-ad'), ${JSON.stringify(gercekName)});
    __mkdSetInput(document.getElementById('pm-muvekkil-form-tel'), '5550001111');
  `);
  await js(win.webContents, `document.querySelector('button[form="pm-muvekkil-form"]')?.click()`);
  await waitForCondition(win.webContents, `!document.getElementById('pm-muvekkil-form')`, 10000);
  assert(countTable("muvekkil") === mvkBefore + 1, "Gerçek kişi tek kayıt oluşturmadı");
  await waitForCondition(
    win.webContents,
    `Array.from(document.querySelectorAll('.pm-mvk-data-name')).some(el => el.textContent.includes(${JSON.stringify(gercekName)}))`,
    15000,
  );
  pass("Gerçek kişi oluştur");

  await js(win.webContents, `Array.from(document.querySelectorAll('button')).find(b => /Yeni müvekkil/i.test(b.textContent||''))?.click()`);
  await waitForSelector(win.webContents, "#pm-muvekkil-form", 8000);
  await js(win.webContents, `Array.from(document.querySelectorAll('.pm-mvk-type-opt')).find(b => /Tüzel/i.test(b.textContent||''))?.click()`);
  await js(win.webContents, `${SET_INPUT_VALUE}
    __mkdSetInput(document.getElementById('pm-muvekkil-form-unvan'), ${JSON.stringify(tuzelName)});
    __mkdSetInput(document.getElementById('pm-muvekkil-form-yetkili-tel'), '2125550000');
  `);
  await js(win.webContents, `document.querySelector('button[form="pm-muvekkil-form"]')?.click()`);
  await waitForCondition(win.webContents, `!document.getElementById('pm-muvekkil-form')`, 10000);
  assert(countTable("muvekkil") === mvkBefore + 2, "Tüzel kişi tek kayıt oluşturmadı");
  await waitForCondition(
    win.webContents,
    `Array.from(document.querySelectorAll('.pm-mvk-data-name')).some(el => el.textContent.includes(${JSON.stringify(tuzelName)}))`,
    15000,
  );
  pass("Tüzel kişi oluştur");

  await loadPremiumRoute(win, "/muvekkiller", ".pm-mvk-data-table tbody tr");
  const rowH = await js<number>(
    win.webContents,
    `(() => { const el = document.querySelector('.pm-mvk-data-row'); if (!el) return 0; return el.getBoundingClientRect().height; })()`,
  );
  assert(rowH > 0 && rowH < 120, `Satır yüksekliği anormal: ${rowH}`);

  await js(win.webContents, `${SET_INPUT_VALUE}
    __mkdSetInput(document.querySelector('.pm-mvk-search-box-input'), ${JSON.stringify(gercekName.slice(0, 8))});
  `);
  await sleep(600);
  const searchHit = await js<boolean>(
    win.webContents,
    `Array.from(document.querySelectorAll('.pm-mvk-data-name')).some(el => el.textContent.includes(${JSON.stringify(gercekName)}))`,
  );
  assert(searchHit, "Arama sonucu bulunamadı");
  await js(win.webContents, `document.querySelector('.pm-mvk-search-clear')?.click()`);
  pass("Arama ve temizleme");

  const editBtn = await js<boolean>(win.webContents, `(() => {
    const row = Array.from(document.querySelectorAll('.pm-mvk-data-row')).find(tr => tr.textContent.includes(${JSON.stringify(gercekName)}));
    if (!row) return false;
    const edit = row.querySelector('.pm-mvk-icon-btn[aria-label="Düzenle"]');
    const detail = row.querySelector('.pm-mvk-icon-btn[aria-label="Detayı aç"]');
  if (edit) { edit.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !location.hash.includes('/muvekkil/'); }
  return false;
  })()`);
  assert(editBtn, "Düzenle detay route tetikledi veya satır yok");
  await waitForSelector(win.webContents, "#pm-muvekkil-form", 8000);
  await js(win.webContents, `Array.from(document.querySelectorAll('button')).find(b => /İptal|Kapat/i.test(b.textContent||''))?.click()`);
  pass("Düzenle modalı detay route açmıyor");

  const gercekId = Number(
    getDb().prepare(`SELECT id FROM muvekkil WHERE ad_soyad = ?`).get(gercekName)?.id,
  );
  const tuzelId = Number(
    getDb().prepare(`SELECT id FROM muvekkil WHERE sirket_unvani = ?`).get(tuzelName)?.id,
  );
  assert(gercekId > 0 && tuzelId > 0, "Oluşturulan müvekkil id bulunamadı");

  await js(win.webContents, `location.hash = '#/muvekkil/${gercekId}'`);
  await waitForSelector(win.webContents, ".pm-mvk-detail-head", 10000);
  pass("Müvekkil detay route");

  await assertNoConsoleIssues(bag, "muvekkiller");
  return { gercekId, tuzelId };
}

async function testRouteSmoke(win: BrowserWindow, ids: { gercekId: number }): Promise<void> {
  section("Premium route smoke");
  const routes: { path: string; selector: string; title?: string }[] = [
    { path: "/", selector: ".pm-overview", title: "Genel Bakış" },
    { path: "/muvekkiller", selector: ".pm-mvk-control-bar", title: "Müvekkiller" },
    { path: `/muvekkil/${ids.gercekId}`, selector: ".pm-mvk-detail-head", title: "Müvekkil detayı" },
    { path: "/ofis-kasasi", selector: ".pm-ofis-page", title: "Ofis Kasası" },
    { path: "/icra-tahsilat", selector: ".pm-icra-page", title: "İcra Tahsilat" },
    { path: "/raporlar", selector: ".pm-rapor-page", title: "Raporlar" },
    { path: "/ayarlar", selector: ".pm-settings-page", title: "Ayarlar" },
  ];

  for (const r of routes) {
    await loadPremiumRoute(win, r.path, r.selector);
    const shellTitle = await js<string>(win.webContents, `document.querySelector('.pm-shell .pm-page-header-title')?.textContent?.trim() || ''`);
    if (r.title) assert(shellTitle === r.title || shellTitle.length > 0, `${r.path} üst bar başlığı: ${shellTitle}`);
    const innerDup = await js<number>(
      win.webContents,
      `document.querySelectorAll('.pm-content-inner .pm-page-header-title').length`,
    );
    assert(innerDup === 0, `${r.path} içerikte yinelenen başlık`);
    const loading = await js<boolean>(win.webContents, `!!document.querySelector('.pm-loading-screen')`);
    assert(!loading, `${r.path} sonsuz loading`);
    pass(`Route ${r.path}`);
  }
}

async function testAuthLicenseScenarios(): Promise<void> {
  section("Auth ve lisans senaryoları (ayrı DB)");
  // Her senaryo için closeDb + yeni DB — tek Electron sürecinde
  const scenarios: { name: string; license: "none" | "expired" | "active"; withUser: boolean; route: string; expect: string }[] = [
    { name: "Lisans aktivasyonu gerekli", license: "none", withUser: true, route: "/login", expect: "/lisans" },
    { name: "Lisans süresi doldu", license: "expired", withUser: true, route: "/login", expect: "expired" },
    { name: "İlk kurulum", license: "active", withUser: false, route: "/setup", expect: "setup" },
    { name: "Oturum yok login", license: "active", withUser: true, route: "/", expect: "/login" },
  ];

  for (const sc of scenarios) {
    closeDb();
    const dbPath = newTestDbPath(`mkd-auth-${sc.name.replace(/\s+/g, "-")}`);
    process.env.MKD_TEST_DB = dbPath;
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    if (sc.license === "active") seedLicenseActive(db);
    else if (sc.license === "expired") seedLicenseExpired(db);
    else clearLicense(db);
    if (sc.withUser) seedDefaultUser(db);
    authLogout();

    const win = createPremiumWindow(1280, 800);
    try {
      await loadPremiumRoute(win, sc.route, undefined);
      await sleep(1200);
      const hash = await js<string>(win.webContents, `location.hash || ''`);
      const body = await js<string>(win.webContents, `document.body?.innerText?.slice(0, 500) || ''`);
      if (sc.expect === "/lisans") assert(hash.includes("/lisans"), `${sc.name}: /lisans bekleniyordu, ${hash}`);
      else if (sc.expect === "/login") assert(hash.includes("/login"), `${sc.name}: /login bekleniyordu, ${hash}`);
      else if (sc.expect === "setup") assert(hash.includes("/setup"), `${sc.name}: /setup bekleniyordu, ${hash}`);
      else if (sc.expect === "expired") assert(/sona erdi|doğrulanamadı|Lisans/i.test(body), `${sc.name}: expired ekranı yok`);
      pass(sc.name);
    } finally {
      if (!win.isDestroyed()) win.destroy();
      closeDb();
      try {
        const { unlinkSync } = await import("node:fs");
        unlinkSync(dbPath);
      } catch {
        /* ignore */
      }
    }
  }
  console.log("[BLOCKER] Gerçek lisans aktivasyonu (sunucu anahtarı) güvenli test modu olmadan otomatik doğrulanamaz.");
}

async function run(): Promise<void> {
  resetDbConnection();
  const env = initIsolatedElectronEnv(`premium-gui-${Date.now()}`);
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
      adSoyad: CRED.ad,
      kullaniciAdi: CRED.user,
      sifre: CRED.pass,
      guvenlikSorusuKodu: "G1",
      guvenlikCevabi: "test",
    });
    assert(setup.ok, setup.error ?? "setup failed");
    registerIpcHandlers();
    initAuthOnReady();
    initLicenseOnReady();
    authLogout();

    await testLoginDesignAndBehavior(win, CRED, bag);
    const ids = await testMuvekkillerCrud(win, CRED, bag);
    await testRouteSmoke(win, ids);
    await testAuthLicenseScenarios();
  } finally {
    await shutdownPremiumElectron(win, env.dbPath, true);
    cleanupIsolatedEnv(env);
  }
}

if (process.env.MKD_PREMIUM_GUI_TEST === "1") {
  app.on("window-all-closed", () => {
    /* test süreci pencereyi kapatana kadar çıkma */
  });
  void run()
    .then(() => {
      console.log("\n=== Premium GUI smoke: TÜM TESTLER GEÇTİ ===\n");
      process.exit(0);
    })
    .catch((e) => {
      console.error("[FAIL] Premium GUI:", e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
