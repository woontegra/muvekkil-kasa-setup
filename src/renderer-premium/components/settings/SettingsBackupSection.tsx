import { useRef, useState } from "react";
import { PremiumButton } from "../PremiumButton";
import { PremiumConfirmDialog } from "../dosya/PremiumConfirmDialog";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { SettingsSectionFrame } from "./SettingsSectionFrame";

export function SettingsBackupSection() {
  const { showToast } = usePremiumToast();
  const [busy, setBusy] = useState(false);
  const [lastPath, setLastPath] = useState<string | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const busyRef = useRef(false);

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
      if (!r.ok) {
        if (!r.error.includes("iptal")) {
          showToast("error", r.error);
        }
        return;
      }
      showToast(
        "success",
        `Geri yükleme tamamlandı. Önceki veritabanı yedeği: ${r.autoBackupPath}. Değişikliklerin tam yansıması için programı yeniden başlatmanız önerilir.`,
      );
    } catch {
      showToast("error", "Geri yükleme başarısız.");
    } finally {
      setBusy(false);
      busyRef.current = false;
      setRestoreOpen(false);
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
    </>
  );
}
