import { useEffect, useState } from "react";
import type { Dosya, DosyaDurum, DosyaInput, DosyaUpdateInput } from "@shared/types/dosya";
import { DeskModalBackdrop } from "./DeskModalBackdrop";
import { DeskModalHead } from "./DeskModalHead";

type Props = {
  title: string;
  open: boolean;
  saving: boolean;
  error: string | null;
  muvekkilId?: number;
  initial?: Dosya | null;
  onClose: () => void;
  onSave: (input: DosyaInput | DosyaUpdateInput) => Promise<void>;
};

export function DosyaFormModal({ title, open, saving, error, muvekkilId, initial, onClose, onSave }: Props) {
  const [konu, setKonu] = useState("");
  const [mahkeme, setMahkeme] = useState("");
  const [dosyaNo, setDosyaNo] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [durum, setDurum] = useState<DosyaDurum>("AKTIF");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setKonu((initial.konuBasligi ?? "").trim());
      setMahkeme((initial.mahkemeAdi ?? "").trim());
      setDosyaNo((initial.dosyaNumarasi ?? "").trim());
      setAciklama((initial.aciklama ?? "").trim());
      setDurum(initial.durum ?? "AKTIF");
    } else {
      setKonu("");
      setMahkeme("");
      setDosyaNo("");
      setAciklama("");
      setDurum("AKTIF");
    }
  }, [open, initial]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (initial) {
      await onSave({
        konuBasligi: konu.trim(),
        mahkemeAdi: mahkeme.trim(),
        dosyaNumarasi: dosyaNo.trim(),
        aciklama: aciklama.trim() || null,
        durum,
      });
      return;
    }
    if (!muvekkilId) return;
    await onSave({
      muvekkilId,
      konuBasligi: konu.trim(),
      mahkemeAdi: mahkeme.trim(),
      dosyaNumarasi: dosyaNo.trim(),
      aciklama: aciklama.trim() || null,
      durum,
    });
  }

  return (
    <DeskModalBackdrop onClose={onClose} disabled={saving}>
      <div className="modal modal-desk" role="dialog" onClick={(e) => e.stopPropagation()}>
        <DeskModalHead title={title} onClose={onClose} closeDisabled={saving} />
        <div className="modal-body">
          {error ? <p className="form-error">{error}</p> : null}
          <form id="form-dosya" onSubmit={(e) => void handleSubmit(e)}>
            <div className="field">
              <label htmlFor="dosya-konu">Dosya konusu *</label>
              <input id="dosya-konu" className="desk-input" value={konu} onChange={(e) => setKonu(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="dosya-mahkeme">Mahkeme / icra *</label>
              <input id="dosya-mahkeme" className="desk-input" value={mahkeme} onChange={(e) => setMahkeme(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="dosya-no">Dosya no *</label>
              <input id="dosya-no" className="desk-input" value={dosyaNo} onChange={(e) => setDosyaNo(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="dosya-aciklama">Açıklama</label>
              <textarea
                id="dosya-aciklama"
                className="desk-input"
                rows={2}
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="dosya-durum">Durum</label>
              <select
                id="dosya-durum"
                className="desk-input"
                value={durum}
                onChange={(e) => setDurum(e.target.value as DosyaDurum)}
              >
                <option value="AKTIF">Aktif</option>
                <option value="PASIF">Pasif</option>
                <option value="KAPANDI">Kapandı</option>
              </select>
            </div>
          </form>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm" disabled={saving} onClick={onClose}>
            İptal
          </button>
          <button type="submit" form="form-dosya" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </DeskModalBackdrop>
  );
}
