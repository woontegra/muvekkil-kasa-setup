import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Dosya } from "@shared/types/dosya";
import type { MuvekkilListItem } from "@shared/types/muvekkil";
import type { Randevu, RandevuKullanici, RandevuWriteInput } from "@shared/types/randevu";
import {
  combineLocalDateTime,
  defaultEndTimeFromStart,
  localDateTimeToIso,
  toDateInputValue,
  toTimeInputValue,
} from "@shared/lib/randevuCalendar";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { muvekkilGorunenAd } from "../../lib/muvekkil";
import { PremiumButton } from "../PremiumButton";
import { PremiumModal } from "../modal/PremiumModal";

export type RandevuFormPrefill = {
  date?: string;
  startTime?: string;
  endTime?: string;
  muvekkilId?: number;
  dosyaId?: number;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  randevu?: Randevu;
  prefill?: RandevuFormPrefill;
  onClose: () => void;
  onSaved: () => void;
};

export function RandevuFormModal({ open, mode, randevu, prefill, onClose, onSaved }: Props) {
  const { showToast } = usePremiumToast();
  const isEdit = mode === "edit";
  const now = new Date();

  const [baslik, setBaslik] = useState("");
  const [tarih, setTarih] = useState(toDateInputValue(now));
  const [baslangicSaati, setBaslangicSaati] = useState(toTimeInputValue(now));
  const [bitisSaati, setBitisSaati] = useState(defaultEndTimeFromStart(toTimeInputValue(now)));
  const [konum, setKonum] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [muvekkilId, setMuvekkilId] = useState<number | null>(null);
  const [dosyaId, setDosyaId] = useState<number | null>(null);
  const [sorumluKullaniciId, setSorumluKullaniciId] = useState<number | null>(null);
  const [muvekkilQ, setMuvekkilQ] = useState("");
  const debouncedMuvekkilQ = useDebouncedValue(muvekkilQ.trim(), 300);
  const [muvekkilSonuclar, setMuvekkilSonuclar] = useState<MuvekkilListItem[]>([]);
  const [muvekkilAramaBusy, setMuvekkilAramaBusy] = useState(false);
  const [dosyalar, setDosyalar] = useState<Dosya[]>([]);
  const [kullanicilar, setKullanicilar] = useState<RandevuKullanici[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedMuvekkilLabel, setSelectedMuvekkilLabel] = useState("");

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (randevu) {
      setBaslik(randevu.baslik);
      setTarih(toDateInputValue(new Date(randevu.baslangicAt)));
      setBaslangicSaati(toTimeInputValue(new Date(randevu.baslangicAt)));
      setBitisSaati(toTimeInputValue(new Date(randevu.bitisAt)));
      setKonum(randevu.konum ?? "");
      setAciklama(randevu.aciklama ?? "");
      setMuvekkilId(randevu.muvekkilId);
      setDosyaId(randevu.dosyaId);
      setSorumluKullaniciId(randevu.sorumluKullaniciId);
      setSelectedMuvekkilLabel(randevu.muvekkilAd ?? "");
      setMuvekkilQ("");
    } else {
      setBaslik("");
      setTarih(prefill?.date ?? toDateInputValue(now));
      setBaslangicSaati(prefill?.startTime ?? toTimeInputValue(now));
      setBitisSaati(prefill?.endTime ?? defaultEndTimeFromStart(prefill?.startTime ?? toTimeInputValue(now)));
      setKonum("");
      setAciklama("");
      setMuvekkilId(prefill?.muvekkilId ?? null);
      setDosyaId(prefill?.dosyaId ?? null);
      setSorumluKullaniciId(null);
      setMuvekkilQ("");
      setSelectedMuvekkilLabel("");
    }
  }, [open, randevu, prefill]);

  useEffect(() => {
    if (!open) return;
    void window.api.randevuKullanicilar().then(setKullanicilar).catch(() => setKullanicilar([]));
  }, [open]);

  useEffect(() => {
    if (!open || !muvekkilId) {
      setDosyalar([]);
      return;
    }
    void window.api.dosyaList(muvekkilId).then(setDosyalar).catch(() => setDosyalar([]));
  }, [open, muvekkilId]);

  useEffect(() => {
    if (!open || debouncedMuvekkilQ.length < 1) {
      setMuvekkilSonuclar([]);
      return;
    }
    let cancelled = false;
    setMuvekkilAramaBusy(true);
    void window.api
      .muvekkilAraPaged(debouncedMuvekkilQ, 1, 50)
      .then((r) => {
        if (!cancelled) setMuvekkilSonuclar(r.items);
      })
      .catch(() => {
        if (!cancelled) setMuvekkilSonuclar([]);
      })
      .finally(() => {
        if (!cancelled) setMuvekkilAramaBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedMuvekkilQ]);

  useEffect(() => {
    if (!open || !prefill?.muvekkilId || randevu) return;
    void window.api.muvekkilGet(prefill.muvekkilId).then((m) => {
      if (m) setSelectedMuvekkilLabel(muvekkilGorunenAd(m));
    });
  }, [open, prefill?.muvekkilId, randevu]);

  const showMuvekkilDropdown =
    muvekkilQ.trim().length >= 1 && !muvekkilId && !muvekkilAramaBusy && muvekkilSonuclar.length > 0;

  const dosyaLabel = useMemo(() => {
    if (!dosyaId) return "";
    const d = dosyalar.find((x) => x.id === dosyaId);
    if (d) return (d.konuBasligi ?? d.dosyaNumarasi ?? "").trim() || `Dosya #${d.id}`;
    if (randevu?.dosyaId === dosyaId && randevu.dosyaBaslik) return randevu.dosyaBaslik;
    return "";
  }, [dosyaId, dosyalar, randevu]);

  function buildPayload(): RandevuWriteInput {
    return {
      baslik: baslik.trim(),
      baslangicAt: localDateTimeToIso(tarih, baslangicSaati),
      bitisAt: localDateTimeToIso(tarih, bitisSaati),
      konum: konum.trim() || null,
      aciklama: aciklama.trim() || null,
      muvekkilId,
      dosyaId,
      sorumluKullaniciId,
    };
  }

  function validate(): boolean {
    if (!baslik.trim()) {
      setFormError("Başlık zorunludur.");
      return false;
    }
    if (!tarih || !baslangicSaati || !bitisSaati) {
      setFormError("Tarih ve saat alanları zorunludur.");
      return false;
    }
    const start = combineLocalDateTime(tarih, baslangicSaati);
    const end = combineLocalDateTime(tarih, bitisSaati);
    if (end <= start) {
      setFormError("Bitiş saati başlangıçtan sonra olmalıdır.");
      return false;
    }
    setFormError(null);
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving || !validate()) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      const result =
        isEdit && randevu
          ? await window.api.randevuGuncelle(randevu.id, payload)
          : await window.api.randevuOlustur(payload);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      showToast("success", isEdit ? "Randevu güncellendi." : "Randevu oluşturuldu.");
      onSaved();
      onClose();
    } catch {
      setFormError("Randevu kaydedilemedi.");
      showToast("error", "Randevu kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PremiumModal
      open={open}
      title={isEdit ? "Randevuyu Düzenle" : "Yeni Randevu"}
      subtitle={
        isEdit ? "Tarih, saat ve randevu bilgilerini güncelleyin." : "Randevu tarihini ve ilgili bilgileri belirleyin."
      }
      onClose={onClose}
      disabled={saving}
      panelClassName="pm-modal-panel--randevu-form"
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Vazgeç
          </PremiumButton>
          <PremiumButton type="submit" form="pm-randevu-form" disabled={saving}>
            {saving ? "Kaydediliyor…" : isEdit ? "Değişiklikleri Kaydet" : "Randevu Oluştur"}
          </PremiumButton>
        </>
      }
    >
      <form id="pm-randevu-form" className="pm-form-grid--modal" onSubmit={(e) => void handleSubmit(e)}>
        {formError ? <div className="pm-form-error pm-form-error--modal pm-form-span2">{formError}</div> : null}

        <div className="pm-field pm-form-span2">
          <label htmlFor="randevu-baslik">Başlık *</label>
          <input id="randevu-baslik" value={baslik} onChange={(e) => setBaslik(e.target.value)} required />
        </div>

        <div className="pm-field">
          <label htmlFor="randevu-muvekkil">Müvekkil</label>
          <input
            id="randevu-muvekkil"
            placeholder="Müvekkil ara…"
            value={muvekkilId && !muvekkilQ ? selectedMuvekkilLabel : muvekkilQ}
            onChange={(e) => {
              const next = e.target.value;
              setMuvekkilQ(next);
              if (muvekkilId) {
                setMuvekkilId(null);
                setDosyaId(null);
                setSelectedMuvekkilLabel("");
              }
            }}
            autoComplete="off"
          />
          {showMuvekkilDropdown ? (
            <ul className="pm-randevu-combobox-list">
              {muvekkilSonuclar.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="pm-randevu-combobox-item"
                    onClick={() => {
                      setMuvekkilId(m.id);
                      setSelectedMuvekkilLabel(muvekkilGorunenAd(m));
                      setMuvekkilQ("");
                      setDosyaId(null);
                    }}
                  >
                    {muvekkilGorunenAd(m)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {muvekkilId ? (
            <p className="pm-randevu-selected-hint">
              Seçili: <strong>{selectedMuvekkilLabel || dosyaLabel || `#${muvekkilId}`}</strong>
              <button
                type="button"
                onClick={() => {
                  setMuvekkilId(null);
                  setDosyaId(null);
                  setMuvekkilQ("");
                  setSelectedMuvekkilLabel("");
                }}
              >
                Temizle
              </button>
            </p>
          ) : null}
        </div>

        <div className="pm-field">
          <label htmlFor="randevu-dosya">Dosya</label>
          <select
            id="randevu-dosya"
            value={dosyaId ?? ""}
            onChange={(e) => setDosyaId(e.target.value ? Number(e.target.value) : null)}
            disabled={!muvekkilId}
          >
            <option value="">— Seçiniz —</option>
            {dosyalar.map((d) => (
              <option key={d.id} value={d.id}>
                {(d.konuBasligi ?? d.dosyaNumarasi ?? `Dosya #${d.id}`).trim()}
              </option>
            ))}
          </select>
        </div>

        <div className="pm-field">
          <label htmlFor="randevu-tarih">Tarih *</label>
          <input id="randevu-tarih" type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} required />
        </div>

        <div className="pm-field">
          <label htmlFor="randevu-sorumlu">Sorumlu</label>
          <select
            id="randevu-sorumlu"
            value={sorumluKullaniciId ?? ""}
            onChange={(e) => setSorumluKullaniciId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Seçiniz —</option>
            {kullanicilar.map((u) => (
              <option key={u.id} value={u.id}>
                {u.adSoyad}
              </option>
            ))}
          </select>
        </div>

        <div className="pm-field">
          <label htmlFor="randevu-baslangic">Başlangıç *</label>
          <input
            id="randevu-baslangic"
            type="time"
            value={baslangicSaati}
            onChange={(e) => setBaslangicSaati(e.target.value)}
            required
          />
        </div>

        <div className="pm-field">
          <label htmlFor="randevu-bitis">Bitiş *</label>
          <input id="randevu-bitis" type="time" value={bitisSaati} onChange={(e) => setBitisSaati(e.target.value)} required />
        </div>

        <div className="pm-field pm-form-span2">
          <label htmlFor="randevu-konum">Konum</label>
          <input id="randevu-konum" value={konum} onChange={(e) => setKonum(e.target.value)} />
        </div>

        <div className="pm-field pm-form-span2">
          <label htmlFor="randevu-aciklama">Açıklama</label>
          <textarea id="randevu-aciklama" rows={3} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
        </div>
      </form>
    </PremiumModal>
  );
}
