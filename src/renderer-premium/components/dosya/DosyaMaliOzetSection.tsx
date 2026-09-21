import { useCallback, useEffect, useState } from "react";
import type { DosyaMaliOzetPayload, DosyaMaliOzetResponse } from "@shared/types/dosyaMaliOzet";
import { formatMoney, tryResolveParaBirimi } from "@shared/lib/paraBirimi";
import { PremiumButton } from "../PremiumButton";

type ViewMode = "tumZamanlar" | "buDonem";

type Props = {
  dosyaId: number;
  vekaletParaBirimi?: string | null;
};

function OzetRow(p: {
  label: string;
  value: number;
  valueClass?: string;
  currency?: "TRY" | "vekalet";
  vekaletPb?: ReturnType<typeof tryResolveParaBirimi>;
}) {
  const fmt =
    p.currency === "vekalet" && p.vekaletPb
      ? (n: number) => formatMoney(n, p.vekaletPb!)
      : (n: number) => formatMoney(n, "TRY");
  return (
    <div className="pm-mali-ozet-row">
      <span className="pm-mali-ozet-row-k">{p.label}</span>
      <span className={`pm-mali-ozet-row-v${p.valueClass ? ` ${p.valueClass}` : ""}`}>{fmt(p.value)}</span>
    </div>
  );
}

function OzetPanel({ data, vekaletPb }: { data: DosyaMaliOzetPayload; vekaletPb: ReturnType<typeof tryResolveParaBirimi> }) {
  const kararlastirilan = Number(data.kararlastirilanVekalet);
  const tahsilEdilen = Number(data.tahsilEdilenVekalet);
  const kalanVekalet = Number(data.kalanVekalet);
  const avans = Number(data.alinanMasrafAvansi);
  const masraf = Number(data.toplamMasraf);
  const duzeltme = Number(data.duzeltmeEtkisi);
  const masrafAvansiIadesi = Number(data.masrafAvansiIadesi);
  const kalanAvans = Number(data.kalanMasrafAvansi);
  const buroGider = Number(data.buroKarsiladigiGider);
  const net = Number(data.netKazanc);

  return (
    <div className="pm-mali-ozet-panels">
      <div className="pm-mali-ozet-block">
        <h3 className="pm-mali-ozet-block-title">Vekalet ücreti ({vekaletPb})</h3>
        <OzetRow label="Kararlaştırılan" value={kararlastirilan} currency="vekalet" vekaletPb={vekaletPb} />
        <OzetRow
          label="Tahsil edilen"
          value={tahsilEdilen}
          valueClass="pm-text-success"
          currency="vekalet"
          vekaletPb={vekaletPb}
        />
        <OzetRow
          label="Kalan"
          value={kalanVekalet}
          valueClass={kalanVekalet > 0 ? "pm-text-warn" : undefined}
          currency="vekalet"
          vekaletPb={vekaletPb}
        />
        <div className="pm-mali-ozet-progress">
          <div className="pm-mali-ozet-progress-head">
            <span>Tahsilat oranı</span>
            <strong>{data.tahsilatOrani.toFixed(1)}%</strong>
          </div>
          <div className="pm-mali-ozet-progress-bar">
            <div className="pm-mali-ozet-progress-fill" style={{ width: `${Math.min(100, data.tahsilatOrani)}%` }} />
          </div>
        </div>
      </div>

      <div className="pm-mali-ozet-block">
        <h3 className="pm-mali-ozet-block-title">Masraf avansı (TRY)</h3>
        <OzetRow label="Alınan avans" value={avans} />
        <OzetRow label="Yapılan masraf" value={masraf} valueClass="pm-text-danger" />
        {duzeltme !== 0 ? <OzetRow label="Düzeltme etkisi" value={duzeltme} /> : null}
        {masrafAvansiIadesi > 0 ? (
          <OzetRow label="Müvekkile iade edilen avans" value={masrafAvansiIadesi} valueClass="pm-text-warn" />
        ) : null}
        <OzetRow
          label="Güncel avans bakiyesi"
          value={kalanAvans}
          valueClass={kalanAvans > 0 ? "pm-text-success" : undefined}
        />
      </div>

      <div className="pm-mali-ozet-block">
        <h3 className="pm-mali-ozet-block-title">Kârlılık</h3>
        {buroGider > 0 ? (
          <OzetRow label="Büro karşıladığı gider" value={buroGider} valueClass="pm-text-danger" />
        ) : null}
        <OzetRow
          label="Net kazanç"
          value={net}
          valueClass={net > 0 ? "pm-text-success" : net < 0 ? "pm-text-danger" : undefined}
        />
      </div>
    </div>
  );
}

export function DosyaMaliOzetSection({ dosyaId, vekaletParaBirimi }: Props) {
  const [view, setView] = useState<ViewMode>("tumZamanlar");
  const [data, setData] = useState<DosyaMaliOzetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    if (!window.api) return;
    setLoading(true);
    setError(null);
    try {
      const r = await window.api.dosyaMaliOzet(dosyaId);
      if (!r.ok) {
        setError(r.mesaj ?? r.error ?? "Mali özet yüklenemedi.");
        setData(null);
        return;
      }
      setData(r.data);
    } catch {
      setError("Mali özet yüklenemedi.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dosyaId]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const vekaletPb = tryResolveParaBirimi(vekaletParaBirimi);

  if (loading) {
    return (
      <section className="pm-dosya-section">
        <p className="pm-muted">Mali özet yükleniyor…</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="pm-dosya-section">
        <p className="pm-form-error">{error ?? "Veri yok."}</p>
        <PremiumButton type="button" variant="ghost" onClick={() => void yukle()}>
          Yeniden dene
        </PremiumButton>
      </section>
    );
  }

  const activeData = view === "buDonem" && data.buDonem ? data.buDonem : data.tumZamanlar;

  return (
    <section className="pm-dosya-section pm-mali-ozet-section">
      <div className="pm-section-head">
        <h2 className="pm-section-title">Mali özet</h2>
      </div>

      <div className="pm-mali-ozet-toggle">
        <button
          type="button"
          className={`pm-mali-ozet-toggle-btn${view === "tumZamanlar" ? " pm-mali-ozet-toggle-btn--active" : ""}`}
          onClick={() => setView("tumZamanlar")}
        >
          Tüm zamanlar
        </button>
        {data.buDonem ? (
          <button
            type="button"
            className={`pm-mali-ozet-toggle-btn${view === "buDonem" ? " pm-mali-ozet-toggle-btn--active" : ""}`}
            onClick={() => setView("buDonem")}
          >
            {data.donemEtiketi ?? "Bu dönem"}
          </button>
        ) : null}
      </div>

      <OzetPanel data={activeData} vekaletPb={vekaletPb} />

      {view === "buDonem" ? (
        <p className="pm-mali-ozet-hint">
          Dönem görünümünde kararlaştırılan vekalet tutarı gösterilmez; yalnızca dönem içi tahsilatlar ve hareketler
          hesaplanır.
        </p>
      ) : null}
    </section>
  );
}
