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
import { bugunYmd, parseCurrencyInputTR, parsePosTutar } from "../../lib/format";
import { muvekkilGorunenAd } from "../../lib/muvekkil";
import { MoneyInput } from "../MoneyInput";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";
import type { ParaBirimi } from "@shared/lib/paraBirimi";
import { ParaBirimiSelect } from "../currency/CurrencyFields";

type FieldErrors = {
  borcluAdi?: string;
  toplam?: string;
  pesinat?: string;
  taksitSayisi?: string;
  ilkVade?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (id: number) => void;
};

export function PremiumIcraAlacakModal({ open, onClose, onSaved }: Props) {
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

  async function kaydet() {
    if (kaydediyor) return;
    setErr(null);
    const nextErr: FieldErrors = {};

    if (!borcluAdi.trim()) nextErr.borcluAdi = "Borçlu / karşı taraf zorunludur.";

    const toplamParsed = parsePosTutar(toplam);
    if (toplamParsed == null || toplamParsed <= 0) nextErr.toplam = "Geçerli toplam alacak tutarı girin.";

    let pesinatSayi = 0;
    if (pesinatVar) {
      const p = parsePosTutar(pesinat);
      if (p == null || p <= 0) nextErr.pesinat = "Geçerli peşinat tutarı girin.";
      else if (toplamParsed != null && kurusBuyuktur(p, toplamParsed)) {
        nextErr.pesinat = "Peşinat tutarı toplam alacağı aşamaz.";
      } else pesinatSayi = p;
    }

    const adetRaw = taksitSayisi.trim();
    const adet = Number(adetRaw);
    if (!adetRaw || !Number.isFinite(adet) || adet < 1 || !Number.isInteger(adet)) {
      nextErr.taksitSayisi = "Taksit sayısı 1 veya daha büyük tam sayı olmalıdır.";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ilkVade)) nextErr.ilkVade = "Geçerli ilk vade tarihi girin.";

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
      const res = await window.api.icraTahsilatAlacakOlustur(input);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      onSaved(res.row.id);
      onClose();
    } catch {
      setErr("Kayıt oluşturulamadı.");
    } finally {
      setKaydediyor(false);
    }
  }

  return (
    <PremiumModal
      open={open}
      title="Yeni icra tahsilat alacağı"
      wide
      disabled={kaydediyor}
      onClose={onClose}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onClose} disabled={kaydediyor}>
            İptal
          </PremiumButton>
          <PremiumButton type="button" onClick={() => void kaydet()} disabled={kaydediyor}>
            {kaydediyor ? "Kaydediliyor…" : "Kaydet"}
          </PremiumButton>
        </>
      }
    >
      {err ? <p className="pm-form-error pm-modal-form-error">{err}</p> : null}
      <div className="pm-form-grid pm-icra-form-grid">
        <div className="pm-field">
          <label htmlFor="pm-icra-alacak-tur">Alacak türü *</label>
          <select
            id="pm-icra-alacak-tur"
            className="pm-input"
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
        <div className="pm-field">
          <label htmlFor="pm-icra-alacak-borclu">Borçlu / karşı taraf *</label>
          <input
            id="pm-icra-alacak-borclu"
            className="pm-input"
            value={borcluAdi}
            onChange={(e) => {
              setBorcluAdi(e.target.value);
              if (fieldErr.borcluAdi) setFieldErr((p) => ({ ...p, borcluAdi: undefined }));
            }}
            autoComplete="off"
          />
          {fieldErr.borcluAdi ? <span className="pm-field-error">{fieldErr.borcluAdi}</span> : null}
        </div>
        <div className="pm-field">
          <label htmlFor="pm-icra-alacak-muvekkil">İlgili müvekkil</label>
          <select
            id="pm-icra-alacak-muvekkil"
            className="pm-input"
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
        <div className="pm-field">
          <label htmlFor="pm-icra-alacak-dosya">İlgili dosya</label>
          <select
            id="pm-icra-alacak-dosya"
            className="pm-input"
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
        <div className="pm-field">
          <label htmlFor="pm-icra-alacak-toplam">Toplam alacak *</label>
          <MoneyInput
            id="pm-icra-alacak-toplam"
            value={toplam}
            onChange={(v) => {
              setToplam(v);
              if (fieldErr.toplam) setFieldErr((p) => ({ ...p, toplam: undefined }));
            }}
          />
          {fieldErr.toplam ? <span className="pm-field-error">{fieldErr.toplam}</span> : null}
        </div>
        <div className="pm-field">
          <label htmlFor="pm-icra-alacak-pb">Para birimi</label>
          <ParaBirimiSelect id="pm-icra-alacak-pb" value={paraBirimi} onChange={setParaBirimi} />
        </div>
        <div className="pm-field pm-icra-pesinat-field">
          <span className="pm-field-label">Peşinat seçeneği</span>
          <label className="pm-icra-check">
            <input type="checkbox" checked={pesinatVar} onChange={(e) => pesinatVarDegistir(e.target.checked)} />
            <span>Peşinat var</span>
          </label>
          {pesinatVar ? (
            <div className="pm-icra-pesinat-tutar">
              <label htmlFor="pm-icra-alacak-pesinat">Peşinat tutarı *</label>
              <MoneyInput
                id="pm-icra-alacak-pesinat"
                value={pesinat}
                onChange={(v) => {
                  setPesinat(v);
                  if (fieldErr.pesinat) setFieldErr((p) => ({ ...p, pesinat: undefined }));
                }}
                maxValue={pesinatMax}
              />
              {fieldErr.pesinat ? <span className="pm-field-error">{fieldErr.pesinat}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="pm-field">
          <label htmlFor="pm-icra-alacak-adet">Taksit sayısı *</label>
          <input
            id="pm-icra-alacak-adet"
            className="pm-input"
            type="text"
            inputMode="numeric"
            value={taksitSayisi}
            onChange={(e) => {
              setTaksitSayisi(e.target.value.replace(/[^\d]/g, "").slice(0, 3));
              if (fieldErr.taksitSayisi) setFieldErr((p) => ({ ...p, taksitSayisi: undefined }));
            }}
            autoComplete="off"
          />
          {fieldErr.taksitSayisi ? <span className="pm-field-error">{fieldErr.taksitSayisi}</span> : null}
        </div>
        <div className="pm-field">
          <label htmlFor="pm-icra-alacak-vade">İlk vade tarihi *</label>
          <input
            id="pm-icra-alacak-vade"
            className="pm-input"
            type="date"
            value={ilkVade}
            onChange={(e) => {
              setIlkVade(e.target.value);
              if (fieldErr.ilkVade) setFieldErr((p) => ({ ...p, ilkVade: undefined }));
            }}
          />
          {fieldErr.ilkVade ? <span className="pm-field-error">{fieldErr.ilkVade}</span> : null}
        </div>
        <div className="pm-field">
          <label htmlFor="pm-icra-alacak-odeme">Ödeme yöntemi</label>
          <select
            id="pm-icra-alacak-odeme"
            className="pm-input"
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
        <div className="pm-field pm-form-span2">
          <label htmlFor="pm-icra-alacak-aciklama">Açıklama / not</label>
          <textarea
            id="pm-icra-alacak-aciklama"
            className="pm-input"
            rows={2}
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
          />
        </div>
      </div>
    </PremiumModal>
  );
}
