import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UYARI_SEVIYE_ETIKET,
  UYARI_TUR_ETIKET,
  type MaliKontrolResponse,
  type MaliKontrolUyari,
  type UyariSeviyesi,
  type UyariTuru,
} from "@shared/types/maliKontrol";
import { formatMoney, type ParaBirimi } from "@shared/lib/paraBirimi";
import { buildMaliKontrolNavigateUrl, canNavigateMaliKontrolUyari } from "@shared/lib/maliKontrolNavigation";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = { enabled: boolean };
type ViewMode = "tum" | "kritik" | "uyari" | "bilgi";

function parseUyariTutar(raw: string | null): number | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  let normalized: string;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) || (t.includes(",") && t.includes("."))) {
    normalized = t.replace(/\./g, "").replace(",", ".");
  } else if (t.includes(",")) {
    normalized = t.replace(",", ".");
  } else {
    normalized = t;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatUyariTutar(tutar: string | null, paraBirimi: ParaBirimi | null): string | null {
  const n = parseUyariTutar(tutar);
  if (n == null) return tutar;
  return formatMoney(n, paraBirimi ?? "TRY");
}

export function MaliKontrolCard({ enabled }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<MaliKontrolResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("tum");
  const [turFilter, setTurFilter] = useState<UyariTuru | "ALL">("ALL");

  const yukle = useCallback(async () => {
    if (!enabled || !window.api?.maliKontrolUyarilar) return;
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
  }, [enabled]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const filtered = useMemo(() => {
    if (!data) return [] as MaliKontrolUyari[];
    return data.uyarilar.filter((u) => {
      if (view === "kritik" && u.seviye !== "KRITIK") return false;
      if (view === "uyari" && u.seviye !== "UYARI") return false;
      if (view === "bilgi" && u.seviye !== "BILGI") return false;
      if (turFilter !== "ALL" && u.tur !== turFilter) return false;
      return true;
    });
  }, [data, view, turFilter]);

  if (!enabled) return null;

  /** Tek kaynak: API özeti (filtre dışı; dış kart + modal footer). */
  const toplam = data?.toplamUyari ?? 0;
  const kritik = data?.kritikUyari ?? 0;
  const uyari = data?.uyariUyari ?? 0;
  const bilgi = data?.bilgiUyari ?? 0;
  const filteredCount = filtered.length;
  const filterActive = view !== "tum" || turFilter !== "ALL";

  const toneClass =
    kritik > 0
      ? "pm-mk-card--kritik"
      : uyari > 0
        ? "pm-mk-card--uyari"
        : toplam === 0
          ? "pm-mk-card--temiz"
          : "pm-mk-card--bilgi";

  function git(u: MaliKontrolUyari) {
    if (!canNavigateMaliKontrolUyari(u)) return;
    const url = buildMaliKontrolNavigateUrl(u.actionPayload);
    setOpen(false);
    navigate(url);
  }

  const seviyeClass = (s: UyariSeviyesi) =>
    s === "KRITIK" ? "pm-mk-row--kritik" : s === "UYARI" ? "pm-mk-row--uyari" : "pm-mk-row--bilgi";

  function openMerkez() {
    void yukle();
    setOpen(true);
  }

  return (
    <>
      <section
        className={`pm-overview-panel pm-dash-side-card pm-mk-card ${toneClass}`}
        aria-label="Mali Kontrol Merkezi"
        data-mk-toplam={toplam}
        data-mk-kritik={kritik}
        data-mk-uyari={uyari}
        data-mk-bilgi={bilgi}
      >
        <div className="pm-mk-card-head">
          <div className="pm-mk-card-titles">
            <h3 className="pm-overview-panel-title">Mali Kontrol Merkezi</h3>
            {err ? <p className="pm-mk-card-err">{err}</p> : null}
          </div>
          <span className="pm-mk-card-badge" aria-label={`${toplam} açık kayıt`}>
            {toplam === 0 ? "Temiz" : `${toplam} açık kayıt`}
          </span>
        </div>

        {toplam === 0 && !err ? (
          <p className="pm-mk-card-empty">Kontrol edilecek mali uyarı yok.</p>
        ) : (
          <>
            <p className="pm-mk-card-breakdown">
              <span className="pm-mk-chip pm-mk-chip--kritik">{kritik} kritik</span>
              <span className="pm-mk-chip-sep" aria-hidden>
                ·
              </span>
              <span className="pm-mk-chip pm-mk-chip--uyari">{uyari} uyarı</span>
              <span className="pm-mk-chip-sep" aria-hidden>
                ·
              </span>
              <span className="pm-mk-chip pm-mk-chip--bilgi">{bilgi} bilgi</span>
            </p>
            <div className="pm-mk-card-meters" aria-hidden>
              <span className="pm-mk-meter pm-mk-meter--kritik" title={`${kritik} kritik`} />
              <span className="pm-mk-meter pm-mk-meter--uyari" title={`${uyari} uyarı`} />
              <span className="pm-mk-meter pm-mk-meter--bilgi" title={`${bilgi} bilgi`} />
            </div>
          </>
        )}

        <PremiumButton type="button" className="pm-mk-card-cta" onClick={openMerkez}>
          Kontrol merkezini aç
        </PremiumButton>
      </section>

      <PremiumModal
        open={open}
        title="Mali Kontrol Merkezi"
        wide
        onClose={() => setOpen(false)}
        footer={
          <>
            <span className="pm-mk-footer-counts" style={{ marginRight: "auto" }} data-mk-footer-toplam={toplam}>
              {data ? (
                <>
                  <span>{toplam} toplam</span>
                  <span className="pm-mk-count--kritik">{kritik} kritik</span>
                  <span className="pm-mk-count--uyari">{uyari} uyarı</span>
                  <span>{bilgi} bilgi</span>
                  {filterActive ? <span className="pm-mk-footer-shown">Gösterilen: {filteredCount}</span> : null}
                </>
              ) : null}
            </span>
            <PremiumButton type="button" variant="ghost" onClick={() => void yukle()}>
              Yenile
            </PremiumButton>
            <PremiumButton type="button" variant="ghost" onClick={() => setOpen(false)}>
              Kapat
            </PremiumButton>
          </>
        }
      >
        <div className="pm-mk-toolbar">
          <div className="pm-mk-tabs" role="tablist" aria-label="Seviye filtresi">
            {(
              [
                ["tum", "Tüm açık"],
                ["kritik", "Kritik"],
                ["uyari", "Uyarı"],
                ["bilgi", "Bilgi"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                className={`pm-mk-tab${view === id ? " pm-mk-tab--active" : ""}`}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            className="pm-input pm-mk-tur-select"
            value={turFilter}
            onChange={(e) => setTurFilter(e.target.value as UyariTuru | "ALL")}
            aria-label="Uyarı türü"
          >
            <option value="ALL">Tüm türler</option>
            {(Object.keys(UYARI_TUR_ETIKET) as UyariTuru[]).map((t) => (
              <option key={t} value={t}>
                {UYARI_TUR_ETIKET[t]}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="pm-mk-empty">
            <p className="pm-mk-empty-title">{toplam === 0 ? "Kontroller temiz" : "Bu filtrede uyarı yok"}</p>
            <p className="pm-muted">
              {toplam === 0
                ? "Açık mali kontrol uyarısı bulunmuyor."
                : "Filtreyi değiştirerek diğer uyarıları görebilirsiniz."}
            </p>
          </div>
        ) : (
          <ul className="pm-mk-list">
            {filtered.map((u) => {
              const tutarGoster = formatUyariTutar(u.tutar, u.paraBirimi);
              return (
                <li key={`${u.tur}:${u.id}`} className={`pm-mk-row ${seviyeClass(u.seviye)}`}>
                  <div className="pm-mk-row-main">
                    <div className="pm-mk-row-top">
                      <span className={`pm-mk-dot pm-mk-dot--${u.seviye.toLowerCase()}`} aria-hidden />
                      <span className="pm-mk-badge">{UYARI_SEVIYE_ETIKET[u.seviye]}</span>
                      <span className="pm-mk-tur">{UYARI_TUR_ETIKET[u.tur]}</span>
                      {tutarGoster ? <span className="pm-mk-tutar">{tutarGoster}</span> : null}
                    </div>
                    <div className="pm-mk-row-body">
                      <strong className="pm-mk-muvekkil">{u.muvekkilAd}</strong>
                      <span className="pm-muted">{u.dosyaBaslik}</span>
                      <p className="pm-mk-aciklama">{u.aciklama}</p>
                    </div>
                  </div>
                  {canNavigateMaliKontrolUyari(u) ? (
                    <div className="pm-mk-row-actions">
                      <button type="button" className="pm-btn pm-btn--sm pm-btn--ghost" onClick={() => git(u)}>
                        Kayda git
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </PremiumModal>
    </>
  );
}
