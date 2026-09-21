import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { app, BrowserWindow } from "electron";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady } from "../ipc/handlers";
import { setupFirst, authLoginSuccess } from "../services/auth.service";
import { computeDeviceHash } from "../services/deviceHash.service";
import { vekaletKaydet, vekaletTaksitEkle } from "../services/vekalet.service";
import { createMainWindow } from "../window";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForSelector(win: BrowserWindow, selector: string, timeoutMs = 20000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = await win.webContents.executeJavaScript(`!!document.querySelector(${JSON.stringify(selector)})`);
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
  ).run("SCROLL-TEST-KEY", deviceHash, "Müvekkil Kasa Defteri", expires.toISOString(), t, grace.toISOString(), t, t);
}

/** 1280×900 — vekalet taksit tablosu yalnızca panel içinde kaydırılıyor mu? */
export async function runVekaletScrollSmoke(): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-vekalet-scroll-${Date.now()}.sqlite`);
  process.env.MKD_TEST_DB = dbPath;

  let win: BrowserWindow | null = null;

  try {
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    seedLicense(db);

    const t = nowIso();
    db.prepare(
      `INSERT INTO muvekkil (muvekkil_turu, ad_soyad, kayit_tarihi, guncelleme_tarihi) VALUES ('TUZEL_KISI', 'Scroll Test A.Ş.', ?, ?)`,
    ).run(t, t);
    const muvekkilId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    db.prepare(
      `INSERT INTO dosya (muvekkil_id, konu_basligi, mahkeme_adi, dosya_numarasi, durum, kayit_tarihi, guncelleme_tarihi)
       VALUES (?, 'Scroll test davası', 'Test Mahkemesi', '2026/1', 'AKTIF', ?, ?)`,
    ).run(muvekkilId, t, t);
    const dosyaId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    const setup = setupFirst({
      adSoyad: "Scroll Test",
      kullaniciAdi: "scroll_test",
      sifre: "scroll-test-123456",
      guvenlikSorusuKodu: "G1",
      guvenlikCevabi: "test",
    });
    assert(setup.ok, setup.ok ? "" : setup.error);
    authLoginSuccess(setup.user);

    const vk = vekaletKaydet(dosyaId, muvekkilId, { anlasilanTutar: 100000 });
    assert(vk.ok, vk.ok ? "" : vk.error);

    for (let i = 1; i <= 10; i += 1) {
      const res = vekaletTaksitEkle(vk.row.id, {
        taksitNo: i,
        tutar: 10000,
        vadeTarihi: `2026-${String(i).padStart(2, "0")}-15`,
      });
      assert(res.ok, res.ok ? "" : res.error);
    }

    await app.whenReady();
    registerIpcHandlers();
    initAuthOnReady();
    initLicenseOnReady();

    win = createMainWindow();
    await new Promise<void>((resolve) => {
      win!.webContents.once("did-finish-load", () => resolve());
    });
    await sleep(800);

    await js(win, `location.hash = '#/muvekkil/${muvekkilId}/dosya/${dosyaId}'`);
    await sleep(1500);

    win.setBounds({ x: 40, y: 40, width: 1280, height: 900 });
    await sleep(300);

    const licenseOk = await waitForSelector(win, ".license-status-badge", 10000);
    assert(licenseOk, "Lisans rozeti görünmüyor — lisans akışı bozulmuş olabilir");
    console.log("[PASS] Lisans rozeti görünür (test DB)");

    const onDosya = await waitForSelector(win, ".desk-page--dosya-detail", 15000);
    assert(onDosya, "Dosya detay sayfası yüklenmedi");

    const taksitWrap = await waitForSelector(win, ".desk-vekalet-taksit-wrap", 8000);
    assert(taksitWrap, "Vekalet taksit sarmalayıcısı yok");

    const metrics = await js<{
      rowCount: number;
      wrapScrollHeight: number;
      wrapClientHeight: number;
      wrapHasVerticalScroll: boolean;
      pageScrollWidth: number;
      summaryVisible: boolean;
    }>(win, `
      (function() {
        const wrap = document.querySelector('.desk-vekalet-taksit-wrap');
        const rows = document.querySelectorAll('.desk-table--vekalet-taksit tbody tr');
        const summary = document.querySelector('.desk-summary-bar--dosya-footer');
        const docEl = document.documentElement;
        const wrapScrollHeight = wrap ? wrap.scrollHeight : 0;
        const wrapClientHeight = wrap ? wrap.clientHeight : 0;
        return {
          rowCount: rows.length,
          wrapScrollHeight,
          wrapClientHeight,
          wrapHasVerticalScroll: wrap ? wrapScrollHeight > wrapClientHeight + 2 : false,
          pageScrollWidth: Math.max(docEl.scrollWidth - docEl.clientWidth, 0),
          summaryVisible: !!summary && summary.getBoundingClientRect().height > 0,
        };
      })()
    `);

    assert(metrics.rowCount === 10, `10 taksit satırı bekleniyordu, ${metrics.rowCount} bulundu`);
    assert(
      metrics.wrapHasVerticalScroll,
      `Vekalet panelinde dikey scroll yok (scrollHeight=${metrics.wrapScrollHeight}, clientHeight=${metrics.wrapClientHeight})`,
    );
    assert(metrics.pageScrollWidth < 40, `Sayfa yatay taşması fazla: ${metrics.pageScrollWidth}px`);
    assert(metrics.summaryVisible, "Alt özet çubuğu görünmüyor — layout bozulmuş olabilir");

    console.log(`[PASS] 1280×900 — ${metrics.rowCount} taksit, vekalet wrap scroll: ${metrics.wrapScrollHeight}px / ${metrics.wrapClientHeight}px`);
    console.log(`[PASS] Sayfa yatay taşma: ${metrics.pageScrollWidth}px, özet çubuğu görünür`);
    console.log("\n=== Vekalet scroll smoke: TÜM TESTLER GEÇTİ ===\n");
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
    closeDb();
    try {
      unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
  }
}
