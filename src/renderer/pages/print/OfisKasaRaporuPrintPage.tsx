import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { OfisKasaRaporPaketi } from "@shared/types/ofisKasa";
import programLogo from "../../assets/logo-M6Wo_PDM.png";
import { formatDateTr, formatTry } from "../../lib/format";
import {
  ayBasiSonu,
  duzeltmeAltSatir,
  duzeltmeListeTutar,
  duzeltmeTurEtiketForRow,
  formatSignedTry,
  islemTipiEtiket,
  odemeEtiket,
  ofisKasaKategoriListeEtiketi,
  onayEtiket,
} from "../../lib/ofisKasa";

export function OfisKasaRaporuPrintPage() {
  const [params] = useSearchParams();
  const { bas, bit } = useMemo(() => {
    const fallback = ayBasiSonu();
    return {
      bas: (params.get("bas") ?? fallback.bas).trim().slice(0, 10),
      bit: (params.get("bit") ?? fallback.bit).trim().slice(0, 10),
    };
  }, [params]);
  const [paket, setPaket] = useState<OfisKasaRaporPaketi | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    if (!window.api?.ofisKasaRaporPaketi) {
      setPaket({ ok: false, mesaj: "Rapor servisi kullanılamıyor." });
      return;
    }
    try {
      const r = await window.api.ofisKasaRaporPaketi({ bas, bit });
      if (!r.ok) {
        setPaket(r);
        return;
      }
      setPaket(r);
      try {
        const lp = r.office.logoPath?.trim();
        if (lp) {
          const u = await window.api.officeLogoDataUrl(lp);
          setLogoUrl(u);
        } else {
          setLogoUrl(null);
        }
      } catch {
        setLogoUrl(null);
      }
    } catch {
      setPaket({ ok: false, mesaj: "Rapor verisi alınamadı." });
    }
  }, [bas, bit]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  if (!paket) {
    return <p className="muted">Yükleniyor…</p>;
  }

  if (!paket.ok) {
    return (
      <div className="hesap-ozeti-print-wrap">
        <p className="form-error">{paket.mesaj}</p>
        <Link to="/ofis-kasasi" className="btn no-print">
          Ofis kasasına dön
        </Link>
      </div>
    );
  }

  const office = paket.office;
  const hareketler = paket.hareketler;
  const receiptLogoSrc = logoUrl ?? programLogo;

  return (
    <div className="hesap-ozeti-print-wrap">
      <div className="hesap-ozeti-toolbar no-print">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Yazdır
        </button>
        <Link to="/ofis-kasasi" className="btn">
          Kapat
        </Link>
      </div>

      <article className="hesap-ozeti-doc">
        <header className="hesap-ozeti-header">
          <div className="hesap-ozeti-header-left">
            <div className="hesap-ozeti-logo">
              <img src={receiptLogoSrc} alt="" />
            </div>
            <div className="hesap-ozeti-office">
              {(office.ofisAdi ?? "").trim() ? <div className="hesap-ozeti-firma">{office.ofisAdi}</div> : null}
              {(office.avukatAdiSoyadi ?? "").trim() ? (
                <div className="hesap-ozeti-avukat">{office.avukatAdiSoyadi}</div>
              ) : null}
            </div>
          </div>
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
                <th>Toplam gelir</th>
                <td className="hesap-ozeti-num">{formatTry(paket.toplamGelir)}</td>
              </tr>
              <tr>
                <th>Toplam gider</th>
                <td className="hesap-ozeti-num">{formatTry(paket.toplamGider)}</td>
              </tr>
              <tr>
                <th>Düzeltme etkisi</th>
                <td className="hesap-ozeti-num">{formatSignedTry(paket.duzeltmeEtkisi)}</td>
              </tr>
              <tr>
                <th>Kasa bakiyesi</th>
                <td className="hesap-ozeti-num hesap-ozeti-num--strong">{formatTry(paket.kasaBakiyesi)}</td>
              </tr>
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
                    <td>{h.islemTipi === "DUZELTME" ? duzeltmeTurEtiketForRow(h) ?? "Düzeltme" : islemTipiEtiket(h.islemTipi)}</td>
                    <td>{ofisKasaKategoriListeEtiketi(h.kategori, h.ozelKategoriAdi)}</td>
                    <td>
                      {h.islemTipi === "DUZELTME" ? (
                        <>
                          <div>{h.aciklama?.trim() ? h.aciklama : "—"}</div>
                          {duzeltmeAltSatir(h) ? <div className="desk-kasa-duzeltme-alt">{duzeltmeAltSatir(h)}</div> : null}
                        </>
                      ) : (
                        h.aciklama?.trim() ? h.aciklama : "—"
                      )}
                    </td>
                    <td>{odemeEtiket(h)}</td>
                    <td>{h.belgeNo?.trim() ? h.belgeNo : "—"}</td>
                    <td className="hesap-ozeti-col-num">{formatTry(duzeltmeListeTutar(h))}</td>
                    <td>{onayEtiket(h)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </article>
    </div>
  );
}
