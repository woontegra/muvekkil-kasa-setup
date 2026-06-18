import { HESAP_OZETI_PRINT_CSS } from "./hesapOzetPrintStyles";

export function buildHesapOzetPrintHtml(docOuterHtml: string): string {
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Dosya Hesap Özeti</title><style>${HESAP_OZETI_PRINT_CSS}</style></head><body>${docOuterHtml}</body></html>`;
}
