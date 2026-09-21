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
import { buildMaliKontrolNavigateUrl, canNavigateMaliKontrolUyari } from "@shared/lib/maliKontrolNavigation";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = { enabled: boolean };
type ViewMode = "tum" | "kritik" | "uyari" | "bilgi";

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

  const toplam = data?.toplamUyari ?? 0;
  const kritik = data?.kritikUyari ?? 0;

  function git(u: MaliKontrolUyari) {
    if (!canNavigateMaliKontrolUyari(u)) return;
    const url = buildMaliKontrolNavigateUrl(u.actionPayload);
    setOpen(false);
    navigate(url);
  }

  const seviyeClass = (s: UyariSeviyesi) =>
    s === "KRITIK" ? "pm-mk-row--kritik" : s === "UYARI" ? "pm-mk-row--uyari" : "pm-mk-row--bilgi";

  return (
    <>
      <button
        type="button"
        className={`pm-overview-alert-card ${kritik > 0 ? "pm-overview-alert-card--danger" : ""}`}
        onClick={() => {
          void yukle();
          setOpen(true);
        }}
      >
        <span className="pm-overview-alert-label">Mali Kontrol</span>
        <strong className="pm-overview-alert-value">{toplam}</strong>
        <span className="pm-overview-alert-meta">
          {err ? err : kritik > 0 ? `${kritik} kritik uyarı` : toplam === 0 ? "Temiz · Açık kontrol yok" : "Açık kontrol"}
        </span>
      </button>

      <PremiumModal
        open={open}
        title="Mali Kontrol Merkezi"
        wide
        onClose={() => setOpen(false)}
        footer={
          <>
            <span className="pm-mk-footer-counts" style={{ marginRight: "auto" }}>
              {data ? (
                <>
                  <span>{data.toplamUyari} toplam</span>
                  <span className="pm-mk-count--kritik">{data.kritikUyari} kritik</span>
                  <span className="pm-mk-count--uyari">{data.uyariUyari} uyarı</span>
                  <span>{data.bilgiUyari} bilgi</span>
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
          <div className="pm-kalem-tabs" role="tablist" aria-label="Seviye filtresi">
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
                className={`pm-kalem-tab${view === id ? " pm-kalem-tab--active" : ""}`}
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
            {filtered.map((u) => (
              <li key={`${u.tur}:${u.id}`} className={`pm-mk-row ${seviyeClass(u.seviye)}`}>
                <div className="pm-mk-row-top">
                  <span className={`pm-mk-dot pm-mk-dot--${u.seviye.toLowerCase()}`} aria-hidden />
                  <span className="pm-mk-badge">{UYARI_SEVIYE_ETIKET[u.seviye]}</span>
                  <span className="pm-mk-tur">{UYARI_TUR_ETIKET[u.tur]}</span>
                  {u.tutar ? <span className="pm-mk-tutar">{u.tutar}</span> : null}
                </div>
                <div className="pm-mk-row-body">
                  <strong className="pm-mk-muvekkil">{u.muvekkilAd}</strong>
                  <span className="pm-muted">{u.dosyaBaslik}</span>
                  <p className="pm-mk-aciklama">{u.aciklama}</p>
                </div>
                {canNavigateMaliKontrolUyari(u) ? (
                  <div className="pm-mk-row-actions">
                    <button type="button" className="pm-btn pm-btn--sm pm-btn--ghost" onClick={() => git(u)}>
                      Kayda git
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PremiumModal>
    </>
  );
}
