import type { DosyaHesapOzetPaketi } from "@shared/types/hesapOzet";
import { formatDateTr, formatSignedTry, formatTry } from "../../lib/format";
import { kasaIslemTipiEtiket, kasaTurEk, muvekkilHesapOzetSatirlari } from "../../lib/hesapOzet";
import { hareketAciklamaMasraf, odemeEtiket, onayBadgeMetni } from "../../lib/kasa";
import { taksitDurumEtiket } from "../../lib/vekalet";
import { PrintOfficeHeaderLeft } from "../print/PrintOfficeHeaderLeft";

export function HesapOzetSheet({
  paket,
  logoSrc,
}: {
  paket: Extract<DosyaHesapOzetPaketi, { ok: true }>;
  logoSrc?: string | null;
}) {
  const { muvekkil, dosya, kasaOzet, hareketler, vekalet, taksitler, vekaletOzet, office } = paket;

  return (
    <article className="hesap-ozeti-doc">
      <header className="hesap-ozeti-header">
        <PrintOfficeHeaderLeft office={office} logoSrc={logoSrc} />
        <div className="hesap-ozeti-header-right">
          <h1 className="hesap-ozeti-title">DOSYA HESAP ÖZETİ / EKSTRE</h1>
          <p className="hesap-ozeti-meta">Düzenleme tarihi: {formatDateTr(paket.duzenlemeTarihi)}</p>
        </div>
      </header>

      <section className="hesap-ozeti-block">
        <h2 className="hesap-ozeti-h2">Müvekkil</h2>
        <table className="hesap-ozeti-kv">
          <tbody>
            {muvekkilHesapOzetSatirlari(muvekkil).map((row) => (
              <tr key={row.etiket}>
                <th>{row.etiket}</th>
                <td>{row.deger}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="hesap-ozeti-block">
        <h2 className="hesap-ozeti-h2">Dosya</h2>
        <table className="hesap-ozeti-kv">
          <tbody>
            <tr>
              <th>Konu başlığı</th>
              <td>{ofisDeger(dosya.konuBasligi)}</td>
            </tr>
            <tr>
              <th>Mahkeme / icra dairesi</th>
              <td>{ofisDeger(dosya.mahkemeAdi)}</td>
            </tr>
            <tr>
              <th>Dosya numarası</th>
              <td>{ofisDeger(dosya.dosyaNumarasi)}</td>
            </tr>
            <tr>
              <th>Dosya notu</th>
              <td>{ofisDeger(dosya.not)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="hesap-ozeti-block">
        <h2 className="hesap-ozeti-h2">Avans ve masraf özeti</h2>
        <table className="hesap-ozeti-kv hesap-ozeti-kv--ozet">
          <tbody>
            <tr>
              <th>Toplam alınan avans</th>
              <td className="hesap-ozeti-num">{formatTry(kasaOzet.toplamAlinanAvans)}</td>
            </tr>
            <tr>
              <th>Toplam yapılan masraf</th>
              <td className="hesap-ozeti-num">{formatTry(kasaOzet.toplamYapilanMasraf)}</td>
            </tr>
            <tr>
              <th>Düzeltmeler toplamı (net)</th>
              <td className="hesap-ozeti-num">{formatSignedTry(kasaOzet.duzeltmelerNet)}</td>
            </tr>
            <tr>
              <th>Kalan avans</th>
              <td className="hesap-ozeti-num hesap-ozeti-num--strong">{formatTry(kasaOzet.kalanAvans)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="hesap-ozeti-block">
        <h2 className="hesap-ozeti-h2">Kasa hareketleri</h2>
        {hareketler.length === 0 ? (
          <p className="hesap-ozeti-muted">Kasa hareketi kaydı yok.</p>
        ) : (
          <table className="hesap-ozeti-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>İşlem tipi</th>
                <th>Tür / ek</th>
                <th className="hesap-ozeti-col-num">Tutar</th>
                <th>Belge no</th>
                <th>Açıklama</th>
                <th>Masrafı yapan</th>
                <th>Onay</th>
              </tr>
            </thead>
            <tbody>
              {hareketler.map((h) => (
                <tr key={h.id}>
                  <td>{formatDateTr(h.tarih)}</td>
                  <td>{kasaIslemTipiEtiket(h.islemTipi)}</td>
                  <td>{kasaTurEk(h, odemeEtiket)}</td>
                  <td className="hesap-ozeti-col-num">
                    {h.islemTipi === "DUZELTME" ? formatSignedTry(h.tutar) : formatTry(h.tutar)}
                  </td>
                  <td>{ofisDeger(h.belgeNo)}</td>
                  <td>{hareketAciklamaMasraf(h)}</td>
                  <td>{ofisDeger(h.masrafiYapanKisi)}</td>
                  <td>{onayBadgeMetni(h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="hesap-ozeti-block">
        <h2 className="hesap-ozeti-h2">Vekalet ücreti</h2>
        <table className="hesap-ozeti-kv">
          <tbody>
            <tr>
              <th>Anlaşılan vekalet ücreti</th>
              <td className="hesap-ozeti-num">{formatTry(vekaletOzet.anlasilanTutar)}</td>
            </tr>
            <tr>
              <th>Ödenen toplam</th>
              <td className="hesap-ozeti-num">{formatTry(vekaletOzet.odenenToplam)}</td>
            </tr>
            <tr>
              <th>Kalan vekalet ücreti</th>
              <td className="hesap-ozeti-num hesap-ozeti-num--strong">{formatTry(vekaletOzet.kalanVekalet)}</td>
            </tr>
            <tr>
              <th>Açıklama</th>
              <td>{ofisDeger(vekalet.aciklama)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="hesap-ozeti-block">
        <h2 className="hesap-ozeti-h2">Vekalet taksitleri</h2>
        {taksitler.length === 0 ? (
          <p className="hesap-ozeti-muted">Taksit kaydı yok.</p>
        ) : (
          <table className="hesap-ozeti-table">
            <thead>
              <tr>
                <th>Taksit no</th>
                <th>Vade tarihi</th>
                <th className="hesap-ozeti-col-num">Tutar</th>
                <th>Durum</th>
                <th>Ödeme tarihi</th>
                <th>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {taksitler.map((t) => (
                <tr key={t.id}>
                  <td>{t.taksitNo}</td>
                  <td>{t.vadeTarihi ? formatDateTr(t.vadeTarihi) : "—"}</td>
                  <td className="hesap-ozeti-col-num">{formatTry(t.tutar)}</td>
                  <td>{taksitDurumEtiket(t.durum)}</td>
                  <td>{t.sonOdemeTarihi ? formatDateTr(t.sonOdemeTarihi) : "—"}</td>
                  <td>{ofisDeger(t.aciklama)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="hesap-ozeti-sonuc">
        <p className="hesap-ozeti-sonuc-line">
          <strong>Dosya avans bakiyesi:</strong> {formatTry(kasaOzet.kalanAvans)}
        </p>
        <p className="hesap-ozeti-sonuc-line">
          <strong>Kalan vekalet ücreti:</strong> {formatTry(vekaletOzet.kalanVekalet)}
        </p>
        <p className="hesap-ozeti-notice">
          Bu özet, dosyaya ait kayıtlı avans, masraf, düzeltme, vekalet ücreti ve taksit bilgilerine dayanmaktadır.
        </p>
      </section>

      <div className="hesap-ozeti-sign">
        <div className="hesap-ozeti-sign-box">
          <div className="hesap-ozeti-sign-lbl">Hazırlayan</div>
          <div className="hesap-ozeti-sign-line" />
          <div className="hesap-ozeti-sign-sub">Ad soyad · imza</div>
        </div>
        <div className="hesap-ozeti-sign-box">
          <div className="hesap-ozeti-sign-lbl">Müvekkil / Teslim alan</div>
          <div className="hesap-ozeti-sign-line" />
          <div className="hesap-ozeti-sign-sub">Ad soyad · imza</div>
        </div>
      </div>
    </article>
  );
}
