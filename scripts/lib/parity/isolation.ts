import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { app } from "electron";

export type ParityBootstrapEnv = {
  baseDir: string;
  userDataDir: string;
  cacheDir: string;
  dbPath: string;
};

/** Doğal DB yolu (MKD_TEST_DB yok) — bootstrap için. app.whenReady() öncesi. */
export function initParityBootstrapEnv(runId: string): ParityBootstrapEnv {
  const safeId = runId.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const baseDir = join(tmpdir(), `mkd-parity-${safeId}`);
  const userDataDir = join(baseDir, "user-data");
  const cacheDir = join(baseDir, "cache");
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });

  delete process.env.MKD_TEST_DB;
  delete process.env.MKD_E2E_USER_DATA;
  app.setPath("userData", userDataDir);
  app.commandLine.appendSwitch("disk-cache-dir", cacheDir);
  app.commandLine.appendSwitch("disable-gpu");

  const dbPath = join(userDataDir, "muvekkil-kasa-defteri.sqlite");
  return { baseDir, userDataDir, cacheDir, dbPath };
}
