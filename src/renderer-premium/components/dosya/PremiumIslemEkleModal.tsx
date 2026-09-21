import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = {
  open: boolean;
  onClose: () => void;
  onAvans: () => void;
  onMasraf: () => void;
};

export function PremiumIslemEkleModal({ open, onClose, onAvans, onMasraf }: Props) {
  return (
    <PremiumModal
      open={open}
      title="İşlem ekle"
      onClose={onClose}
      footer={
        <PremiumButton type="button" variant="ghost" onClick={onClose}>
          İptal
        </PremiumButton>
      }
    >
      <div className="pm-islem-secim">
        <button
          type="button"
          className="pm-islem-secim-btn pm-islem-secim-btn--primary"
          onClick={() => {
            onClose();
            onAvans();
          }}
        >
          <span className="pm-islem-secim-icon" aria-hidden>
            ↓
          </span>
          <span>
            <strong>Avans girişi</strong>
            <small>Müvekkilden dosya kasasına avans tahsilatı</small>
          </span>
        </button>
        <button
          type="button"
          className="pm-islem-secim-btn"
          onClick={() => {
            onClose();
            onMasraf();
          }}
        >
          <span className="pm-islem-secim-icon" aria-hidden>
            ↑
          </span>
          <span>
            <strong>Masraf girişi</strong>
            <small>Dosya masrafı ve harcama kaydı</small>
          </span>
        </button>
      </div>
    </PremiumModal>
  );
}
