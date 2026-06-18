import type { KasaMakbuzPaketi, VekaletMakbuzPaketi } from "@shared/types/makbuz";
import { formatDateTr, formatTry } from "../../lib/format";
import { muvekkilMakbuzSatirlari, ofisDeger } from "../../lib/makbuz";
import { onayBadgeMetni, odemeEtiket, tipEtiket } from "../../lib/kasa";
import { tutarYaziylaTry } from "../../lib/tutarYaziyla";
import { MakbuzMetaBlock, MakbuzOfficeHeader, MakbuzSignFooter } from "./MakbuzLayout";

export function KasaMakbuzSheet({ paket }: { paket: Extract<KasaMakbuzPaketi, { ok: true }> }) {
  const { office, muvekkil, dosya, hareket } = paket;
  const makbuzNo = hareket.makbuzNo ?? "—";
  const tarih = formatDateTr(hareket.makbuzTarihi ?? hareket.tarih);

  return (
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
  );
}

export function VekaletMakbuzSheet({ paket }: { paket: Extract<VekaletMakbuzPaketi, { ok: true }> }) {
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
