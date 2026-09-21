import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  UYARI_SEVIYE_ETIKET,
  UYARI_TUR_ETIKET,
  type MaliKontrolResponse,
  type MaliKontrolUyari,
} from "@shared/types/maliKontrol";
import { buildMaliKontrolNavigateUrl, canNavigateMaliKontrolUyari } from "@shared/lib/maliKontrolNavigation";

export function LegacyMaliKontrolCard() {
  const [data, setData] = useState<MaliKontrolResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try {
      const r = await window.api.maliKontrolUyarilar();
      if (!r.ok) {
        setData(null);
        setErr(r.mesaj);
        return;
      }
      setErr(null);
      setData(r.data);
    } catch {
      setErr("Mali kontrol yüklenemedi.");
      setData(null);
    }
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const toplam = data?.toplamUyari ?? 0;

  return (
    <section className="section-card desk-panel" aria-label="Mali kontrol">
      <div className="desk-panel-head">
        <span>Mali Kontrol Merkezi</span>
        <button type="button" className="btn btn-sm" onClick={() => void yukle()}>
          Yenile
        </button>
      </div>
      <div className="desk-panel-body desk-panel-body--pad-sm">
        {err ? <p className="desk-muted-compact">{err}</p> : null}
        <p className="desk-muted-compact">
          Toplam uyarı: <strong>{toplam}</strong>
          {data ? ` · Kritik: ${data.kritikUyari} · Uyarı: ${data.uyariUyari}` : null}
        </p>
        {data && data.uyarilar.length > 0 ? (
          <ul className="desk-list-compact">
            {data.uyarilar.slice(0, 8).map((u: MaliKontrolUyari) => {
              const url = canNavigateMaliKontrolUyari(u) ? buildMaliKontrolNavigateUrl(u) : null;
              return (
                <li key={u.id}>
                  <span>
                    [{UYARI_SEVIYE_ETIKET[u.seviye]}] {UYARI_TUR_ETIKET[u.tur]} — {u.baslik}
                  </span>
                  {url ? (
                    <Link className="desk-link-inline" to={url}>
                      {" "}
                      Git
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : !err ? (
          <p className="desk-muted-compact">Açık uyarı yok.</p>
        ) : null}
      </div>
    </section>
  );
}
