import { useEffect, useState } from "react";
import type { ParaBirimi } from "@shared/lib/paraBirimi";
import { formatCurrencyInputTR, parsePosTutar, bugunYmd } from "../../lib/format";
import { MoneyInput } from "../MoneyInput";
import { PremiumButton } from "../PremiumButton";
import { PremiumModal } from "../modal/PremiumModal";
import { ParaBirimiSelect } from "../currency/CurrencyFields";

export function PremiumDovizDonusumModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kaynak, setKaynak] = useState<ParaBirimi>("USD");
  const [hedef, setHedef] = useState<ParaBirimi>("TRY");
  const [kaynakTutar, setKaynakTutar] = useState("");
  const [hedefTutar, setHedefTutar] = useState("");
  const [tarih, setTarih] = useState(bugunYmd());
  const [aciklama, setAciklama] = useState("");
  const [meta, setMeta] = useState<{ kurKaynagi: "TCMB" | "MANUEL"; tcmbKurTarihi?: string | null; tcmbReferansKur?: number | null }>({ kurKaynagi: "MANUEL" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKaynak("USD"); setHedef("TRY"); setKaynakTutar(""); setHedefTutar("");
    setTarih(bugunYmd()); setAciklama(""); setMeta({ kurKaynagi: "MANUEL" }); setErr(null);
  }, [open]);

  async function tcmbOner() {
    const amount = parsePosTutar(kaynakTutar);
    if (!amount || kaynak === hedef) return;
    try {
      const r = await window.api.kurlarTcmbCapraz({ baz: kaynak, karsi: hedef, date: tarih });
      if (!r.ok || !r.available) return setErr(r.error ?? "TCMB kuru bulunamadı.");
      const kur = Number(r.dovizAlis);
      setHedefTutar(formatCurrencyInputTR(amount * kur));
      setMeta({ kurKaynagi: "TCMB", tcmbKurTarihi: r.bulunanTcmbKurTarihi, tcmbReferansKur: kur });
      setErr(null);
    } catch {
      setErr("TCMB kuru alınamadı.");
    }
  }

  async function kaydet() {
    const kt = parsePosTutar(kaynakTutar);
    const ht = parsePosTutar(hedefTutar);
    if (!kt || !ht) return setErr("Kaynak ve hedef tutar zorunludur.");
    if (kaynak === hedef) return setErr("Para birimleri farklı olmalıdır.");
    setSaving(true);
    try {
      const r = await window.api.ofisKasaDovizDonusum({
        tarih, kaynakParaBirimi: kaynak, hedefParaBirimi: hedef,
        kaynakTutar: kt, hedefTutar: ht, aciklama: aciklama.trim() || null, ...meta,
      });
      if (!r.ok) return setErr(r.error);
      onSaved(); onClose();
    } catch {
      setErr("Döviz dönüşümü kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PremiumModal open={open} title="Döviz dönüşümü" wide disabled={saving} onClose={onClose}
      footer={<><PremiumButton variant="ghost" onClick={onClose}>Vazgeç</PremiumButton><PremiumButton onClick={() => void kaydet()}>Dönüştür</PremiumButton></>}>
      {err ? <p className="pm-form-error">{err}</p> : null}
      <div className="pm-form-grid">
        <div className="pm-field"><label>Kaynak para birimi</label><ParaBirimiSelect value={kaynak} onChange={setKaynak} /></div>
        <div className="pm-field"><label>Hedef para birimi</label><ParaBirimiSelect value={hedef} onChange={setHedef} /></div>
        <div className="pm-field"><label>Kaynak tutar</label><MoneyInput value={kaynakTutar} onChange={setKaynakTutar} /></div>
        <div className="pm-field"><label>Hedef tutar</label><MoneyInput value={hedefTutar} onChange={(v) => { setHedefTutar(v); setMeta({ kurKaynagi: "MANUEL" }); }} /></div>
        <div className="pm-field"><label>Tarih</label><input className="pm-input" type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} /></div>
        <div className="pm-field"><label>&nbsp;</label><PremiumButton variant="ghost" className="pm-btn--sm" onClick={() => void tcmbOner()}>TCMB kuru öner</PremiumButton></div>
        <div className="pm-field pm-form-span2"><label>Açıklama</label><input className="pm-input" value={aciklama} onChange={(e) => setAciklama(e.target.value)} /></div>
      </div>
    </PremiumModal>
  );
}
