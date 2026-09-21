import type { OfisKasaRaporPaketi } from "@shared/types/ofisKasa";
import { PARA_BIRIMLERI, formatMoney } from "@shared/lib/paraBirimi";
import { PrintOfficeHeaderLeft } from "../print/PrintOfficeHeaderLeft";
import { formatDateTr, formatTry } from "../../lib/format";
import {
  duzeltmeAltSatir,
  duzeltmeListeTutar,
  duzeltmeTurEtiketForRow,
  formatSignedTry,
  islemTipiEtiket,
  odemeEtiket,
  ofisKasaKategoriListeEtiketi,
  onayEtiket,
} from "../../lib/ofisKasa";

type Paket = Extract<OfisKasaRaporPaketi, { ok: true }>;

export function OfisKasaRaporSheet({ paket, logoSrc }: { paket: Paket; logoSrc?: string | null }) {
  const office = paket.office;
  const hareketler = paket.hareketler;

  return (
    <article className="hesap-ozeti-doc">
      <header className="hesap-ozeti-header">
        <PrintOfficeHeaderLeft office={office} logoSrc={logoSrc} />
        <div className="hesap-ozeti-header-right">
          <h1 className="hesap-ozeti-title">OFİS KASA RAPORU</h1>
          <p className="hesap-ozeti-meta">
            Tarih aralığı: {formatDateTr(paket.tarihBas)} — {formatDateTr(paket.tarihBit)}
          </p>
        </div>
      </header>

      <section className="hesap-ozeti-block">
        <h2 className="hesap-ozeti-h2">Özet</h2>
        <table className="hesap-ozeti-kv hesap-ozeti-kv--ozet">
          <tbody>
            <tr>
              <th>Devreden bakiye (TRY)</th>
              <td className="hesap-ozeti-num">{formatTry(paket.devredenBakiye)}</td>
            </tr>
            <tr>
              <th>Dönem geliri (TRY)</th>
              <td className="hesap-ozeti-num">{formatTry(paket.donemGelir)}</td>
            </tr>
            <tr>
              <th>Dönem gideri (TRY)</th>
              <td className="hesap-ozeti-num">{formatTry(paket.donemGider)}</td>
            </tr>
            <tr>
              <th>Dönem düzeltme etkisi (TRY)</th>
              <td className="hesap-ozeti-num">{formatSignedTry(paket.donemDuzeltmeEtkisi)}</td>
            </tr>
            <tr>
              <th>Dönem sonu kasa bakiyesi (TRY)</th>
              <td className="hesap-ozeti-num hesap-ozeti-num--strong">{formatTry(paket.kasaBakiyesi)}</td>
            </tr>
            {PARA_BIRIMLERI.map((pb) => (
              <tr key={pb}>
                <th>{pb} kasa bakiyesi</th>
                <td className="hesap-ozeti-num hesap-ozeti-num--strong">{formatMoney(paket.bakiyeler[pb], pb)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="hesap-ozeti-block">
        <h2 className="hesap-ozeti-h2">Hareket listesi</h2>
        {hareketler.length === 0 ? (
          <p className="hesap-ozeti-muted">Bu tarih aralığında ofis kasa hareketi bulunamadı.</p>
        ) : (
          <table className="hesap-ozeti-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Tip</th>
                <th>PB</th>
                <th>Kategori</th>
                <th>Açıklama</th>
                <th>Ödeme</th>
                <th>Belge no</th>
                <th className="hesap-ozeti-col-num">Tutar</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {hareketler.map((h) => (
                <tr key={h.id}>
                  <td>{formatDateTr(h.tarih)}</td>
                  <td>
                    {h.islemTipi === "DUZELTME" ? duzeltmeTurEtiketForRow(h) ?? "Düzeltme" : islemTipiEtiket(h.islemTipi)}
                  </td>
                  <td>{h.paraBirimi}</td>
                  <td>{ofisKasaKategoriListeEtiketi(h.kategori, h.ozelKategoriAdi)}</td>
                  <td>
                    {h.islemTipi === "DUZELTME" ? (
                      <>
                        <div>{h.aciklama?.trim() ? h.aciklama : "—"}</div>
                        {duzeltmeAltSatir(h) ? <div className="desk-kasa-duzeltme-alt">{duzeltmeAltSatir(h)}</div> : null}
                      </>
                    ) : h.aciklama?.trim() ? (
                      h.aciklama
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{odemeEtiket(h)}</td>
                  <td>{h.belgeNo?.trim() ? h.belgeNo : "—"}</td>
                  <td className="hesap-ozeti-col-num">{formatMoney(duzeltmeListeTutar(h), h.paraBirimi)}</td>
                  <td>{onayEtiket(h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </article>
  );
}
