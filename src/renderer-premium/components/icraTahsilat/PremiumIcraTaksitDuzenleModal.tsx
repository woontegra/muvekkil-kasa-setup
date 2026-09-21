import { useEffect, useState } from "react";
import type { IcraTahsilatTaksit } from "@shared/types/icraTahsilat";
import { parsePosTutar, formatCurrencyInputTR } from "../../lib/format";
import { MoneyInput } from "../MoneyInput";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = {
  open: boolean;
  taksit: IcraTahsilatTaksit | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
};

export function PremiumIcraTaksitDuzenleModal({ open, taksit, onClose, onSaved, onError }: Props) {
  const [vade, setVade] = useState("");
  const [tutar, setTutar] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [kaydediyor, setKaydediyor] = useState(false);

  useEffect(() => {
    if (!open || !taksit) return;
    setVade(taksit.vadeTarihi ?? "");
    setTutar(formatCurrencyInputTR(taksit.tutar));
    setAciklama(taksit.aciklama ?? "");
    setFormErr(null);
  }, [open, taksit]);

  const tamOdendi = taksit != null && taksit.odenenToplam >= taksit.tutar - 0.001;

  async function kaydet() {
    if (!taksit || kaydediyor) return;
    setFormErr(null);
    const tutarSayi = parsePosTutar(tutar);
    if (!tamOdendi && (tutarSayi == null || tutarSayi <= 0)) {
      setFormErr("Geçerli taksit tutarı girin.");
      return;
    }
    setKaydediyor(true);
    try {
      const res = await window.api.icraTahsilatTaksitGuncelle(taksit.id, {
        vadeTarihi: vade || null,
        tutar: tamOdendi ? undefined : tutarSayi ?? undefined,
        aciklama: aciklama.trim() || null,
      });
      if (!res.ok) {
        const msg = res.error ?? "Taksit güncellenemedi";
        setFormErr(msg);
        onError(msg);
        return;
      }
      onSaved();
      onClose();
    } catch {
      const msg = "Taksit güncellenemedi";
      setFormErr(msg);
      onError(msg);
    } finally {
      setKaydediyor(false);
    }
  }

  return (
    <PremiumModal
      open={open && taksit != null}
      title="Taksit düzenle"
      disabled={kaydediyor}
      onClose={onClose}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onClose} disabled={kaydediyor}>
            Vazgeç
          </PremiumButton>
          <PremiumButton type="button" onClick={() => void kaydet()} disabled={kaydediyor}>
            {kaydediyor ? "Kaydediliyor…" : "Kaydet"}
          </PremiumButton>
        </>
      }
    >
      {taksit ? (
        <>
          <p className="pm-icra-submodal-meta">Taksit {taksit.taksitNo}</p>
          {formErr ? <p className="pm-form-error">{formErr}</p> : null}
          <div className="pm-form-grid pm-icra-form-grid">
            <div className="pm-field">
              <label htmlFor="pm-icra-duz-vade">Vade tarihi</label>
              <input
                id="pm-icra-duz-vade"
                className="pm-input"
                type="date"
                value={vade}
                onChange={(e) => setVade(e.target.value)}
              />
            </div>
            <div className="pm-field">
              <label htmlFor="pm-icra-duz-tutar">Taksit tutarı</label>
              <MoneyInput
                id="pm-icra-duz-tutar"
                value={tutar}
                onChange={setTutar}
                readOnly={tamOdendi}
                disabled={tamOdendi}
              />
            </div>
            <div className="pm-field pm-form-span2">
              <label htmlFor="pm-icra-duz-aciklama">Açıklama</label>
              <input
                id="pm-icra-duz-aciklama"
                className="pm-input"
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
              />
            </div>
          </div>
          {tamOdendi ? (
            <p className="pm-icra-duzenle-note">Tam ödenmiş taksitte yalnızca vade ve açıklama düzenlenebilir.</p>
          ) : null}
        </>
      ) : null}
    </PremiumModal>
  );
}
