import { useCallback, useEffect, useRef, useState } from "react";
import { PremiumButton } from "../PremiumButton";
import { PremiumFormField } from "../auth/PremiumFormField";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { notifyOverviewRefresh } from "../../lib/events";
import {
  bosOfficeForm,
  officeFormEquals,
  officeFormFromRow,
  officeFormToInput,
  type OfficeFormState,
} from "../../lib/settingsOffice";
import { SettingsSectionFrame } from "./SettingsSectionFrame";

export function SettingsOfficeSection() {
  const { showToast } = usePremiumToast();
  const [form, setForm] = useState<OfficeFormState>(bosOfficeForm);
  const [saved, setSaved] = useState<OfficeFormState>(bosOfficeForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const dirty = !officeFormEquals(form, saved);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await window.api.officeGet();
      const f = officeFormFromRow(row);
      setForm(f);
      setSaved(f);
    } catch {
      setError("Ofis bilgileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function alanDegistir<K extends keyof OfficeFormState>(alan: K, deger: OfficeFormState[K]) {
    setForm((prev) => ({ ...prev, [alan]: deger }));
    setFieldError(null);
  }

  async function kaydet() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFieldError(null);
    try {
      const r = await window.api.officeSave(officeFormToInput(form));
      if (!r.ok) {
        setFieldError(r.error);
        showToast("error", r.error);
        return;
      }
      const f = officeFormFromRow(r.row);
      setForm(f);
      setSaved(f);
      notifyOverviewRefresh();
      showToast("success", "Ofis bilgileri güncellendi.");
    } catch {
      showToast("error", "Kayıt sırasında hata oluştu.");
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  return (
    <SettingsSectionFrame
      title="Ofis Bilgileri"
      description="Makbuz ve çıktılarda kullanılır. Ofis adı veya avukat adı soyadından en az biri zorunludur."
      loading={loading}
      error={error}
      onRetry={() => void load()}
      footer={
        <div className="pm-settings-save-bar">
          {dirty ? (
            <span className="pm-settings-dirty-badge" aria-live="polite">
              Kaydedilmemiş değişiklikler
            </span>
          ) : (
            <span className="pm-settings-saved-hint">Tüm değişiklikler kaydedildi</span>
          )}
          <PremiumButton type="button" onClick={() => void kaydet()} disabled={saving || !dirty}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </PremiumButton>
        </div>
      }
    >
      <div className="pm-settings-form-grid">
        {fieldError ? (
          <p className="pm-form-error pm-settings-form-full" role="alert">
            {fieldError}
          </p>
        ) : null}
        <PremiumFormField label="Ofis / firma adı" htmlFor="pm-ofis-adi">
          <input
            id="pm-ofis-adi"
            className="pm-input pm-stagger-item"
            value={form.ofisAdi}
            onChange={(e) => alanDegistir("ofisAdi", e.target.value)}
            disabled={saving}
            style={{ animationDelay: "40ms" }}
          />
        </PremiumFormField>
        <PremiumFormField label="Avukat adı soyadı" htmlFor="pm-ofis-avukat">
          <input
            id="pm-ofis-avukat"
            className="pm-input pm-stagger-item"
            value={form.avukatAdiSoyadi}
            onChange={(e) => alanDegistir("avukatAdiSoyadi", e.target.value)}
            disabled={saving}
            style={{ animationDelay: "80ms" }}
          />
        </PremiumFormField>
        <PremiumFormField label="Telefon" htmlFor="pm-ofis-tel">
          <input
            id="pm-ofis-tel"
            className="pm-input pm-stagger-item"
            value={form.telefon}
            onChange={(e) => alanDegistir("telefon", e.target.value)}
            disabled={saving}
            style={{ animationDelay: "120ms" }}
          />
        </PremiumFormField>
        <PremiumFormField label="E-posta" htmlFor="pm-ofis-eposta">
          <input
            id="pm-ofis-eposta"
            className="pm-input pm-stagger-item"
            type="email"
            value={form.eposta}
            onChange={(e) => alanDegistir("eposta", e.target.value)}
            disabled={saving}
            style={{ animationDelay: "160ms" }}
          />
        </PremiumFormField>
        <PremiumFormField label="Vergi no" htmlFor="pm-ofis-vno">
          <input
            id="pm-ofis-vno"
            className="pm-input pm-stagger-item"
            value={form.vergiNo}
            onChange={(e) => alanDegistir("vergiNo", e.target.value)}
            disabled={saving}
            style={{ animationDelay: "200ms" }}
          />
        </PremiumFormField>
        <PremiumFormField label="Vergi dairesi" htmlFor="pm-ofis-vd">
          <input
            id="pm-ofis-vd"
            className="pm-input pm-stagger-item"
            value={form.vergiDairesi}
            onChange={(e) => alanDegistir("vergiDairesi", e.target.value)}
            disabled={saving}
            style={{ animationDelay: "240ms" }}
          />
        </PremiumFormField>
        <PremiumFormField label="Baro adı" htmlFor="pm-ofis-baro">
          <input
            id="pm-ofis-baro"
            className="pm-input pm-stagger-item"
            value={form.baroAdi}
            onChange={(e) => alanDegistir("baroAdi", e.target.value)}
            disabled={saving}
            style={{ animationDelay: "280ms" }}
          />
        </PremiumFormField>
        <PremiumFormField label="Baro sicil no" htmlFor="pm-ofis-sicil">
          <input
            id="pm-ofis-sicil"
            className="pm-input pm-stagger-item"
            value={form.baroSicilNo}
            onChange={(e) => alanDegistir("baroSicilNo", e.target.value)}
            disabled={saving}
            style={{ animationDelay: "320ms" }}
          />
        </PremiumFormField>
        <div className="pm-settings-form-full pm-stagger-item" style={{ animationDelay: "360ms" }}>
          <PremiumFormField label="Adres" htmlFor="pm-ofis-adres">
            <textarea
              id="pm-ofis-adres"
              className="pm-input pm-input--textarea"
              rows={3}
              value={form.adres}
              onChange={(e) => alanDegistir("adres", e.target.value)}
              disabled={saving}
            />
          </PremiumFormField>
        </div>
      </div>
    </SettingsSectionFrame>
  );
}
