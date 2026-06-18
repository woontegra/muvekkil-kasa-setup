import { MAKBUZ_PRINT_CSS } from "./makbuzPrintStyles";

export function buildMakbuzPrintHtml(sheetOuterHtml: string): string {
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Makbuz</title><style>${MAKBUZ_PRINT_CSS}</style></head><body>${sheetOuterHtml}</body></html>`;
}
