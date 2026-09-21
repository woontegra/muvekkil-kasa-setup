import { app, dialog } from "electron";
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
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

function stampForFolder(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/**
 * Güncelleme öncesi güvenli yedek: SQLite (WAL checkpoint), ayar dosyaları, ofis logosu.
 * userData/update-backups/[eski]-to-[yeni]-[tarih]/
 */
export function createPreUpdateBackup(
  fromVersion: string,
  toVersion: string,
): { ok: true; path: string } | { ok: false; error: string } {
  const safeFrom = fromVersion.replace(/[^\w.-]+/g, "_") || "unknown";
  const safeTo = toVersion.replace(/[^\w.-]+/g, "_") || "unknown";
  const dirName = `${safeFrom}-to-${safeTo}-${stampForFolder()}`;
  const backupRoot = join(app.getPath("userData"), "update-backups");
  const destDir = join(backupRoot, dirName);

  try {
    mkdirSync(destDir, { recursive: true });
    const dbPath = getDbPath();
    const dbFileName = basename(dbPath);
    const db = getDb();
    db.pragma("wal_checkpoint(TRUNCATE)");
    copySqliteBundle(dbPath, join(destDir, dbFileName));

    const userData = app.getPath("userData");
    for (const name of ["remembered-login.json", "auth-remember.json"]) {
      const src = join(userData, name);
      if (existsSync(src)) copyFileSync(src, join(destDir, name));
    }

    const logosSrc = join(userData, "logos");
    if (existsSync(logosSrc)) {
      const logosDest = join(destDir, "logos");
      mkdirSync(logosDest, { recursive: true });
      for (const entry of readdirSync(logosSrc, { withFileTypes: true })) {
        if (entry.isFile()) {
          copyFileSync(join(logosSrc, entry.name), join(logosDest, entry.name));
        }
      }
    }

    const metadata = {
      eskiSurum: fromVersion,
      yeniSurum: toVersion,
      yedekTarihi: new Date().toISOString(),
      veritabaniDosyaAdi: dbFileName,
    };
    writeFileSync(join(destDir, "metadata.json"), JSON.stringify(metadata, null, 2), "utf8");
    return { ok: true, path: destDir };
  } catch (e) {
    console.error("[createPreUpdateBackup]", e);
    return { ok: false, error: "Güncelleme öncesi veri yedeği oluşturulamadı." };
  }
}
