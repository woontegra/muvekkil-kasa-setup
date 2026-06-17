import { app, dialog } from "electron";
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { closeDb, getDb, getDbPath } from "../db/connection";

function copySqliteBundle(srcBase: string, destBase: string): void {
  copyFileSync(srcBase, destBase);
  for (const ext of ["-wal", "-shm"]) {
    const s = srcBase + ext;
    if (existsSync(s)) copyFileSync(s, destBase + ext);
  }
}

function removeWalShm(base: string): void {
  for (const ext of ["-wal", "-shm"]) {
    const p = base + ext;
    if (existsSync(p)) unlinkSync(p);
  }
}

export async function backupDatabase(): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const dbPath = getDbPath();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Veritabanı yedeğini kaydet",
    defaultPath: join(app.getPath("documents"), `muvekkil-kasa-yedek-${stamp}.sqlite`),
    filters: [{ name: "SQLite veritabanı", extensions: ["sqlite", "db"] }],
  });
  if (canceled || !filePath?.trim()) {
    return { ok: false, error: "Yedekleme iptal edildi." };
  }
  try {
    const db = getDb();
    db.pragma("wal_checkpoint(TRUNCATE)");
    copySqliteBundle(dbPath, filePath);
    return { ok: true, path: filePath };
  } catch (e) {
    console.error("[backupDatabase]", e);
    return { ok: false, error: "Yedek alınamadı." };
  }
}

export async function restoreDatabase(): Promise<
  { ok: true; autoBackupPath: string } | { ok: false; error: string }
> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Yedekten geri yükle",
    filters: [{ name: "SQLite veritabanı", extensions: ["sqlite", "db"] }],
    properties: ["openFile"],
  });
  if (canceled || !filePaths[0]?.trim()) {
    return { ok: false, error: "Geri yükleme iptal edildi." };
  }
  const src = filePaths[0];
  const dbPath = getDbPath();
  const backupDir = join(app.getPath("userData"), "auto-backups");
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const autoBackupPath = join(backupDir, `oncesi-${stamp}.sqlite`);
  try {
    closeDb();
    if (existsSync(dbPath)) {
      copySqliteBundle(dbPath, autoBackupPath);
    }
    copyFileSync(src, dbPath);
    removeWalShm(dbPath);
    getDb();
    return { ok: true, autoBackupPath };
  } catch (e) {
    console.error("[restoreDatabase]", e);
    try {
      getDb();
    } catch {
      /* ignore */
    }
    return { ok: false, error: "Geri yükleme başarısız." };
  }
}
