import { useRef, useState } from "react";
import { PremiumButton } from "../PremiumButton";
import { PremiumConfirmDialog } from "../dosya/PremiumConfirmDialog";
import { usePremiumAuth } from "../../context/PremiumAuthContext";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { SettingsSectionFrame } from "./SettingsSectionFrame";
import { RestoreSecretModal } from "./BackupSecretDialogs";

export function SettingsBackupSection() {
  const { showToast } = usePremiumToast();
  const { refresh: refreshAuth } = usePremiumAuth();
  const [busy, setBusy] = useState(false);
  const [lastPath, setLastPath] = useState<string | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [secretReq, setSecretReq] = useState<{ token: string; fileName: string | null; error: string | null } | null>(
    null,
  );
  const busyRef = useRef(false);

  async function restoreDone(r: { autoBackupPath: string; restart?: "restarting" | "later" | "manual" }) {
    showToast(
      "success",
      r.restart === "restarting"
        ? "Geri yükleme tamamlandı. Program yeniden başlatılıyor…"
        : `Geri yükleme tamamlandı. Önceki veritabanı yedeği: ${r.autoBackupPath}. Güvenlik için oturum kapatıldı; lütfen yeniden giriş yapın.`,
    );
    await refreshAuth().catch(() => window.location.reload());
  }

  async function yedekAl() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await window.api.backupAl();
      if (!r.ok) {
        if (!r.error.includes("iptal")) {
          showToast("error", r.error);
        }
        return;
      }
      setLastPath(r.path);
      showToast("success", "Veri yedeği başarıyla oluşturuldu.");
    } catch {
      showToast("error", "Yedek alınamadı.");
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  async function yedektenGeriYukle() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await window.api.backupGeriYukle();
      if (r.ok) {
        await restoreDone(r);
        return;
      }
      if (r.needsSecret && r.token) {
        setSecretReq({ token: r.token, fileName: r.fileName ?? null, error: null });
        return;
      }
      if (!r.error.includes("iptal")) showToast("error", r.error);
    } catch {
      showToast("error", "Geri yükleme başarısız.");
    } finally {
      setBusy(false);
      busyRef.current = false;
      setRestoreOpen(false);
    }
  }

  async function sifreliGeriYukle(secret: { password: string } | { recoveryKey: string }) {
    if (busyRef.current || !secretReq) return;
    busyRef.current = true;
    setBusy(true);
    const token = secretReq.token;
    try {
      const r = await window.api.backupGeriYukle({ token, ...secret });
      if (r.ok) {
        setSecretReq(null);
        await restoreDone(r);
        return;
      }
      if (r.needsSecret && r.token) {
        setSecretReq({ token: r.token, fileName: r.fileName ?? secretReq.fileName, error: r.error });
        return;
      }
      setSecretReq(null);
      showToast("error", r.error);
    } catch {
      setSecretReq(null);
      showToast("error", "Geri yükleme başarısız.");
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  return (
    <>
      <SettingsSectionFrame
        title="Veri Yedekleme"
        description="Yedekleme, programdaki müvekkil, dosya, kasa, makbuz, vekalet ve taksit kayıtlarını güvenli bir dosyaya kopyalar."
      >
        <div className="pm-settings-backup-panel">
          {busy ? (
            <div className="pm-settings-backup-progress" aria-live="polite">
              <div className="pm-settings-backup-progress-bar" />
              <span>İşlem devam ediyor…</span>
            </div>
          ) : null}
          <div className="pm-settings-backup-actions pm-stagger-item">
            <PremiumButton type="button" onClick={() => void yedekAl()} disabled={busy}>
              Manuel yedek oluştur
            </PremiumButton>
            <PremiumButton type="button" variant="ghost" onClick={() => setRestoreOpen(true)} disabled={busy}>
              Yedekten geri yükle
            </PremiumButton>
          </div>
          {lastPath ? (
            <p className="pm-settings-backup-path pm-stagger-item">
              <span className="pm-settings-backup-path-label">Son yedek:</span>
              <code>{lastPath}</code>
            </p>
          ) : null}
        </div>
      </SettingsSectionFrame>

      <PremiumConfirmDialog
        open={restoreOpen}
        title="Yedekten geri yükle"
        message={
          "Seçilen yedek dosyası mevcut veritabanının üzerine yazılacaktır.\n\n" +
          "İşlem öncesi mevcut veritabanının otomatik yedeği alınır.\n\n" +
          "Devam etmek istiyor musunuz?"
        }
        variant="danger"
        confirmLabel="Geri yükle"
        busy={busy}
        onConfirm={() => void yedektenGeriYukle()}
        onCancel={() => setRestoreOpen(false)}
      />

      <RestoreSecretModal
        open={secretReq !== null}
        fileName={secretReq?.fileName ?? null}
        busy={busy}
        error={secretReq?.error ?? null}
        onSubmit={(s) => void sifreliGeriYukle(s)}
        onCancel={() => setSecretReq(null)}
      />
    </>
  );
}
