import { app, BrowserWindow } from "electron";
import log from "electron-log";
import electronUpdater, { type AppUpdater } from "electron-updater";
import { IPC } from "@shared/ipc";
import type {
  UpdateActionResult,
  UpdateCheckSource,
  UpdateProgressInfo,
  UpdateStatusSnapshot,
} from "@shared/types/update";
import { createPreUpdateBackup } from "./backup.service";

function getAutoUpdater(): AppUpdater {
  const { autoUpdater } = electronUpdater;
  return autoUpdater;
}

const autoUpdater = getAutoUpdater();

log.transports.file.level = "info";
autoUpdater.logger = log;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = false;

let status: UpdateStatusSnapshot | null = null;
let autoCheckScheduled = false;
let autoCheckDone = false;
let downloadInProgress = false;
let listenersBound = false;
let lastCheckSource: UpdateCheckSource | null = null;

function emptyStatus(): UpdateStatusSnapshot {
  return {
    state: "idle",
    currentVersion: app.getVersion(),
    availableVersion: null,
    releaseDate: null,
    releaseNotes: null,
    progress: null,
    errorMessage: null,
    showPrompt: false,
    infoMessage: null,
    lastCheckSource: null,
    packaged: app.isPackaged,
  };
}

function currentStatus(): UpdateStatusSnapshot {
  if (!status) status = emptyStatus();
  return status;
}

function releaseNotesText(notes: unknown): string | null {
  if (notes == null) return null;
  if (typeof notes === "string") {
    const t = notes.trim();
    return t ? t.slice(0, 800) : null;
  }
  if (Array.isArray(notes)) {
    const parts = notes
      .map((n) => {
        if (typeof n === "string") return n;
        if (n && typeof n === "object" && "note" in n) return String((n as { note: unknown }).note);
        return "";
      })
      .filter(Boolean);
    const t = parts.join("\n").trim();
    return t ? t.slice(0, 800) : null;
  }
  return null;
}

function setStatus(patch: Partial<UpdateStatusSnapshot>): void {
  status = {
    ...currentStatus(),
    ...patch,
    currentVersion: app.getVersion(),
    packaged: app.isPackaged,
    lastCheckSource,
  };
  broadcastStatus();
}

function broadcastStatus(): void {
  const snap = currentStatus();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.update.statusChanged, snap);
    }
  }
}

function bindUpdaterListeners(): void {
  if (listenersBound) return;
  listenersBound = true;

  autoUpdater.on("checking-for-update", () => {
    log.info("[update] checking-for-update", { currentVersion: app.getVersion(), source: lastCheckSource });
    setStatus({
      state: "checking",
      errorMessage: null,
      infoMessage: null,
      showPrompt: false,
      progress: null,
    });
  });

  autoUpdater.on("update-available", (info) => {
    log.info("[update] update-available", { version: info.version, currentVersion: app.getVersion() });
    setStatus({
      state: "available",
      availableVersion: info.version,
      releaseDate: info.releaseDate ?? null,
      releaseNotes: releaseNotesText(info.releaseNotes),
      showPrompt: true,
      infoMessage: null,
      errorMessage: null,
      progress: null,
    });
  });

  autoUpdater.on("update-not-available", (info) => {
    log.info("[update] update-not-available", {
      version: info?.version,
      currentVersion: app.getVersion(),
      source: lastCheckSource,
    });
    const manual = lastCheckSource === "manual";
    setStatus({
      state: "not-available",
      availableVersion: null,
      releaseDate: null,
      releaseNotes: null,
      showPrompt: false,
      infoMessage: manual ? "Programın en güncel sürümünü kullanıyorsunuz." : null,
      errorMessage: null,
      progress: null,
    });
  });

  autoUpdater.on("download-progress", (p) => {
    const progress: UpdateProgressInfo = {
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
      bytesPerSecond: p.bytesPerSecond,
    };
    log.info("[update] download-progress", {
      percent: Math.round(p.percent),
      transferred: p.transferred,
      total: p.total,
    });
    setStatus({
      state: "downloading",
      progress,
      showPrompt: true,
      errorMessage: null,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    downloadInProgress = false;
    log.info("[update] update-downloaded", { version: info.version, currentVersion: app.getVersion() });
    setStatus({
      state: "downloaded",
      availableVersion: info.version,
      releaseDate: info.releaseDate ?? null,
      releaseNotes: releaseNotesText(info.releaseNotes),
      progress: null,
      showPrompt: true,
      errorMessage: null,
      infoMessage: null,
    });
  });

  autoUpdater.on("error", (err) => {
    downloadInProgress = false;
    const summary = err?.message ? String(err.message).slice(0, 300) : "Güncelleme hatası";
    log.error("[update] error", { summary, currentVersion: app.getVersion(), source: lastCheckSource });
    const manual = lastCheckSource === "manual";
    setStatus({
      state: "error",
      errorMessage: manual ? summary : null,
      showPrompt: manual,
      infoMessage: null,
      progress: null,
    });
  });
}

function mockCheck(source: UpdateCheckSource): void {
  lastCheckSource = source;
  log.info("[update] mock check", { source, currentVersion: app.getVersion() });
  setStatus({ state: "checking", showPrompt: false, infoMessage: null, errorMessage: null });
  setTimeout(() => {
    if (process.env.MKD_UPDATE_MOCK_AVAILABLE === "1") {
      setStatus({
        state: "available",
        availableVersion: `${app.getVersion()}-mock`,
        releaseDate: new Date().toISOString(),
        releaseNotes: "Geliştirme mock sürüm notu.",
        showPrompt: true,
        infoMessage: null,
        errorMessage: null,
      });
      return;
    }
    const manual = source === "manual";
    setStatus({
      state: "not-available",
      showPrompt: false,
      infoMessage: manual ? "Programın en güncel sürümünü kullanıyorsunuz." : null,
      errorMessage: null,
    });
  }, 600);
}

export function getUpdateStatus(): UpdateStatusSnapshot {
  return {
    ...currentStatus(),
    currentVersion: app.getVersion(),
    packaged: app.isPackaged,
  };
}

export function dismissUpdatePrompt(): void {
  const s = currentStatus();
  setStatus({
    showPrompt: false,
    infoMessage: null,
    errorMessage: s.state === "error" ? null : s.errorMessage,
    state: s.state === "error" || s.state === "not-available" ? "idle" : s.state,
  });
}

export async function checkForUpdates(source: UpdateCheckSource): Promise<UpdateActionResult> {
  lastCheckSource = source;
  bindUpdaterListeners();

  if (!app.isPackaged) {
    if (process.env.MKD_UPDATE_MOCK === "1") {
      mockCheck(source);
      return { ok: true };
    }
    log.info("[update] skip check (not packaged)", { source });
    if (source === "manual") {
      setStatus({
        state: "not-available",
        showPrompt: false,
        infoMessage: "Programın en güncel sürümünü kullanıyorsunuz.",
        errorMessage: null,
      });
    }
    return { ok: true };
  }

  try {
    log.info("[update] check start", { currentVersion: app.getVersion(), source });
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    const summary = e instanceof Error ? e.message.slice(0, 300) : "Güncelleme kontrolü başarısız";
    log.error("[update] check failed", { summary, source });
    if (source === "manual") {
      setStatus({
        state: "error",
        errorMessage: summary,
        showPrompt: true,
        infoMessage: null,
      });
      return { ok: false, error: summary };
    }
    setStatus({
      state: "error",
      errorMessage: null,
      showPrompt: false,
      infoMessage: null,
    });
    return { ok: true };
  }
}

export async function downloadUpdate(): Promise<UpdateActionResult> {
  const s = currentStatus();
  if (downloadInProgress || s.state === "downloading") {
    return { ok: false, error: "İndirme zaten devam ediyor." };
  }
  if (s.state !== "available") {
    return { ok: false, error: "İndirilecek güncelleme yok." };
  }
  if (!app.isPackaged) {
    if (process.env.MKD_UPDATE_MOCK === "1") {
      downloadInProgress = true;
      setStatus({ state: "downloading", showPrompt: true, progress: { percent: 0, transferred: 0, total: 1, bytesPerSecond: 0 } });
      let pct = 0;
      const timer = setInterval(() => {
        pct += 25;
        setStatus({
          state: "downloading",
          showPrompt: true,
          progress: {
            percent: Math.min(pct, 100),
            transferred: Math.min(pct, 100) * 1024 * 100,
            total: 100 * 1024 * 100,
            bytesPerSecond: 512 * 1024,
          },
        });
        if (pct >= 100) {
          clearInterval(timer);
          downloadInProgress = false;
          setStatus({
            state: "downloaded",
            showPrompt: true,
            progress: null,
            availableVersion: currentStatus().availableVersion ?? `${app.getVersion()}-mock`,
          });
        }
      }, 400);
      return { ok: true };
    }
    return { ok: false, error: "Geliştirme sürümünde indirme yok." };
  }

  try {
    downloadInProgress = true;
    log.info("[update] download start", {
      currentVersion: app.getVersion(),
      availableVersion: currentStatus().availableVersion,
    });
    setStatus({ state: "downloading", showPrompt: true, errorMessage: null, progress: null });
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (e) {
    downloadInProgress = false;
    const summary = e instanceof Error ? e.message.slice(0, 300) : "İndirme başarısız";
    log.error("[update] download failed", { summary });
    setStatus({
      state: "error",
      errorMessage: summary,
      showPrompt: true,
      progress: null,
    });
    return { ok: false, error: summary };
  }
}

export async function installUpdate(): Promise<UpdateActionResult> {
  if (currentStatus().state !== "downloaded") {
    return { ok: false, error: "Kurulacak güncelleme yok." };
  }

  const from = app.getVersion();
  const to = currentStatus().availableVersion ?? "unknown";
  log.info("[update] install requested", { from, to });

  setStatus({
    state: "installing",
    showPrompt: true,
    errorMessage: null,
    infoMessage: null,
  });

  const backup = createPreUpdateBackup(from, to);
  if (!backup.ok) {
    log.error("[update] pre-update backup failed", { error: backup.error });
    setStatus({
      state: "downloaded",
      showPrompt: true,
      errorMessage:
        "Güncelleme öncesi veri yedeği oluşturulamadı. Verilerinizin güvenliği için güncelleme başlatılmadı.",
    });
    return {
      ok: false,
      error:
        "Güncelleme öncesi veri yedeği oluşturulamadı. Verilerinizin güvenliği için güncelleme başlatılmadı.",
    };
  }

  log.info("[update] pre-update backup ok", { path: backup.path, from, to });

  if (!app.isPackaged) {
    log.info("[update] mock install — quitAndInstall atlanıyor (unpackaged)");
    setStatus({
      state: "idle",
      showPrompt: false,
      infoMessage: "Mock: yedek alındı; geliştirme sürümünde kurulum yapılmaz.",
    });
    return { ok: true };
  }

  try {
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  } catch (e) {
    const summary = e instanceof Error ? e.message.slice(0, 300) : "Kurulum başlatılamadı";
    log.error("[update] quitAndInstall failed", { summary });
    setStatus({
      state: "downloaded",
      showPrompt: true,
      errorMessage: summary,
    });
    return { ok: false, error: summary };
  }
}

/** Ana pencere yüklendikten sonra bir kez otomatik kontrol planla. */
export function scheduleAutoUpdateCheck(delayMs = 5000): void {
  if (autoCheckScheduled) return;
  autoCheckScheduled = true;
  bindUpdaterListeners();
  status = emptyStatus();

  setTimeout(() => {
    if (autoCheckDone) return;
    autoCheckDone = true;
    void checkForUpdates("auto");
  }, delayMs);
}

export function initUpdateService(): void {
  bindUpdaterListeners();
  status = emptyStatus();
  log.info("[update] service init", { currentVersion: app.getVersion(), packaged: app.isPackaged });
}
