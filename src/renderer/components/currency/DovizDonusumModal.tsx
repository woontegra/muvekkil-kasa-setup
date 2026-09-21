import { useEffect, useState } from "react";
import type { ParaBirimi } from "@shared/lib/paraBirimi";
import { bugunYmd, formatCurrencyInputTR, parsePosTutar } from "../../lib/format";
import { DeskModalBackdrop } from "../DeskModalBackdrop";
import { DeskModalPortal } from "../DeskModalPortal";
import { MoneyInput } from "../MoneyInput";
import { ParaBirimiSelect } from "./CurrencyFields";

export function DovizDonusumModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [kaynak, setKaynak] = useState<ParaBirimi>("USD");
  const [hedef, setHedef] = useState<ParaBirimi>("TRY");
  const [kaynakTutar, setKaynakTutar] = useState("");
  const [hedefTutar, setHedefTutar] = useState("");
  const [tarih, setTarih] = useState(bugunYmd());
  const [meta, setMeta] = useState<{ kurKaynagi: "TCMB" | "MANUEL"; tcmbKurTarihi?: string | null; tcmbReferansKur?: number | null }>({ kurKaynagi: "MANUEL" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setKaynakTutar(""); setHedefTutar(""); setErr(""); } }, [open]);
  if (!open) return null;

  async function tcmb() {
    const t = parsePosTutar(kaynakTutar);
    if (!t || kaynak === hedef) return;
    const r = await window.api.kurlarTcmbCapraz({ baz: kaynak, karsi: hedef, date: tarih });
    if (!r.ok || !r.available) return setErr(r.error ?? "Kur bulunamadı.");
    const kur = Number(r.dovizAlis);
    setHedefTutar(formatCurrencyInputTR(t * kur));
    setMeta({ kurKaynagi: "TCMB", tcmbKurTarihi: r.bulunanTcmbKurTarihi, tcmbReferansKur: kur });
  }
  async function kaydet() {
    const kt = parsePosTutar(kaynakTutar), ht = parsePosTutar(hedefTutar);
    if (!kt || !ht || kaynak === hedef) return setErr("Geçerli ve farklı para birimleriyle iki tutarı da girin.");
    setSaving(true);
    try {
      const r = await window.api.ofisKasaDovizDonusum({ tarih, kaynakParaBirimi: kaynak, hedefParaBirimi: hedef, kaynakTutar: kt, hedefTutar: ht, ...meta });
      if (!r.ok) return setErr(r.error);
      onSaved(); onClose();
    } finally { setSaving(false); }
  }
  return <DeskModalPortal><DeskModalBackdrop onClose={onClose} disabled={saving}>
    <div className="modal modal-desk modal-desk--wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
      <div className="modal-head"><h2>Döviz dönüşümü</h2></div>
      <div className="modal-body">
        {err ? <p className="form-error">{err}</p> : null}
        <div className="desk-form-grid">
          <div className="field"><label>Kaynak PB</label><ParaBirimiSelect value={kaynak} onChange={setKaynak} /></div>
          <div className="field"><label>Hedef PB</label><ParaBirimiSelect value={hedef} onChange={setHedef} /></div>
          <div className="field"><label>Kaynak tutar</label><MoneyInput value={kaynakTutar} onChange={setKaynakTutar} /></div>
          <div className="field"><label>Hedef tutar</label><MoneyInput value={hedefTutar} onChange={(v) => { setHedefTutar(v); setMeta({ kurKaynagi: "MANUEL" }); }} /></div>
          <div className="field"><label>Tarih</label><input className="desk-input" type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} /></div>
          <div className="field"><label>&nbsp;</label><button className="btn btn-sm" type="button" onClick={() => void tcmb()}>TCMB kuru öner</button></div>
        </div>
      </div>
      <div className="modal-actions"><button className="btn" onClick={onClose}>Vazgeç</button><button className="btn btn-primary" onClick={() => void kaydet()}>Dönüştür</button></div>
    </div>
  </DeskModalBackdrop></DeskModalPortal>;
}
