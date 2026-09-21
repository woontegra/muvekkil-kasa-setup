import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { premiumRestartHint } from "./lib/bootErrorHint";
import App from "./App";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/auth.css";
import "./styles/license.css";

function showBootError(message: string) {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f8fafc;font-family:system-ui,sans-serif;">
      <div style="max-width:520px;padding:24px;border-radius:12px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 8px 24px rgba(15,23,42,.08);">
        <h2 style="margin:0 0 12px;color:#0f2744;">Premium arayüz başlatılamadı</h2>
        <p style="margin:0 0 16px;color:#64748b;font-size:14px;line-height:1.5;">${premiumRestartHint()}</p>
        <pre style="margin:0;padding:12px;border-radius:8px;background:#fef2f2;color:#b91c1c;font-size:12px;white-space:pre-wrap;overflow:auto;">${message}</pre>
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
