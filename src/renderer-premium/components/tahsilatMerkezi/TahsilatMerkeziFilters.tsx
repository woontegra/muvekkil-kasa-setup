import { TAKSILAT_MERKEZI_GORUNUMLER, TAKSILAT_MERKEZI_GORUNUM_LABEL } from "@shared/constants/tahsilatMerkezi";
import type { TaksitDurum } from "@shared/types/vekalet";
import type { UseTahsilatMerkeziReturn } from "../../hooks/useTahsilatMerkezi";
import { PremiumButton } from "../PremiumButton";

type Props = {
  tm: UseTahsilatMerkeziReturn;
};

const DURUM_OPTIONS: { value: "" | TaksitDurum; label: string }[] = [
  { value: "", label: "Tüm durumlar" },
  { value: "GECIKTI", label: "Gecikti" },
  { value: "ODENMEDI", label: "Ödenmedi" },
  { value: "KISMI_ODENDI", label: "Kısmi ödendi" },
];

export function TahsilatMerkeziFilters({ tm }: Props) {
  return (
    <section className="pm-tahsilat-filters pm-stagger-item" aria-label="Tahsilat filtreleri">
      <div className="pm-tahsilat-tabs" role="tablist" aria-label="Görünüm">
        {TAKSILAT_MERKEZI_GORUNUMLER.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={tm.gorunum === g}
            className={`pm-tahsilat-tab${tm.gorunum === g ? " pm-tahsilat-tab--active" : ""}`}
            onClick={() => tm.setGorunum(g)}
          >
            {TAKSILAT_MERKEZI_GORUNUM_LABEL[g]}
          </button>
        ))}
      </div>

      <div className="pm-tahsilat-filters-body">
        <div className="pm-tahsilat-filters-grid">
          <label className="pm-field pm-tahsilat-filters-search">
            <span className="pm-field-label">Ara</span>
            <input
              type="search"
              className="pm-input"
              placeholder="Müvekkil, dosya veya taksit no…"
              value={tm.q}
              onChange={(e) => tm.setQ(e.target.value)}
            />
          </label>
          <label className="pm-field">
            <span className="pm-field-label">Müvekkil ID</span>
            <input
              type="number"
              className="pm-input"
              placeholder="Opsiyonel"
              value={tm.muvekkilId === "" ? "" : tm.muvekkilId}
              onChange={(e) => {
                const v = e.target.value.trim();
                tm.setMuvekkilId(v === "" ? "" : Number(v));
                tm.setDosyaId("");
              }}
            />
          </label>
          <label className="pm-field">
            <span className="pm-field-label">Dosya ID</span>
            <input
              type="number"
              className="pm-input"
              placeholder="Opsiyonel"
              value={tm.dosyaId === "" ? "" : tm.dosyaId}
              onChange={(e) => {
                const v = e.target.value.trim();
                tm.setDosyaId(v === "" ? "" : Number(v));
              }}
            />
          </label>
          <label className="pm-field">
            <span className="pm-field-label">Ödeme durumu</span>
            <select
              className="pm-input"
              value={tm.durum}
              onChange={(e) => tm.setDurum(e.target.value as TaksitDurum | "")}
            >
              {DURUM_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="pm-field">
            <span className="pm-field-label">Vade başlangıç</span>
            <input type="date" className="pm-input" value={tm.vadeBas} onChange={(e) => tm.setVadeBas(e.target.value)} />
          </label>
          <label className="pm-field">
            <span className="pm-field-label">Vade bitiş</span>
            <input type="date" className="pm-input" value={tm.vadeBit} onChange={(e) => tm.setVadeBit(e.target.value)} />
          </label>
        </div>
        <div className="pm-tahsilat-filters-actions">
          <PremiumButton type="button" variant="ghost" className="pm-btn--sm" onClick={() => void tm.yenile()}>
            Yenile
          </PremiumButton>
        </div>
      </div>
    </section>
  );
}
