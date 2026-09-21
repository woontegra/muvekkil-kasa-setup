import { useEffect, useState } from "react";
import {
  DIGER_MASRAF_ETIKETI,
  DIGER_ODEME_YONTEMI_ETIKETI,
  MASRAF_ODEME_YONTEMI_SECENEKLERI,
} from "@shared/constants/kasa";
import type { KasaHareket } from "@shared/types/kasa";
import { bugunYmd, parsePosTutar, formatCurrencyInputTR } from "../lib/format";
import { DeskModalBackdrop } from "./DeskModalBackdrop";
import { DeskModalPortal } from "./DeskModalPortal";
import { DeskModalHead } from "./DeskModalHead";
import { MoneyInput } from "./MoneyInput";
import {
  masrafDuzenlemeSelectDiger,
  masrafKayitTuruFromForm,
  masrafOdemeFormFromKayit,
  masrafOdemeKayitDegeri,
} from "../lib/kasa";

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

export function KasaMasrafModal({ open, saving, error, masrafTurleri, editHareket, onClose, onSave }: Props) {
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

  if (!open) return null;

  function odemeSecildi(value: string) {
    setOdemeSelect(value);
    setLocalErr(null);
    if (value !== DIGER_ODEME_YONTEMI_ETIKETI) {
      setOdemeDiger("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
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
    <DeskModalPortal>
    <DeskModalBackdrop onClose={onClose}>
      <div className="modal modal-desk" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        <DeskModalHead title={baslik} onClose={onClose} closeDisabled={saving} />
        <div className="modal-body">
          {gosterilenHata ? <p className="form-error">{gosterilenHata}</p> : null}
          <form id="form-masraf" onSubmit={(e) => void handleSubmit(e)}>
            <div className="field">
              <label htmlFor="masraf-tarih">Tarih</label>
              <input id="masraf-tarih" type="date" className="desk-input" value={tarih} onChange={(e) => setTarih(e.target.value)} disabled={saving} />
            </div>
            <div className="field">
              <label htmlFor="masraf-tur">Masraf türü *</label>
              <select id="masraf-tur" className="desk-input" value={masrafTuru} onChange={(e) => setMasrafTuru(e.target.value)} disabled={saving}>
                {masrafTurleri.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            {masrafTuru === DIGER_MASRAF_ETIKETI ? (
              <div className="field">
                <label htmlFor="masraf-diger">Diğer masraf adı *</label>
                <input id="masraf-diger" className="desk-input" value={masrafDiger} onChange={(e) => setMasrafDiger(e.target.value)} disabled={saving} />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="masraf-tutar">Tutar *</label>
              <MoneyInput id="masraf-tutar" value={tutar} onChange={setTutar} disabled={saving} />
            </div>
            <div className="field">
              <label htmlFor="masraf-odeme">Ödeme yöntemi</label>
              <select
                id="masraf-odeme"
                className="desk-input"
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
              <div className="field">
                <label htmlFor="masraf-odeme-diger">Diğer ödeme yöntemi *</label>
                <input
                  id="masraf-odeme-diger"
                  className="desk-input"
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
            <div className="field">
              <label htmlFor="masraf-aciklama">Açıklama</label>
              <textarea id="masraf-aciklama" className="desk-input" rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} disabled={saving} />
            </div>
            {!editHareket ? (
              <p className="desk-muted-compact">Belge no kayıt sırasında otomatik üretilir (MSF-YYYY-######).</p>
            ) : null}
          </form>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm" disabled={saving} onClick={onClose}>
            İptal
          </button>
          <button type="submit" form="form-masraf" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </DeskModalBackdrop>
    </DeskModalPortal>
  );
}
