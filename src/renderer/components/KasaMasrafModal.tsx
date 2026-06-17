import { useEffect, useState } from "react";
import { DIGER_MASRAF_ETIKETI, ODEME_YONTEMI_ETIKET, ODEME_YONTEMI_KODLARI } from "@shared/constants/kasa";
import type { OdemeYontemiKodu } from "@shared/constants/kasa";
import type { KasaHareket } from "@shared/types/kasa";
import { bugunYmd, parsePosTutar } from "../lib/format";
import { masrafDuzenlemeSelectDiger, masrafKayitTuruFromForm } from "../lib/kasa";

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
    odemeYontemi: OdemeYontemiKodu;
    masrafTuru: string;
    aciklama: string | null;
  }) => Promise<void>;
};

export function KasaMasrafModal({ open, saving, error, masrafTurleri, editHareket, onClose, onSave }: Props) {
  const [tarih, setTarih] = useState(bugunYmd());
  const [tutar, setTutar] = useState("");
  const [odeme, setOdeme] = useState<OdemeYontemiKodu>("NAKIT");
  const [masrafTuru, setMasrafTuru] = useState("");
  const [masrafDiger, setMasrafDiger] = useState("");
  const [aciklama, setAciklama] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editHareket) {
      const { select, diger } = masrafDuzenlemeSelectDiger(editHareket.masrafTuru, masrafTurleri);
      setMasrafTuru(select);
      setMasrafDiger(diger);
      setTutar(String(editHareket.tutar));
      const tr = (editHareket.tarih ?? "").trim();
      setTarih(tr.length >= 10 ? tr.slice(0, 10) : bugunYmd());
      setOdeme(editHareket.odemeYontemi);
      setAciklama(editHareket.aciklama ?? "");
    } else {
      setTarih(bugunYmd());
      setTutar("");
      setOdeme("NAKIT");
      setMasrafTuru(masrafTurleri[0] ?? DIGER_MASRAF_ETIKETI);
      setMasrafDiger("");
      setAciklama("");
    }
  }, [open, editHareket, masrafTurleri]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const kayitTuru = masrafKayitTuruFromForm(masrafTuru, masrafDiger);
    if (!kayitTuru) return;
    const t = parsePosTutar(tutar);
    if (t == null) return;
    await onSave({ tarih, tutar: t, odemeYontemi: odeme, masrafTuru: kayitTuru, aciklama: aciklama.trim() || null });
  }

  const baslik = editHareket ? "Masrafı düzenle" : "Masraf girişi";

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !saving && onClose()}>
      <div className="modal modal-desk" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{baslik}</h2>
        </div>
        <div className="modal-body">
          {error ? <p className="form-error">{error}</p> : null}
          <form id="form-masraf" onSubmit={(e) => void handleSubmit(e)}>
            <div className="field">
              <label htmlFor="masraf-tarih">Tarih</label>
              <input id="masraf-tarih" type="date" className="desk-input" value={tarih} onChange={(e) => setTarih(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="masraf-tur">Masraf türü *</label>
              <select id="masraf-tur" className="desk-input" value={masrafTuru} onChange={(e) => setMasrafTuru(e.target.value)}>
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
                <input id="masraf-diger" className="desk-input" value={masrafDiger} onChange={(e) => setMasrafDiger(e.target.value)} />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="masraf-tutar">Tutar *</label>
              <input id="masraf-tutar" className="desk-input desk-num" value={tutar} onChange={(e) => setTutar(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="masraf-odeme">Ödeme yöntemi</label>
              <select id="masraf-odeme" className="desk-input" value={odeme} onChange={(e) => setOdeme(e.target.value as OdemeYontemiKodu)}>
                {ODEME_YONTEMI_KODLARI.map((k) => (
                  <option key={k} value={k}>
                    {ODEME_YONTEMI_ETIKET[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="masraf-aciklama">Açıklama</label>
              <textarea id="masraf-aciklama" className="desk-input" rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
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
    </div>
  );
}
