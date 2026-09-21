import { createBrowserPreviewApi } from "./browserPreviewApi";

declare global {
  interface Window {
    __MKD_BROWSER_PREVIEW__?: boolean;
  }
}

/** Electron preload yoksa (tarayıcı) dev modunda sahte API kurar. */
export function installBrowserPreviewApi(): boolean {
  if (typeof window === "undefined") return false;
  if (window.api) return false;
  if (!import.meta.env.DEV) return false;

  window.api = createBrowserPreviewApi();
  window.__MKD_BROWSER_PREVIEW__ = true;
  console.info(
    "[MKD] Tarayıcı önizleme modu — yalnızca arayüz testi. Veriler sahte; Electron ile gerçek uygulamayı çalıştırın.",
  );
  return true;
}

export function isBrowserPreviewMode(): boolean {
  return Boolean(typeof window !== "undefined" && window.__MKD_BROWSER_PREVIEW__);
}
