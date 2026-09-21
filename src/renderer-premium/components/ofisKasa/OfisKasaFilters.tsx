import { tumKategoriSecenekleri } from "../../lib/ofisKasa";
import type { useOfisKasa } from "../../hooks/useOfisKasa";

type OfisApi = ReturnType<typeof useOfisKasa>;

type Props = {
  ofis: OfisApi;
};

export function OfisKasaFilters({ ofis }: Props) {
  const kategoriSecenekleri = tumKategoriSecenekleri();

  return (
    <section className="pm-dosya-section pm-ofis-filters pm-stagger-item" aria-label="Filtreler">
      <div className="pm-section-head">
        <h2 className="pm-section-title">Filtreler</h2>
        <div className="pm-section-head-right">
          <span className="pm-section-meta">
            {ofis.listeLoading ? "Yükleniyor…" : `${ofis.hareketler.length} kayıt`}
          </span>
        </div>
      </div>
      <div className="pm-ofis-filters-body">
        <div className="pm-ofis-filters-grid">
          <div className="pm-field">
            <label htmlFor="pm-ofk-tb">Tarih başı</label>
            <input
              id="pm-ofk-tb"
              className="pm-input"
              type="date"
              value={ofis.tb}
              onChange={(e) => ofis.setTb(e.target.value)}
            />
          </div>
          <div className="pm-field">
            <label htmlFor="pm-ofk-te">Tarih sonu</label>
            <input
              id="pm-ofk-te"
              className="pm-input"
              type="date"
              value={ofis.te}
              onChange={(e) => ofis.setTe(e.target.value)}
            />
          </div>
          <div className="pm-field">
            <label htmlFor="pm-ofk-tip">İşlem tipi</label>
            <select id="pm-ofk-tip" className="pm-input" value={ofis.tip} onChange={(e) => ofis.setTip(e.target.value)}>
              <option value="TUMU">Tümü</option>
              <option value="GELIR">Gelir</option>
              <option value="GIDER">Gider</option>
              <option value="DUZELTME">Düzeltme</option>
            </select>
          </div>
          <div className="pm-field">
            <label htmlFor="pm-ofk-kat">Kategori</label>
            <select id="pm-ofk-kat" className="pm-input" value={ofis.katSel} onChange={(e) => ofis.setKatSel(e.target.value)}>
              <option value="">Tümü</option>
              {kategoriSecenekleri.map((x) => (
                <option key={x.kod} value={x.kod}>
                  {x.etiket}
                </option>
              ))}
            </select>
          </div>
          <div className="pm-field pm-ofis-filters-search">
            <label htmlFor="pm-ofk-q">Arama</label>
            <input
              id="pm-ofk-q"
              className="pm-input"
              placeholder="Açıklama, belge, not veya özel kategori…"
              value={ofis.q}
              onChange={(e) => ofis.setQ(e.target.value)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
