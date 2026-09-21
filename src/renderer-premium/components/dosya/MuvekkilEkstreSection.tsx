import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MuvekkilEkstrePayload } from "@shared/types/muvekkilEkstre";
import { formatMoney, PARA_BIRIMLERI, tryResolveParaBirimi } from "@shared/lib/paraBirimi";
import { bugunYmd, formatDateTr } from "../../lib/format";
import { PremiumButton } from "../PremiumButton";

type Props = {
  dosyaId: number;
};

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="pm-ekstre-kpi">
      <span className="pm-ekstre-kpi-k">{label}</span>
      <strong className="pm-ekstre-kpi-v">{value}</strong>
    </div>
  );
}

export function MuvekkilEkstreSection({ dosyaId }: Props) {
  const navigate = useNavigate();
  const [itibariyle, setItibariyle] = useState(bugunYmd());
  const [ekstre, setEkstre] = useState<MuvekkilEkstrePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    if (!window.api) return;
    setLoading(true);
    setError(null);
    try {
      const r = await window.api.dosyaMuvekkilEkstre(dosyaId, { itibariyleTarih: itibariyle });
      if (!r.ok) {
        setError(r.mesaj ?? r.error ?? "Ekstre yüklenemedi.");
        setEkstre(null);
        return;
      }
      setEkstre(r.data);
    } catch {
      setError("Ekstre yüklenemedi.");
      setEkstre(null);
    } finally {
      setLoading(false);
    }
  }, [dosyaId, itibariyle]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  function yazdir() {
    navigate(`/print/muvekkil-ekstre/${dosyaId}?itibariyle=${encodeURIComponent(itibariyle)}`);
  }

  const v = ekstre?.vekaletOzeti;
  const vekPb = tryResolveParaBirimi(v?.paraBirimi);
  const a = ekstre?.masrafAvansiOzeti;
  const ofis = ekstre?.dosyaDisiOfisGelirleri;

  return (
    <section className="pm-dosya-section pm-ekstre-section">
      <div className="pm-section-head">
        <div>
          <h2 className="pm-section-title">Müvekkil ekstresi</h2>
          <p className="pm-section-desc">
            Müvekkile sunulacak vekalet ve masraf avansı özeti. Büro içi kârlılık ve iç notlar dahil edilmez.
          </p>
        </div>
        <div className="pm-ekstre-actions">
          <label className="pm-ekstre-date">
            <span>İtibarıyla tarih</span>
            <input type="date" value={itibariyle} onChange={(e) => setItibariyle(e.target.value)} />
          </label>
          <PremiumButton type="button" variant="ghost" onClick={() => setItibariyle(bugunYmd())}>
            Bugün
          </PremiumButton>
          <PremiumButton type="button" variant="ghost" disabled={!ekstre} onClick={yazdir}>
            Yazdır / PDF
          </PremiumButton>
        </div>
      </div>

      {loading ? <p className="pm-muted">Müvekkil ekstresi hazırlanıyor…</p> : null}
      {error ? (
        <>
          <p className="pm-form-error">{error}</p>
          <PremiumButton type="button" variant="ghost" onClick={() => void yukle()}>
            Yeniden dene
          </PremiumButton>
        </>
      ) : null}

      {!loading && ekstre && v && a ? (
        <>
          <div className="pm-ekstre-kpi-grid">
            <SummaryCard label={`Kararlaştırılan vekalet (${vekPb})`} value={formatMoney(Number(v.kararlastirilanToplam), vekPb)} />
            <SummaryCard label="Tahsil edilen" value={formatMoney(Number(v.tahsilEdilenToplam), vekPb)} />
            <SummaryCard label="Kalan vekalet" value={formatMoney(Number(v.kalanToplam), vekPb)} />
            <SummaryCard label="Avans bakiyesi (TRY)" value={formatMoney(Number(a.guncelBakiye), "TRY")} />
          </div>

          {ofis && ofis.hareketler.length > 0 ? (
            <div className="pm-ekstre-ofis-info">
              <strong>Dosya dışı ofis geliri (bilgi)</strong>
              <ul>
                {PARA_BIRIMLERI.map((pb) => {
                  const t = ofis.byCurrency[pb]?.toplam;
                  if (!t || Number(t) === 0) return null;
                  return (
                    <li key={pb}>
                      {pb}: {formatMoney(Number(t), pb)}
                    </li>
                  );
                })}
              </ul>
              <span className="pm-muted">{ofis.hareketler.length} kayıt — vekalet/masraf toplamlarına dahil değildir</span>
            </div>
          ) : null}

          <p className="pm-ekstre-meta">
            {ekstre.itibariyleAciklama} · Ref: {ekstre.belgeRef} · Ekstre tarihi: {formatDateTr(ekstre.ekstreTarihi)}
          </p>

          {ekstre.taksitler.length > 0 ? (
            <div className="pm-ekstre-table-wrap">
              <h3 className="pm-ekstre-subtitle">Taksitler</h3>
              <table className="pm-table pm-table--compact">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Vade</th>
                    <th>Tutar</th>
                    <th>Kalan</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {ekstre.taksitler.map((t) => (
                    <tr key={t.id}>
                      <td>{t.taksitNo}</td>
                      <td>{formatDateTr(t.vadeTarihi)}</td>
                      <td>{formatMoney(Number(t.taksitTutari), vekPb)}</td>
                      <td>{formatMoney(Number(t.kalanTutar), vekPb)}</td>
                      <td>{t.durum}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {ekstre.masrafHareketleri.length > 0 ? (
            <div className="pm-ekstre-table-wrap">
              <h3 className="pm-ekstre-subtitle">Masraf hareketleri</h3>
              <table className="pm-table pm-table--compact">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Belge</th>
                    <th>Tür</th>
                    <th>Giriş</th>
                    <th>Çıkış</th>
                    <th>Bakiye</th>
                  </tr>
                </thead>
                <tbody>
                  {ekstre.masrafHareketleri.map((h) => (
                    <tr key={h.id}>
                      <td>{formatDateTr(h.tarih)}</td>
                      <td>{h.belgeNo}</td>
                      <td>{h.islemTuru}</td>
                      <td>{h.giris !== "0.00" ? formatMoney(Number(h.giris), "TRY") : "—"}</td>
                      <td>{h.cikis !== "0.00" ? formatMoney(Number(h.cikis), "TRY") : "—"}</td>
                      <td>{formatMoney(Number(h.bakiyeSonrasi), "TRY")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <p className="pm-ekstre-dipnot">{ekstre.dipnot}</p>
        </>
      ) : null}
    </section>
  );
}
