import { useEffect, useState, type FormEvent } from "react";
import type { VekaletUcreti } from "@shared/types/vekalet";
import { formatCurrencyInputTR, parsePosTutar } from "../../lib/format";
import { MoneyInput } from "../MoneyInput";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";
import type { ParaBirimi } from "@shared/lib/paraBirimi";
import { ParaBirimiSelect } from "../currency/CurrencyFields";

type Props = {
  open: boolean;
  saving: boolean;
  error: string | null;
  initial: VekaletUcreti;
  onClose: () => void;
  onSave: (tutar: number, paraBirimi: ParaBirimi, aciklama: string | null) => Promise<void>;
};

export function PremiumVekaletUcretModal({ open, saving, error, initial, onClose, onSave }: Props) {
  const [tutar, setTutar] = useState(
    initial.anlasilanTutar > 0 ? formatCurrencyInputTR(initial.anlasilanTutar) : "",
  );
  const [aciklama, setAciklama] = useState(initial.aciklama ?? "");
  const [paraBirimi, setParaBirimi] = useState<ParaBirimi>(initial.paraBirimi ?? "TRY");

  useEffect(() => {
    if (!open) return;
    setTutar(initial.anlasilanTutar > 0 ? formatCurrencyInputTR(initial.anlasilanTutar) : "");
    setAciklama(initial.aciklama ?? "");
    setParaBirimi(initial.paraBirimi ?? "TRY");
  }, [open, initial]);

  const baslik = initial.anlasilanTutar > 0 ? "Vekalet ücreti düzenle" : "Vekalet ücreti tanımla";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const t = parsePosTutar(tutar);
    if (t == null) return;
    await onSave(t, paraBirimi, aciklama.trim() || null);
  }

  return (
    <PremiumModal
      open={open}
      title={baslik}
      onClose={onClose}
      disabled={saving}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
            İptal
          </PremiumButton>
          <PremiumButton type="submit" form="pm-form-vekalet-ucret" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </PremiumButton>
        </>
      }
    >
      {error ? <p className="pm-form-error">{error}</p> : null}
      <form id="pm-form-vekalet-ucret" className="pm-form-stack" onSubmit={(e) => void handleSubmit(e)}>
        <div className="pm-field">
          <label htmlFor="pm-vu-tutar">Anlaşılan tutar *</label>
          <MoneyInput id="pm-vu-tutar" value={tutar} onChange={setTutar} disabled={saving} />
        </div>
        <div className="pm-field">
          <label htmlFor="pm-vu-pb">Para birimi</label>
          <ParaBirimiSelect id="pm-vu-pb" value={paraBirimi} onChange={setParaBirimi} disabled={saving || initial.anlasilanTutar > 0} />
        </div>
        <div className="pm-field">
          <label htmlFor="pm-vu-aciklama">Açıklama</label>
          <textarea
            id="pm-vu-aciklama"
            className="pm-input"
            rows={2}
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            disabled={saving}
          />
        </div>
      </form>
    </PremiumModal>
  );
}
