import { isBrowserPreviewMode } from "../dev/installBrowserPreview";

export function BrowserPreviewBanner() {
  if (!isBrowserPreviewMode()) return null;

  return (
    <div className="browser-preview-banner" role="status">
      Tarayıcı önizleme modu — yalnızca arayüz testi. Veriler sahte; kaydetme/yazdırma çalışmaz. Gerçek uygulama için{" "}
      <code>npm run dev</code> ile Electron penceresini kullanın.
    </div>
  );
}
