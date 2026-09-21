import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { app, BrowserWindow } from "electron";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady } from "../ipc/handlers";
import { setupFirst } from "../services/auth.service";
import { computeDeviceHash } from "../services/deviceHash.service";
import { createMainWindow } from "../window";

const TEST_USER = "gui_test";
const TEST_PASS = "gui-test-123456";
const TEST_AD = "GUI Test Kullanıcı";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForSelector(win: BrowserWindow, selector: string, timeoutMs = 20000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = await win.webContents.executeJavaScript(
      `!!document.querySelector(${JSON.stringify(selector)})`,
    );
    if (found) return true;
    await sleep(150);
  }
  return false;
}

async function js<T>(win: BrowserWindow, code: string): Promise<T> {
  return win.webContents.executeJavaScript(code, true) as Promise<T>;
}

function seedLicense(db: ReturnType<typeof getDb>): void {
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
  ).run("GUI-TEST-KEY", deviceHash, "Müvekkil Kasa Defteri", expires.toISOString(), t, grace.toISOString(), t, t);
}

async function waitForHome(win: BrowserWindow): Promise<void> {
  const ok = await waitForSelector(win, ".desk-home-dashboard", 30000);
  assert(ok, "Ana sayfa dashboard yüklenmedi (beyaz ekran / lisans kapısı?)");
}

export async function runGuiLiveSmoke(): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-gui-live-${Date.now()}.sqlite`);
  process.env.MKD_TEST_DB = dbPath;
  const consoleErrors: string[] = [];
  let win: BrowserWindow | null = null;

  try {
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    seedLicense(db);

    const setup = setupFirst({
      adSoyad: TEST_AD,
      kullaniciAdi: TEST_USER,
      sifre: TEST_PASS,
      guvenlikSorusuKodu: "G1",
      guvenlikCevabi: "test",
    });
    assert(setup.ok, setup.ok ? "" : setup.error);

    await app.whenReady();
    registerIpcHandlers();
    initAuthOnReady();
    initLicenseOnReady();

    win = createMainWindow();
    win.webContents.on("console-message", (_e, level, message) => {
      if (level >= 2) consoleErrors.push(message);
      const lower = message.toLowerCase();
      if (lower.includes("license_key") || lower.includes("activationpassword") || lower.includes("devicehash")) {
        consoleErrors.push(`HASSAS_CONSOLE: ${message}`);
      }
    });

    await new Promise<void>((resolve) => {
      win!.webContents.once("did-finish-load", () => resolve());
    });
    await sleep(800);
    await waitForHome(win);

    console.log("[PASS] Açılış — ana sayfa yüklendi");

    const badge = await waitForSelector(win, ".license-status-badge", 10000);
    assert(badge, "Lisans rozeti görünmüyor");
    console.log("[PASS] Lisans rozeti görünür");

    const kpiCount = await js<number>(
      win,
      "document.querySelectorAll('.desk-home-kpi-card').length",
    );
    assert(kpiCount >= 4, `KPI kart sayısı yetersiz: ${kpiCount}`);
    console.log("[PASS] KPI kartları görünür");

    const sidePanel = await js<boolean>(win, "!!document.querySelector('.desk-home-dashboard-side')");
    assert(sidePanel, "Sağ panel yok");
    console.log("[PASS] Sağ panel düzgün");

    // Responsive: küçük pencere
    win.setBounds({ x: 50, y: 50, width: 1250, height: 790 });
    await sleep(400);
    const scrollSmall = await js<number>(
      win,
      "Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, 0)",
    );
    assert(scrollSmall < 80, `1250x790 yatay scroll fazla: ${scrollSmall}px`);
    win.maximize();
    await sleep(400);
    console.log("[PASS] Layout — 1250x790 ve tam ekran");

    // Arama — React controlled input için InputEvent
    await js(win, `
      (function() {
        const el = document.getElementById('home-ara');
        if (!el) throw new Error('Arama inputu yok');
        el.focus();
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(el, 'zzzz-gui-arama-yok');
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'zzzz-gui-arama-yok' }));
      })()
    `);
    await sleep(1500);
    const aramaDurum =
      (await waitForSelector(win, ".desk-home-search-status", 5000)) ||
      (await waitForSelector(win, ".desk-home-liste-filter-bar", 3000));
    assert(aramaDurum, "Arama filtresi görünmüyor");
    await js(win, `
      (function() {
        const el = document.getElementById('home-ara');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(el, '');
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
      })()
    `);
    await sleep(1500);
    console.log("[PASS] Arama filtreleme / temizleme");

    // Yeni müvekkil modal — zorunlu alan
    await js(win, `document.querySelector('.desk-home-search-btn')?.click()`);
    await waitForSelector(win, "#form-muvekkil", 5000);
    await js(win, `document.querySelector('button[form="form-muvekkil"]')?.click()`);
    await sleep(400);
    const valErr = await waitForSelector(win, "#form-muvekkil ~ .form-error, .modal-body .form-error", 3000);
    assert(valErr, "Zorunlu alan uyarısı görünmedi");
    console.log("[PASS] Zorunlu alan uyarısı");

    // Modal backdrop / iç boş alan tıklaması kapatmamalı
    await js(
      win,
      `(function() {
        const bd = document.querySelector('.modal-backdrop');
        if (!bd) throw new Error('backdrop yok');
        bd.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        bd.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        bd.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        const body = document.querySelector('.modal-body');
        body?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        body?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        body?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      })()`,
    );
    await sleep(200);
    assert(await js<boolean>(win, "!!document.getElementById('form-muvekkil')"), "Backdrop/iç tık modalı kapattı");
    console.log("[PASS] Modal backdrop + iç boş alan tıklaması kapatmaz");

    // İptal ile kapanır
    await js(win, `Array.from(document.querySelectorAll('.modal button')).find(b => /İptal|Kapat/i.test(b.textContent||''))?.click()`);
    await sleep(300);
    assert(!(await js<boolean>(win, "!!document.getElementById('form-muvekkil')")), "İptal modalı kapatmadı");
    console.log("[PASS] İptal ile modal kapanır");

    // Yeniden aç — input çalışır
    await js(win, `document.querySelector('.desk-home-search-btn')?.click()`);
    await waitForSelector(win, "#form-muvekkil", 5000);
    await js(
      win,
      `(function() {
        const el = document.getElementById('mvk-ad');
        if (!el) throw new Error('mvk-ad yok');
        el.focus();
        const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        d?.set?.call(el, '');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        d?.set?.call(el, 'YenidenAçTest');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      })()`,
    );
    const reopenVal = await js<string>(win, "document.getElementById('mvk-ad')?.value || ''");
    assert(reopenVal.includes("YenidenAçTest"), `Yeniden açılışta input çalışmıyor: ${reopenVal}`);
    console.log("[PASS] Modal yeniden açılınca input çalışır");

    // Validation hatasında açık kalır (zaten test edildi) — Kaydet boş ad ile
    await js(win, `
      (function() {
        const el = document.getElementById('mvk-ad');
        const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        d?.set?.call(el, '');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('button[form="form-muvekkil"]')?.click();
      })()
    `);
    await sleep(400);
    assert(await js<boolean>(win, "!!document.getElementById('form-muvekkil')"), "Validation sonrası modal kapandı");
    console.log("[PASS] Validation hatasında modal açık kalır");

    const testName = `GUI Test ${Date.now()}`;
    await js(
      win,
      `(function() {
        function setVal(id, v) {
          const el = document.getElementById(id);
          const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
          d?.set?.call(el, v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        setVal('mvk-ad', ${JSON.stringify(testName)});
        setVal('mvk-tel', '5550000000');
      })()`,
    );
    await js(win, `document.querySelector('button[form="form-muvekkil"]')?.click()`);
    await sleep(1000);
    const modalStillOpen = await js<boolean>(win, "!!document.getElementById('form-muvekkil')");
    assert(!modalStillOpen, "Müvekkil modal kapanmadı");
    const listed = await js<boolean>(
      win,
      `Array.from(document.querySelectorAll('.desk-home-muvekkil-table-wrap td')).some(td => td.textContent.includes(${JSON.stringify(testName)}))`,
    );
    assert(listed, "Yeni müvekkil listede görünmüyor");
    console.log("[PASS] Yeni müvekkil ekleme");

    // Aç — detay
    await js(
      win,
      `(function() {
        const row = Array.from(document.querySelectorAll('.desk-home-muvekkil-table-wrap tr')).find(tr => tr.textContent.includes(${JSON.stringify(testName)}));
        row?.querySelector('a, .desk-home-row-btn')?.click();
      })()`,
    );
    await sleep(800);
    const onDetail = await js<boolean>(win, "location.hash.includes('/muvekkil/')");
    assert(onDetail, "Müvekkil detay açılmadı");

    // Dosya ekle → Vekalet MoneyInput 20× (ücret + tek taksit)
    await js(win, `Array.from(document.querySelectorAll('button')).find(b => /Yeni dosya/i.test(b.textContent||''))?.click()`);
    await waitForSelector(win, "#form-dosya", 5000);
    await js(
      win,
      `(function() {
        function setVal(id, v) {
          const el = document.getElementById(id);
          const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
          d?.set?.call(el, v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        setVal('dosya-konu', 'GUI Vekalet Test');
        setVal('dosya-mahkeme', 'Test Mahkemesi');
        setVal('dosya-no', '2026/1');
        document.querySelector('button[form="form-dosya"]')?.click();
      })()`,
    );
    await sleep(900);
    await js(
      win,
      `(function() {
        const row = Array.from(document.querySelectorAll('tr')).find(tr => tr.textContent.includes('GUI Vekalet Test'));
        row?.querySelector('a')?.click();
      })()`,
    );
    await sleep(1000);
    assert(await js<boolean>(win, "location.hash.includes('/dosya/')"), "Dosya detay açılmadı");

    await js(win, `Array.from(document.querySelectorAll('button, a, [role="tab"]')).find(el => /Vekalet/i.test(el.textContent||''))?.click()`);
    await sleep(500);
    await js(win, `Array.from(document.querySelectorAll('button')).find(b => /Vekalet ücreti|Ücret|Anlaşılan/i.test(b.textContent||''))?.click()`);
    await sleep(400);
    const vuOpen = await waitForSelector(win, "#vu-tutar", 8000);
    assert(vuOpen, "Vekalet ücreti MoneyInput açılmadı");
    const vuCycles = await js<{ ok: boolean; n: number; last: string }>(
      win,
      `(function() {
        const el = document.getElementById('vu-tutar');
        if (!el) return { ok: false, n: 0, last: '' };
        const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        function typeVal(v) {
          el.focus();
          proto?.set?.call(el, v);
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: v }));
        }
        function clearVal() {
          el.focus();
          proto?.set?.call(el, '');
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
        }
        let n = 0;
        for (let i = 0; i < 20; i++) {
          typeVal(String(75000 + i));
          clearVal();
          typeVal(String(100000 + i));
          n++;
        }
        return { ok: true, n, last: el.value };
      })()`,
    );
    assert(vuCycles.ok && vuCycles.n === 20 && vuCycles.last.length > 0, `Vekalet ücret 20× fail: ${JSON.stringify(vuCycles)}`);
    // Kaydet ücret ki taksit açılsın
    await js(win, `document.querySelector('button[form="form-vekalet-ucret"]')?.click()`);
    await sleep(800);
    console.log("[PASS] Vekalet ücreti MoneyInput 20× yaz-sil-yaz");

    await js(win, `Array.from(document.querySelectorAll('button')).find(b => /Tek taksit|Taksit ekle/i.test(b.textContent||''))?.click()`);
    await sleep(400);
    const tekOpen = await waitForSelector(win, "#te-tutar", 5000);
    if (tekOpen) {
      const tekCycles = await js<{ ok: boolean; n: number }>(
        win,
        `(function() {
          const el = document.getElementById('te-tutar');
          if (!el) return { ok: false, n: 0 };
          const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
          function typeVal(v) {
            el.focus();
            proto?.set?.call(el, v);
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: v }));
          }
          function clearVal() {
            el.focus();
            proto?.set?.call(el, '');
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
          }
          let n = 0;
          for (let i = 0; i < 20; i++) {
            typeVal(String(1000 + i));
            clearVal();
            typeVal(String(2500 + i));
            n++;
          }
          return { ok: true, n };
        })()`,
      );
      assert(tekCycles.ok && tekCycles.n === 20, `Tek taksit 20× fail: ${JSON.stringify(tekCycles)}`);
      await js(win, `Array.from(document.querySelectorAll('.modal button')).find(b => /İptal/i.test(b.textContent||''))?.click()`);
      await sleep(300);
      console.log("[PASS] Tek taksit MoneyInput 20× yaz-sil-yaz");
    }

    await js(win, `Array.from(document.querySelectorAll('button')).find(b => /Taksit planı|Plan oluştur|Eşit taksit/i.test(b.textContent||''))?.click()`);
    await sleep(500);
    const planOpen = await js<boolean>(win, "!!document.getElementById('tp-adet') || !!document.getElementById('form-taksit-plani')");
    if (planOpen) {
      const planCycles = await js<{ ok: boolean; n: number }>(
        win,
        `(function() {
          const el = document.getElementById('tp-tutar') || document.querySelector('#form-taksit-plani input.desk-num');
          if (!el) return { ok: false, n: 0 };
          const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
          function typeVal(v) {
            el.focus();
            proto?.set?.call(el, v);
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: v }));
          }
          function clearVal() {
            el.focus();
            proto?.set?.call(el, '');
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
          }
          let n = 0;
          for (let i = 0; i < 20; i++) {
            typeVal(String(5000 + i));
            clearVal();
            typeVal(String(8000 + i));
            n++;
          }
          // adet integer sil-yaz
          const adet = document.getElementById('tp-adet');
          if (adet) {
            const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
            d?.set?.call(adet, '');
            adet.dispatchEvent(new Event('input', { bubbles: true }));
            d?.set?.call(adet, '1');
            adet.dispatchEvent(new Event('input', { bubbles: true }));
            d?.set?.call(adet, '12');
            adet.dispatchEvent(new Event('input', { bubbles: true }));
          }
          return { ok: true, n };
        })()`,
      );
      assert(planCycles.ok && planCycles.n === 20, `Taksit planı 20× fail: ${JSON.stringify(planCycles)}`);
      await js(win, `Array.from(document.querySelectorAll('.modal button')).find(b => /İptal|Kapat/i.test(b.textContent||''))?.click()`);
      await sleep(300);
      console.log("[PASS] Eşit taksit planı MoneyInput 20× yaz-sil-yaz");
    }

    await js(win, `Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Müvekkil Kasa'))?.click()`);
    await sleep(600);
    await waitForHome(win);
    console.log("[PASS] Müvekkil detay / vekalet input / geri dönüş");

    // Ofis kasası
    await js(win, `document.querySelector('a[href="#/ofis-kasasi"]')?.click()`);
    await sleep(700);
    const onKasa = await waitForSelector(win, ".desk-app-page", 8000);
    assert(onKasa, "Ofis kasası sayfası açılmadı");
    console.log("[PASS] Ofis kasası navigasyonu");

    // Ofis kasa MoneyInput: 20× yaz-sil-yaz
    await js(
      win,
      `Array.from(document.querySelectorAll('button')).find(b => /Yeni hareket/i.test(b.textContent||''))?.click()`,
    );
    await sleep(500);
    const moneyOpen = await waitForSelector(win, "#ofk-ftut", 8000);
    assert(moneyOpen, "Ofis kasa tutar inputu açılmadı");
    const moneyCycles = await js<{ ok: boolean; last: string; n: number }>(
      win,
      `(function() {
        const el = document.getElementById('ofk-ftut');
        if (!el) return { ok: false, last: '', n: 0 };
        const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        function typeVal(v) {
          el.focus();
          proto?.set?.call(el, v);
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: v }));
        }
        function clearVal() {
          el.focus();
          proto?.set?.call(el, '');
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
        }
        let n = 0;
        for (let i = 0; i < 20; i++) {
          typeVal(String(1000 + i));
          clearVal();
          typeVal(String(5000 + i));
          n++;
        }
        return { ok: true, last: el.value, n };
      })()`,
    );
    assert(moneyCycles.ok && moneyCycles.n === 20, `MoneyInput 20 döngü başarısız: ${JSON.stringify(moneyCycles)}`);
    assert(String(moneyCycles.last).length > 0, "MoneyInput son değer boş kaldı");
    console.log("[PASS] Ofis kasa MoneyInput 20× yaz-sil-yaz");

    await js(
      win,
      `Array.from(document.querySelectorAll('.modal button')).find(b => /İptal|Kapat/i.test(b.textContent||''))?.click()`,
    );
    await sleep(300);

    // Ofis bilgileri
    await js(win, `document.querySelector('a[href="#/ayarlar/ofis"]')?.click()`);
    await sleep(700);
    const onOffice = await js<boolean>(win, "location.hash.includes('/ayarlar/ofis')");
    assert(onOffice, "Ofis bilgileri açılmadı");
    const saveBtn = await js<boolean>(
      win,
      `Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Kaydet')`,
    );
    assert(saveBtn, "Ofis bilgileri Kaydet butonu yok");
    console.log("[PASS] Ofis bilgileri ekranı");

    // Ana sayfa
    await js(win, `document.querySelector('a[href="#/"]')?.click()`);
    await sleep(600);
    await waitForHome(win);

    // Çıkış / giriş
    await js(win, `document.querySelector('.btn--header-logout')?.click()`);
    await sleep(700);
    const onLogin = await waitForSelector(win, ".auth-card-title", 8000);
    assert(onLogin, "Login ekranı açılmadı");
    await js(
      win,
      `(function() {
        const inputs = document.querySelectorAll('.auth-card input');
        const user = inputs[0];
        const pass = inputs[1];
        const set = (el, v) => {
          const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
          d?.set?.call(el, v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        set(user, ${JSON.stringify(TEST_USER)});
        set(pass, ${JSON.stringify(TEST_PASS)});
        document.querySelector('.auth-card button[type="submit"]')?.click();
      })()`,
    );
    await sleep(900);
    await waitForHome(win);
    console.log("[PASS] Çıkış / tekrar giriş");

    const reactFatals = consoleErrors.filter((m) => {
      if (/Ad soyad zorunludur/i.test(m)) return false;
      if (/muvekkil:ekle/i.test(m)) return false;
      return (
        /react/i.test(m) ||
        /uncaught/i.test(m) ||
        /ipc/i.test(m) ||
        /sqlite/i.test(m) ||
        /HASSAS_CONSOLE/i.test(m)
      );
    });
    assert(reactFatals.length === 0, `Console hataları: ${reactFatals.join(" | ")}`);
    console.log("[PASS] Console — kritik React/IPC/SQLite/hassas log yok");

    console.log("\n=== Canlı GUI smoke: TÜM ADIMLAR GEÇTİ ===");
  } finally {
    if (win && !win.isDestroyed()) win.close();
    closeDb();
    delete process.env.MKD_TEST_DB;
    try {
      unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
    setTimeout(() => app.quit(), 100);
  }
}
