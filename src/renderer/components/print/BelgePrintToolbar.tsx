import type { YaziciInfo } from "@shared/types/print";

type Props = {
  yazicilar: YaziciInfo[];
  seciliYazici: string;
  onYaziciChange: (name: string) => void;
  onPrint: () => void;
  onClose: () => void;
  printDisabled?: boolean;
  closeDisabled?: boolean;
  printLabel?: string;
  mesaj?: string | null;
};

export function BelgePrintToolbar({
  yazicilar,
  seciliYazici,
  onYaziciChange,
  onPrint,
  onClose,
  printDisabled,
  closeDisabled,
  printLabel = "Yazdır",
  mesaj,
}: Props) {
  return (
    <div className="belge-print-toolbar">
      <div className="belge-print-toolbar-left">
        <label className="belge-print-yazici-label">
          Yazıcı
          <select
            className="belge-print-yazici-select"
            value={seciliYazici}
            onChange={(e) => onYaziciChange(e.target.value)}
            disabled={printDisabled || yazicilar.length === 0}
          >
            {yazicilar.length === 0 ? <option value="">Yazıcı bulunamadı</option> : null}
            {yazicilar.map((y) => (
              <option key={y.name} value={y.name}>
                {y.displayName}
                {y.isDefault ? " (varsayılan)" : ""}
              </option>
            ))}
          </select>
        </label>
        {mesaj ? <span className="belge-print-ok-msg">{mesaj}</span> : null}
      </div>
      <div className="belge-print-toolbar-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onPrint} disabled={printDisabled}>
          {printLabel}
        </button>
        <button type="button" className="btn btn-sm" onClick={onClose} disabled={closeDisabled}>
          Kapat
        </button>
      </div>
    </div>
  );
}
