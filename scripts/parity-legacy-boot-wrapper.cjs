/** Electron child bootstrap — gerçek parity bundle'ı require etmeden önce teşhis logları. */
console.log("[BOOT] wrapper başladı");

process.on("uncaughtException", (err) => {
  console.error("[BOOT] uncaughtException:", err && err.stack ? err.stack : err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[BOOT] unhandledRejection:", reason);
  process.exit(1);
});

try {
  const { app } = require("electron");
  console.log("[BOOT] electron app modülü yüklendi, isReady=", app.isReady());
  console.log("[BOOT] userData (başlangıç):", app.getPath("userData"));
} catch (e) {
  console.error("[BOOT] electron app yüklenemedi:", e && e.message ? e.message : e);
}

console.log("[BOOT] ELECTRON_RUN_AS_NODE=", process.env.ELECTRON_RUN_AS_NODE ?? "(yok)");
console.log("[BOOT] MKD_TEST_DB=", process.env.MKD_TEST_DB ?? "(yok)");
console.log("[BOOT] MKD_PARITY_LEGACY_FLOW=", process.env.MKD_PARITY_LEGACY_FLOW ?? "(yok)");

const target = process.env.MKD_PARITY_BOOT_TARGET;
if (!target) {
  console.error("[BOOT] MKD_PARITY_BOOT_TARGET tanımsız");
  process.exit(1);
}

console.log("[BOOT] require öncesi:", target);
const t0 = Date.now();
try {
  require(target);
  console.log(`[BOOT] require sonrası — modül yüklendi (${Date.now() - t0}ms)`);
} catch (e) {
  console.error(`[BOOT] require hatası (${Date.now() - t0}ms):`, e && e.stack ? e.stack : e);
  process.exit(1);
}

if (process.env.MKD_PARITY_LEGACY_FLOW === "1") {
  console.log("[BOOT] MKD_PARITY_LEGACY_FLOW=1 — entry akışı devralıyor");
} else {
  console.log("[BOOT] MKD_PARITY_LEGACY_FLOW yok — UI akışı başlatılmadı, çıkılıyor");
  process.exit(0);
}
