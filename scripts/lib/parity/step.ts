import type { BrowserWindow } from "electron";
import { captureLegacyFailure } from "./legacy-screen";
import type { ConsoleBag } from "./ui";

export const STEP_TIMEOUT_MS = 45_000;

export async function runStep(
  win: BrowserWindow,
  name: string,
  fn: () => Promise<void>,
  consoleBag?: ConsoleBag,
): Promise<void> {
  console.log(`[START] ${name}`);
  if (process.env.MKD_PARITY_LEGACY_STARTUP_PROBE === "1" && name === "1. Giriş") {
    console.log("[BOOT] startup probe tamam — [START] 1. Giriş sonrası çıkılıyor");
    return;
  }
  const timer = setTimeout(() => {
    /* handled by race */
  }, STEP_TIMEOUT_MS);
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Adım zaman aşımı (${STEP_TIMEOUT_MS}ms): ${name}`)), STEP_TIMEOUT_MS),
      ),
    ]);
    console.log(`[PASS] ${name}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[FAIL] ${name}: ${msg}`);
    await captureLegacyFailure(
      win,
      name.replace(/[^a-z0-9]+/gi, "-").slice(0, 40),
      consoleBag?.errors ?? [],
      consoleBag?.ipc ?? [],
    );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
