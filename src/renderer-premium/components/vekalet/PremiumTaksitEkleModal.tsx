import { useEffect, useState, type FormEvent } from "react";
import type { TaksitEkleInput } from "@shared/types/vekalet";
import { kurusBuyuktur } from "@shared/lib/moneyKurus";
import { bugunYmd, formatTry, parsePosTutar } from "../../lib/format";
import { MoneyInput } from "../MoneyInput";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = {
  open: boolean;
  saving: boolean;
  error: string | null;
  kalanTaksitlendirme: number;
  onClose: () => void;
  onSave: (input: TaksitEkleInput) => Promise<void>;
  onPlanOlustur?: () => void;
};

export function PremiumTaksitEkleModal({
  open,
  saving,
  error,
  kalanTaksitlendirme,
  onClose,
  onSave,
  onPlanOlustur,
}: Props) {
  const [tutar, setTutar] = useState("");
  const [vade, setVade] = useState(bugunYmd());
  const [aciklama, setAciklama] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTutar("");
    setVade(bugunYmd());
    setAciklama("");
    setLocalErr(null);
  }, [open]);

  const kalanYok = kalanTaksitlendirme <= 0;
  const gosterilenHata = localErr ?? error;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setLocalErr(null);
    if (kalanYok) {
      setLocalErr("Taksitlendirilebilir tutar kalmadı.");
      return;
    }
    const t = parsePosTutar(tutar);
    if (t == null) {
      setLocalErr("Geçerli taksit tutarı girin.");
      return;
    }
    if (kurusBuyuktur(t, kalanTaksitlendirme)) {
      setLocalErr(`Taksit tutarı, taksitlendirilebilir kalan ${formatTry(kalanTaksitlendirme)} tutarını aşamaz.`);
      return;
    }
    await onSave({ tutar: t, vadeTarihi: vade, aciklama: aciklama.trim() || null });
  }

  return (
    <PremiumModal
      open={open}
      title="Taksit ekle"
      onClose={onClose}
      disabled={saving}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
            İptal
          </PremiumButton>
          <PremiumButton type="submit" form="pm-form-taksit-ekle" disabled={saving || kalanYok}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </PremiumButton>
        </>
      }
    >
      {gosterilenHata ? <p className="pm-form-error">{gosterilenHata}</p> : null}
      {kalanYok ? (
        <p className="pm-form-error">Taksitlendirilebilir tutar kalmadı.</p>
      ) : (
        <p className="pm-vekalet-kalan-hint">
          Taksitlendirilebilir kalan: <strong>{formatTry(kalanTaksitlendirme)}</strong>
        </p>
      )}
      <form id="pm-form-taksit-ekle" className="pm-form-stack" onSubmit={(e) => void handleSubmit(e)}>
        <div className="pm-field">
          <label htmlFor="pm-te-tutar">Taksit tutarı *</label>
          <MoneyInput
            id="pm-te-tutar"
            value={tutar}
            onChange={(v) => {
              setLocalErr(null);
              setTutar(v);
            }}
            disabled={saving || kalanYok}
          />
        </div>
        <div className="pm-field">
          <label htmlFor="pm-te-vade">Vade tarihi</label>
          <input
            id="pm-te-vade"
            type="date"
            className="pm-input"
            value={vade}
            onChange={(e) => setVade(e.target.value)}
            disabled={saving || kalanYok}
          />
        </div>
        <div className="pm-field">
          <label htmlFor="pm-te-aciklama">Açıklama</label>
          <textarea
            id="pm-te-aciklama"
            className="pm-input"
            rows={2}
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            disabled={saving || kalanYok}
          />
        </div>
        {onPlanOlustur ? (
          <p className="pm-form-hint">
            Birden fazla taksit mi?{" "}
            <button type="button" className="pm-link-btn" onClick={onPlanOlustur} disabled={saving || kalanYok}>
              Taksit planı oluştur
            </button>
          </p>
        ) : null}
      </form>
    </PremiumModal>
  );
}
