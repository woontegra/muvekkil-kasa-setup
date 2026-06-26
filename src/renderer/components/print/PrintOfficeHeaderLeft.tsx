import type { OfficeSettings } from "@shared/types/office";
import { ofisAdiGoster, ofisDeger } from "../../lib/makbuz";

export function PrintOfficeHeaderLeft({
  office,
  logoSrc,
}: {
  office: OfficeSettings;
  logoSrc?: string | null;
}) {
  const firma = ofisAdiGoster(office);
  const avukat = (office.avukatAdiSoyadi ?? "").trim();
  const logo = logoSrc?.trim();

  return (
    <div className="hesap-ozeti-header-left">
      {logo ? (
        <div className="hesap-ozeti-logo">
          <img src={logo} alt="" />
        </div>
      ) : null}
      <div>
        <div className="hesap-ozeti-firma">{firma}</div>
        {avukat ? <div className="hesap-ozeti-avukat">{avukat}</div> : null}
        <table className="hesap-ozeti-mini">
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
                <td>{ofisDeger(office.adres)}</td>
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
            {office.baroSicilNo?.trim() ? (
              <tr>
                <th>Baro sicil</th>
                <td>{ofisDeger(office.baroSicilNo)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
