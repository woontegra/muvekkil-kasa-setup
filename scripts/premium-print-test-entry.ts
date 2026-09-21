/**
 * Premium vs legacy print/PDF veri paritesi.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app, ipcMain, type BrowserWindow } from "electron";
import { runMigrations } from "../src/main/db/migrate";
import { allMigrations } from "../src/main/migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady } from "../src/main/ipc/handlers";
import { authLogout, setupFirst } from "../src/main/services/auth.service";
import {
  assert,
  attachConsoleCollector,
  createPremiumWindow,
  js,
  loadLegacyRoute,
  loadPremiumRoute,
  premiumLogin,
  resetDbConnection,
  seedLicenseActive,
  shutdownPremiumElectron,
  waitForCondition,
  waitForSelector,
  PROJECT_ROOT,
} from "./lib/premium-e2e-harness";
import { getDb, nowIso } from "../src/main/db/connection";
import { seedPrintParityData, setOfficeName } from "./lib/premium-e2e-seed";
import { cleanupIsolatedEnv, initIsolatedElectronEnv } from "./lib/premium-e2e-isolation";
import { IPC } from "../src/shared/ipc";
import { silentPrintPdf } from "../src/main/services/makbuzPrint.service";
import type { PrintPdfRequest, PrintDocumentResult } from "../src/shared/types/print";

const outDir = join(PROJECT_ROOT, "test-results", "premium-print");

/** Test sürecinde yazdırma callback'i takılırsa UI busy kalmasın; gerçek silentPrintPdf bir kez çağrılır. */
function installPrintBusyTestGuard(): void {
  ipcMain.removeHandler(IPC.print.pdf);
  ipcMain.handle(IPC.print.pdf, async (_e, req: PrintPdfRequest) => {
    const raced = await Promise.race<PrintDocumentResult>([
      silentPrintPdf(req),
      new Promise((resolve) => {
        setTimeout(() => resolve({ ok: false, canceled: true }), 8000);
      }),
    ]);
    return raced;
  });
}

function normalizePrintText(html: string): string[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const amounts = [...text.matchAll(/\d{1,3}(\.\d{3})*(,\d{2})?/g)].map((m) => m[0]!);
  const dates = [...text.matchAll(/\d{2}\.\d{2}\.\d{4}/g)].map((m) => m[0]!);
  const words = text
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^[\d.,]+$/.test(w))
    .slice(0, 80);
  return [...amounts, ...dates, ...words].sort();
}

function compareSets(a: string[], b: string[], label: string): void {
  const money = (arr: string[]) => arr.filter((x) => /\d,\d{2}$/.test(x));
  const multiset = (arr: string[]) => {
    const bag = new Map<string, number>();
    for (const x of money(arr)) bag.set(x, (bag.get(x) ?? 0) + 1);
    return bag;
  };
  const aBag = multiset(a);
  const bBag = multiset(b);
  const allKeys = new Set([...aBag.keys(), ...bBag.keys()]);
  const diffs: string[] = [];
  for (const k of allKeys) {
    const av = aBag.get(k) ?? 0;
    const bv = bBag.get(k) ?? 0;
    if (av !== bv) diffs.push(`${k}: premium=${av} legacy=${bv}`);
  }
  assert(diffs.length === 0, `${label} tutar paritesi farkı: ${diffs.join("; ")}`);
  const aDates = a.filter((x) => /\d{2}\.\d{2}\.\d{4}/.test(x));
  const bDates = b.filter((x) => /\d{2}\.\d{2}\.\d{4}/.test(x));
  assert(aDates.length > 0 && bDates.length > 0, `${label} tarih bulunamadı`);
}

async function extractPrintHtml(win: BrowserWindow): Promise<string> {
  await waitForCondition(
    win.webContents,
    `(() => {
      const iframe = document.querySelector('.pm-print-preview');
      const src = iframe?.getAttribute('srcdoc') || '';
      return src.length > 40;
    })()`,
    45000,
  );
  return js<string>(
    win.webContents,
    `document.querySelector('.pm-print-preview')?.getAttribute('srcdoc') || ''`,
  );
}

async function testPrintBusyGuard(win: BrowserWindow): Promise<void> {
  const sel = ".pm-print-actions button.pm-btn:not(.pm-btn--ghost)";
  const ready = await waitForCondition(
    win.webContents,
    `(() => { const b = document.querySelector(${JSON.stringify(sel)}); return !!b && !b.disabled; })()`,
    15000,
  );
  assert(ready, "Yazdır butonu hazır değil");

  const phase1 = await js<{
    ok: boolean;
    reason?: string;
    disabledAfterFirst?: boolean;
    textAfterFirst?: string;
  }>(
    win.webContents,
    `(async () => {
      const sel = ${JSON.stringify(sel)};
      const btn = document.querySelector(sel);
      if (!btn) return { ok: false, reason: 'buton yok' };
      btn.click();
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        const b = document.querySelector(sel);
        if (b && (b.disabled || /Yazdırılıyor/i.test(b.textContent || ''))) {
          const disabled = !!b.disabled;
          b.click();
          return { ok: true, disabledAfterFirst: disabled, textAfterFirst: String(b.textContent || '') };
        }
        await new Promise((r) => requestAnimationFrame(r));
      }
      return { ok: false, reason: 'busy/disabled durumu görülmedi' };
    })()`,
  );
  assert(phase1.ok, phase1.reason ?? "Yazdır busy fazı başarısız");
  assert(phase1.disabledAfterFirst, `İlk tıklamadan sonra buton disabled değil: ${phase1.textAfterFirst}`);

  const idle = await waitForCondition(
    win.webContents,
    `(() => {
      const b = document.querySelector(${JSON.stringify(sel)});
      return !!b && !b.disabled && /Yazdır/i.test(b.textContent || '') && !/Yazdırılıyor/i.test(b.textContent || '');
    })()`,
    30000,
  );
  assert(idle, "Yazdır butonu busy durumundan çıkmadı");
  console.log("[MKD_PRINT_BUSY_GUARD] ui=pass");
}

async function run(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  resetDbConnection();
  const env = initIsolatedElectronEnv(`print-${Date.now()}`);
  let win: BrowserWindow | null = null;

  try {
    await app.whenReady();
    app.commandLine.appendSwitch("disable-gpu");
    win = createPremiumWindow(1400, 900);
    attachConsoleCollector(win);
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    seedLicenseActive(db);
    const setup = setupFirst({
      adSoyad: "Print Test",
      kullaniciAdi: "print_e2e",
      sifre: "print-e2e-123",
      guvenlikSorusuKodu: "G1",
      guvenlikCevabi: "test",
    });
    assert(setup.ok, setup.error ?? "setup failed");
    setOfficeName("Print Test Bürosu");
    const seed = seedPrintParityData();
    registerIpcHandlers();
    installPrintBusyTestGuard();
    initAuthOnReady();
    initLicenseOnReady();
    authLogout();

    await premiumLogin(win, "print_e2e", "print-e2e-123");

    const cases: { name: string; premiumRoute: string; legacyRoute: string }[] = [
      {
        name: "hesap-ozeti",
        premiumRoute: `/print/hesap-ozeti/${seed.dosyaId}`,
        legacyRoute: `/print/hesap-ozeti/${seed.dosyaId}`,
      },
      {
        name: "kasa-makbuz",
        premiumRoute: `/print/makbuz/kasa/${seed.kasaHareketId}`,
        legacyRoute: `/print/makbuz/kasa/${seed.kasaHareketId}`,
      },
      {
        name: "vekalet-makbuz",
        premiumRoute: `/print/makbuz/vekalet/${seed.vekaletOdemeId}`,
        legacyRoute: `/print/makbuz/vekalet/${seed.vekaletOdemeId}`,
      },
      {
        name: "ofis-kasa-raporu",
        premiumRoute: "/print/ofis-kasa-raporu?bas=2026-06-01&bit=2026-06-30",
        legacyRoute: "/print/ofis-kasa-raporu?bas=2026-06-01&bit=2026-06-30",
      },
      {
        name: "icra-tahsilat-raporu",
        premiumRoute: "/print/icra-tahsilat-raporu",
        legacyRoute: "/print/icra-tahsilat-raporu",
      },
    ];

    for (const c of cases) {
      await loadPremiumRoute(win, c.premiumRoute, ".pm-print-page, .pm-print-preview, .pm-print-toolbar");
      const pHtml = await extractPrintHtml(win);
      writeFileSync(join(outDir, `${c.name}-premium.html`), pHtml, "utf8");

      await loadLegacyRoute(win, c.legacyRoute, ".belge-onizleme-screen, .makbuz-print-wrap, .desk-print");
      const lHtml = await js<string>(
        win.webContents,
        `document.querySelector('.print-preview, .belge-onizleme-body, .desk-print-body, main')?.innerHTML || document.body.innerHTML`,
      );
      writeFileSync(join(outDir, `${c.name}-legacy.html`), lHtml, "utf8");

      compareSets(normalizePrintText(pHtml), normalizePrintText(lHtml), c.name);
      console.log(`[PASS] Print parite: ${c.name}`);
    }

    await loadPremiumRoute(win, `/print/hesap-ozeti/${seed.dosyaId}`, ".pm-print-page");
    await waitForCondition(
      win.webContents,
      `(() => {
        const src = document.querySelector('.pm-print-preview')?.getAttribute('srcdoc') || '';
        return src.length > 40;
      })()`,
      30000,
    );
    const pdfResult = await js<string>(
      win.webContents,
      `(async () => {
        const html = document.querySelector('.pm-print-preview')?.getAttribute('srcdoc') || '';
        const r = await window.api.printHtmlToPdf({ html, page: 'A4', landscape: false });
        return JSON.stringify(r);
      })()`,
    );
    const parsed = JSON.parse(pdfResult) as { ok: boolean; pdfBase64?: string };
    assert(parsed.ok && (parsed.pdfBase64?.length ?? 0) > 100, "PDF oluşturulamadı");
    writeFileSync(join(outDir, "hesap-ozeti-test.pdf"), Buffer.from(parsed.pdfBase64!, "base64"));
    console.log("[PASS] PDF oluşturma (fiziksel yazıcı yok)");

    await testPrintBusyGuard(win);

    console.log("\n=== Premium print parite: TÜM TESTLER GEÇTİ ===\n");
  } finally {
    await shutdownPremiumElectron(win, env.dbPath, true);
    cleanupIsolatedEnv(env);
  }
}

if (process.env.MKD_PREMIUM_PRINT_TEST === "1") {
  app.on("window-all-closed", () => {});
  void run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[FAIL] Premium print:", e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
