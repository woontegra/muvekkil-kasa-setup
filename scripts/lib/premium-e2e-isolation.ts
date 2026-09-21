import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { app } from "electron";

export type IsolatedEnv = {
  runId: string;
  baseDir: string;
  userDataDir: string;
  cacheDir: string;
  dbPath: string;
};

/** app.whenReady() öncesi çağrılmalı. */
export function initIsolatedElectronEnv(runId: string, dbPath?: string): IsolatedEnv {
  const safeId = runId.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const baseDir = join(tmpdir(), `mkd-e2e-${safeId}`);
  const userDataDir = join(baseDir, "user-data");
  const cacheDir = join(baseDir, "cache");
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });

  const resolvedDb = dbPath ?? join(baseDir, "test.sqlite");
  process.env.MKD_TEST_DB = resolvedDb;
  process.env.MKD_E2E_USER_DATA = userDataDir;
  process.env.MKD_E2E_RUN_ID = safeId;

  app.setPath("userData", userDataDir);
  app.commandLine.appendSwitch("disk-cache-dir", cacheDir);
  app.commandLine.appendSwitch("disable-gpu");

  return { runId: safeId, baseDir, userDataDir, cacheDir, dbPath: resolvedDb };
}

export function cleanupIsolatedEnv(env: IsolatedEnv): void {
  delete process.env.MKD_E2E_USER_DATA;
  delete process.env.MKD_E2E_RUN_ID;
  try {
    rmSync(env.baseDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
