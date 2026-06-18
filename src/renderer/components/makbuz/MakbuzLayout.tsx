import { useEffect, useState } from "react";
import type { OfficeSettings } from "@shared/types/office";
import { ofisAdiGoster, ofisDeger } from "../../lib/makbuz";

type Props = {
  office: OfficeSettings;
};

export function MakbuzOfficeHeader({ office }: Props) {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    const p = (office.logoPath ?? "").trim();
    if (!p || !window.api?.officeLogoDataUrl) {
      setLogoSrc(null);
      return;
    }
    void window.api.officeLogoDataUrl(p).then((url) => setLogoSrc(url));
  }, [office.logoPath]);

  const firma = ofisAdiGoster(office);
  const avukat = (office.avukatAdiSoyadi ?? "").trim();

  return (
    <div className="makbuz-a5l-office">
        <div className="makbuz-a5l-office-head">
          {logoSrc ? (
            <div className="makbuz-a5l-logo">
              <img src={logoSrc} alt="" />
            </div>
          ) : null}
          <div className="makbuz-a5l-office-text">
            <div className="makbuz-a5l-firma">{firma}</div>
            {avukat ? <div className="makbuz-a5l-avukat">{avukat}</div> : null}
          </div>
        </div>
        <table className="makbuz-a5l-mini">
          <tbody>
            {office.telefon?.trim() ? (
              <tr>
                <th>Tel</th>
                <td>{ofisDeger(office.telefon)}</td>
              </tr>
            ) : null}
            {office.eposta?.trim() ? (
              <tr>
                <th>E-posta</th>
                <td>{ofisDeger(office.eposta)}</td>
              </tr>
            ) : null}
            {office.adres?.trim() ? (
              <tr>
                <th>Adres</th>
                <td>
                  <div className="makbuz-a5l-clamp2">{ofisDeger(office.adres)}</div>
                </td>
              </tr>
            ) : null}
            {office.vergiNo?.trim() ? (
              <tr>
                <th>Vergi no</th>
                <td>{ofisDeger(office.vergiNo)}</td>
              </tr>
            ) : null}
            {office.vergiDairesi?.trim() ? (
              <tr>
                <th>V.D.</th>
                <td>{ofisDeger(office.vergiDairesi)}</td>
              </tr>
            ) : null}
            {office.baroAdi?.trim() ? (
              <tr>
                <th>Baro</th>
                <td>{ofisDeger(office.baroAdi)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
  );
}

export function MakbuzMetaBlock({
  title,
  makbuzNo,
  tarih,
}: {
  title: string;
  makbuzNo: string;
  tarih: string;
}) {
  return (
    <div className="makbuz-a5l-meta">
      <h1 className="makbuz-a5l-title">{title}</h1>
      <table className="makbuz-a5l-meta-tbl">
        <tbody>
          <tr>
            <th>Makbuz no</th>
            <td>{makbuzNo}</td>
          </tr>
          <tr>
            <th>Tarih</th>
            <td>{tarih}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function MakbuzSignFooter() {
  return (
    <>
      <div className="makbuz-a5l-sign">
        <div className="makbuz-a5l-sign-box">
          <div className="makbuz-a5l-sign-lbl">Teslim eden</div>
          <div className="makbuz-a5l-sign-line" />
          <div className="makbuz-a5l-sign-sub">Ad soyad · imza</div>
        </div>
        <div className="makbuz-a5l-sign-box">
          <div className="makbuz-a5l-sign-lbl">Teslim alan</div>
          <div className="makbuz-a5l-sign-line" />
          <div className="makbuz-a5l-sign-sub">Ad soyad · imza</div>
        </div>
      </div>
      <footer className="makbuz-a5l-foot">Bu belge bilgi işlem aracı ile düzenlenmiştir.</footer>
    </>
  );
}

export function MakbuzPrintToolbar({
  onPrint,
  onClose,
  printDisabled,
  closeDisabled,
  printLabel = "Yazdır",
}: {
  onPrint: () => void;
  onClose: () => void;
  printDisabled?: boolean;
  closeDisabled?: boolean;
  printLabel?: string;
}) {
  return (
    <div className="makbuz-toolbar no-print">
      <button type="button" className="btn btn-primary btn-sm" onClick={onPrint} disabled={printDisabled}>
        {printLabel}
      </button>
      <button type="button" className="btn btn-sm" onClick={onClose} disabled={closeDisabled}>
        Kapat
      </button>
    </div>
  );
}
