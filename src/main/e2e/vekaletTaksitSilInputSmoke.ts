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
import { vekaletKaydet, vekaletTaksitEkle } from "../services/vekalet.service";
import { createMainWindow } from "../window";

const TEST_USER = "sil_input_test";
const TEST_PASS = "sil-input-123456";

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
    await sleep(120);
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
  ).run("SIL-INPUT-KEY", deviceHash, "Müvekkil Kasa Defteri", expires.toISOString(), t, grace.toISOString(), t, t);
}

function typeMoney(win: BrowserWindow, selector: string, raw: string): Promise<void> {
  return js(
    win,
    `(function() {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('Money input yok: ${selector}');
      el.focus();
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      proto?.set?.call(el, ${JSON.stringify(raw)});
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(raw)} }));
    })()`,
  );
}

function clearMoney(win: BrowserWindow, selector: string): Promise<void> {
  return js(
    win,
    `(function() {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('Money input yok');
      el.focus();
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      proto?.set?.call(el, '');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    })()`,
  );
}

export async function runVekaletTaksitSilInputSmoke(): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-vekalet-sil-input-${Date.now()}.sqlite`);
  process.env.MKD_TEST_DB = dbPath;
  let win: BrowserWindow | null = null;

  try {
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    seedLicense(db);

    const setup = setupFirst({
      adSoyad: "Sil Input Test",
      kullaniciAdi: TEST_USER,
      sifre: TEST_PASS,
      guvenlikSorusuKodu: "G1",
      guvenlikCevabi: "test",
    });
    assert(setup.ok, setup.ok ? "" : setup.error);

    const t = nowIso();
    db.prepare(
      `INSERT INTO muvekkil (muvekkil_turu, ad_soyad, kayit_tarihi, guncelleme_tarihi) VALUES ('GERCEK_KISI', 'Sil Input Müvekkil', ?, ?)`,
    ).run(t, t);
    const muvekkilId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);
    db.prepare(
      `INSERT INTO dosya (muvekkil_id, konu_basligi, durum, kayit_tarihi, guncelleme_tarihi) VALUES (?, 'Sil Input Dosya', 'AKTIF', ?, ?)`,
    ).run(muvekkilId, t, t);
    const dosyaId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    const vk = vekaletKaydet(dosyaId, muvekkilId, { anlasilanTutar: 200000 });
    assert(vk.ok, vk.ok ? "" : vk.error);
    // 12 küçük taksit — 10 silme turu + yedek
    for (let i = 1; i <= 12; i++) {
      const r = vekaletTaksitEkle(vk.row.id, {
        tutar: 5000,
        taksitNo: i,
        vadeTarihi: `2026-${String(((i - 1) % 12) + 1).padStart(2, "0")}-15`,
      });
      assert(r.ok, `taksit ${i}: ${r.ok ? "" : r.error}`);
    }

    await app.whenReady();
    registerIpcHandlers();
    initAuthOnReady();
    initLicenseOnReady();

    win = createMainWindow();
    await new Promise<void>((resolve) => {
      win!.webContents.once("did-finish-load", () => resolve());
    });
    await sleep(600);

    // Login gerekebilir (setupFirst oturumu açmış olabilir)
    const needsLogin = await js<boolean>(win, "!!document.querySelector('.auth-card')");
    if (needsLogin) {
      await js(
        win,
        `(function() {
          const inputs = document.querySelectorAll('.auth-card input');
          const set = (el, v) => {
            const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
            d?.set?.call(el, v);
            el.dispatchEvent(new Event('input', { bubbles: true }));
          };
          set(inputs[0], ${JSON.stringify(TEST_USER)});
          set(inputs[1], ${JSON.stringify(TEST_PASS)});
          document.querySelector('.auth-card button[type="submit"]')?.click();
        })()`,
      );
      await sleep(800);
    }

    await js(win, `location.hash = ${JSON.stringify(`#/muvekkil/${muvekkilId}/dosya/${dosyaId}`)}`);
    await sleep(1000);
    assert(await waitForSelector(win, ".desk-vekalet-actions-bar, .desk-vekalet-compact-actions", 15000), "Vekalet paneli yok");

    async function silIlkOdenmemisTaksit(): Promise<void> {
      const clicked = await js<boolean>(
        win!,
        `(function() {
          const btn = document.querySelector('button[title="Sil"]');
          if (!btn) return false;
          btn.click();
          return true;
        })()`,
      );
      assert(clicked, "Sil butonu bulunamadı");
      assert(await waitForSelector(win!, '[data-testid="vekalet-taksit-sil-onay"]', 5000), "Silme onay modalı açılmadı");
      await js(win!, `document.querySelector('[data-testid="vekalet-taksit-sil-onay"]')?.click()`);
      await sleep(500);
      // Onay modalı DOM'dan kalkmalı
      const backdropOrOnay = await js<boolean>(
        win!,
        `!!document.querySelector('[data-testid="vekalet-taksit-sil-onay"]')`,
      );
      assert(!backdropOrOnay, "Silme onay modalı DOM'da kaldı");
    }

    async function tekTaksitAcVeYaz(raw: string, expected: string): Promise<void> {
      await js(
        win!,
        `Array.from(document.querySelectorAll('button')).find(b => /Tek taksit/i.test(b.textContent||''))?.click()`,
      );
      assert(await waitForSelector(win!, "#te-tutar", 5000), "Tek taksit modalı açılmadı");
      // Silme sonrası görünmez ekstra backdrop olmamalı (tek modal backdrop)
      const bdCount = await js<number>(win!, `document.querySelectorAll('.modal-backdrop').length`);
      assert(bdCount === 1, `Beklenen 1 backdrop, bulunan: ${bdCount}`);

      await typeMoney(win!, "#te-tutar", raw);
      await sleep(80);
      let val = await js<string>(win!, `document.getElementById('te-tutar')?.value || ''`);
      assert(val === expected || val.replace(/\s/g, "") === expected, `Beklenen ${expected}, gelen: ${val}`);

      await clearMoney(win!, "#te-tutar");
      await sleep(40);
      val = await js<string>(win!, `document.getElementById('te-tutar')?.value || ''`);
      assert(val === "", `Silindikten sonra boş olmalı: "${val}"`);

      await typeMoney(win!, "#te-tutar", raw === "5000" ? "12000" : "5000");
      await sleep(80);
      val = await js<string>(win!, `document.getElementById('te-tutar')?.value || ''`);
      const expected2 = raw === "5000" ? "12.000" : "5.000";
      assert(val === expected2, `Yeniden yazım: beklenen ${expected2}, gelen ${val}`);

      await js(win!, `Array.from(document.querySelectorAll('.modal button')).find(b => /İptal/i.test(b.textContent||''))?.click()`);
      await sleep(250);
      assert(!(await js<boolean>(win!, "!!document.getElementById('te-tutar')")), "Modal kapanmadı");
      assert(
        (await js<number>(win!, `document.querySelectorAll('.modal-backdrop').length`)) === 0,
        "İptal sonrası backdrop kaldı",
      );
    }

    // Test 1
    await silIlkOdenmemisTaksit();
    await tekTaksitAcVeYaz("5000", "5.000");
    console.log("[PASS] Test1: sil → tek taksit → 5000");

    // Test 2
    await silIlkOdenmemisTaksit();
    await tekTaksitAcVeYaz("12000", "12.000");
    console.log("[PASS] Test2: sil → tek taksit → 12000");

    // Test 3 — 8 tur (ödeme al testi için en az 1 taksit kalsın)
    for (let i = 0; i < 8; i++) {
      await silIlkOdenmemisTaksit();
      await tekTaksitAcVeYaz(i % 2 === 0 ? "5000" : "12000", i % 2 === 0 ? "5.000" : "12.000");
    }
    console.log("[PASS] Test3: 8× (+önceki 2 = 10 sil→yaz turu) sil → aç → yaz → İptal");

    // Test 4 — silmeden aç
    await js(
      win,
      `Array.from(document.querySelectorAll('button')).find(b => /Tek taksit/i.test(b.textContent||''))?.click()`,
    );
    assert(await waitForSelector(win, "#te-tutar", 5000), "Silmeden tek taksit açılmadı");
    await typeMoney(win, "#te-tutar", "7500");
    assert((await js<string>(win, `document.getElementById('te-tutar')?.value || ''`)) === "7.500", "Silmeden yazım başarısız");
    await js(win, `Array.from(document.querySelectorAll('.modal button')).find(b => /İptal/i.test(b.textContent||''))?.click()`);
    await sleep(200);
    console.log("[PASS] Test4: silmeden Tek taksit çalışıyor");

    // Test 5 — diğer modallar
    await js(win, `Array.from(document.querySelectorAll('button')).find(b => /Taksit planı/i.test(b.textContent||''))?.click()`);
    assert(await waitForSelector(win, "#tp-tutar", 5000), "Plan modalı açılmadı");
    await typeMoney(win, "#tp-tutar", "3000");
    assert((await js<string>(win, `document.getElementById('tp-tutar')?.value || ''`)) === "3.000", "Plan tutar kilitli");
    await js(win, `Array.from(document.querySelectorAll('.modal button')).find(b => /İptal|Kapat/i.test(b.textContent||''))?.click()`);
    await sleep(200);

    await js(
      win,
      `Array.from(document.querySelectorAll('button')).find(b => /Vekalet ücreti düzenle|Vekalet ücreti tanımla/i.test(b.textContent||''))?.click() ||
       Array.from(document.querySelectorAll('.desk-vekalet-compact-actions button, .desk-vekalet-actions-bar button')).find(b => /^Düzenle$/i.test((b.textContent||'').trim()))?.click()`,
    );
    assert(await waitForSelector(win, "#vu-tutar", 5000), "Ücret modalı açılmadı");
    await clearMoney(win, "#vu-tutar");
    await typeMoney(win, "#vu-tutar", "180000");
    assert(
      (await js<string>(win, `document.getElementById('vu-tutar')?.value || ''`)).includes("180"),
      "Ücret input kilitli",
    );
    await js(win, `Array.from(document.querySelectorAll('.modal button')).find(b => /İptal/i.test(b.textContent||''))?.click()`);
    await sleep(200);

    await js(win, `document.querySelector('button[title="Ödeme al"]')?.click()`);
    assert(await waitForSelector(win, "#oa-tutar", 5000), "Ödeme al modalı açılmadı");
    await typeMoney(win, "#oa-tutar", "1000");
    assert((await js<string>(win, `document.getElementById('oa-tutar')?.value || ''`)) === "1.000", "Ödeme input kilitli");
    await js(win, `Array.from(document.querySelectorAll('.modal button')).find(b => /İptal/i.test(b.textContent||''))?.click()`);
    await sleep(200);
    console.log("[PASS] Test5: plan / ücret / ödeme inputları çalışıyor");

    // Test 6 — silme sonrası temiz DOM (zaten her turda doğrulandı)
    assert((await js<number>(win, `document.querySelectorAll('.modal-backdrop').length`)) === 0, "Kalan backdrop var");
    console.log("[PASS] Test6: silme sonrası görünmez backdrop yok");

    console.log("\n=== Vekalet sil → Tek taksit input smoke: TÜM ADIMLAR GEÇTİ ===");
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
