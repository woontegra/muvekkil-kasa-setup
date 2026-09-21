import { formatTry } from "../../lib/format";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = {
  open: boolean;
  saving: boolean;
  error: string | null;
  taksitSayisi: number;
  taksitToplam: number;
  odenenToplam: number;
  onClose: () => void;
  onConfirm: () => void;
};

export function PremiumTaksitTopluSilModal({
  open,
  saving,
  error,
  taksitSayisi,
  taksitToplam,
  odenenToplam,
  onClose,
  onConfirm,
}: Props) {
  return (
    <PremiumModal
      open={open}
      title="Tüm taksitleri sil"
      onClose={onClose}
      disabled={saving}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
            İptal
          </PremiumButton>
          <PremiumButton type="button" className="pm-btn--danger" onClick={onConfirm} disabled={saving}>
            {saving ? "Siliniyor…" : "Tümünü sil"}
          </PremiumButton>
        </>
      }
    >
      {error ? <p className="pm-form-error">{error}</p> : null}
      <p className="pm-vekalet-sil-uyari">
        Bu işlem {taksitSayisi} taksitin tamamını silecektir. Bu işlem geri alınamaz.
      </p>
      <div className="pm-vekalet-sil-ozet">
        <div className="pm-vekalet-sil-ozet-row">
          <span>Taksit sayısı</span>
          <strong>{taksitSayisi}</strong>
        </div>
        <div className="pm-vekalet-sil-ozet-row">
          <span>Taksitlerin toplam tutarı</span>
          <strong>{formatTry(taksitToplam)}</strong>
        </div>
        <div className="pm-vekalet-sil-ozet-row">
          <span>Ödenen toplam</span>
          <strong>{formatTry(odenenToplam)}</strong>
        </div>
      </div>
    </PremiumModal>
  );
}
