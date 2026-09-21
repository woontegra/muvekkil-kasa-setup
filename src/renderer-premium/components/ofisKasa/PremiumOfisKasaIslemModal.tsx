import {
  OFIS_ODEME_YONTEMI_ETIKET,
  OFIS_ODEME_YONTEMI_KODLARI,
} from "@shared/constants/ofisKasa";
import { MoneyInput } from "../MoneyInput";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";
import type { useOfisKasa } from "../../hooks/useOfisKasa";
import { ParaBirimiSelect } from "../currency/CurrencyFields";

type OfisApi = ReturnType<typeof useOfisKasa>;

type Props = {
  ofis: OfisApi;
};

export function PremiumOfisKasaIslemModal({ ofis }: Props) {
  const {
    modalAcik,
    duzenleId,
    fTip,
    setFTip,
    fTarih,
    setFTarih,
    fKalemId,
    setFKalemId,
    fKalemler,
    setFKat,
    fOzelKat,
    setFOzelKat,
    fAciklama,
    setFAciklama,
    fTutar,
    setFTutar,
    fParaBirimi,
    setFParaBirimi,
    fOdeme,
    setFOdeme,
    fBelge,
    setFBelge,
    fMuvekkilId,
    setFMuvekkilId,
    fMuvekkilQ,
    fMuvekkilOpts,
    araMuvekkilForForm,
    fTahsilUserId,
    setFTahsilUserId,
    fKullanicilar,
    loadFormLookups,
    formErr,
    formKaydediyor,
    digerSecili,
    personelMaasSecili,
    ozelAlanGerekli,
    modalKapat,
    formKaydet,
  } = ofis;

  const baslik =
    duzenleId != null ? "Ofis kasa hareketini düzenle" : fTip === "GELIR" ? "Gelir kaydı" : "Gider kaydı";

  return (
    <PremiumModal
      open={modalAcik}
      title={baslik}
      wide
      disabled={formKaydediyor}
      onClose={modalKapat}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={modalKapat} disabled={formKaydediyor}>
            Vazgeç
          </PremiumButton>
          <PremiumButton type="button" onClick={() => void formKaydet()} disabled={formKaydediyor}>
            {formKaydediyor ? "Kaydediliyor…" : "Kaydet"}
          </PremiumButton>
        </>
      }
    >
      {formErr ? <p className="pm-form-error pm-modal-form-error">{formErr}</p> : null}
      <div className="pm-form-grid pm-ofis-form-grid">
        <div className="pm-field">
          <label htmlFor="pm-ofk-ftip">İşlem tipi</label>
          <select
            id="pm-ofk-ftip"
            className="pm-input"
            value={fTip}
            disabled={duzenleId != null}
            onChange={(e) => {
              const t = e.target.value as "GELIR" | "GIDER";
              setFTip(t);
              setFOzelKat("");
              setFTahsilUserId(null);
              void loadFormLookups(t);
            }}
          >
            <option value="GELIR">Gelir</option>
            <option value="GIDER">Gider</option>
          </select>
        </div>
        <div className="pm-field">
          <label htmlFor="pm-ofk-fpb">Para birimi</label>
          <ParaBirimiSelect id="pm-ofk-fpb" value={fParaBirimi} onChange={setFParaBirimi} disabled={duzenleId != null} />
        </div>
        <div className="pm-field">
          <label htmlFor="pm-ofk-ftar">Tarih</label>
          <input id="pm-ofk-ftar" className="pm-input" type="date" value={fTarih} onChange={(e) => setFTarih(e.target.value)} />
        </div>
        <div className="pm-field pm-form-span2">
          <label htmlFor="pm-ofk-fkat">Kalem</label>
          <select
            id="pm-ofk-fkat"
            className="pm-input"
            value={fKalemId ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              setFKalemId(Number.isFinite(id) ? id : null);
              const k = fKalemler.find((x) => x.id === id);
              if (k) setFKat(k.kod ?? k.ad);
              setFOzelKat("");
            }}
          >
            {fKalemler.length === 0 ? <option value="">Kalem yükleniyor…</option> : null}
            {fKalemler.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ad}
              </option>
            ))}
          </select>
        </div>
        {ozelAlanGerekli ? (
          <div className="pm-field pm-form-span2">
            <label htmlFor="pm-ofk-fozel">{personelMaasSecili ? "Personel ismi" : "Özel kategori adı"}</label>
            <input
              id="pm-ofk-fozel"
              className="pm-input"
              value={fOzelKat}
              onChange={(e) => setFOzelKat(e.target.value)}
              placeholder={personelMaasSecili ? "Örn. Ayşe Demir" : "Listede görünecek ad"}
              maxLength={200}
            />
          </div>
        ) : null}
        <div className="pm-field pm-form-span2">
          <label htmlFor="pm-ofk-fac">Açıklama</label>
          <textarea
            id="pm-ofk-fac"
            className="pm-input"
            value={fAciklama}
            onChange={(e) => setFAciklama(e.target.value)}
            rows={2}
          />
        </div>
        <div className="pm-field">
          <label htmlFor="pm-ofk-ftut">Tutar</label>
          <MoneyInput id="pm-ofk-ftut" value={fTutar} onChange={setFTutar} />
        </div>
        <div className="pm-field">
          <label htmlFor="pm-ofk-fod">Ödeme yöntemi</label>
          <select id="pm-ofk-fod" className="pm-input" value={fOdeme} onChange={(e) => setFOdeme(e.target.value)}>
            {OFIS_ODEME_YONTEMI_KODLARI.map((k) => (
              <option key={k} value={k}>
                {OFIS_ODEME_YONTEMI_ETIKET[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="pm-field pm-form-span2">
          <label htmlFor="pm-ofk-fmv">İlgili müvekkil (isteğe bağlı)</label>
          <input
            id="pm-ofk-fmv"
            className="pm-input"
            value={fMuvekkilQ}
            onChange={(e) => void araMuvekkilForForm(e.target.value)}
            placeholder="Müvekkil ara…"
            list="pm-ofk-muvekkil-list"
          />
          <datalist id="pm-ofk-muvekkil-list">
            {fMuvekkilOpts.map((o) => (
              <option key={o.id} value={o.label} />
            ))}
          </datalist>
          <div className="pm-ofis-muvekkil-pick">
            {fMuvekkilOpts.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`pm-btn pm-btn--sm ${fMuvekkilId === o.id ? "pm-btn--primary" : "pm-btn--ghost"}`}
                onClick={() => {
                  setFMuvekkilId(o.id);
                  void araMuvekkilForForm(o.label);
                }}
              >
                {o.label}
              </button>
            ))}
            {fMuvekkilId != null ? (
              <button
                type="button"
                className="pm-btn pm-btn--sm pm-btn--ghost"
                onClick={() => {
                  setFMuvekkilId(null);
                  void araMuvekkilForForm("");
                }}
              >
                Temizle
              </button>
            ) : null}
          </div>
        </div>
        {fTip === "GELIR" ? (
          <div className="pm-field pm-form-span2">
            <label htmlFor="pm-ofk-ftahsil">Tahsilatı yapan personel (isteğe bağlı)</label>
            <select
              id="pm-ofk-ftahsil"
              className="pm-input"
              value={fTahsilUserId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setFTahsilUserId(v ? Number(v) : null);
              }}
            >
              <option value="">— Seçilmedi —</option>
              {fKullanicilar.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.adSoyad}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="pm-field pm-form-span2">
          <label htmlFor="pm-ofk-fbel">Belge no / fiş no / dekont no</label>
          <input id="pm-ofk-fbel" className="pm-input" value={fBelge} onChange={(e) => setFBelge(e.target.value)} />
        </div>
      </div>
    </PremiumModal>
  );
}
