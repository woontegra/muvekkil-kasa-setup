import { app, dialog } from "electron";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseRecoveryKey } from "@shared/backupPassword";
import { closeDb, getDb, getDbPath, nowIso } from "../db/connection";
import { allMigrations } from "../migrations";
import { createPlainBackup } from "./backupCreate";
import { ENCRYPTED_BACKUP_EXTENSION, isEncryptedBackupFile, type BackupSecret } from "./backupCrypto";
import { restoreFromBackupFile } from "./backupRestore";
import { authLogout } from "./auth.service";

function copySqliteBundle(srcBase: string, destBase: string): void {
  copyFileSync(srcBase, destBase);
  for (const ext of ["-wal", "-shm"]) {
    const s = srcBase + ext;
    if (existsSync(s)) copyFileSync(s, destBase + ext);
  }
}

function isLiveDbFile(filePath: string): boolean {
  const target = resolve(filePath);
  const dbPath = resolve(getDbPath());
  return [dbPath, dbPath + "-wal", dbPath + "-shm"].includes(target);
}

export async function backupDatabase(): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Veritabanı yedeğini kaydet",
    defaultPath: join(app.getPath("documents"), `muvekkil-kasa-yedek-${stamp}.sqlite`),
    filters: [{ name: "SQLite veritabanı", extensions: ["sqlite", "db"] }],
  });
  if (canceled || !filePath?.trim()) {
    return { ok: false, error: "Yedekleme iptal edildi." };
  }
  if (isLiveDbFile(filePath)) {
    return { ok: false, error: "Yedek, programın kendi veritabanı dosyasının üzerine kaydedilemez." };
  }
  try {
    await createPlainBackup({ db: getDb(), destPath: filePath });
    return { ok: true, path: filePath };
  } catch (e) {
    console.error("[backupDatabase]", e instanceof Error ? e.message : e);
    return { ok: false, error: "Yedek alınamadı. Mevcut dosyalar değiştirilmedi." };
  }
}

type PendingRestore = { path: string; expiresAt: number; attempts: number };
const pendingRestores = new Map<string, PendingRestore>();
const PENDING_RESTORE_TTL_MS = 10 * 60 * 1000;
const PENDING_RESTORE_MAX_ATTEMPTS = 5;

export type RestoreDatabaseResult =
  | { ok: true; autoBackupPath: string }
  | { ok: false; error: string; needsSecret?: true; token?: string; fileName?: string };

/** Bellekteki oturum eski veritabanının kullanıcı/rolünü taşır; yeni veritabanında geçerli sayılamaz. */
function endSessionAfterRestore(): void {
  authLogout();
  pendingRestores.clear();
}

function restoreDeps() {
  return {
    dbPath: getDbPath(),
    userDataDir: app.getPath("userData"),
    getDb,
    closeDb,
    migrations: allMigrations,
    nowIso,
  };
}

/**
 * Argümansız: dosya seçtirir; şifresiz eski yedek doğrudan geri yüklenir, şifreli yedekte token döner.
 * { token, password } veya { token, recoveryKey }: seçilmiş şifreli yedeği geri yükler.
 */
export async function restoreDatabase(
  input?: { token?: unknown; password?: unknown; recoveryKey?: unknown },
): Promise<RestoreDatabaseResult> {
  const now = Date.now();
  for (const [t, p] of pendingRestores) if (p.expiresAt < now) pendingRestores.delete(t);

  if (input && typeof input.token === "string") {
    const token = input.token;
    const pending = pendingRestores.get(token);
    if (!pending) {
      return { ok: false, error: "Yedek seçimi zaman aşımına uğradı. Lütfen dosyayı yeniden seçin." };
    }
    let secret: BackupSecret | null = null;
    if (typeof input.password === "string" && input.password.length > 0) {
      secret = { kind: "password", value: input.password };
    } else if (typeof input.recoveryKey === "string" && input.recoveryKey.trim().length > 0) {
      if (!parseRecoveryKey(input.recoveryKey)) {
        return {
          ok: false,
          needsSecret: true,
          token,
          fileName: basename(pending.path),
          error: "Kurtarma anahtarı biçimi geçersiz (32 karakter, 4'lü gruplar).",
        };
      }
      secret = { kind: "recovery", value: input.recoveryKey };
    }
    if (!secret) {
      return { ok: false, needsSecret: true, token, fileName: basename(pending.path), error: "Parola veya kurtarma anahtarı girin." };
    }
    const result = restoreFromBackupFile(pending.path, restoreDeps(), secret);
    if (result.ok) {
      endSessionAfterRestore();
      return { ok: true, autoBackupPath: result.autoBackupPath };
    }
    if (result.code === "WRONG_SECRET") {
      pending.attempts += 1;
      if (pending.attempts >= PENDING_RESTORE_MAX_ATTEMPTS) {
        pendingRestores.delete(token);
        return { ok: false, error: `${result.error} Çok fazla hatalı deneme; dosyayı yeniden seçin.` };
      }
      return { ok: false, needsSecret: true, token, fileName: basename(pending.path), error: result.error };
    }
    pendingRestores.delete(token);
    return { ok: false, error: result.error };
  }

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Yedekten geri yükle",
    filters: [
      { name: "Müvekkil Kasa yedeği", extensions: [ENCRYPTED_BACKUP_EXTENSION, "sqlite", "db"] },
      { name: "Şifreli yedek", extensions: [ENCRYPTED_BACKUP_EXTENSION] },
      { name: "SQLite veritabanı (eski yedek)", extensions: ["sqlite", "db"] },
    ],
    properties: ["openFile"],
  });
  if (canceled || !filePaths[0]?.trim()) {
    return { ok: false, error: "Geri yükleme iptal edildi." };
  }
  const src = filePaths[0];
  let encrypted = false;
  try {
    encrypted = isEncryptedBackupFile(src);
  } catch {
    /* okunamayan dosya aşağıda reddedilir */
  }
  if (encrypted) {
    const token = randomUUID();
    pendingRestores.set(token, { path: src, expiresAt: now + PENDING_RESTORE_TTL_MS, attempts: 0 });
    return {
      ok: false,
      needsSecret: true,
      token,
      fileName: basename(src),
      error: "Bu yedek şifreli; parola veya kurtarma anahtarı gerekli.",
    };
  }
  const result = restoreFromBackupFile(src, restoreDeps());
  if (result.ok) {
    endSessionAfterRestore();
    return { ok: true, autoBackupPath: result.autoBackupPath };
  }
  return { ok: false, error: result.error };
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
