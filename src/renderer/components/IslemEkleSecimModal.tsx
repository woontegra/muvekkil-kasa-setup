type Props = {
  open: boolean;
  onClose: () => void;
  onAvans: () => void;
  onMasraf: () => void;
};

export function IslemEkleSecimModal({ open, onClose, onAvans, onMasraf }: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal modal-desk modal-desk--narrow" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>İşlem ekle</h2>
        </div>
        <div className="modal-body desk-islem-secim">
          <button
            type="button"
            className="btn btn-primary btn-sm desk-btn-block"
            onClick={() => {
              onClose();
              onAvans();
            }}
          >
            Avans girişi
          </button>
          <button
            type="button"
            className="btn btn-sm desk-btn-block"
            onClick={() => {
              onClose();
              onMasraf();
            }}
          >
            Masraf girişi
          </button>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm" onClick={onClose}>
            İptal
          </button>
        </div>
      </div>
    </div>
  );
}
