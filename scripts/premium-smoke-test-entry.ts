/**
 * Premium renderer geniş smoke — ana ekranlar, buton/modal akışları, runtime hata yakalama.
 * Geçici MKD_TEST_DB; AppData yazılmaz.
 */
import { app, type BrowserWindow } from "electron";
import { getDb, nowIso } from "../src/main/db/connection";
import { runMigrations } from "../src/main/db/migrate";
import { allMigrations } from "../src/main/migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady } from "../src/main/ipc/handlers";
import { authLogout, setupFirst } from "../src/main/services/auth.service";
import { vekaletTaksitEkle } from "../src/main/services/vekalet.service";
import {
  assert,
  attachConsoleCollector,
  createPremiumWindow,
  js,
  loadPremiumRoute,
  navigatePremiumHash,
  premiumLogin,
  seedLicenseActive,
  SET_INPUT_VALUE,
  shutdownPremiumElectron,
  sleep,
  waitForCondition,
  waitForSelector,
  resetDbConnection,
  type ConsoleCollector,
} from "./lib/premium-e2e-harness";
import { seedPrintParityData } from "./lib/premium-e2e-seed";
import { cleanupIsolatedEnv, initIsolatedElectronEnv } from "./lib/premium-e2e-isolation";

const CRED = { user: "premium_smoke", pass: "premium-smoke-123", ad: "Premium Smoke" };

const FATAL_CONSOLE_RE =
  /ReferenceError|TypeError|is not defined|Cannot read propert|Cannot access .+ before initialization|Unhandled(?:Promise)?Rejection|unhandledrejection|Arayüz yüklenemedi/i;

function pass(msg: string): void {
  console.log(`[PASS] ${msg}`);
}

function section(title: string): void {
  console.log(`\n--- ${title} ---`);
}

async function installRuntimeGuards(win: BrowserWindow): Promise<void> {
  await js(
    win.webContents,
    `(() => {
      if (window.__mkdSmokeGuards) return;
      window.__mkdSmokeGuards = true;
      window.__mkdSmokeRuntimeErrors = [];
      window.addEventListener('error', (e) => {
        window.__mkdSmokeRuntimeErrors.push(String(e?.message || e?.error || 'window.error'));
      });
      window.addEventListener('unhandledrejection', (e) => {
        const r = e?.reason;
        window.__mkdSmokeRuntimeErrors.push('UnhandledPromiseRejection: ' + (r instanceof Error ? r.message : String(r)));
      });
    })()`,
  );
}

async function assertHealthy(win: BrowserWindow, bag: ConsoleCollector, ctx: string): Promise<void> {
  const boundary = await js<boolean>(
    win.webContents,
    `!!(document.body?.innerText || '').includes('Arayüz yüklenemedi')`,
  );
  assert(!boundary, `${ctx}: ErrorBoundary göründü`);

  const runtime = await js<string[]>(win.webContents, `window.__mkdSmokeRuntimeErrors || []`);
  const fatalRuntime = runtime.filter((m) => FATAL_CONSOLE_RE.test(m));
  assert(fatalRuntime.length === 0, `${ctx}: runtime hata: ${fatalRuntime.slice(0, 3).join(" | ")}`);

  const fatalConsole = bag.errors.filter((e) => FATAL_CONSOLE_RE.test(e) && !/devtools|Autofill|Third-party cookie/i.test(e));
  assert(fatalConsole.length === 0, `${ctx}: console fatal: ${fatalConsole.slice(0, 3).join(" | ")}`);
  assert(bag.sensitive.length === 0, `${ctx}: hassas console: ${bag.sensitive.join("; ")}`);
}

async function goRoute(win: BrowserWindow, route: string, selector: string): Promise<void> {
  const hasShell = await js<boolean>(win.webContents, `!!document.querySelector('.pm-shell')`);
  if (hasShell) {
    try {
      await navigatePremiumHash(win, route, selector, 20000);
      return;
    } catch {
      /* print/fullscreen routes leave shell — full reload */
    }
  }
  await loadPremiumRoute(win, route, ".pm-shell");
  await installRuntimeGuards(win);
  await navigatePremiumHash(win, route, selector, 25000);
}

async function clickText(win: BrowserWindow, pattern: string, sel = "button, a"): Promise<void> {
  const ok = await js<boolean>(
    win.webContents,
    `(() => {
      const re = ${pattern};
      const el = Array.from(document.querySelectorAll(${JSON.stringify(sel)})).find((n) => re.test((n.textContent || '').trim()));
      if (!el) return false;
      el.click();
      return true;
    })()`,
  );
  assert(ok, `Tıklanamadı: ${pattern}`);
}

async function closeModal(win: BrowserWindow): Promise<void> {
  const closed = await js<boolean>(
    win.webContents,
    `(() => {
      const close = document.querySelector('.pm-modal-close');
      if (close) { close.click(); return true; }
      const iptal = Array.from(document.querySelectorAll('button')).find((b) => /İptal|Vazgeç|Kapat/i.test(b.textContent || ''));
      if (iptal) { iptal.click(); return true; }
      return false;
    })()`,
  );
  assert(closed, "Modal kapatılamadı");
  await waitForCondition(win.webContents, `!document.querySelector('.pm-modal-panel')`, 10000);
}

async function testOverview(win: BrowserWindow, bag: ConsoleCollector, muvekkilId: number): Promise<void> {
  section("Genel Bakış");
  await goRoute(win, "/", ".pm-overview");
  assert(await waitForSelector(win.webContents, ".pm-finance-kpi, .pm-dash-metric", 15000), "Metrik kartları yok");
  assert(await waitForSelector(win.webContents, ".pm-dash-workflow, .pm-alerts-panel, .pm-quick-panel", 10000), "Dashboard panelleri yok");
  pass("Sayfa açıldı");

  await clickText(win, "/Yeni müvekkil/i");
  assert(await waitForSelector(win.webContents, "#pm-muvekkil-form, .pm-modal-panel", 8000), "Yeni müvekkil modalı açılmadı");
  await closeModal(win);
  pass("Yeni müvekkil modal aç/kapat");

  const detailOk = await js<boolean>(
    win.webContents,
    `(() => {
      const btn = document.querySelector('.pm-mvk-icon-btn[aria-label="Detayı aç"], a.pm-mvk-detail-link');
      if (btn) { btn.click(); return true; }
      const row = document.querySelector('.pm-dash-client-row, .pm-mvk-table tbody tr');
      if (row) { row.click(); return true; }
      return false;
    })()`,
  );
  if (detailOk) {
    assert(
      await waitForCondition(win.webContents, `location.hash.includes('/muvekkil/')`, 10000),
      "Detay navigasyonu başarısız",
    );
    pass("Müvekkil detay aksiyonu");
    await goRoute(win, "/", ".pm-overview");
  } else {
    // Seed sonrası satır yoksa doğrudan route ile doğrula
    await goRoute(win, `/muvekkil/${muvekkilId}`, ".pm-mvk-detail-head");
    pass("Müvekkil detay (route fallback)");
    await goRoute(win, "/", ".pm-overview");
  }

  const quickRoutes: { label: RegExp; path: string; sel: string }[] = [
    { label: /Ofis Kasası/i, path: "/ofis-kasasi", sel: ".pm-ofis-page" },
    { label: /İcra Tahsilat/i, path: "/icra-tahsilat", sel: ".pm-icra-page" },
    { label: /Raporlar/i, path: "/raporlar", sel: ".pm-rapor-page" },
  ];
  for (const q of quickRoutes) {
    await goRoute(win, "/", ".pm-overview");
    const href = await js<string | null>(
      win.webContents,
      `(() => {
        const re = ${q.label};
        const el = Array.from(document.querySelectorAll('.pm-quick-action')).find((n) => re.test(n.textContent || ''));
        if (!el) return null;
        return el.getAttribute('href') || el.getAttribute('to') || '';
      })()`,
    );
    assert(href != null, `Hızlı işlem yok: ${q.label}`);
    assert(
      String(href).includes(q.path.replace(/^\//, "")) || String(href).includes(q.path),
      `Hızlı işlem href yanlış: ${href} (beklenen ${q.path})`,
    );
    await goRoute(win, q.path, q.sel);
    pass(`Hızlı işlem → ${q.path}`);
  }

  await goRoute(win, "/", ".pm-overview");
  assert(await waitForSelector(win.webContents, ".pm-alerts-panel, .pm-alert-metric", 8000), "Uyarı merkezi render yok");
  pass("Uyarı merkezi render");

  // Mali Kontrol Merkezi — sayaç tutarlılığı + bozuk metin yok
  assert(await waitForSelector(win.webContents, ".pm-mk-card", 10000), "Mali Kontrol kartı yok");
  const mkText = await js<string>(
    win.webContents,
    `document.querySelector('.pm-mk-card')?.innerText?.replace(/\\s+/g, ' ').trim() || ''`,
  );
  assert(!/Mali Kontrol\d/i.test(mkText), `Birleşik bozuk metin: ${mkText}`);
  assert(!/81 kritik/i.test(mkText), `Yanlış 81 kritik metni: ${mkText}`);
  assert(/Mali Kontrol Merkezi/i.test(mkText), "Kart başlığı yok");

  const cardCounts = await js<{ toplam: number; kritik: number; uyari: number; bilgi: number }>(
    win.webContents,
    `(() => {
      const el = document.querySelector('.pm-mk-card');
      return {
        toplam: Number(el?.getAttribute('data-mk-toplam') || 0),
        kritik: Number(el?.getAttribute('data-mk-kritik') || 0),
        uyari: Number(el?.getAttribute('data-mk-uyari') || 0),
        bilgi: Number(el?.getAttribute('data-mk-bilgi') || 0),
      };
    })()`,
  );
  assert(
    cardCounts.toplam === cardCounts.kritik + cardCounts.uyari + cardCounts.bilgi,
    `Kart sayaç toplamı uyumsuz: ${JSON.stringify(cardCounts)}`,
  );

  await js(win.webContents, `document.querySelector('.pm-mk-card-cta')?.click()`);
  assert(await waitForSelector(win.webContents, ".pm-modal-panel", 8000), "Mali Kontrol modalı açılmadı");
  const footerToplam = await js<number>(
    win.webContents,
    `Number(document.querySelector('[data-mk-footer-toplam]')?.getAttribute('data-mk-footer-toplam') || -1)`,
  );
  assert(footerToplam === cardCounts.toplam, `Kart toplam (${cardCounts.toplam}) ≠ modal footer (${footerToplam})`);
  const modalTitle = await js<string>(
    win.webContents,
    `document.querySelector('#pm-modal-title')?.textContent?.trim() || ''`,
  );
  assert(/Mali Kontrol/i.test(modalTitle), "Modal başlığı yanlış");
  await closeModal(win);
  pass("Mali Kontrol kart = modal sayaç; modal aç/kapat");

  await assertHealthy(win, bag, "overview");
}

async function testMuvekkiller(win: BrowserWindow, bag: ConsoleCollector, muvekkilId: number): Promise<void> {
  section("Müvekkiller");
  await goRoute(win, "/muvekkiller", ".pm-mvk-control-bar, .pm-mvk-page");
  pass("Sayfa açıldı");

  await js(
    win.webContents,
    `${SET_INPUT_VALUE}
      const el = document.querySelector('.pm-mvk-search-box-input, .pm-mvk-search-input');
      if (!el) throw new Error('Arama alanı yok');
      __mkdSetInput(el, 'smoke');
    `,
  );
  await sleep(400);
  pass("Arama alanı yazılabilir");

  await clickText(win, /Yeni [Mm]üvekkil/);
  assert(await waitForSelector(win.webContents, "#pm-muvekkil-form", 8000), "Yeni müvekkil formu açılmadı");
  await clickText(win, /İptal|Vazgeç/);
  await waitForCondition(win.webContents, `!document.getElementById('pm-muvekkil-form')`, 8000);
  pass("Yeni müvekkil aç/kapat");

  await goRoute(win, `/muvekkil/${muvekkilId}`, ".pm-mvk-detail-head");
  pass("Müvekkil detayına gidildi");

  await clickText(win, /Müvekkiller/, "a, button");
  assert(
    await waitForCondition(win.webContents, `location.hash.includes('/muvekkiller')`, 10000),
    "Detaydan geri dönüş başarısız",
  );
  pass("Detaydan geri dönüş");
  await assertHealthy(win, bag, "muvekkiller");
}

async function testDosyaDetail(
  win: BrowserWindow,
  bag: ConsoleCollector,
  muvekkilId: number,
  dosyaId: number,
): Promise<void> {
  section("Dosya detay");
  await goRoute(win, `/muvekkil/${muvekkilId}`, ".pm-mvk-detail-dosya-shell, .pm-mvk-detail-main");
  assert(
    await waitForSelector(win.webContents, ".pm-mvk-detail-main table, .pm-mvk-empty, .pm-empty", 10000),
    "Dosya listesi alanı yok",
  );
  pass("Dosya listesi render");

  await goRoute(win, `/muvekkil/${muvekkilId}/dosya/${dosyaId}`, ".pm-dosya-page");
  assert(await waitForSelector(win.webContents, ".pm-dosya-page:not(.pm-dosya-page--loading)", 20000), "Dosya detay yüklenmedi");
  pass("Dosya detayına girildi");

  assert(
    await waitForSelector(win.webContents, ".pm-kasa-table, .pm-dosya-section--table, [aria-label*='asa']", 15000),
    "Kasa hareketleri alanı yok",
  );
  pass("Kasa hareketleri alanı");

  await clickText(win, /İşlem ekle/);
  assert(await waitForSelector(win.webContents, ".pm-modal-panel", 8000), "İşlem ekle modalı açılmadı");
  // Avans
  await js(
    win.webContents,
    `Array.from(document.querySelectorAll('.pm-modal-panel button, .pm-modal-panel [role="button"]')).find(b => /Avans/i.test(b.textContent||''))?.click()`,
  );
  assert(
    await waitForCondition(win.webContents, `!!document.querySelector('#pm-modal-title') && /Avans/i.test(document.querySelector('#pm-modal-title')?.textContent||'')`, 8000),
    "Avans modalı açılmadı",
  );
  await closeModal(win);
  pass("Avans girişi modal aç/kapat");

  await clickText(win, /İşlem ekle/);
  await waitForSelector(win.webContents, ".pm-modal-panel", 8000);
  await js(
    win.webContents,
    `Array.from(document.querySelectorAll('.pm-modal-panel button, .pm-modal-panel [role="button"]')).find(b => /Masraf/i.test(b.textContent||''))?.click()`,
  );
  assert(
    await waitForCondition(win.webContents, `/Masraf/i.test(document.querySelector('#pm-modal-title')?.textContent||'')`, 8000),
    "Masraf modalı açılmadı",
  );
  await closeModal(win);
  pass("Masraf girişi modal aç/kapat");

  assert(await waitForSelector(win.webContents, ".pm-vekalet-panel", 15000), "Vekalet paneli yok");
  pass("Vekalet/Taksit paneli");

  const smmOrPanel = await js<boolean>(
    win.webContents,
    `!!document.querySelector('.pm-vekalet-smm-badge, .pm-vekalet-panel, .pm-vekalet-metrics')`,
  );
  assert(smmOrPanel, "SMM / vekalet alanı render olmadı");
  pass("SMM / vekalet uyarı alanı");

  const printBtn = await js<boolean>(
    win.webContents,
    `!!Array.from(document.querySelectorAll('button')).find(b => /Hesap özeti|Yazdır/i.test(b.textContent||''))`,
  );
  assert(printBtn, "Hesap özeti / yazdır butonu yok");
  await js(
    win.webContents,
    `Array.from(document.querySelectorAll('button')).find(b => /Hesap özeti yazdır/i.test(b.textContent||''))?.click()`,
  );
  await waitForCondition(
    win.webContents,
    `location.hash.includes('/print/') || !!document.querySelector('.pm-print, .pm-print-preview, .pm-shell')`,
    10000,
  );
  // Print sayfası shell dışına çıkar — crash olmadığını doğrula, sonra shell'e dön
  const printCrash = await js<boolean>(
    win.webContents,
    `!!(document.body?.innerText || '').includes('Arayüz yüklenemedi')`,
  );
  assert(!printCrash, "Hesap özeti yazdır ErrorBoundary");
  pass("Hesap özeti yazdır tıklandı (crash yok)");
  await goRoute(win, `/muvekkil/${muvekkilId}/dosya/${dosyaId}`, ".pm-dosya-page");
  await assertHealthy(win, bag, "dosya-detail");
}

async function testTahsilatMerkezi(win: BrowserWindow, bag: ConsoleCollector): Promise<void> {
  section("Tahsilat Merkezi");
  await goRoute(win, "/tahsilat-merkezi", ".pm-tahsilat-page");
  pass("Sayfa açıldı");

  const tabCount = await js<number>(win.webContents, `document.querySelectorAll('.pm-tahsilat-tab').length`);
  assert(tabCount >= 2, `Sekme sayısı yetersiz: ${tabCount}`);
  await js(win.webContents, `document.querySelectorAll('.pm-tahsilat-tab')[1]?.click()`);
  await sleep(300);
  await js(win.webContents, `document.querySelectorAll('.pm-tahsilat-tab')[0]?.click()`);
  pass("Sekme geçişi");

  // Tümü sekmesi — ödeme/dosya aksiyonları için
  await js(
    win.webContents,
    `Array.from(document.querySelectorAll('.pm-tahsilat-tab')).find(b => /Tümü/i.test(b.textContent||''))?.click()`,
  );
  await sleep(600);

  const filterOk = await js<boolean>(
    win.webContents,
    `(() => {
      ${SET_INPUT_VALUE}
      const el = document.querySelector('.pm-tahsilat-filters input[type="search"]');
      if (!el) return false;
      try { __mkdSetInput(el, 'smoke'); return true; } catch (e) { return false; }
    })()`,
  );
  assert(filterOk, "Tahsilat arama filtresi yazılamadı");
  pass("Filtre yazıldı");

  const odemeBtn = await js<boolean>(
    win.webContents,
    `!!Array.from(document.querySelectorAll('button')).find(b => /Ödeme al/i.test(b.textContent||''))`,
  );
  if (odemeBtn) {
    await clickText(win, /Ödeme al/);
    assert(await waitForSelector(win.webContents, "#pm-form-odeme-al, .pm-modal-panel", 10000), "Ödeme al modalı açılmadı");
    await closeModal(win);
    pass("Ödeme al modal aç/kapat");
  } else {
    pass("Ödeme al butonu yok (liste boş — fallback OK)");
  }

  const dosyaGit = await js<boolean>(
    win.webContents,
    `!!Array.from(document.querySelectorAll('button, a')).find(b => /Dosyaya git/i.test(b.textContent||''))`,
  );
  if (dosyaGit) {
    await clickText(win, /Dosyaya git/, "button, a");
    assert(
      await waitForCondition(win.webContents, `location.hash.includes('/dosya/')`, 15000),
      "Dosyaya git navigasyonu başarısız",
    );
    pass("Dosyaya git");
    await goRoute(win, "/tahsilat-merkezi", ".pm-tahsilat-page");
  } else {
    pass("Dosyaya git butonu yok (liste boş — fallback OK)");
  }

  await assertHealthy(win, bag, "tahsilat");
}

async function testOfisKasasi(win: BrowserWindow, bag: ConsoleCollector): Promise<void> {
  section("Ofis Kasası");
  await goRoute(win, "/ofis-kasasi", ".pm-ofis-page");
  pass("Sayfa açıldı");

  await clickText(win, /Gelir ekle/);
  assert(await waitForSelector(win.webContents, "#pm-ofk-ftut, .pm-modal-panel", 8000), "Gelir modalı açılmadı");
  await closeModal(win);
  pass("Gelir modal aç/kapat");

  await clickText(win, /Gider ekle/);
  assert(await waitForSelector(win.webContents, "#pm-ofk-ftut, .pm-modal-panel", 8000), "Gider modalı açılmadı");
  await closeModal(win);
  pass("Gider modal aç/kapat");

  const ofisFilterOk = await js<boolean>(
    win.webContents,
    `(() => {
      ${SET_INPUT_VALUE}
      const el = document.getElementById('pm-ofk-q');
      if (!el) return false;
      try {
        __mkdSetInput(el, 'test');
        __mkdSetInput(el, '');
        return true;
      } catch (e) { return false; }
    })()`,
  );
  assert(ofisFilterOk, "Ofis filtre alanı yazılamadı");
  pass("Filtreler yazılabilir");
  await sleep(400);

  assert(
    await waitForSelector(
      win.webContents,
      ".pm-ofis-table, .pm-ofis-table-section, .pm-ofis-action, .pm-empty-state",
      15000,
    ),
    "Ofis tablo / aksiyon alanı yok",
  );
  pass("Onayla/düzeltme alanı veya tablo render");
  await assertHealthy(win, bag, "ofis-kasasi");
}

async function testIcra(win: BrowserWindow, bag: ConsoleCollector): Promise<void> {
  section("İcra Tahsilat");
  await goRoute(win, "/icra-tahsilat", ".pm-icra-page");
  assert(
    await waitForSelector(win.webContents, ".pm-icra-table, .pm-icra-page, .pm-empty, [class*='empty']", 10000),
    "İcra liste/boş durum yok",
  );
  pass("Liste/boş durum render");

  await clickText(win, /Yeni icra tahsilat/);
  assert(await waitForSelector(win.webContents, ".pm-modal-panel", 8000), "Yeni icra modalı açılmadı");
  await closeModal(win);
  pass("Yeni kayıt modal aç/kapat");

  await js(
    win.webContents,
    `Array.from(document.querySelectorAll('button')).find(b => /raporu yazdır/i.test(b.textContent||''))?.click()`,
  );
  await sleep(400);
  pass("Rapor yazdır tıklandı (crash yok)");
  await assertHealthy(win, bag, "icra");
}

async function testRaporlar(win: BrowserWindow, bag: ConsoleCollector): Promise<void> {
  section("Raporlar");
  await goRoute(win, "/raporlar", ".pm-rapor-page");
  assert(await waitForSelector(win.webContents, ".pm-rapor-nav-btn, .pm-rapor-content", 8000), "Rapor kartları/nav yok");
  pass("Rapor kartları render");

  const navCount = await js<number>(win.webContents, `document.querySelectorAll('.pm-rapor-nav-btn').length`);
  assert(navCount >= 2, `Rapor nav yetersiz: ${navCount}`);
  await js(win.webContents, `document.querySelectorAll('.pm-rapor-nav-btn')[1]?.click()`);
  await sleep(300);
  await js(win.webContents, `document.querySelectorAll('.pm-rapor-nav-btn')[0]?.click()`);

  await js(
    win.webContents,
    `Array.from(document.querySelectorAll('button')).find(b => /Yazdır|Dışa aktar/i.test(b.textContent||''))?.click()`,
  );
  await sleep(400);
  pass("Yazdır/dışa aktar tıklandı (crash yok)");
  await assertHealthy(win, bag, "raporlar");
}

async function testAyarlar(win: BrowserWindow, bag: ConsoleCollector): Promise<void> {
  section("Ayarlar");
  await goRoute(win, "/ayarlar", ".pm-settings-page");
  pass("Sayfa açıldı");

  await clickText(win, /Veri Yedekleme/);
  assert(await waitForSelector(win.webContents, ".pm-settings-backup-panel, .pm-settings-backup-actions", 8000), "Yedekleme alanı yok");
  pass("Yedekleme/Geri yükleme alanı");

  await clickText(win, /^Lisans$/);
  assert(await waitForSelector(win.webContents, ".pm-settings-license-panel, .pm-settings-license-status", 8000), "Lisans alanı yok");
  pass("Lisans ayarları");

  await clickText(win, /Güvenlik/);
  await sleep(300);
  pass("Güvenlik ayarları render");

  await assertHealthy(win, bag, "ayarlar");
}

async function run(): Promise<void> {
  resetDbConnection();
  const env = initIsolatedElectronEnv(`premium-smoke-${Date.now()}`);
  let win: BrowserWindow | null = null;
  const bag: ConsoleCollector = { errors: [], warnings: [], sensitive: [] };

  try {
    await app.whenReady();
    app.commandLine.appendSwitch("disable-gpu");
    win = createPremiumWindow(1440, 900);
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

    const seed = seedPrintParityData();
    // Ödeme al testleri için açık taksit
    const vkRow = db
      .prepare(`SELECT id FROM anlasilan_vekalet_ucreti WHERE dosya_id = ?`)
      .get(seed.dosyaId) as { id: number } | undefined;
    if (vkRow?.id) {
      const tkOpen = vekaletTaksitEkle(vkRow.id, { tutar: 2500, taksitNo: 2, vadeTarihi: "2026-12-01" });
      assert(tkOpen.ok, tkOpen.ok ? "" : tkOpen.error);
      const tkLate = vekaletTaksitEkle(vkRow.id, { tutar: 1500, taksitNo: 3, vadeTarihi: "2026-01-15" });
      assert(tkLate.ok, tkLate.ok ? "" : tkLate.error);
    }

    await premiumLogin(win, CRED.user, CRED.pass);
    await installRuntimeGuards(win);
    await assertHealthy(win, bag, "login");

    await testOverview(win, bag, seed.muvekkilId);
    await testMuvekkiller(win, bag, seed.muvekkilId);
    await testDosyaDetail(win, bag, seed.muvekkilId, seed.dosyaId);
    await testTahsilatMerkezi(win, bag);
    await testOfisKasasi(win, bag);
    await testIcra(win, bag);
    await testRaporlar(win, bag);
    await testAyarlar(win, bag);

    await assertHealthy(win, bag, "final");
  } finally {
    await shutdownPremiumElectron(win, env.dbPath, true);
    cleanupIsolatedEnv(env);
  }
}

if (process.env.MKD_PREMIUM_SMOKE_TEST === "1") {
  app.on("window-all-closed", () => {
    /* hold until process.exit */
  });
  void run()
    .then(() => {
      console.log("\n=== Premium geniş smoke: TÜM TESTLER GEÇTİ ===\n");
      process.exit(0);
    })
    .catch((e) => {
      console.error("[FAIL] Premium smoke:", e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
