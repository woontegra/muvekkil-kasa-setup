export type YaziciInfo = {
  name: string;
  displayName: string;
  isDefault: boolean;
};

export type PrintDocumentResult =
  | { ok: true }
  | { ok: false; canceled: true }
  | { ok: false; error: string };

export type PrintDocumentRequest = {
  html: string;
  deviceName?: string;
  page?: "A4" | "A5";
  landscape?: boolean;
};

export type PrintHtmlOptions = Omit<PrintDocumentRequest, "html">;

export type HtmlToPdfRequest = Omit<PrintDocumentRequest, "deviceName">;

export type HtmlToPdfResult =
  | { ok: true; pdfBase64: string; pageCount: number }
  | { ok: false; error: string };

export type PrintPdfRequest = {
  pdfBase64: string;
  deviceName?: string;
  copies?: number;
  landscape?: boolean;
};

export type PrintDocumentKind = "hesap-ozeti" | "vekalet-makbuzu" | "kasa-makbuzu";
