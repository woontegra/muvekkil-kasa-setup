import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { TaksitGuncelleInput, VekaletTaksit } from "@shared/types/vekalet";
import { kurusBuyuktur } from "@shared/lib/moneyKurus";
import { formatCurrencyInputTR, formatTry, parsePosTutar } from "../../lib/format";
import { taksitMaxTutar } from "../../lib/vekalet";
import { MoneyInput } from "../MoneyInput";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = {
  open: boolean;
  saving: boolean;
  error: string | null;
  taksit: VekaletTaksit;
  anlasilanTutar: number;
  taksitler: VekaletTaksit[];
  onClose: () => void;
  onSave: (id: number, patch: TaksitGuncelleInput) => Promise<void>;
};

export function PremiumTaksitDuzenleModal({
  open,
  saving,
  error,
  taksit,
  anlasilanTutar,
  taksitler,
  onClose,
  onSave,
}: Props) {
  const odemeVar = taksit.odenenToplam > 0.005;
  const maxTutar = useMemo(
    () => taksitMaxTutar(anlasilanTutar, taksitler, taksit.id),
    [anlasilanTutar, taksitler, taksit.id],
  );

  const [tutar, setTutar] = useState(formatCurrencyInputTR(taksit.tutar));
  const [vade, setVade] = useState((taksit.vadeTarihi ?? "").slice(0, 10));
  const [aciklama, setAciklama] = useState(taksit.aciklama ?? "");
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTutar(formatCurrencyInputTR(taksit.tutar));
    setVade((taksit.vadeTarihi ?? "").slice(0, 10));
    setAciklama(taksit.aciklama ?? "");
    setLocalErr(null);
  }, [open, taksit]);

  const gosterilenHata = localErr ?? error;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setLocalErr(null);

    const patch: TaksitGuncelleInput = {
      aciklama: aciklama.trim() || null,
    };

    if (!odemeVar) {
      const t = parsePosTutar(tutar);
      if (t == null) {
        setLocalErr("Geçerli taksit tutarı girin.");
        return;
      }
      if (t < taksit.odenenToplam - 0.001) {
        setLocalErr("Taksit tutarı ödenen tutardan küçük olamaz.");
        return;
      }
      if (kurusBuyuktur(t, maxTutar)) {
        setLocalErr(`Taksit tutarı, taksitlendirilebilir kalan ${formatTry(maxTutar)} tutarını aşamaz.`);
        return;
      }
      patch.tutar = t;
      patch.vadeTarihi = vade.trim() || null;
    }

    await onSave(taksit.id, patch);
  }

  return (
    <PremiumModal
      open={open}
      title={`Taksit #${taksit.taksitNo} — düzenle`}
      onClose={onClose}
      disabled={saving}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
            İptal
          </PremiumButton>
          <PremiumButton type="submit" form="pm-form-taksit-duzenle" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </PremiumButton>
        </>
      }
    >
      {gosterilenHata ? <p className="pm-form-error">{gosterilenHata}</p> : null}
      {odemeVar ? (
        <p className="pm-form-hint">
          Bu taksitte ödeme kaydı bulunduğu için tutar ve vade alanları kilitlidir. Yalnızca açıklama düzenlenebilir.
        </p>
      ) : (
        <p className="pm-vekalet-kalan-hint">
          En fazla taksit tutarı: <strong>{formatTry(maxTutar)}</strong>
        </p>
      )}
      <form id="pm-form-taksit-duzenle" className="pm-form-stack" onSubmit={(e) => void handleSubmit(e)}>
        <div className="pm-field">
          <label htmlFor="pm-td-tutar">Taksit tutarı *</label>
          <MoneyInput id="pm-td-tutar" value={tutar} onChange={setTutar} disabled={saving || odemeVar} />
        </div>
        <div className="pm-field">
          <label htmlFor="pm-td-vade">Vade tarihi</label>
          <input
            id="pm-td-vade"
            type="date"
            className="pm-input"
            value={vade}
            onChange={(e) => setVade(e.target.value)}
            disabled={saving || odemeVar}
          />
        </div>
        <div className="pm-field">
          <label htmlFor="pm-td-aciklama">Açıklama</label>
          <textarea
            id="pm-td-aciklama"
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
