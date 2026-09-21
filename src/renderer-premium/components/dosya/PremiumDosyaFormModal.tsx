import { useEffect, useState, type FormEvent, type CSSProperties } from "react";
import type { Dosya, DosyaDurum, DosyaInput, DosyaUpdateInput } from "@shared/types/dosya";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { PremiumButton } from "../PremiumButton";
import { PremiumModal } from "../modal/PremiumModal";

type Props = {
  open: boolean;
  muvekkilId?: number;
  initial?: Dosya | null;
  onClose: () => void;
  onSuccess?: () => void;
};

export function PremiumDosyaFormModal({ open, muvekkilId, initial, onClose, onSuccess }: Props) {
  const { showToast } = usePremiumToast();
  const formId = "pm-dosya-form";
  const isEdit = Boolean(initial?.id);

  const [konu, setKonu] = useState("");
  const [mahkeme, setMahkeme] = useState("");
  const [dosyaNo, setDosyaNo] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [durum, setDurum] = useState<DosyaDurum>("AKTIF");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    setError(null);
    setSaving(true);
    try {
      if (isEdit && initial) {
        const payload: DosyaUpdateInput = {
          konuBasligi: konu.trim(),
          mahkemeAdi: mahkeme.trim(),
          dosyaNumarasi: dosyaNo.trim(),
          aciklama: aciklama.trim() || null,
          durum,
        };
        await window.api.dosyaGuncelle(initial.id, payload);
        showToast("success", "Dosya bilgileri güncellendi.");
      } else {
        if (!muvekkilId) {
          throw new Error("Müvekkil bilgisi eksik.");
        }
        const payload: DosyaInput = {
          muvekkilId,
          konuBasligi: konu.trim(),
          mahkemeAdi: mahkeme.trim(),
          dosyaNumarasi: dosyaNo.trim(),
          aciklama: aciklama.trim() || null,
          durum,
        };
        await window.api.dosyaEkle(payload);
        showToast("success", "Dosya başarıyla oluşturuldu.");
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Dosya kaydedilemedi.";
      setError(msg);
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit ? "Dosyayı düzenle" : "Yeni dosya";

  return (
    <PremiumModal
      open={open}
      title={title}
      onClose={onClose}
      disabled={saving}
      footer={
        <>
          <PremiumButton variant="ghost" type="button" onClick={onClose} disabled={saving}>
            İptal
          </PremiumButton>
          <PremiumButton type="submit" form={formId} disabled={saving}>
            {saving ? "Kaydediliyor…" : isEdit ? "Değişiklikleri kaydet" : "Kaydet"}
          </PremiumButton>
        </>
      }
    >
      {error ? <p className="pm-form-error pm-form-error--modal">{error}</p> : null}
      <form id={formId} className="pm-form pm-form--modal" onSubmit={(e) => void handleSubmit(e)}>
        <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 0 } as CSSProperties}>
          <label htmlFor={`${formId}-konu`}>Dosya konusu *</label>
          <input
            id={`${formId}-konu`}
            className="pm-input"
            value={konu}
            onChange={(e) => setKonu(e.target.value)}
            disabled={saving}
            autoComplete="off"
          />
        </div>
        <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 1 } as CSSProperties}>
          <label htmlFor={`${formId}-mahkeme`}>Mahkeme / icra *</label>
          <input
            id={`${formId}-mahkeme`}
            className="pm-input"
            value={mahkeme}
            onChange={(e) => setMahkeme(e.target.value)}
            disabled={saving}
            autoComplete="off"
          />
        </div>
        <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 2 } as CSSProperties}>
          <label htmlFor={`${formId}-no`}>Dosya no *</label>
          <input
            id={`${formId}-no`}
            className="pm-input"
            value={dosyaNo}
            onChange={(e) => setDosyaNo(e.target.value)}
            disabled={saving}
            autoComplete="off"
          />
        </div>
        <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 3 } as CSSProperties}>
          <label htmlFor={`${formId}-aciklama`}>Açıklama</label>
          <textarea
            id={`${formId}-aciklama`}
            className="pm-input pm-textarea"
            rows={2}
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 4 } as CSSProperties}>
          <label htmlFor={`${formId}-durum`}>Durum</label>
          <select
            id={`${formId}-durum`}
            className="pm-input pm-select"
            value={durum}
            onChange={(e) => setDurum(e.target.value as DosyaDurum)}
            disabled={saving}
          >
            <option value="AKTIF">Aktif</option>
            <option value="PASIF">Pasif</option>
            <option value="KAPANDI">Kapandı</option>
          </select>
        </div>
      </form>
    </PremiumModal>
  );
}
