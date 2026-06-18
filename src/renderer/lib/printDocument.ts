import type {
  HtmlToPdfRequest,
  HtmlToPdfResult,
  PrintDocumentRequest,
  PrintDocumentResult,
  PrintPdfRequest,
} from "@shared/types/print";

export type SilentPrintOpts = Omit<PrintDocumentRequest, "html">;
export type HtmlToPdfOpts = Omit<HtmlToPdfRequest, "html">;

function isTechnicalPrintError(msg: string): boolean {
  const r = msg.toLowerCase();
  return r.includes("cancel") || r.includes("iptal") || r.includes("print job");
}

export async function fetchPrinters() {
  if (!window.api?.printGetPrinters) return [];
  return window.api.printGetPrinters();
}

/** HTML → PDF (program içi önizleme için) */
export async function htmlToPdfDocument(html: string, opts: HtmlToPdfOpts): Promise<HtmlToPdfResult> {
  if (!window.api?.printHtmlToPdf) {
    return { ok: false, error: "PDF önizleme servisi kullanılamıyor." };
  }
  return window.api.printHtmlToPdf({ html, ...opts });
}

/** PDF → sessiz yazdır (yalnızca önizleme ekranından) */
export async function silentPrintPdf(req: PrintPdfRequest): Promise<PrintDocumentResult> {
  if (!window.api?.printPdf) {
    return { ok: false, error: "Yazdırma servisi kullanılamıyor." };
  }
  return window.api.printPdf(req);
}

/** @deprecated Doğrudan HTML yazdırma — önizleme akışında kullanılmamalı */
export async function silentPrintDocument(html: string, opts: SilentPrintOpts): Promise<PrintDocumentResult> {
  if (!window.api?.printDocument) {
    return { ok: false, error: "Yazdırma servisi kullanılamıyor." };
  }
  return window.api.printDocument({ html, ...opts });
}

/** Sonuç: başarı mesajı veya sessiz iptal; teknik hatalar filtrelenir */
export function handlePrintResult(r: PrintDocumentResult, onSuccess?: (msg: string) => void): void {
  if (r.ok) {
    onSuccess?.("Yazdırma gönderildi.");
    return;
  }
  if ("canceled" in r && r.canceled) return;
  const err = "error" in r ? r.error : "";
  if (err && !isTechnicalPrintError(err)) {
    alert("Yazdırma tamamlanamadı. Yazıcı bağlantısını kontrol edin.");
  }
}