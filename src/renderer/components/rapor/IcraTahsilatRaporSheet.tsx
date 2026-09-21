import type { OfficeSettings } from "@shared/types/office";
import type { IcraTahsilatListeSatir, IcraTahsilatUstOzet } from "@shared/types/icraTahsilat";
import { ICRA_ALACAK_DURUM_ETIKET, ICRA_ALACAK_TURU_ETIKET } from "@shared/constants/icraTahsilat";
import { PrintOfficeHeaderLeft } from "../print/PrintOfficeHeaderLeft";
import { bugunYmd, formatDateTr, formatTry } from "../../lib/format";
import { icraAlacakDurumEtiket, icraAlacakTuruEtiket, ilgiliMuvekkilDosyaMetni } from "../../lib/icraTahsilat";

type Props = {
  office: OfficeSettings;
  logoSrc?: string | null;
  tarihBas: string;
  tarihBit: string;
  alacakTuru: string;
  durum: string;
  arama: string;
  ozet: IcraTahsilatUstOzet | null;
  liste: IcraTahsilatListeSatir[];
};

function filtreEtiket(tur: string, durum: string, arama: string): string {
  const parcalar: string[] = [];
  if (tur && tur !== "TUMU") parcalar.push(`Tür: ${ICRA_ALACAK_TURU_ETIKET[tur as keyof typeof ICRA_ALACAK_TURU_ETIKET] ?? tur}`);
  if (durum && durum !== "TUMU") parcalar.push(`Durum: ${ICRA_ALACAK_DURUM_ETIKET[durum as keyof typeof ICRA_ALACAK_DURUM_ETIKET] ?? durum}`);
  if (arama.trim()) parcalar.push(`Arama: ${arama.trim()}`);
  return parcalar.length ? parcalar.join(" · ") : "Tüm kayıtlar";
}

export function IcraTahsilatRaporSheet({ office, logoSrc, tarihBas, tarihBit, alacakTuru, durum, arama, ozet, liste }: Props) {
  const toplamAlacak = liste.reduce((s, a) => s + a.toplamTutar, 0);
  const toplamOdenen = liste.reduce((s, a) => s + a.odenenToplam, 0);
  const toplamKalan = liste.reduce((s, a) => s + a.kalanTutar, 0);

  return (
    <article className="hesap-ozeti-doc">
      <header className="hesap-ozeti-header">
        <PrintOfficeHeaderLeft office={office} logoSrc={logoSrc} />
        <div className="hesap-ozeti-header-right">
          <h1 className="hesap-ozeti-title">İCRA TAHSİLAT RAPORU</h1>
          <p className="hesap-ozeti-meta">
            Tarih aralığı: {formatDateTr(tarihBas)} — {formatDateTr(tarihBit)}
          </p>
          <p className="hesap-ozeti-meta">Düzenleme: {formatDateTr(bugunYmd())}</p>
        </div>
      </header>

      <section className="hesap-ozeti-block">
        <h2 className="hesap-ozeti-h2">Filtre</h2>
        <p className="hesap-ozeti-muted">{filtreEtiket(alacakTuru, durum, arama)}</p>
      </section>

      <section className="hesap-ozeti-block">
        <h2 className="hesap-ozeti-h2">Özet</h2>
        <table className="hesap-ozeti-kv hesap-ozeti-kv--ozet">
          <tbody>
            {ozet ? (
              <>
                <tr>
                  <th>Genel toplam alacak</th>
                  <td className="hesap-ozeti-num">{formatTry(ozet.toplamAlacak)}</td>
                </tr>
                <tr>
                  <th>Genel tahsil edilen</th>
                  <td className="hesap-ozeti-num">{formatTry(ozet.tahsilEdilen)}</td>
                </tr>
                <tr>
                  <th>Genel kalan</th>
                  <td className="hesap-ozeti-num">{formatTry(ozet.kalanAlacak)}</td>
                </tr>
              </>
            ) : null}
            <tr>
              <th>Listelenen kayıt</th>
              <td>{liste.length}</td>
            </tr>
            <tr>
              <th>Listelenen toplam alacak</th>
              <td className="hesap-ozeti-num">{formatTry(toplamAlacak)}</td>
            </tr>
            <tr>
              <th>Listelenen ödenen</th>
              <td className="hesap-ozeti-num">{formatTry(toplamOdenen)}</td>
            </tr>
            <tr>
              <th>Listelenen kalan</th>
              <td className="hesap-ozeti-num hesap-ozeti-num--strong">{formatTry(toplamKalan)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="hesap-ozeti-block">
        <h2 className="hesap-ozeti-h2">Alacak listesi</h2>
        {liste.length === 0 ? (
          <p className="hesap-ozeti-muted">Filtreye uygun kayıt bulunamadı.</p>
        ) : (
          <table className="hesap-ozeti-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Borçlu</th>
                <th>Müvekkil / dosya</th>
                <th>Tür</th>
                <th className="hesap-ozeti-col-num">Toplam</th>
                <th className="hesap-ozeti-col-num">Ödenen</th>
                <th className="hesap-ozeti-col-num">Kalan</th>
                <th>Taksit</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((a) => (
                <tr key={a.id}>
                  <td>{a.id}</td>
                  <td>{a.borcluAdi}</td>
                  <td>{ilgiliMuvekkilDosyaMetni(a.muvekkilAdi, a.dosyaKonu)}</td>
                  <td>{icraAlacakTuruEtiket(a.alacakTuru)}</td>
                  <td className="hesap-ozeti-col-num">{formatTry(a.toplamTutar)}</td>
                  <td className="hesap-ozeti-col-num">{formatTry(a.odenenToplam)}</td>
                  <td className="hesap-ozeti-col-num">{formatTry(a.kalanTutar)}</td>
                  <td>{a.taksitSayisi}</td>
                  <td>{icraAlacakDurumEtiket(a.durum)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </article>
  );
}
