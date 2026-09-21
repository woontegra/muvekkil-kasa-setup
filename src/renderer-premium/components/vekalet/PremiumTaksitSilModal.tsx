import type { VekaletTaksit } from "@shared/types/vekalet";
import { formatDateTr, formatTry } from "../../lib/format";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = {
  open: boolean;
  saving: boolean;
  error: string | null;
  taksit: VekaletTaksit;
  onClose: () => void;
  onConfirm: () => void;
};

export function PremiumTaksitSilModal({ open, saving, error, taksit, onClose, onConfirm }: Props) {
  return (
    <PremiumModal
      open={open}
      title="Taksiti sil"
      onClose={onClose}
      disabled={saving}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
            İptal
          </PremiumButton>
          <PremiumButton
            type="button"
            className="pm-btn--danger"
            onClick={onConfirm}
            disabled={saving}
            data-testid="vekalet-taksit-sil-onay"
          >
            {saving ? "Siliniyor…" : "Sil"}
          </PremiumButton>
        </>
      }
    >
      {error ? <p className="pm-form-error">{error}</p> : null}
      <p>
        <strong>#{taksit.taksitNo}</strong> numaralı taksiti ({formatTry(taksit.tutar)}, vade{" "}
        {formatDateTr(taksit.vadeTarihi)}) silmek istediğinize emin misiniz?
      </p>
      <p className="pm-form-hint">Bu işlem geri alınamaz.</p>
    </PremiumModal>
  );
}
