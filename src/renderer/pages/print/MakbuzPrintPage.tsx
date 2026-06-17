import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { KasaMakbuzPaketi } from "@shared/types/makbuz";
import { MakbuzMetaBlock, MakbuzOfficeHeader, MakbuzPrintToolbar, MakbuzSignFooter } from "../../components/makbuz/MakbuzLayout";
import { formatDateTr, formatTry } from "../../lib/format";
import { muvekkilMakbuzSatirlari, ofisDeger } from "../../lib/makbuz";
import { onayBadgeMetni, odemeEtiket, tipEtiket } from "../../lib/kasa";
import { tutarYaziylaTry } from "../../lib/tutarYaziyla";

export function MakbuzPrintPage() {
  const { hareketId } = useParams();
  const hid = Number(hareketId);
  const navigate = useNavigate();
  const [paket, setPaket] = useState<KasaMakbuzPaketi | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!window.api || !Number.isFinite(hid)) return;
    void window.api.makbuzYazdirmaPaketi(hid).then((r) => {
      if (!r.ok) {
        setErr(r.mesaj ?? r.error ?? "Makbuz yüklenemedi");
        return;
      }
      setPaket(r);
    });
  }, [hid]);

  if (!Number.isFinite(hid)) return <p className="muted">Geçersiz makbuz adresi.</p>;
  if (err) return <p className="form-error">{err}</p>;
  if (!paket || !paket.ok) return <p className="muted">Yükleniyor…</p>;

  const { office, muvekkil, dosya, hareket } = paket;
  const makbuzNo = hareket.makbuzNo ?? "—";
  const tarih = formatDateTr(hareket.makbuzTarihi ?? hareket.tarih);

  return (
    <div className="makbuz-print-wrap">
      <MakbuzPrintToolbar onPrint={() => window.print()} onClose={() => navigate(-1)} />
      <article className="makbuz-sheet makbuz-sheet--a5l">
        <div className="makbuz-a5l-top">
          <MakbuzOfficeHeader office={office} />
          <MakbuzMetaBlock title="TAHSİLAT MAKBUZU" makbuzNo={makbuzNo} tarih={tarih} />
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
          <div className="makbuz-a5l-panel-h">Tahsilat</div>
          <table className="makbuz-a5l-kv">
            <tbody>
              <tr>
                <th>Hareket tipi</th>
                <td>{tipEtiket(hareket.islemTipi)}</td>
              </tr>
              <tr>
                <th>Belge no</th>
                <td>{ofisDeger(hareket.belgeNo)}</td>
              </tr>
              <tr>
                <th>Ödeme yöntemi</th>
                <td>{hareket.islemTipi === "DUZELTME" ? "—" : odemeEtiket(hareket.odemeYontemi)}</td>
              </tr>
              <tr>
                <th>Onay durumu</th>
                <td>{onayBadgeMetni(hareket)}</td>
              </tr>
              <tr>
                <th>Açıklama</th>
                <td>
                  <div className="makbuz-a5l-clamp2">{ofisDeger(hareket.aciklama)}</div>
                </td>
              </tr>
              <tr>
                <th>Tutar</th>
                <td className="makbuz-a5l-tutar">{formatTry(hareket.tutar)}</td>
              </tr>
              <tr>
                <th>Yazıyla</th>
                <td>
                  <div className="makbuz-a5l-clamp2 makbuz-a5l-yazi">{tutarYaziylaTry(hareket.tutar)}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <MakbuzSignFooter />
      </article>
    </div>
  );
}
