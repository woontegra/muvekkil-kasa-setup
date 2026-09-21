import { app, BrowserWindow } from "electron";
import { unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  HtmlToPdfRequest,
  HtmlToPdfResult,
  PrintDocumentRequest,
  PrintDocumentResult,
  PrintPdfRequest,
  YaziciInfo,
} from "@shared/types/print";

const PAGE_MICRONS: Record<"A4" | "A5", { width: number; height: number }> = {
  A4: { width: 210000, height: 297000 },
  A5: { width: 210000, height: 148000 },
};

function isPrintCanceled(reason: string | undefined): boolean {
  if (!reason) return true;
  const r = reason.toLowerCase();
  return r.includes("cancel") || r.includes("iptal");
}

function createHiddenPrintWindow() {
  return new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
}

function countPdfPages(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  const countMatch = text.match(/\/Type\s*\/Pages\b[\s\S]*?\/Count\s+(\d+)/);
  if (countMatch) return Math.max(1, parseInt(countMatch[1], 10));
  const pages = text.match(/\/Type\s*\/Page\b(?!s)/g);
  return Math.max(1, pages?.length ?? 1);
}

function pdfPrintOptions(page: "A4" | "A5", landscape: boolean) {
  const base = PAGE_MICRONS[page];
  return {
    landscape,
    pageSize: landscape ? { width: base.width, height: base.height } : { width: base.width, height: base.height },
  };
}

async function loadHtmlForPrint(win: BrowserWindow, html: string): Promise<void> {
  const tmpPath = join(app.getPath("temp"), `mkd-print-${process.pid}-${Date.now()}.html`);
  writeFileSync(tmpPath, html, "utf8");
  try {
    await win.loadURL(pathToFileURL(tmpPath).href);
    await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const waitImages = () =>
          Promise.all(
            [...document.images].map((img) =>
              img.complete
                ? Promise.resolve()
                : new Promise((r) => {
                    img.onload = () => r(undefined);
                    img.onerror = () => r(undefined);
                  })
            )
          );
        const done = () => waitImages().then(() => setTimeout(resolve, 200));
        if (document.readyState === "complete") done();
        else window.addEventListener("load", done, { once: true });
      })
    `);
  } finally {
    try {
      unlinkSync(tmpPath);
    } catch {
      /* temp dosya silinemedi */
    }
  }
}

/** Yazıcı listesi */
export async function getSystemPrinters(): Promise<YaziciInfo[]> {
  const win = createHiddenPrintWindow();
  try {
    await win.loadURL("about:blank");
    const list = await win.webContents.getPrintersAsync();
    return list.map((p) => ({
      name: p.name,
      isDefault: Boolean(p.isDefault),
      displayName: p.displayName || p.name,
    }));
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

/** HTML → PDF (gizli pencere, dış tarayıcı açılmaz) */
export async function htmlToPdf(req: HtmlToPdfRequest): Promise<HtmlToPdfResult> {
  const page = req.page ?? "A5";
  const landscape = req.landscape ?? page === "A5";
  const win = createHiddenPrintWindow();

  try {
    await win.loadURL("about:blank");
    await loadHtmlForPrint(win, req.html);

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: page,
      landscape,
    });

    return {
      ok: true,
      pdfBase64: pdfBuffer.toString("base64"),
      pageCount: countPdfPages(pdfBuffer),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || "PDF oluşturulamadı." };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

/** PDF → sessiz yazdır (yalnızca önizleme modalından) */
export async function silentPrintPdf(req: PrintPdfRequest): Promise<PrintDocumentResult> {
  const win = createHiddenPrintWindow();

  try {
    const dataUrl = `data:application/pdf;base64,${req.pdfBase64}`;
    await win.loadURL(dataUrl);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 650);
    });

    const deviceName = (req.deviceName ?? "").trim();
    const copies = Math.max(1, Math.min(99, req.copies ?? 1));

    return await new Promise((resolve) => {
      win.webContents.print(
        {
          silent: true,
          printBackground: true,
          copies,
          ...(req.landscape != null ? { landscape: req.landscape } : {}),
          ...(deviceName ? { deviceName } : {}),
        },
        (success, failureReason) => {
          if (success) resolve({ ok: true });
          else if (isPrintCanceled(failureReason)) resolve({ ok: false, canceled: true });
          else resolve({ ok: false, error: failureReason || "Yazdırma başarısız oldu." });
        }
      );
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isPrintCanceled(msg)) return { ok: false, canceled: true };
    return { ok: false, error: msg || "Yazdırma başlatılamadı." };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

/** Gizli pencerede sessiz yazdır — native print dialog açılmaz */
export async function silentPrintDocument(req: PrintDocumentRequest): Promise<PrintDocumentResult> {
  const page = req.page ?? "A5";
  const landscape = req.landscape ?? page === "A5";
  const { pageSize, landscape: ls } = pdfPrintOptions(page, landscape);

  const win = createHiddenPrintWindow();

  try {
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(req.html)}`;
    await win.loadURL(dataUrl);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 450);
    });

    const deviceName = (req.deviceName ?? "").trim();

    return await new Promise((resolve) => {
      win.webContents.print(
        {
          silent: true,
          printBackground: true,
          landscape: ls,
          pageSize,
          ...(deviceName ? { deviceName } : {}),
        },
        (success, failureReason) => {
          if (success) resolve({ ok: true });
          else if (isPrintCanceled(failureReason)) resolve({ ok: false, canceled: true });
          else resolve({ ok: false, error: failureReason || "Yazdırma başarısız oldu." });
        }
      );
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isPrintCanceled(msg)) return { ok: false, canceled: true };
    return { ok: false, error: msg || "Yazdırma başlatılamadı." };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}
