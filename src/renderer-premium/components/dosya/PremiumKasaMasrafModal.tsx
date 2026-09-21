import { useEffect, useState, type FormEvent } from "react";
import {
  DIGER_MASRAF_ETIKETI,
  DIGER_ODEME_YONTEMI_ETIKETI,
  MASRAF_ODEME_YONTEMI_SECENEKLERI,
} from "@shared/constants/kasa";
import type { KasaHareket } from "@shared/types/kasa";
import { bugunYmd, formatCurrencyInputTR, parsePosTutar } from "../../lib/format";
import {
  masrafDuzenlemeSelectDiger,
  masrafKayitTuruFromForm,
  masrafOdemeFormFromKayit,
  masrafOdemeKayitDegeri,
} from "../../lib/kasa";
import { MoneyInput } from "../MoneyInput";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = {
  open: boolean;
  saving: boolean;
  error: string | null;
  masrafTurleri: string[];
  editHareket?: KasaHareket | null;
  onClose: () => void;
  onSave: (data: {
    tarih: string;
    tutar: number;
    odemeYontemi: string;
    masrafTuru: string;
    aciklama: string | null;
  }) => Promise<void>;
};

export function PremiumKasaMasrafModal({
  open,
  saving,
  error,
  masrafTurleri,
  editHareket,
  onClose,
  onSave,
}: Props) {
  const [tarih, setTarih] = useState(bugunYmd());
  const [tutar, setTutar] = useState("");
  const [odemeSelect, setOdemeSelect] = useState<string>("Nakit");
  const [odemeDiger, setOdemeDiger] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [masrafTuru, setMasrafTuru] = useState("");
  const [masrafDiger, setMasrafDiger] = useState("");
  const [aciklama, setAciklama] = useState("");

  useEffect(() => {
    if (!open) return;
    setLocalErr(null);
    if (editHareket) {
      const { select, diger } = masrafDuzenlemeSelectDiger(editHareket.masrafTuru, masrafTurleri);
      setMasrafTuru(select);
      setMasrafDiger(diger);
      setTutar(formatCurrencyInputTR(editHareket.tutar));
      const tr = (editHareket.tarih ?? "").trim();
      setTarih(tr.length >= 10 ? tr.slice(0, 10) : bugunYmd());
      const odemeForm = masrafOdemeFormFromKayit(editHareket.odemeYontemi);
      setOdemeSelect(odemeForm.select);
      setOdemeDiger(odemeForm.diger);
      setAciklama(editHareket.aciklama ?? "");
    } else {
      setTarih(bugunYmd());
      setTutar("");
      setOdemeSelect("Nakit");
      setOdemeDiger("");
      setMasrafTuru(masrafTurleri[0] ?? DIGER_MASRAF_ETIKETI);
      setMasrafDiger("");
      setAciklama("");
    }
  }, [open, editHareket, masrafTurleri]);

  function odemeSecildi(value: string) {
    setOdemeSelect(value);
    setLocalErr(null);
    if (value !== DIGER_ODEME_YONTEMI_ETIKETI) setOdemeDiger("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setLocalErr(null);
    const kayitTuru = masrafKayitTuruFromForm(masrafTuru, masrafDiger);
    if (!kayitTuru) return;
    const t = parsePosTutar(tutar);
    if (t == null) return;
    const odemeKayit = masrafOdemeKayitDegeri(odemeSelect, odemeDiger);
    if (!odemeKayit) {
      setLocalErr("Diğer ödeme yöntemini yazın.");
      return;
    }
    await onSave({
      tarih,
      tutar: t,
      odemeYontemi: odemeKayit,
      masrafTuru: kayitTuru,
      aciklama: aciklama.trim() || null,
    });
  }

  const baslik = editHareket ? "Masrafı düzenle" : "Masraf girişi";
  const gosterilenHata = localErr ?? error;

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
          <PremiumButton type="submit" form="pm-form-masraf" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </PremiumButton>
        </>
      }
    >
      {gosterilenHata ? <p className="pm-form-error">{gosterilenHata}</p> : null}
      <form id="pm-form-masraf" className="pm-form-stack" onSubmit={(e) => void handleSubmit(e)}>
        <div className="pm-field">
          <label htmlFor="pm-masraf-tarih">Tarih</label>
          <input
            id="pm-masraf-tarih"
            type="date"
            className="pm-input"
            value={tarih}
            onChange={(e) => setTarih(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="pm-field">
          <label htmlFor="pm-masraf-tur">Masraf türü *</label>
          <select
            id="pm-masraf-tur"
            className="pm-input"
            value={masrafTuru}
            onChange={(e) => setMasrafTuru(e.target.value)}
            disabled={saving}
          >
            {masrafTurleri.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        {masrafTuru === DIGER_MASRAF_ETIKETI ? (
          <div className="pm-field">
            <label htmlFor="pm-masraf-diger">Diğer masraf adı *</label>
            <input
              id="pm-masraf-diger"
              className="pm-input"
              value={masrafDiger}
              onChange={(e) => setMasrafDiger(e.target.value)}
              disabled={saving}
            />
          </div>
        ) : null}
        <div className="pm-field">
          <label htmlFor="pm-masraf-tutar">Tutar *</label>
          <MoneyInput id="pm-masraf-tutar" value={tutar} onChange={setTutar} disabled={saving} />
        </div>
        <div className="pm-field">
          <label htmlFor="pm-masraf-odeme">Ödeme yöntemi</label>
          <select
            id="pm-masraf-odeme"
            className="pm-input"
            value={odemeSelect}
            onChange={(e) => odemeSecildi(e.target.value)}
            disabled={saving}
          >
            {MASRAF_ODEME_YONTEMI_SECENEKLERI.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        {odemeSelect === DIGER_ODEME_YONTEMI_ETIKETI ? (
          <div className="pm-field">
            <label htmlFor="pm-masraf-odeme-diger">Diğer ödeme yöntemi *</label>
            <input
              id="pm-masraf-odeme-diger"
              className="pm-input"
              value={odemeDiger}
              placeholder="Ödeme yöntemini yazın"
              disabled={saving}
              onChange={(e) => {
                setOdemeDiger(e.target.value);
                setLocalErr(null);
              }}
            />
          </div>
        ) : null}
        <div className="pm-field">
          <label htmlFor="pm-masraf-aciklama">Açıklama</label>
          <textarea
            id="pm-masraf-aciklama"
            className="pm-input"
            rows={2}
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            disabled={saving}
          />
        </div>
        {!editHareket ? (
          <p className="pm-form-hint">Belge no kayıt sırasında otomatik üretilir (MSF-YYYY-######).</p>
        ) : null}
      </form>
    </PremiumModal>
  );
}
