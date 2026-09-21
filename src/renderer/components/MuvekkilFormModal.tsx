import { useEffect, useState } from "react";
import type { Muvekkil, MuvekkilInput, MuvekkilTuru } from "@shared/types/muvekkil";
import { DeskModalPortal } from "./DeskModalPortal";
import { DeskModalBackdrop } from "./DeskModalBackdrop";
import { DeskModalHead } from "./DeskModalHead";

type Props = {
  title: string;
  open: boolean;
  saving: boolean;
  error: string | null;
  initial?: Muvekkil | null;
  onClose: () => void;
  onSave: (input: MuvekkilInput) => Promise<void>;
};

export function MuvekkilFormModal({ title, open, saving, error, initial, onClose, onSave }: Props) {
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

  useEffect(() => {
    if (!open) return;
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

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
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
    await onSave(payload);
  }

  return (
    <DeskModalPortal>
      <DeskModalBackdrop onClose={onClose} disabled={saving}>
        <div className="modal modal-desk modal-desk--wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <DeskModalHead title={title} onClose={onClose} closeDisabled={saving} />
        <div className="modal-body">
          {error ? <p className="form-error">{error}</p> : null}
          <form id="form-muvekkil" onSubmit={(e) => void handleSubmit(e)}>
            <div className="field">
              <label htmlFor="mvk-tur">Müvekkil tipi</label>
              <select
                id="mvk-tur"
                className="desk-input"
                value={mvkTur}
                onChange={(e) => setMvkTur(e.target.value as MuvekkilTuru)}
              >
                <option value="GERCEK_KISI">Gerçek kişi</option>
                <option value="TUZEL_KISI">Tüzel kişi</option>
              </select>
            </div>
            {mvkTur === "GERCEK_KISI" ? (
              <>
                <div className="field">
                  <label htmlFor="mvk-ad">Ad soyad *</label>
                  <input id="mvk-ad" className="desk-input" value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="mvk-tel">Telefon *</label>
                  <input id="mvk-tel" className="desk-input" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="mvk-unvan">Şirket ünvanı *</label>
                  <input
                    id="mvk-unvan"
                    className="desk-input"
                    value={sirketUnvani}
                    onChange={(e) => setSirketUnvani(e.target.value)}
                  />
                </div>
                <div className="desk-form-grid">
                  <div className="field">
                    <label htmlFor="mvk-yetkili">Yetkili adı</label>
                    <input id="mvk-yetkili" className="desk-input" value={yetkiliAd} onChange={(e) => setYetkiliAd(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="mvk-yetkili-tel">Yetkili telefon</label>
                    <input
                      id="mvk-yetkili-tel"
                      className="desk-input"
                      value={yetkiliTel}
                      onChange={(e) => setYetkiliTel(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="mvk-mudur">Müdür adı</label>
                    <input id="mvk-mudur" className="desk-input" value={mudurAd} onChange={(e) => setMudurAd(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="mvk-mudur-tel">Müdür telefon</label>
                    <input id="mvk-mudur-tel" className="desk-input" value={mudurTel} onChange={(e) => setMudurTel(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="mvk-muh">Muhasebe adı</label>
                    <input id="mvk-muh" className="desk-input" value={muhasebeAd} onChange={(e) => setMuhasebeAd(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="mvk-muh-tel">Muhasebe telefon</label>
                    <input
                      id="mvk-muh-tel"
                      className="desk-input"
                      value={muhasebeTel}
                      onChange={(e) => setMuhasebeTel(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="mvk-vergi-no">Vergi no</label>
                    <input id="mvk-vergi-no" className="desk-input" value={vergiNo} onChange={(e) => setVergiNo(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="mvk-vergi-d">Vergi dairesi</label>
                    <input
                      id="mvk-vergi-d"
                      className="desk-input"
                      value={vergiDairesi}
                      onChange={(e) => setVergiDairesi(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
            <div className="field">
              <label htmlFor="mvk-eposta">E-posta</label>
              <input
                id="mvk-eposta"
                type="email"
                className="desk-input"
                value={eposta}
                onChange={(e) => setEposta(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="mvk-adres">Adres</label>
              <textarea id="mvk-adres" className="desk-input" rows={2} value={adres} onChange={(e) => setAdres(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="mvk-not">Not</label>
              <textarea id="mvk-not" className="desk-input" rows={2} value={not} onChange={(e) => setNot(e.target.value)} />
            </div>
          </form>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm" disabled={saving} onClick={onClose}>
            İptal
          </button>
          <button type="submit" form="form-muvekkil" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </DeskModalBackdrop>
    </DeskModalPortal>
  );
}
