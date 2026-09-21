import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dosya } from "@shared/types/dosya";
import type { MuvekkilListItem } from "@shared/types/muvekkil";
import {
  ICRA_ALACAK_TURU_ETIKET,
  ICRA_ALACAK_TURU_KODLARI,
  type IcraAlacakTuruKodu,
} from "@shared/constants/icraTahsilat";
import { OFIS_ODEME_YONTEMI_ETIKET, OFIS_ODEME_YONTEMI_KODLARI } from "@shared/constants/ofisKasa";
import type { IcraTahsilatAlacakOlusturInput } from "@shared/types/icraTahsilat";
import { kurusBuyuktur } from "@shared/lib/moneyKurus";
import { DeskModalPortal } from "../DeskModalPortal";
import { DeskModalBackdrop } from "../DeskModalBackdrop";
import { bugunYmd, parseCurrencyInputTR, parsePosTutar } from "../../lib/format";
import { muvekkilGorunenAd } from "../../lib/muvekkil";
import { MoneyInput } from "../MoneyInput";
import { ParaBirimiSelect } from "../currency/CurrencyFields";
import type { ParaBirimi } from "@shared/lib/paraBirimi";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type FieldErrors = {
  borcluAdi?: string;
  toplam?: string;
  pesinat?: string;
  taksitSayisi?: string;
  ilkVade?: string;
};

export function IcraTahsilatAlacakModal({ open, onClose, onSaved }: Props) {
  const [alacakTuru, setAlacakTuru] = useState<IcraAlacakTuruKodu>("KARSI_TARAF_VEKALET");
  const [borcluAdi, setBorcluAdi] = useState("");
  const [muvekkiller, setMuvekkiller] = useState<MuvekkilListItem[]>([]);
  const [dosyalar, setDosyalar] = useState<Dosya[]>([]);
  const [muvekkilId, setMuvekkilId] = useState("");
  const [dosyaId, setDosyaId] = useState("");
  const [toplam, setToplam] = useState("");
  const [paraBirimi, setParaBirimi] = useState<ParaBirimi>("TRY");
  const [pesinatVar, setPesinatVar] = useState(false);
  const [pesinat, setPesinat] = useState("");
  const [taksitSayisi, setTaksitSayisi] = useState("3");
  const [ilkVade, setIlkVade] = useState(bugunYmd());
  const [odemeYontemi, setOdemeYontemi] = useState("NAKIT");
  const [aciklama, setAciklama] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<FieldErrors>({});
  const [kaydediyor, setKaydediyor] = useState(false);

  const resetForm = useCallback(() => {
    setAlacakTuru("KARSI_TARAF_VEKALET");
    setBorcluAdi("");
    setMuvekkilId("");
    setDosyaId("");
    setDosyalar([]);
    setToplam("");
    setParaBirimi("TRY");
    setPesinatVar(false);
    setPesinat("");
    setTaksitSayisi("3");
    setIlkVade(bugunYmd());
    setOdemeYontemi("NAKIT");
    setAciklama("");
    setErr(null);
    setFieldErr({});
    setKaydediyor(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetForm();
    void (async () => {
      try {
        const r = await window.api?.muvekkilAraPaged?.("", 1, 200);
        setMuvekkiller(r?.items ?? []);
      } catch {
        setMuvekkiller([]);
      }
    })();
  }, [open, resetForm]);

  useEffect(() => {
    if (!open) return;
    const mid = Number(muvekkilId);
    if (!Number.isFinite(mid) || mid <= 0) {
      setDosyalar([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const list = await window.api?.dosyaList?.(mid);
        if (!cancelled) setDosyalar(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setDosyalar([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, muvekkilId]);

  const toplamSayi = useMemo(() => parseCurrencyInputTR(toplam), [toplam]);
  const pesinatMax = toplamSayi != null && toplamSayi > 0 ? toplamSayi : undefined;

  function muvekkilDegistir(next: string) {
    setMuvekkilId(next);
    setDosyaId("");
  }

  function pesinatVarDegistir(checked: boolean) {
    setPesinatVar(checked);
    if (!checked) {
      setPesinat("");
      setFieldErr((prev) => {
        if (!prev.pesinat) return prev;
        const { pesinat: _p, ...rest } = prev;
        return rest;
      });
    }
  }

  async function kaydet(e?: React.FormEvent) {
    e?.preventDefault();
    if (kaydediyor) return;

    setErr(null);
    const nextErr: FieldErrors = {};

    if (!borcluAdi.trim()) {
      nextErr.borcluAdi = "Borçlu / karşı taraf zorunludur.";
    }

    const toplamParsed = parsePosTutar(toplam);
    if (toplamParsed == null || toplamParsed <= 0) {
      nextErr.toplam = "Geçerli toplam alacak tutarı girin.";
    }

    let pesinatSayi = 0;
    if (pesinatVar) {
      const p = parsePosTutar(pesinat);
      if (p == null || p <= 0) {
        nextErr.pesinat = "Geçerli peşinat tutarı girin.";
      } else if (toplamParsed != null && kurusBuyuktur(p, toplamParsed)) {
        nextErr.pesinat = "Peşinat tutarı toplam alacağı aşamaz.";
      } else {
        pesinatSayi = p;
      }
    }

    const adetRaw = taksitSayisi.trim();
    const adet = Number(adetRaw);
    if (!adetRaw || !Number.isFinite(adet) || adet < 1 || !Number.isInteger(adet)) {
      nextErr.taksitSayisi = "Taksit sayısı 1 veya daha büyük tam sayı olmalıdır.";
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(ilkVade)) {
      nextErr.ilkVade = "Geçerli ilk vade tarihi girin.";
    }

    setFieldErr(nextErr);
    if (Object.keys(nextErr).length > 0) {
      setErr("Lütfen işaretli alanları düzeltin.");
      return;
    }

    const input: IcraTahsilatAlacakOlusturInput = {
      alacakTuru,
      borcluAdi: borcluAdi.trim(),
      muvekkilId: muvekkilId ? Number(muvekkilId) : null,
      dosyaId: dosyaId ? Number(dosyaId) : null,
      toplamTutar: toplamParsed!,
      paraBirimi,
      pesinatVar,
      pesinatTutar: pesinatVar ? pesinatSayi : 0,
      taksitSayisi: adet,
      ilkVadeTarihi: ilkVade,
      odemeYontemi: odemeYontemi as IcraTahsilatAlacakOlusturInput["odemeYontemi"],
      aciklama: aciklama.trim() || null,
    };

    setKaydediyor(true);
    try {
      const res = await window.api?.icraTahsilatAlacakOlustur?.(input);
      if (!res?.ok) {
        setErr(res?.error ?? "Kayıt oluşturulamadı.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setErr("Kayıt oluşturulamadı.");
    } finally {
      setKaydediyor(false);
    }
  }

  if (!open) return null;

  return (
    <DeskModalPortal>
      <DeskModalBackdrop onClose={onClose} closeOnBackdrop={false} disabled={kaydediyor}>
        <div
          className="modal modal-desk modal-desk--icra-alacak"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="icra-alacak-title"
        >
          <div className="modal-header desk-icra-alacak-header">
            <h2 id="icra-alacak-title">Yeni İcra Tahsilat Alacağı</h2>
            <button type="button" className="desk-icra-detay-close" onClick={onClose} aria-label="Kapat" disabled={kaydediyor}>
              ×
            </button>
          </div>

          <div className="modal-body desk-icra-alacak-body">
            {err ? <p className="form-error">{err}</p> : null}

            <form id="form-icra-alacak" onSubmit={(e) => void kaydet(e)}>
              <div className="desk-icra-alacak-grid">
                <div className="field">
                  <label htmlFor="icra-alacak-tur">Alacak türü *</label>
                  <select
                    id="icra-alacak-tur"
                    className="desk-input"
                    value={alacakTuru}
                    onChange={(e) => setAlacakTuru(e.target.value as IcraAlacakTuruKodu)}
                  >
                    {ICRA_ALACAK_TURU_KODLARI.map((k) => (
                      <option key={k} value={k}>
                        {ICRA_ALACAK_TURU_ETIKET[k]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="icra-alacak-borclu">Borçlu / karşı taraf *</label>
                  <input
                    id="icra-alacak-borclu"
                    className="desk-input"
                    value={borcluAdi}
                    onChange={(e) => {
                      setBorcluAdi(e.target.value);
                      if (fieldErr.borcluAdi) setFieldErr((p) => ({ ...p, borcluAdi: undefined }));
                    }}
                    autoComplete="off"
                  />
                  {fieldErr.borcluAdi ? <span className="desk-icra-alacak-field-err">{fieldErr.borcluAdi}</span> : null}
                </div>

                <div className="field">
                  <label htmlFor="icra-alacak-muvekkil">İlgili müvekkil</label>
                  <select
                    id="icra-alacak-muvekkil"
                    className="desk-input"
                    value={muvekkilId}
                    onChange={(e) => muvekkilDegistir(e.target.value)}
                  >
                    <option value="">— Seçilmedi —</option>
                    {muvekkiller.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {muvekkilGorunenAd(m)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="icra-alacak-dosya">İlgili dosya</label>
                  <select
                    id="icra-alacak-dosya"
                    className="desk-input"
                    value={dosyaId}
                    onChange={(e) => setDosyaId(e.target.value)}
                    disabled={!muvekkilId}
                  >
                    <option value="">— Seçilmedi —</option>
                    {dosyalar.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.konuBasligi}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="icra-alacak-toplam">Toplam alacak *</label>
                  <MoneyInput
                    id="icra-alacak-toplam"
                    value={toplam}
                    onChange={(v) => {
                      setToplam(v);
                      if (fieldErr.toplam) setFieldErr((p) => ({ ...p, toplam: undefined }));
                    }}
                  />
                  {fieldErr.toplam ? <span className="desk-icra-alacak-field-err">{fieldErr.toplam}</span> : null}
                </div>
                <div className="field">
                  <label htmlFor="icra-alacak-pb">Para birimi</label>
                  <ParaBirimiSelect id="icra-alacak-pb" value={paraBirimi} onChange={setParaBirimi} />
                </div>

                <div className="field desk-icra-alacak-pesinat-field">
                  <span className="desk-icra-alacak-pesinat-label">Peşinat seçeneği</span>
                  <div className="desk-icra-alacak-check-row">
                    <label className="desk-icra-alacak-check" htmlFor="icra-alacak-pesinat-var">
                      <input
                        id="icra-alacak-pesinat-var"
                        type="checkbox"
                        checked={pesinatVar}
                        onChange={(e) => pesinatVarDegistir(e.target.checked)}
                      />
                      <span>Peşinat var</span>
                    </label>
                  </div>
                  {pesinatVar ? (
                    <div className="desk-icra-alacak-pesinat-tutar">
                      <label htmlFor="icra-alacak-pesinat">Peşinat tutarı *</label>
                      <MoneyInput
                        id="icra-alacak-pesinat"
                        value={pesinat}
                        onChange={(v) => {
                          setPesinat(v);
                          if (fieldErr.pesinat) setFieldErr((p) => ({ ...p, pesinat: undefined }));
                        }}
                        maxValue={pesinatMax}
                      />
                      {fieldErr.pesinat ? (
                        <span className="desk-icra-alacak-field-err">{fieldErr.pesinat}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="icra-alacak-adet">Taksit sayısı *</label>
                  <input
                    id="icra-alacak-adet"
                    className="desk-input desk-num"
                    type="text"
                    inputMode="numeric"
                    value={taksitSayisi}
                    onChange={(e) => {
                      setTaksitSayisi(e.target.value.replace(/[^\d]/g, "").slice(0, 3));
                      if (fieldErr.taksitSayisi) setFieldErr((p) => ({ ...p, taksitSayisi: undefined }));
                    }}
                    autoComplete="off"
                  />
                  {fieldErr.taksitSayisi ? (
                    <span className="desk-icra-alacak-field-err">{fieldErr.taksitSayisi}</span>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="icra-alacak-vade">İlk vade tarihi *</label>
                  <input
                    id="icra-alacak-vade"
                    className="desk-input"
                    type="date"
                    value={ilkVade}
                    onChange={(e) => {
                      setIlkVade(e.target.value);
                      if (fieldErr.ilkVade) setFieldErr((p) => ({ ...p, ilkVade: undefined }));
                    }}
                  />
                  {fieldErr.ilkVade ? <span className="desk-icra-alacak-field-err">{fieldErr.ilkVade}</span> : null}
                </div>

                <div className="field">
                  <label htmlFor="icra-alacak-odeme">Ödeme yöntemi</label>
                  <select
                    id="icra-alacak-odeme"
                    className="desk-input"
                    value={odemeYontemi}
                    onChange={(e) => setOdemeYontemi(e.target.value)}
                  >
                    {OFIS_ODEME_YONTEMI_KODLARI.map((k) => (
                      <option key={k} value={k}>
                        {OFIS_ODEME_YONTEMI_ETIKET[k]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="icra-alacak-aciklama">Açıklama / not</label>
                  <textarea
                    id="icra-alacak-aciklama"
                    className="desk-input"
                    rows={2}
                    value={aciklama}
                    onChange={(e) => setAciklama(e.target.value)}
                  />
                </div>
              </div>
            </form>
          </div>

          <div className="modal-actions desk-icra-alacak-actions">
            <button type="button" className="btn btn-sm" onClick={onClose} disabled={kaydediyor}>
              İptal
            </button>
            <button type="submit" form="form-icra-alacak" className="btn btn-primary btn-sm" disabled={kaydediyor}>
              {kaydediyor ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      </DeskModalBackdrop>
    </DeskModalPortal>
  );
}
