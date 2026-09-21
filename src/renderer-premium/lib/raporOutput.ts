import type { HtmlToPdfOpts } from "./raporTypes";

function downloadBase64Pdf(base64: string, filename: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function validateTarihAraligi(bas: string, bit: string): string | null {
  if (!bas.trim() || !bit.trim()) return "Tarih aralığı seçin.";
  if (bas > bit) return "Başlangıç tarihi bitiş tarihinden sonra olamaz.";
  return null;
}

export async function indirPdfFromHtml(
  html: string,
  filename: string,
  opts: HtmlToPdfOpts,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!window.api?.printHtmlToPdf) {
    return { ok: false, error: "PDF servisi kullanılamıyor." };
  }
  const pdf = await window.api.printHtmlToPdf({ html, page: opts.page, landscape: opts.landscape });
  if (!pdf.ok) return { ok: false, error: pdf.error ?? "PDF oluşturulamadı." };
  downloadBase64Pdf(pdf.pdfBase64, filename);
  return { ok: true };
}

export async function yazdirFromHtml(
  html: string,
  opts: HtmlToPdfOpts,
): Promise<{ ok: true } | { ok: false; error: string; canceled?: boolean }> {
  if (!window.api?.printHtmlToPdf || !window.api?.printPdf) {
    return { ok: false, error: "Yazdırma servisi kullanılamıyor." };
  }
  const pdf = await window.api.printHtmlToPdf({ html, page: opts.page, landscape: opts.landscape });
  if (!pdf.ok) return { ok: false, error: pdf.error ?? "PDF oluşturulamadı." };
  const r = await window.api.printPdf({ pdfBase64: pdf.pdfBase64, landscape: opts.landscape });
  if (r.ok) return { ok: true };
  if ("canceled" in r && r.canceled) return { ok: false, error: "", canceled: true };
  return { ok: false, error: "error" in r ? r.error : "Yazdırma tamamlanamadı." };
}
