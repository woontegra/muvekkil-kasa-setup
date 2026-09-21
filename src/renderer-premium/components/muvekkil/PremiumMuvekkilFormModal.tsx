import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import type { Muvekkil, MuvekkilInput, MuvekkilTuru } from "@shared/types/muvekkil";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { notifyMuvekkilChanged } from "../../lib/events";
import { PremiumButton } from "../PremiumButton";
import { PremiumModal } from "../modal/PremiumModal";

type Props = {
  open: boolean;
  initial?: Muvekkil | null;
  onClose: () => void;
  onSuccess?: () => void;
};

export function PremiumMuvekkilFormModal({ open, initial, onClose, onSuccess }: Props) {
  const { showToast } = usePremiumToast();
  const formId = "pm-muvekkil-form";
  const isEdit = Boolean(initial?.id);

  const [mvkTur, setMvkTur] = useState<MuvekkilTuru>("GERCEK_KISI");
  const [adSoyad, setAdSoyad] = useState("");
  const [telefon, setTelefon] = useState("");
  const [eposta, setEposta] = useState("");
  const [adres, setAdres] = useState("");
  const [not, setNot] = useState("");
  const [sirketUnvani, setSirketUnvani] = useState("");
  const [yetkiliAd, setYetkiliAd] = useState("");
  const [yetkiliTel, setYetkiliTel] = useState("");
  const [mudurAd, setMudurAd] = useState("");
  const [mudurTel, setMudurTel] = useState("");
  const [muhasebeAd, setMuhasebeAd] = useState("");
  const [muhasebeTel, setMuhasebeTel] = useState("");
  const [vergiNo, setVergiNo] = useState("");
  const [vergiDairesi, setVergiDairesi] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const m = initial;
    if (m) {
      setMvkTur(m.muvekkilTuru);
      setAdSoyad(m.adSoyad ?? "");
      setTelefon(m.telefon ?? "");
      setEposta(m.eposta ?? "");
      setAdres(m.adres ?? "");
      setNot(m.not ?? "");
      setSirketUnvani(m.sirketUnvani ?? "");
      setYetkiliAd(m.yetkiliAdSoyad ?? "");
      setYetkiliTel(m.yetkiliTelefon ?? "");
      setMudurAd(m.mudurAdSoyad ?? "");
      setMudurTel(m.mudurTelefon ?? "");
      setMuhasebeAd(m.muhasebeAdSoyad ?? "");
      setMuhasebeTel(m.muhasebeTelefon ?? "");
      setVergiNo(m.vergiNo ?? "");
      setVergiDairesi(m.vergiDairesi ?? "");
    } else {
      setMvkTur("GERCEK_KISI");
      setAdSoyad("");
      setTelefon("");
      setEposta("");
      setAdres("");
      setNot("");
      setSirketUnvani("");
      setYetkiliAd("");
      setYetkiliTel("");
      setMudurAd("");
      setMudurTel("");
      setMuhasebeAd("");
      setMuhasebeTel("");
      setVergiNo("");
      setVergiDairesi("");
    }
  }, [open, initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    let payload: MuvekkilInput;
    if (mvkTur === "GERCEK_KISI") {
      payload = {
        muvekkilTuru: "GERCEK_KISI",
        adSoyad: adSoyad.trim(),
        telefon: telefon.trim(),
        eposta: eposta.trim() || null,
        adres: adres.trim() || null,
        not: not.trim() || null,
      };
    } else {
      payload = {
        muvekkilTuru: "TUZEL_KISI",
        sirketUnvani: sirketUnvani.trim(),
        yetkiliAdSoyad: yetkiliAd.trim() || null,
        yetkiliTelefon: yetkiliTel.trim() || null,
        mudurAdSoyad: mudurAd.trim() || null,
        mudurTelefon: mudurTel.trim() || null,
        muhasebeAdSoyad: muhasebeAd.trim() || null,
        muhasebeTelefon: muhasebeTel.trim() || null,
        vergiNo: vergiNo.trim() || null,
        vergiDairesi: vergiDairesi.trim() || null,
        eposta: eposta.trim() || null,
        adres: adres.trim() || null,
        not: not.trim() || null,
      };
    }

    setError(null);
    setSaving(true);
    try {
      if (isEdit && initial) {
        await window.api.muvekkilGuncelle(initial.id, payload);
        showToast("success", "Müvekkil bilgileri güncellendi.");
      } else {
        await window.api.muvekkilEkle(payload);
        showToast("success", "Müvekkil başarıyla oluşturuldu.");
      }
      notifyMuvekkilChanged();
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kayıt kaydedilemedi.";
      setError(msg);
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit ? "Müvekkili düzenle" : "Yeni müvekkil";

  return (
    <PremiumModal
      open={open}
      title={title}
      onClose={onClose}
      disabled={saving}
      wide
      footer={
        <>
          <PremiumButton variant="ghost" type="button" onClick={onClose} disabled={saving}>
            İptal
          </PremiumButton>
          <PremiumButton type="submit" form={formId} disabled={saving} className="pm-mvk-modal-save">
            {saving ? (
              <span className="pm-mvk-modal-saving">
                <span className="pm-login-spinner" aria-hidden />
                Kaydediliyor…
              </span>
            ) : isEdit ? (
              "Değişiklikleri kaydet"
            ) : (
              "Kaydet"
            )}
          </PremiumButton>
        </>
      }
    >
      {error ? <p className="pm-form-error pm-form-error--modal">{error}</p> : null}
      <form id={formId} className="pm-form pm-form--modal pm-mvk-form" onSubmit={(e) => void handleSubmit(e)}>
        <div className="pm-mvk-type-switch pm-form-field--enter" style={{ "--pm-field-i": 0 } as CSSProperties}>
          <span className="pm-mvk-type-switch-label">Müvekkil tipi</span>
          <div className="pm-mvk-type-switch-track" role="radiogroup" aria-label="Müvekkil tipi">
            <button
              type="button"
              role="radio"
              aria-checked={mvkTur === "GERCEK_KISI"}
              className={`pm-mvk-type-opt${mvkTur === "GERCEK_KISI" ? " pm-mvk-type-opt--active" : ""}`}
              onClick={() => setMvkTur("GERCEK_KISI")}
              disabled={saving}
            >
              Gerçek kişi
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mvkTur === "TUZEL_KISI"}
              className={`pm-mvk-type-opt${mvkTur === "TUZEL_KISI" ? " pm-mvk-type-opt--active" : ""}`}
              onClick={() => setMvkTur("TUZEL_KISI")}
              disabled={saving}
            >
              Tüzel kişi
            </button>
          </div>
          <select
            id={`${formId}-tur`}
            className="pm-mvk-type-select-hidden"
            value={mvkTur}
            onChange={(e) => setMvkTur(e.target.value as MuvekkilTuru)}
            disabled={saving}
            tabIndex={-1}
            aria-hidden
          >
            <option value="GERCEK_KISI">Gerçek kişi</option>
            <option value="TUZEL_KISI">Tüzel kişi</option>
          </select>
        </div>

        {mvkTur === "GERCEK_KISI" ? (
          <div className="pm-form-grid pm-form-grid--modal">
            <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 1 } as CSSProperties}>
              <label htmlFor={`${formId}-ad`}>Ad soyad *</label>
              <input
                id={`${formId}-ad`}
                className="pm-input"
                value={adSoyad}
                onChange={(e) => setAdSoyad(e.target.value)}
                disabled={saving}
                autoComplete="off"
              />
            </div>
            <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 2 } as CSSProperties}>
              <label htmlFor={`${formId}-tel`}>Telefon *</label>
              <input
                id={`${formId}-tel`}
                className="pm-input"
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                disabled={saving}
                autoComplete="off"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 1 } as CSSProperties}>
              <label htmlFor={`${formId}-unvan`}>Şirket ünvanı *</label>
              <input
                id={`${formId}-unvan`}
                className="pm-input"
                value={sirketUnvani}
                onChange={(e) => setSirketUnvani(e.target.value)}
                disabled={saving}
                autoComplete="off"
              />
            </div>
            <div className="pm-form-grid pm-form-grid--modal">
              <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 2 } as CSSProperties}>
                <label htmlFor={`${formId}-yetkili`}>Yetkili adı</label>
                <input
                  id={`${formId}-yetkili`}
                  className="pm-input"
                  value={yetkiliAd}
                  onChange={(e) => setYetkiliAd(e.target.value)}
                  disabled={saving}
                  autoComplete="off"
                />
              </div>
              <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 3 } as CSSProperties}>
                <label htmlFor={`${formId}-yetkili-tel`}>Yetkili telefon</label>
                <input
                  id={`${formId}-yetkili-tel`}
                  className="pm-input"
                  value={yetkiliTel}
                  onChange={(e) => setYetkiliTel(e.target.value)}
                  disabled={saving}
                  autoComplete="off"
                />
              </div>
              <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 4 } as CSSProperties}>
                <label htmlFor={`${formId}-mudur`}>Müdür adı</label>
                <input
                  id={`${formId}-mudur`}
                  className="pm-input"
                  value={mudurAd}
                  onChange={(e) => setMudurAd(e.target.value)}
                  disabled={saving}
                  autoComplete="off"
                />
              </div>
              <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 5 } as CSSProperties}>
                <label htmlFor={`${formId}-mudur-tel`}>Müdür telefon</label>
                <input
                  id={`${formId}-mudur-tel`}
                  className="pm-input"
                  value={mudurTel}
                  onChange={(e) => setMudurTel(e.target.value)}
                  disabled={saving}
                  autoComplete="off"
                />
              </div>
              <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 6 } as CSSProperties}>
                <label htmlFor={`${formId}-muh`}>Muhasebe adı</label>
                <input
                  id={`${formId}-muh`}
                  className="pm-input"
                  value={muhasebeAd}
                  onChange={(e) => setMuhasebeAd(e.target.value)}
                  disabled={saving}
                  autoComplete="off"
                />
              </div>
              <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 7 } as CSSProperties}>
                <label htmlFor={`${formId}-muh-tel`}>Muhasebe telefon</label>
                <input
                  id={`${formId}-muh-tel`}
                  className="pm-input"
                  value={muhasebeTel}
                  onChange={(e) => setMuhasebeTel(e.target.value)}
                  disabled={saving}
                  autoComplete="off"
                />
              </div>
              <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 8 } as CSSProperties}>
                <label htmlFor={`${formId}-vergi-no`}>Vergi no</label>
                <input
                  id={`${formId}-vergi-no`}
                  className="pm-input"
                  value={vergiNo}
                  onChange={(e) => setVergiNo(e.target.value)}
                  disabled={saving}
                  autoComplete="off"
                />
              </div>
              <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 9 } as CSSProperties}>
                <label htmlFor={`${formId}-vergi-d`}>Vergi dairesi</label>
                <input
                  id={`${formId}-vergi-d`}
                  className="pm-input"
                  value={vergiDairesi}
                  onChange={(e) => setVergiDairesi(e.target.value)}
                  disabled={saving}
                  autoComplete="off"
                />
              </div>
            </div>
          </>
        )}

        <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 10 } as CSSProperties}>
          <label htmlFor={`${formId}-eposta`}>E-posta</label>
          <input
            id={`${formId}-eposta`}
            type="email"
            className="pm-input"
            value={eposta}
            onChange={(e) => setEposta(e.target.value)}
            disabled={saving}
            autoComplete="off"
          />
        </div>
        <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 11 } as CSSProperties}>
          <label htmlFor={`${formId}-adres`}>Adres</label>
          <textarea
            id={`${formId}-adres`}
            className="pm-input pm-textarea"
            rows={2}
            value={adres}
            onChange={(e) => setAdres(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="pm-form-field pm-form-field--enter" style={{ "--pm-field-i": 12 } as CSSProperties}>
          <label htmlFor={`${formId}-not`}>Not</label>
          <textarea
            id={`${formId}-not`}
            className="pm-input pm-textarea"
            rows={2}
            value={not}
            onChange={(e) => setNot(e.target.value)}
            disabled={saving}
          />
        </div>
      </form>
    </PremiumModal>
  );
}
