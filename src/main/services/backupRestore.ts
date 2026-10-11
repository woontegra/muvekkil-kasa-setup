import Database from "better-sqlite3";
import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  statfsSync,
  unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { runMigrations, type Migration } from "../db/migrate";
import { BackupCryptoError, decryptBackupFile, isEncryptedBackupFile, type BackupSecret } from "./backupCrypto";

/** userData altında, yalnızca geri yükleme sırasında kullanılan geçici çalışma alanı. */
export const RESTORE_WORK_DIR_NAME = "restore-work";
const AUTO_BACKUP_DIR_NAME = "auto-backups";
const SQLITE_MAGIC = Buffer.from("SQLite format 3\0", "utf8");
/** Migration ve SQLite geçici dosyaları için ek pay. */
const FREE_SPACE_MARGIN_BYTES = 16 * 1024 * 1024;
/** Uygulamanın en eski sürümlerinden beri var olan tablolar; bunlar yoksa dosya bu uygulamanın yedeği değildir. */
const REQUIRED_BASE_TABLES = ["schema_migrations", "uygulama_kullanici"];

export type RestoreErrorCode =
  | "INVALID_SQLITE"
  | "CORRUPT"
  | "NOT_APP_BACKUP"
  | "NEWER_VERSION"
  | "MIGRATION_FAILED"
  | "MISSING_TABLES"
  | "DISK_FULL"
  | "FAILED"
  | "ROLLED_BACK"
  | "ROLLBACK_FAILED"
  | "SECRET_REQUIRED"
  | "WRONG_SECRET"
  | "UNSUPPORTED_ENCRYPTION";

const UNCHANGED = "Mevcut veritabanı değiştirilmedi.";

export const RESTORE_ERROR_MESSAGES: Record<RestoreErrorCode, string> = {
  INVALID_SQLITE: `Seçilen dosya geçerli bir SQLite yedeği değil. ${UNCHANGED}`,
  CORRUPT: `Seçilen yedek dosyası bozuk (bütünlük kontrolü başarısız). ${UNCHANGED}`,
  NOT_APP_BACKUP: `Seçilen dosya Müvekkil Kasa Defteri yedeği değil. ${UNCHANGED}`,
  NEWER_VERSION: `Seçilen yedek programın daha yeni bir sürümüyle alınmış. Önce programı güncelleyin. ${UNCHANGED}`,
  MIGRATION_FAILED: `Seçilen yedek bu sürüme uyarlanamadı. ${UNCHANGED}`,
  MISSING_TABLES: `Seçilen yedekte gerekli tablolar eksik. ${UNCHANGED}`,
  DISK_FULL: `Geri yükleme için yeterli disk alanı yok. ${UNCHANGED}`,
  FAILED: `Geri yükleme başarısız. ${UNCHANGED}`,
  ROLLED_BACK: "Geri yükleme tamamlanamadı; önceki veritabanı eksiksiz geri getirildi.",
  ROLLBACK_FAILED:
    "Geri yükleme tamamlanamadı ve önceki veritabanı otomatik geri getirilemedi. Geri yükleme öncesi kopya otomatik yedek klasöründe duruyor.",
  SECRET_REQUIRED: `Bu yedek şifreli; parola veya kurtarma anahtarı gerekli. ${UNCHANGED}`,
  WRONG_SECRET: `Parola veya kurtarma anahtarı hatalı. ${UNCHANGED}`,
  UNSUPPORTED_ENCRYPTION: `Bu şifreli yedek programın daha yeni bir sürümüyle oluşturulmuş. Önce programı güncelleyin. ${UNCHANGED}`,
};

export class RestoreError extends Error {
  constructor(
    public readonly code: RestoreErrorCode,
    public readonly detail?: unknown,
  ) {
    super(code);
    this.name = "RestoreError";
  }
}

export type RestoreDeps = {
  dbPath: string;
  userDataDir: string;
  getDb: () => Database.Database;
  closeDb: () => void;
  migrations: Migration[];
  nowIso: () => string;
  now?: () => Date;
  copyFile?: (src: string, dest: string) => void;
  decryptFile?: (src: string, dest: string, secret: BackupSecret) => void;
  freeBytes?: (dir: string) => number;
};

export type RestoreResult =
  | { ok: true; autoBackupPath: string }
  | { ok: false; code: RestoreErrorCode; error: string; autoBackupPath?: string };

type LicenseRow = Record<string, unknown>;

function isDiskFull(e: unknown): boolean {
  for (let cur: unknown = e; cur; cur = (cur as { detail?: unknown }).detail) {
    const code = (cur as { code?: unknown }).code;
    if (code === "ENOSPC" || code === "SQLITE_FULL") return true;
  }
  return false;
}

function asRestoreError(e: unknown, fallback: RestoreErrorCode): RestoreError {
  if (e instanceof RestoreError) return e;
  return new RestoreError(isDiskFull(e) ? "DISK_FULL" : fallback, e);
}

function fsyncPath(path: string): void {
  const fd = openSync(path, "r+");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function fsyncDir(path: string): void {
  if (process.platform === "win32") return;
  try {
    const fd = openSync(path, "r");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  } catch {
    /* bazı dosya sistemleri dizin fsync desteklemez */
  }
}

function fileSize(path: string): number {
  return existsSync(path) ? statSync(path).size : 0;
}

function bundleSize(base: string): number {
  return fileSize(base) + fileSize(base + "-wal") + fileSize(base + "-shm");
}

function removeWalShm(base: string): void {
  for (const ext of ["-wal", "-shm"]) {
    const p = base + ext;
    if (existsSync(p)) unlinkSync(p);
  }
}

function defaultFreeBytes(dir: string): number {
  const s = statfsSync(dir);
  return Number(s.bavail) * Number(s.bsize);
}

export function assertSqliteHeader(filePath: string): void {
  let fd: number;
  try {
    fd = openSync(filePath, "r");
  } catch (e) {
    throw new RestoreError("INVALID_SQLITE", e);
  }
  try {
    const buf = Buffer.alloc(SQLITE_MAGIC.length);
    const n = readSync(fd, buf, 0, buf.length, 0);
    if (n < SQLITE_MAGIC.length || !buf.equals(SQLITE_MAGIC)) {
      throw new RestoreError("INVALID_SQLITE");
    }
  } finally {
    closeSync(fd);
  }
}

function tableNames(db: Database.Database): Set<string> {
  const rows = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

function readLiveLicense(db: Database.Database): LicenseRow | null {
  if (!tableNames(db).has("yerel_lisans")) return null;
  const row = db.prepare(`SELECT * FROM yerel_lisans WHERE id = 1`).get() as LicenseRow | undefined;
  return row ?? null;
}

function quickCheckOk(db: Database.Database): boolean {
  return db.pragma("quick_check", { simple: true }) === "ok";
}

/**
 * Geçici kopya üzerinde: bütünlük + şema kontrolü, migration, lisans aktarımı.
 * Canlı veritabanına dokunmaz.
 */
function prepareCandidate(
  candidatePath: string,
  ctx: { liveTables: Set<string>; liveLicense: LicenseRow | null; migrations: Migration[]; nowIso: () => string },
): void {
  let db: Database.Database;
  try {
    db = new Database(candidatePath, { fileMustExist: true });
  } catch (e) {
    throw asRestoreError(e, "CORRUPT");
  }
  try {
    try {
      const rows = db.pragma("integrity_check") as { integrity_check: string }[];
      if (rows.length !== 1 || rows[0]?.integrity_check !== "ok") throw new RestoreError("CORRUPT");
    } catch (e) {
      throw asRestoreError(e, "CORRUPT");
    }

    const tables = tableNames(db);
    if (!REQUIRED_BASE_TABLES.every((t) => tables.has(t))) throw new RestoreError("NOT_APP_BACKUP");

    const known = new Set(ctx.migrations.map((m) => m.id));
    const applied = (db.prepare(`SELECT id FROM schema_migrations`).all() as { id: unknown }[]).map((r) =>
      String(r.id),
    );
    if (applied.some((id) => !known.has(id))) throw new RestoreError("NEWER_VERSION");

    try {
      runMigrations(db, ctx.migrations, ctx.nowIso);
    } catch (e) {
      throw asRestoreError(e, "MIGRATION_FAILED");
    }

    const migratedTables = tableNames(db);
    for (const t of ctx.liveTables) {
      if (t.startsWith("sqlite_")) continue;
      if (!migratedTables.has(t)) throw new RestoreError("MISSING_TABLES");
    }

    // Lisans bu bilgisayara aittir: yedekteki kayıt atılır, canlı kayıt (varsa) aynen taşınır.
    try {
      const licenseCols = new Set(
        (db.prepare(`PRAGMA table_info(yerel_lisans)`).all() as { name: string }[]).map((c) => c.name),
      );
      const liveLicense = ctx.liveLicense;
      const cols = liveLicense ? Object.keys(liveLicense) : [];
      if (cols.some((c) => !licenseCols.has(c))) throw new RestoreError("MIGRATION_FAILED");
      db.transaction(() => {
        db.prepare(`DELETE FROM yerel_lisans`).run();
        if (liveLicense) {
          const quoted = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ");
          const params = cols.map(() => "?").join(", ");
          db.prepare(`INSERT INTO yerel_lisans (${quoted}) VALUES (${params})`).run(
            ...cols.map((c) => liveLicense[c]),
          );
        }
      })();
    } catch (e) {
      throw asRestoreError(e, "FAILED");
    }

    try {
      if (!quickCheckOk(db)) throw new RestoreError("CORRUPT");
      db.pragma("wal_checkpoint(TRUNCATE)");
    } catch (e) {
      throw asRestoreError(e, "FAILED");
    }
  } finally {
    db.close();
  }
  if (existsSync(candidatePath + "-wal")) {
    // Kapanışta WAL birleştirilemediyse kopya eksik olabilir; canlıya taşınmaz.
    throw new RestoreError("FAILED");
  }
  removeWalShm(candidatePath);
}

function copyBundle(copyFile: (s: string, d: string) => void, srcBase: string, destBase: string): string[] {
  const written: string[] = [];
  copyFile(srcBase, destBase);
  written.push(destBase);
  for (const ext of ["-wal", "-shm"]) {
    if (existsSync(srcBase + ext)) {
      copyFile(srcBase + ext, destBase + ext);
      written.push(destBase + ext);
    }
  }
  for (const p of written) fsyncPath(p);
  return written;
}

/** Önceki geri yüklemelerden kalmış geçici çalışma alanını siler (uygulama açılışında). */
export function cleanupRestoreWorkspace(userDataDir: string): void {
  try {
    rmSync(join(userDataDir, RESTORE_WORK_DIR_NAME), { recursive: true, force: true });
  } catch (e) {
    console.error("[cleanupRestoreWorkspace]", e);
  }
}

/**
 * Seçilen yedeği güvenli biçimde geri yükler. Seçilen dosya yalnızca okunur.
 * Canlı veritabanı yalnızca tüm kontrollerden geçmiş hazır kopya ile atomik rename ile değiştirilir.
 */
export function restoreFromBackupFile(src: string, deps: RestoreDeps, secret?: BackupSecret): RestoreResult {
  const copyFile = deps.copyFile ?? ((s: string, d: string) => copyFileSync(s, d));
  const decryptFile = deps.decryptFile ?? decryptBackupFile;
  const freeBytes = deps.freeBytes ?? defaultFreeBytes;
  const stamp = (deps.now?.() ?? new Date()).toISOString().replace(/[:.]/g, "-");
  const workRoot = join(deps.userDataDir, RESTORE_WORK_DIR_NAME);
  const workDir = join(workRoot, stamp);
  const autoBackupDir = join(deps.userDataDir, AUTO_BACKUP_DIR_NAME);
  const autoBackupPath = join(autoBackupDir, `oncesi-${stamp}.sqlite`);
  const dbPath = deps.dbPath;

  let liveClosed = false;
  let swapped = false;
  let autoBackupWritten = false;

  const fail = (e: unknown, fallback: RestoreErrorCode): RestoreResult => {
    const err = asRestoreError(e, fallback);
    console.error("[restoreDatabase]", err.code, err.detail ?? "");
    return { ok: false, code: err.code, error: RESTORE_ERROR_MESSAGES[err.code] };
  };

  try {
    let encrypted: boolean;
    try {
      encrypted = isEncryptedBackupFile(src);
      if (!encrypted) assertSqliteHeader(src);
    } catch (e) {
      return fail(e, "INVALID_SQLITE");
    }
    if (encrypted && !secret) return fail(new RestoreError("SECRET_REQUIRED"), "SECRET_REQUIRED");

    const live = deps.getDb();
    const liveTables = tableNames(live);
    const liveLicense = readLiveLicense(live);
    live.pragma("wal_checkpoint(TRUNCATE)");

    const srcSize = fileSize(src);
    const liveSize = bundleSize(dbPath);
    const needed = srcSize * 2 + liveSize + FREE_SPACE_MARGIN_BYTES;
    if (freeBytes(dirname(dbPath)) < needed) return fail(new RestoreError("DISK_FULL"), "DISK_FULL");

    const candidatePath = join(workDir, "candidate.sqlite");
    try {
      mkdirSync(workDir, { recursive: true });
      if (encrypted) {
        decryptFile(src, candidatePath, secret!);
        assertSqliteHeader(candidatePath);
      } else {
        copyFile(src, candidatePath);
      }
    } catch (e) {
      if (e instanceof BackupCryptoError) {
        if (e.code === "WRONG_SECRET") return fail(new RestoreError("WRONG_SECRET"), "WRONG_SECRET");
        if (e.code === "UNSUPPORTED_VERSION") return fail(new RestoreError("UNSUPPORTED_ENCRYPTION"), "CORRUPT");
        return fail(new RestoreError("CORRUPT", e.code), "CORRUPT");
      }
      if (encrypted && e instanceof RestoreError && e.code === "INVALID_SQLITE") {
        return fail(new RestoreError("CORRUPT"), "CORRUPT");
      }
      return fail(e, "FAILED");
    }

    try {
      prepareCandidate(candidatePath, { liveTables, liveLicense, migrations: deps.migrations, nowIso: deps.nowIso });
      fsyncPath(candidatePath);
    } catch (e) {
      return fail(e, "FAILED");
    }

    deps.closeDb();
    liveClosed = true;

    try {
      if (existsSync(dbPath)) {
        mkdirSync(autoBackupDir, { recursive: true });
        const staged = join(workDir, "oncesi.sqlite");
        const written = copyBundle(copyFile, dbPath, staged);
        for (const p of written) {
          renameSync(p, autoBackupPath + p.slice(staged.length));
        }
        autoBackupWritten = true;
        fsyncDir(autoBackupDir);
      }
    } catch (e) {
      return fail(e, "FAILED");
    }

    try {
      removeWalShm(dbPath);
      renameSync(candidatePath, dbPath);
      swapped = true;
      fsyncDir(dirname(dbPath));

      const db = deps.getDb();
      liveClosed = false;
      const tables = tableNames(db);
      if (!quickCheckOk(db) || [...liveTables].some((t) => !t.startsWith("sqlite_") && !tables.has(t))) {
        throw new RestoreError("FAILED");
      }
    } catch (e) {
      if (!swapped) return fail(e, "FAILED");
      console.error("[restoreDatabase] swap sonrası hata, geri alınıyor", e);
      return rollback();
    }

    return { ok: true, autoBackupPath };
  } catch (e) {
    return fail(e, "FAILED");
  } finally {
    if (liveClosed) {
      try {
        deps.getDb();
      } catch (e) {
        console.error("[restoreDatabase] veritabanı yeniden açılamadı", e);
      }
    }
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* açılışta tekrar temizlenir */
    }
  }

  function rollback(): RestoreResult {
    try {
      try {
        deps.closeDb();
      } catch {
        /* zaten kapalı olabilir */
      }
      liveClosed = true;
      if (!autoBackupWritten) throw new Error("no pre-restore copy");
      const staged = join(workDir, "rollback.sqlite");
      mkdirSync(workDir, { recursive: true });
      const written = copyBundle(copyFile, autoBackupPath, staged);
      removeWalShm(dbPath);
      for (const p of written.slice(1)) renameSync(p, dbPath + p.slice(staged.length));
      renameSync(staged, dbPath);
      fsyncDir(dirname(dbPath));
      deps.getDb();
      liveClosed = false;
      return { ok: false, code: "ROLLED_BACK", error: RESTORE_ERROR_MESSAGES.ROLLED_BACK, autoBackupPath };
    } catch (e) {
      console.error("[restoreDatabase] geri alma başarısız", e);
      return {
        ok: false,
        code: "ROLLBACK_FAILED",
        error: RESTORE_ERROR_MESSAGES.ROLLBACK_FAILED,
        autoBackupPath,
      };
    }
  }
}
