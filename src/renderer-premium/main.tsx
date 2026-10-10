import { premiumRestartHint } from "./lib/bootErrorHint";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/auth.css";
import "./styles/license.css";
import "./styles/toast.css";
import "./styles/overview.css";
import "./styles/modal.css";
import "./styles/muvekkil.css";
import "./styles/dosya-detail.css";
import "./styles/vekalet.css";
import "./styles/ofis-kasa.css";
import "./styles/icra-tahsilat.css";
import "./styles/tahsilat-merkezi.css";
import "./styles/randevu.css";
import "./styles/settings.css";
import "./styles/raporlar.css";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showBootError(message: string) {
  const root = document.getElementById("root");
  if (!root) return;
  const detail = escapeHtml(message.trim() || "Bilinmeyen hata");
  root.innerHTML = `
    <div class="pm-error-boundary">
      <div class="pm-error-boundary-card" role="alert">
        <h2 class="pm-error-boundary-title">Premium arayüz başlatılamadı</h2>
        <p class="pm-error-boundary-desc">${escapeHtml(premiumRestartHint())}</p>
        <details class="pm-error-boundary-details">
          <summary>Teknik detay</summary>
          <pre class="pm-error-boundary-pre">${detail}</pre>
        </details>
        <div class="pm-error-boundary-actions">
          <button type="button" class="pm-btn pm-btn--primary" onclick="location.reload()">Sayfayı yenile</button>
        </div>
      </div>
    </div>
  `;
}

window.addEventListener("error", (event) => {
  if (event.error instanceof Error) showBootError(event.error.message);
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const msg = reason instanceof Error ? reason.message : String(reason ?? "Bilinmeyen hata");
  showBootError(msg);
});

try {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error) {
  showBootError(error instanceof Error ? error.message : String(error));
}
