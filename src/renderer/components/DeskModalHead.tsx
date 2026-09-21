type Props = {
  title: string;
  onClose?: () => void;
  closeDisabled?: boolean;
  className?: string;
  titleId?: string;
};

/** Sunumsal modal başlık çubuğu — başlık solda, X sağda */
export function DeskModalHead({ title, onClose, closeDisabled, className, titleId }: Props) {
  const headClass = className ? `modal-head ${className}` : "modal-head";
  return (
    <div className={headClass}>
      <h2 id={titleId}>{title}</h2>
      {onClose ? (
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          disabled={closeDisabled}
          aria-label="Kapat"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
