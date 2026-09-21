import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { closeDb, getDb, nowIso } from "../src/main/db/connection";
import { runMigrations } from "../src/main/db/migrate";
import { allMigrations } from "../src/main/migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady } from "../src/main/ipc/handlers";
import { setupFirst } from "../src/main/services/auth.service";
import { seedLicenseActive } from "./lib/premium-e2e-harness";
import { PARITY, PARITY_OUT } from "./lib/parity/constants";
import { initParityBootstrapEnv } from "./lib/parity/isolation";

async function runBootstrap(): Promise<void> {
  const env = initParityBootstrapEnv(`boot-${Date.now()}`);
  try {
    await app.whenReady();

    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    seedLicenseActive(db);
    const setup = setupFirst({
      adSoyad: PARITY.ad,
      kullaniciAdi: PARITY.user,
      sifre: PARITY.pass,
      guvenlikSorusuKodu: "G1",
      guvenlikCevabi: "test",
    });
    if (!setup.ok) throw new Error(setup.error ?? "setupFirst failed");

    registerIpcHandlers();
    initAuthOnReady();
    initLicenseOnReady();

    closeDb();

    mkdirSync(PARITY_OUT, { recursive: true });
    const legacyDb = join(PARITY_OUT, "legacy-test.sqlite");
    const premiumDb = join(PARITY_OUT, "premium-test.sqlite");
    copyFileSync(env.dbPath, legacyDb);
    copyFileSync(env.dbPath, premiumDb);

    const manifest = {
      legacyDb,
      premiumDb,
      bootstrapDb: env.dbPath,
      user: PARITY.user,
      pass: PARITY.pass,
      createdAt: new Date().toISOString(),
    };
    writeFileSync(join(PARITY_OUT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    console.log(`[PASS] Bootstrap DB: ${env.dbPath}`);
    console.log(`[PASS] Kopyalar: ${legacyDb}, ${premiumDb}`);
  } finally {
    closeDb();
    delete process.env.MKD_TEST_DB;
    app.quit();
  }
}

if (process.env.MKD_PARITY_BOOTSTRAP === "1") {
  app.on("window-all-closed", () => {});
  void runBootstrap()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
