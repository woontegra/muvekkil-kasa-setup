import { useEffect, useState } from "react";
import type { KasaHareket } from "@shared/types/kasa";
import { bugunYmd, formatDateTr, parsePosTutar } from "../lib/format";
import { tipEtiket } from "../lib/kasa";

type Props = {
  hedef: KasaHareket | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (data: { tutar: number; tarih: string; aciklama: string }) => Promise<void>;
};

export function KasaDuzeltmeModal({ hedef, saving, error, onClose, onSave }: Props) {
  const [isaret, setIsaret] = useState<"+" | "-">("-");
  const [tutar, setTutar] = useState("");
  const [tarih, setTarih] = useState(bugunYmd());
  const [aciklama, setAciklama] = useState("");

  useEffect(() => {
    if (!hedef) return;
    setIsaret("-");
    setTutar("");
    setTarih(bugunYmd());
    setAciklama("");
  }, [hedef]);

  if (!hedef) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = parsePosTutar(tutar);
    if (raw == null) return;
    const ac = aciklama.trim();
    if (!ac) return;
    const signed = isaret === "+" ? raw : -raw;
    await onSave({ tutar: signed, tarih, aciklama: ac });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !saving && onClose()}>
      <div className="modal modal-desk" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Düzeltme kaydı</h2>
        </div>
        <div className="modal-body">
          {error ? <p className="form-error">{error}</p> : null}
          <p className="desk-muted-compact">
            Düzeltilen işlem: #{hedef.id} · {tipEtiket(hedef.islemTipi)} · {formatDateTr(hedef.tarih)}
          </p>
          <form id="form-duzeltme" onSubmit={(e) => void handleSubmit(e)}>
            <div className="desk-form-grid">
              <div className="field">
                <label htmlFor="dz-isaret">İşaret</label>
                <select id="dz-isaret" className="desk-input" value={isaret} onChange={(e) => setIsaret(e.target.value as "+" | "-")}>
                  <option value="-">Eksi (−)</option>
                  <option value="+">Artı (+)</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="dz-tutar">Tutar *</label>
                <input id="dz-tutar" className="desk-input desk-num" value={tutar} onChange={(e) => setTutar(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="dz-tarih">Tarih</label>
              <input id="dz-tarih" type="date" className="desk-input" value={tarih} onChange={(e) => setTarih(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="dz-aciklama">Açıklama *</label>
              <textarea id="dz-aciklama" className="desk-input" rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
            </div>
          </form>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm" disabled={saving} onClick={onClose}>
            İptal
          </button>
          <button type="submit" form="form-duzeltme" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Düzeltme kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
