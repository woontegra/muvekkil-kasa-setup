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
import { kasaAvansEkleInTx } from "../services/kasa.service";
import { createMainWindow } from "../window";

const TEST_USER = "masraf_input_test";
const TEST_PASS = "masraf-input-123";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
    `INSERT INTO yerel_lisans (id, license_key, device_hash, product_name, expires_at, last_validated_at, offline_grace_until, status, kayit_tarihi, guncelleme_tarihi)
     VALUES (1, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
     ON CONFLICT(id) DO UPDATE SET license_key=excluded.license_key, device_hash=excluded.device_hash, expires_at=excluded.expires_at, status=excluded.status`,
  ).run("MASRAF-TEST", deviceHash, "Müvekkil Kasa Defteri", expires.toISOString(), t, grace.toISOString(), t, t);
}

async function typeMoney(win: BrowserWindow, selector: string, raw: string): Promise<void> {
  await js(
    win,
    `(function() {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('input yok');
      el.focus();
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      proto?.set?.call(el, ${JSON.stringify(raw)});
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(raw)} }));
    })()`,
  );
}

async function clearMoney(win: BrowserWindow, selector: string): Promise<void> {
  await js(
    win,
    `(function() {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('input yok');
      el.focus();
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      proto?.set?.call(el, '');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    })()`,
  );
}

export async function runMasrafInputSmoke(): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-masraf-input-${Date.now()}.sqlite`);
  process.env.MKD_TEST_DB = dbPath;
  let win: BrowserWindow | null = null;

  try {
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    seedLicense(db);
    const t = nowIso();
    setupFirst({
      adSoyad: "Masraf Input",
      kullaniciAdi: TEST_USER,
      sifre: TEST_PASS,
      guvenlikSorusuKodu: "G1",
      guvenlikCevabi: "test",
    });
    db.prepare(`INSERT INTO muvekkil (muvekkil_turu, ad_soyad, kayit_tarihi, guncelleme_tarihi) VALUES ('GERCEK_KISI', 'Masraf M', ?, ?)`).run(t, t);
    const mid = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);
    db.prepare(`INSERT INTO dosya (muvekkil_id, konu_basligi, durum, kayit_tarihi, guncelleme_tarihi) VALUES (?, 'Masraf D', 'AKTIF', ?, ?)`).run(mid, t, t);
    const did = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);
    kasaAvansEkleInTx(db, { dosyaId: did, muvekkilId: mid, tutar: 1000, tarih: "2026-07-01", odemeYontemi: "NAKIT", aciklama: null, t });

    await app.whenReady();
    registerIpcHandlers();
    initAuthOnReady();
    initLicenseOnReady();
    win = createMainWindow();
    await new Promise<void>((r) => win!.webContents.once("did-finish-load", () => r()));
    await sleep(600);

    await js(win, `location.hash = ${JSON.stringify(`#/muvekkil/${mid}/dosya/${did}`)}`);
    await sleep(1000);

    async function masrafModalCycle(i: number): Promise<void> {
      await js(
        win!,
        `Array.from(document.querySelectorAll('button')).find(b => /Masraf girişi/i.test(b.textContent||''))?.click()`,
      );
      await sleep(400);
      assert(await js<boolean>(win!, `!!document.getElementById('masraf-tutar')`), "Masraf modal açılmadı");
      await typeMoney(win!, "#masraf-tutar", i % 2 === 0 ? "5000" : "12000");
      await sleep(60);
      let val = await js<string>(win!, `document.getElementById('masraf-tutar')?.value || ''`);
      assert(val.length > 0, `yazılamadı tur ${i}: ${val}`);
      await clearMoney(win!, "#masraf-tutar");
      await typeMoney(win!, "#masraf-tutar", i % 2 === 0 ? "7500" : "12000");
      await sleep(60);
      val = await js<string>(win!, `document.getElementById('masraf-tutar')?.value || ''`);
      assert(val.length > 0, `yeniden yazılamadı tur ${i}`);
      await js(win!, `Array.from(document.querySelectorAll('.modal button')).find(b => /İptal/i.test(b.textContent||''))?.click()`);
      await sleep(250);
    }

    for (let i = 0; i < 20; i++) {
      await masrafModalCycle(i);
    }
    console.log("[PASS] Masraf modal 20× yaz-sil-yaz (paketli GUI)");

    // Kaydet → yeniden aç → yaz (Test B)
    await js(
      win!,
      `Array.from(document.querySelectorAll('button')).find(b => /Masraf girişi/i.test(b.textContent||''))?.click()`,
    );
    await sleep(400);
    await typeMoney(win!, "#masraf-tutar", "8500");
    await js(
      win!,
      `(function(){
        const sel = document.getElementById('masraf-odeme');
        if (!sel) return;
        sel.value = 'Nakit';
        sel.dispatchEvent(new Event('change',{bubbles:true}));
      })()`,
    );
    await js(
      win!,
      `Array.from(document.querySelectorAll('.modal button')).find(b => /^Kaydet$/i.test((b.textContent||'').trim()))?.click()`,
    );
    await sleep(800);
    await js(
      win!,
      `Array.from(document.querySelectorAll('button')).find(b => /Masraf girişi/i.test(b.textContent||''))?.click()`,
    );
    await sleep(400);
    await typeMoney(win!, "#masraf-tutar", "4200");
    assert((await js<string>(win!, `document.getElementById('masraf-tutar')?.value||''`)).length > 0, "Kayıt sonrası masraf input");
    await js(win!, `Array.from(document.querySelectorAll('.modal button')).find(b => /İptal/i.test(b.textContent||''))?.click()`);
    await sleep(250);
    console.log("[PASS] Masraf kaydı sonrası input çalışıyor");

    // Dropdown Diğer → yaz → Nakit → Diğer (Test F)
    await js(
      win!,
      `Array.from(document.querySelectorAll('button')).find(b => /Masraf girişi/i.test(b.textContent||''))?.click()`,
    );
    await sleep(400);
    await js(
      win!,
      `(function(){
        const sel = document.getElementById('masraf-odeme');
        if (!sel) return;
        sel.value = 'Diğer';
        sel.dispatchEvent(new Event('change',{bubbles:true}));
      })()`,
    );
    await sleep(200);
    await js(
      win!,
      `(function(){
        const el = document.getElementById('masraf-odeme-diger');
        if (!el) throw new Error('diger input yok');
        el.focus();
        const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        proto?.set?.call(el, 'Test Ödeme');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      })()`,
    );
    const digerVal = await js<string>(win!, `document.getElementById('masraf-odeme-diger')?.value||''`);
    assert(digerVal.includes("Test"), "Diğer ödeme inputu");
    await js(
      win!,
      `(function(){
        const sel = document.getElementById('masraf-odeme');
        if (!sel) return;
        sel.value = 'Nakit';
        sel.dispatchEvent(new Event('change',{bubbles:true}));
      })()`,
    );
    await sleep(150);
    await js(
      win!,
      `(function(){
        const sel = document.getElementById('masraf-odeme');
        if (!sel) return;
        sel.value = 'Diğer';
        sel.dispatchEvent(new Event('change',{bubbles:true}));
      })()`,
    );
    await sleep(150);
    await js(
      win!,
      `(function(){
        const el = document.getElementById('masraf-odeme-diger');
        if (!el) throw new Error('diger input yok 2');
        el.focus();
        const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        proto?.set?.call(el, 'Yeniden');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      })()`,
    );
    assert((await js<string>(win!, `document.getElementById('masraf-odeme-diger')?.value||''`)).includes("Yeniden"), "Diğer tekrar");
    await js(win!, `Array.from(document.querySelectorAll('.modal button')).find(b => /İptal/i.test(b.textContent||''))?.click()`);
    await sleep(250);
    console.log("[PASS] Masraf ödeme Diğer dropdown akışı");

    // Onay sonrası avans modal
    const avansId = Number(
      db.prepare(`SELECT id FROM dosya_kasa_hareket WHERE islem_tipi='AVANS_GIRISI' LIMIT 1`).get().id,
    );
    const { finalizePendingApprovals } = await import("../services/pendingApproval.service");
    finalizePendingApprovals();
    const onayli = db.prepare(`SELECT onay_durumu FROM dosya_kasa_hareket WHERE id=?`).get(avansId) as { onay_durumu: string };
    assert(onayli.onay_durumu === "ONAYLI", "Avans otomatik onaylı değil");

    await js(win, `Array.from(document.querySelectorAll('button')).find(b => /İşlem ekle/i.test(b.textContent||''))?.click()`);
    await sleep(350);
    await js(win, `Array.from(document.querySelectorAll('button')).find(b => /Avans girişi/i.test(b.textContent||''))?.click()`);
    await sleep(400);
    assert(await js<boolean>(win, `!!document.getElementById('avans-tutar')`), "Avans modal açılmadı");
    await typeMoney(win, "#avans-tutar", "3000");
    assert((await js<string>(win, `document.getElementById('avans-tutar')?.value||''`)).includes("3"), "Onay sonrası avans input");
    await js(win, `Array.from(document.querySelectorAll('.modal button')).find(b => /İptal/i.test(b.textContent||''))?.click()`);
    console.log("[PASS] Onay sonrası avans input çalışıyor (Test E)");

    console.log("\n=== Masraf input smoke: TÜM ADIMLAR GEÇTİ ===");
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
