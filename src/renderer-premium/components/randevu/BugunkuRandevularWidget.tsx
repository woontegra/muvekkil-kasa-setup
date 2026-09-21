import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Randevu } from "@shared/types/randevu";
import { formatTimeTR, getTodayRangeIso } from "@shared/lib/randevuCalendar";

const MAX_ITEMS = 5;

export function BugunkuRandevularWidget() {
  const [items, setItems] = useState<Randevu[]>([]);
  const [loading, setLoading] = useState(true);

  const yukle = useCallback(async () => {
    setLoading(true);
    try {
      const { baslangic, bitis } = getTodayRangeIso();
      const list = await window.api.randevuList({ baslangic, bitis });
      const now = Date.now();
      const upcoming = list
        .filter((r) => new Date(r.bitisAt).getTime() >= now)
        .sort((a, b) => Date.parse(a.baslangicAt) - Date.parse(b.baslangicAt))
        .slice(0, MAX_ITEMS);
      setItems(upcoming);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void yukle();
    const onFocus = () => void yukle();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [yukle]);

  return (
    <section className="pm-overview-panel pm-section-enter" aria-label="Bugünkü randevular">
      <div className="pm-overview-panel-head">
        <h3 className="pm-overview-panel-title">Bugünkü Randevular</h3>
        <Link to="/randevular" className="pm-btn pm-btn--ghost pm-btn--sm">
          Tümünü gör
        </Link>
      </div>
      {loading ? (
        <div className="pm-skeleton pm-skeleton--line" />
      ) : items.length === 0 ? (
        <p className="pm-muted" style={{ margin: 0, fontSize: "var(--pm-font-size-sm)" }}>
          Bugün için yaklaşan randevu yok.
        </p>
      ) : (
        <ul className="pm-randevu-widget-list">
          {items.map((r) => (
            <li key={r.id} className="pm-randevu-widget-item">
              <Link to="/randevular">
                <strong>{r.baslik}</strong>
                <span>{r.muvekkilAd?.trim() || "Müvekkil belirtilmedi"}</span>
              </Link>
              <span className="pm-randevu-widget-time">{formatTimeTR(r.baslangicAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
