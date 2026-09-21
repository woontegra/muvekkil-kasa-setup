import {
  ICRA_ALACAK_DURUM_ETIKET,
  ICRA_ALACAK_DURUM_KODLARI,
  ICRA_ALACAK_TURU_ETIKET,
  ICRA_ALACAK_TURU_KODLARI,
} from "@shared/constants/icraTahsilat";
import type { useIcraTahsilat } from "../../hooks/useIcraTahsilat";

type IcraApi = ReturnType<typeof useIcraTahsilat>;

type Props = {
  icra: IcraApi;
};

export function IcraTahsilatFilters({ icra }: Props) {
  return (
    <section className="pm-dosya-section pm-icra-filters pm-stagger-item" aria-label="Filtreler">
      <div className="pm-section-head">
        <h2 className="pm-section-title">Filtreler</h2>
        <span className="pm-section-meta">
          {icra.listeLoading ? "Yükleniyor…" : `${icra.liste.length} kayıt`}
        </span>
      </div>
      <div className="pm-icra-filters-body">
        <div className="pm-icra-filters-grid">
          <div className="pm-field">
            <label htmlFor="pm-icra-tb">Başlangıç</label>
            <input
              id="pm-icra-tb"
              className="pm-input"
              type="date"
              value={icra.tb}
              onChange={(e) => icra.setTb(e.target.value)}
            />
          </div>
          <div className="pm-field">
            <label htmlFor="pm-icra-te">Bitiş</label>
            <input
              id="pm-icra-te"
              className="pm-input"
              type="date"
              value={icra.te}
              onChange={(e) => icra.setTe(e.target.value)}
            />
          </div>
          <div className="pm-field">
            <label htmlFor="pm-icra-tur">Alacak türü</label>
            <select id="pm-icra-tur" className="pm-input" value={icra.tur} onChange={(e) => icra.setTur(e.target.value)}>
              <option value="TUMU">Tümü</option>
              {ICRA_ALACAK_TURU_KODLARI.map((k) => (
                <option key={k} value={k}>
                  {ICRA_ALACAK_TURU_ETIKET[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="pm-field">
            <label htmlFor="pm-icra-durum">Durum</label>
            <select
              id="pm-icra-durum"
              className="pm-input"
              value={icra.durum}
              onChange={(e) => icra.setDurum(e.target.value)}
            >
              <option value="TUMU">Tümü</option>
              {ICRA_ALACAK_DURUM_KODLARI.map((k) => (
                <option key={k} value={k}>
                  {ICRA_ALACAK_DURUM_ETIKET[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="pm-field pm-icra-filters-search">
            <label htmlFor="pm-icra-q">Arama</label>
            <input
              id="pm-icra-q"
              className="pm-input"
              placeholder="Borçlu, müvekkil, dosya…"
              value={icra.q}
              onChange={(e) => icra.setQ(e.target.value)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
