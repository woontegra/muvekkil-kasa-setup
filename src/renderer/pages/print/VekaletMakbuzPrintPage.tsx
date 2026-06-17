import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { VekaletMakbuzPaketi } from "@shared/types/makbuz";
import { MakbuzMetaBlock, MakbuzOfficeHeader, MakbuzPrintToolbar, MakbuzSignFooter } from "../../components/makbuz/MakbuzLayout";
import { formatDateTr, formatTry } from "../../lib/format";
import { muvekkilMakbuzSatirlari, ofisDeger } from "../../lib/makbuz";
import { odemeEtiket } from "../../lib/kasa";
import { tutarYaziylaTry } from "../../lib/tutarYaziyla";

function VekaletMakbuzSheet({ paket }: { paket: Extract<VekaletMakbuzPaketi, { ok: true }> }) {
  const { office, muvekkil, dosya, vekalet, taksit, odeme, odenenToplam, kalanVekalet } = paket;
  const makbuzNo = odeme.makbuzNo ?? "—";
  const tarih = formatDateTr(odeme.odemeTarihi);

  return (
    <article className="makbuz-sheet makbuz-sheet--a5l">
      <div className="makbuz-a5l-top">
        <MakbuzOfficeHeader office={office} />
        <MakbuzMetaBlock title="VEKALET ÜCRETİ TAHSİLAT MAKBUZU" makbuzNo={makbuzNo} tarih={tarih} />
      </div>

      <section className="makbuz-a5l-panel">
        <div className="makbuz-a5l-panel-h">Müvekkil ve dosya</div>
        <table className="makbuz-a5l-kv">
          <tbody>
            {muvekkilMakbuzSatirlari(muvekkil).map((row) => (
              <tr key={row.etiket}>
                <th>{row.etiket}</th>
                <td>{row.deger}</td>
              </tr>
            ))}
            <tr>
              <th>Dosya konusu</th>
              <td>{ofisDeger(dosya.konuBasligi)}</td>
            </tr>
            <tr>
              <th>Mahkeme / icra</th>
              <td>{ofisDeger(dosya.mahkemeAdi)}</td>
            </tr>
            <tr>
              <th>Dosya no</th>
              <td>{ofisDeger(dosya.dosyaNumarasi)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="makbuz-a5l-panel makbuz-a5l-panel--tahsil">
        <div className="makbuz-a5l-panel-h">Vekalet ücreti tahsilatı</div>
        <table className="makbuz-a5l-kv">
          <tbody>
            <tr>
              <th>Taksit no</th>
              <td>{taksit.taksitNo}</td>
            </tr>
            <tr>
              <th>Taksit tutarı</th>
              <td className="makbuz-a5l-tutar">{formatTry(taksit.tutar)}</td>
            </tr>
            <tr>
              <th>Ödeme tarihi</th>
              <td>{formatDateTr(odeme.odemeTarihi)}</td>
            </tr>
            <tr>
              <th>Ödeme yöntemi</th>
              <td>{odemeEtiket(odeme.odemeYontemi)}</td>
            </tr>
            <tr>
              <th>Bu makbuzdaki tahsilat</th>
              <td className="makbuz-a5l-tutar">{formatTry(odeme.tutar)}</td>
            </tr>
            <tr>
              <th>Yazıyla (bu tahsilat)</th>
              <td>
                <div className="makbuz-a5l-clamp2 makbuz-a5l-yazi">{tutarYaziylaTry(odeme.tutar)}</div>
              </td>
            </tr>
            <tr>
              <th>Anlaşılan vekalet</th>
              <td className="makbuz-a5l-tutar">{formatTry(vekalet.anlasilanTutar)}</td>
            </tr>
            <tr>
              <th>Ödenen toplam</th>
              <td className="makbuz-a5l-tutar">{formatTry(odenenToplam)}</td>
            </tr>
            <tr>
              <th>Kalan vekalet</th>
              <td className="makbuz-a5l-tutar">{formatTry(kalanVekalet)}</td>
            </tr>
            <tr>
              <th>SMM durumu</th>
              <td>{odeme.smmKesildiMi ? "SMM kesildi" : "SMM bekliyor"}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <MakbuzSignFooter />
    </article>
  );
}

export function VekaletMakbuzOdemePrintPage() {
  const { odemeId } = useParams();
  const oid = Number(odemeId);
  const navigate = useNavigate();
  const [paket, setPaket] = useState<VekaletMakbuzPaketi | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!window.api || !Number.isFinite(oid)) return;
    void window.api.getVekaletPrintPackageByOdemeId(oid).then((r) => {
      if (!r.ok) {
        setErr(r.mesaj ?? r.error ?? "Makbuz yüklenemedi");
        return;
      }
      setPaket(r);
    });
  }, [oid]);

  if (!Number.isFinite(oid)) return <p className="muted">Geçersiz makbuz adresi.</p>;
  if (err) return <p className="form-error">{err}</p>;
  if (!paket || !paket.ok) return <p className="muted">Yükleniyor…</p>;

  return (
    <div className="makbuz-print-wrap">
      <MakbuzPrintToolbar onPrint={() => window.print()} onClose={() => navigate(-1)} />
      <VekaletMakbuzSheet paket={paket} />
    </div>
  );
}

export function VekaletMakbuzPrintPage() {
  const { taksitId } = useParams();
  const tid = Number(taksitId);
  const navigate = useNavigate();
  const [paket, setPaket] = useState<VekaletMakbuzPaketi | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!window.api || !Number.isFinite(tid)) return;
    void window.api.getVekaletReceiptDataByInstallmentId(tid).then((r) => {
      if (!r.ok) {
        setErr(r.mesaj ?? r.error ?? "Makbuz yüklenemedi");
        return;
      }
      setPaket(r);
    });
  }, [tid]);

  if (!Number.isFinite(tid)) return <p className="muted">Geçersiz makbuz adresi.</p>;
  if (err) return <p className="form-error">{err}</p>;
  if (!paket || !paket.ok) return <p className="muted">Yükleniyor…</p>;

  return (
    <div className="makbuz-print-wrap">
      <MakbuzPrintToolbar onPrint={() => window.print()} onClose={() => navigate(-1)} />
      <VekaletMakbuzSheet paket={paket} />
    </div>
  );
}
