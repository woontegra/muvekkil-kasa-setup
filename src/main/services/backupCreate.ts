import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import { closeSync, existsSync, fsyncSync, openSync, renameSync, rmSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

/** Önceki sürümlerin şifreli yedek oluştururken kullandığı geçici alan; artıkları açılışta silinir. */
export const BACKUP_WORK_DIR_NAME = "backup-work";

function fsyncPath(path: string): void {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function fsyncDir(path: string): void {
  if (process.platform === "win32") return;
  try {
    fsyncPath(path);
  } catch {
    /* bazı dosya sistemleri dizin fsync desteklemez */
  }
}

export function cleanupBackupWorkspace(userDataDir: string): void {
  try {
    rmSync(join(userDataDir, BACKUP_WORK_DIR_NAME), { recursive: true, force: true });
  } catch (e) {
    console.error("[cleanupBackupWorkspace]", e);
  }
}

/**
 * Canlı veritabanının tutarlı anlık görüntüsünü şifresiz SQLite olarak alır, doğrular ve destPath'e atomik olarak yerleştirir.
 * Hata durumunda destPath'te önceden var olan dosyaya dokunulmaz ve yarım dosya bırakılmaz.
 */
export async function createPlainBackup(opts: { db: Database.Database; destPath: string }): Promise<void> {
  const partPath = `${opts.destPath}.${randomBytes(6).toString("hex")}.part`;
  try {
    await opts.db.backup(partPath);
    const check = new Database(partPath, { fileMustExist: true });
    try {
      // Anlık görüntü canlı veritabanının WAL kipini taşır; tek dosyalık kipe alınmazsa yedek açıldığında yanında -wal/-shm oluşur.
      check.pragma("journal_mode = DELETE");
      if (check.pragma("quick_check", { simple: true }) !== "ok") throw new Error("backup quick_check failed");
    } finally {
      check.close();
    }
    fsyncPath(partPath);
    renameSync(partPath, opts.destPath);
    fsyncDir(dirname(opts.destPath));
  } finally {
    for (const p of [partPath, `${partPath}-journal`, `${partPath}-wal`, `${partPath}-shm`]) {
      try {
        if (existsSync(p)) unlinkSync(p);
      } catch {
        /* yok sayılır */
      }
    }
  }
}
