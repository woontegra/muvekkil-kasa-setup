import { useState } from "react";
import { Link } from "react-router-dom";
import type { Randevu } from "@shared/types/randevu";
import { formatDateTRLong, formatTimeTR } from "@shared/lib/randevuCalendar";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { PremiumButton } from "../PremiumButton";
import { PremiumConfirmDialog } from "../dosya/PremiumConfirmDialog";
import { PremiumModal } from "../modal/PremiumModal";

type Props = {
  open: boolean;
  randevu: Randevu;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
};

export function RandevuDetailModal({ open, randevu, onClose, onEdit, onDeleted }: Props) {
  const { showToast } = usePremiumToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const start = new Date(randevu.baslangicAt);
  const dateLabel = Number.isNaN(start.getTime()) ? "—" : formatDateTRLong(start);
  const aciklama = randevu.aciklama?.trim();

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const result = await window.api.randevuSil(randevu.id);
      if (!result.ok) {
        showToast("error", result.error);
        return;
      }
      showToast("success", "Randevu silindi.");
      onDeleted();
      onClose();
    } catch {
      showToast("error", "Randevu silinemedi.");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <PremiumModal
        open={open}
        title={randevu.baslik}
        subtitle={`${dateLabel} · ${formatTimeTR(randevu.baslangicAt)} – ${formatTimeTR(randevu.bitisAt)}`}
        onClose={onClose}
        disabled={deleting}
        panelClassName="pm-modal-panel--randevu-detail"
        footer={
          <>
            <PremiumButton type="button" variant="ghost" onClick={onClose} disabled={deleting}>
              Kapat
            </PremiumButton>
            <PremiumButton type="button" onClick={onEdit} disabled={deleting}>
              Düzenle
            </PremiumButton>
            <PremiumButton type="button" className="pm-btn--danger" onClick={() => setConfirmOpen(true)} disabled={deleting}>
              Sil
            </PremiumButton>
          </>
        }
      >
        <dl className="pm-randevu-detail-grid">
          <div className="pm-randevu-detail-field">
            <dt>Müvekkil</dt>
            <dd>
              {randevu.muvekkilId && randevu.muvekkilAd ? (
                <Link to={`/muvekkil/${randevu.muvekkilId}`}>{randevu.muvekkilAd}</Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="pm-randevu-detail-field">
            <dt>Dosya</dt>
            <dd>
              {randevu.dosyaId && randevu.dosyaBaslik && randevu.muvekkilId ? (
                <Link to={`/muvekkil/${randevu.muvekkilId}/dosya/${randevu.dosyaId}`}>{randevu.dosyaBaslik}</Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="pm-randevu-detail-field">
            <dt>Sorumlu</dt>
            <dd>{randevu.sorumluAdSoyad?.trim() || "—"}</dd>
          </div>
          <div className="pm-randevu-detail-field">
            <dt>Konum</dt>
            <dd>{randevu.konum?.trim() || "—"}</dd>
          </div>
        </dl>

        {aciklama ? (
          <div className="pm-randevu-detail-note" style={{ marginTop: 16 }}>
            <h4>Açıklama</h4>
            <p>{aciklama}</p>
          </div>
        ) : null}
      </PremiumModal>

      <PremiumConfirmDialog
        open={confirmOpen}
        title="Randevuyu sil"
        message="Bu randevuyu silmek istediğinize emin misiniz?"
        confirmLabel="Sil"
        variant="danger"
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
