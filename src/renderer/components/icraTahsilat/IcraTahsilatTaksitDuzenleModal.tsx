import { useEffect, useState } from "react";
import type { IcraTahsilatTaksit } from "@shared/types/icraTahsilat";
import { parsePosTutar, formatCurrencyInputTR } from "../../lib/format";
import { DeskModalBackdrop } from "../DeskModalBackdrop";
import { MoneyInput } from "../MoneyInput";

type Props = {
  open: boolean;
  taksit: IcraTahsilatTaksit | null;
  onClose: () => void;
  onSaved: () => void;
};

export function IcraTahsilatTaksitDuzenleModal({ open, taksit, onClose, onSaved }: Props) {
  const [vade, setVade] = useState("");
  const [tutar, setTutar] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [kaydediyor, setKaydediyor] = useState(false);

  useEffect(() => {
    if (!open || !taksit) return;
    setVade(taksit.vadeTarihi ?? "");
    setTutar(formatCurrencyInputTR(taksit.tutar));
    setAciklama(taksit.aciklama ?? "");
  }, [open, taksit]);

  if (!open || !taksit) return null;

  const tamOdendi = taksit.odenenToplam >= taksit.tutar - 0.001;

  async function kaydet() {
    if (!taksit || kaydediyor) return;
    const tutarSayi = parsePosTutar(tutar);
    if (!tamOdendi && (tutarSayi == null || tutarSayi <= 0)) {
      alert("Geçerli taksit tutarı girin.");
      return;
    }
    setKaydediyor(true);
    try {
      const res = await window.api?.icraTahsilatTaksitGuncelle?.(taksit.id, {
        vadeTarihi: vade || null,
        tutar: tamOdendi ? undefined : tutarSayi ?? undefined,
        aciklama: aciklama.trim() || null,
      });
      if (!res?.ok) {
        alert(res?.error ?? "Taksit güncellenemedi");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setKaydediyor(false);
    }
  }

  return (
    <DeskModalBackdrop className="modal-backdrop desk-icra-submodal-backdrop" onClose={onClose}>
      <div
        className="modal modal-desk modal-desk--icra-taksit-duzenle"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="icra-taksit-duzenle-title"
      >
        <div className="modal-header desk-icra-submodal-header">
          <h2 id="icra-taksit-duzenle-title">Taksit düzenle</h2>
          <button type="button" className="desk-icra-detay-close" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        </div>
        <div className="modal-body desk-icra-submodal-body">
          <p className="desk-icra-submodal-meta">Taksit {taksit.taksitNo}</p>
          <label className="desk-form-field">
            <span>Vade tarihi</span>
            <input className="desk-input form-input" type="date" value={vade} onChange={(e) => setVade(e.target.value)} />
          </label>
          <label className="desk-form-field">
            <span>Taksit tutarı</span>
            <MoneyInput
              className="desk-input form-input desk-num"
              value={tutar}
              onChange={setTutar}
              readOnly={tamOdendi}
              disabled={tamOdendi}
            />
          </label>
          <label className="desk-form-field">
            <span>Açıklama</span>
            <input className="desk-input form-input" value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
          </label>
          {tamOdendi ? (
            <p className="desk-icra-taksit-duzenle-note">Tam ödenmiş taksitte yalnızca vade ve açıklama düzenlenebilir.</p>
          ) : null}
        </div>
        <div className="modal-foot desk-icra-submodal-foot">
          <div className="desk-modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={kaydediyor}>
              Vazgeç
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void kaydet()} disabled={kaydediyor}>
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </DeskModalBackdrop>
  );
}
