import { useCallback, useEffect, useMemo, useState } from "react";
import type { Randevu } from "@shared/types/randevu";
import { formatDateTRLong, formatTimeTR } from "@shared/lib/randevuCalendar";
import { PremiumButton } from "../PremiumButton";
import { RandevuDetailModal } from "./RandevuDetailModal";
import { RandevuFormModal } from "./RandevuFormModal";

type Props = {
  muvekkilId: number;
};

export function MuvekkilRandevularSection({ muvekkilId }: Props) {
  const [items, setItems] = useState<Randevu[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Randevu | null>(null);
  const [editing, setEditing] = useState<Randevu | null>(null);

  const yukle = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const bas = new Date(now);
      bas.setMonth(bas.getMonth() - 3);
      const bit = new Date(now);
      bit.setMonth(bit.getMonth() + 6);
      const list = await window.api.randevuList({
        baslangic: bas.toISOString(),
        bitis: bit.toISOString(),
        muvekkilId,
      });
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [muvekkilId]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up = items.filter((r) => new Date(r.bitisAt).getTime() >= now);
    const pa = items.filter((r) => new Date(r.bitisAt).getTime() < now);
    return {
      upcoming: up.sort((a, b) => Date.parse(a.baslangicAt) - Date.parse(b.baslangicAt)).slice(0, 5),
      past: pa.sort((a, b) => Date.parse(b.baslangicAt) - Date.parse(a.baslangicAt)).slice(0, 5),
    };
  }, [items]);

  function renderList(list: Randevu[], emptyText: string) {
    if (loading) return <div className="pm-skeleton pm-skeleton--line" />;
    if (list.length === 0) return <p className="pm-muted" style={{ margin: 0, fontSize: "var(--pm-font-size-sm)" }}>{emptyText}</p>;
    return (
      <ul className="pm-randevu-widget-list">
        {list.map((r) => (
          <li key={r.id} className="pm-randevu-widget-item">
            <button type="button" onClick={() => setSelected(r)}>
              <strong>{r.baslik}</strong>
              <span>
                {formatDateTRLong(new Date(r.baslangicAt))} · {formatTimeTR(r.baslangicAt)} – {formatTimeTR(r.bitisAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="pm-randevu-section pm-section-enter" aria-label="Randevular">
      <div className="pm-randevu-section-head">
        <h3 className="pm-randevu-section-title">Randevular</h3>
        <PremiumButton type="button" variant="ghost" onClick={() => setFormOpen(true)}>
          + Randevu Oluştur
        </PremiumButton>
      </div>

      <h4 className="pm-randevu-section-title" style={{ marginBottom: 8, fontSize: "var(--pm-font-size-sm)" }}>
        Yaklaşan
      </h4>
      {renderList(upcoming, "Yaklaşan randevu yok.")}

      <h4 className="pm-randevu-section-title" style={{ margin: "16px 0 8px", fontSize: "var(--pm-font-size-sm)" }}>
        Geçmiş
      </h4>
      {renderList(past, "Geçmiş randevu yok.")}

      <RandevuFormModal
        open={formOpen}
        mode={editing ? "edit" : "create"}
        randevu={editing ?? undefined}
        prefill={{ muvekkilId }}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={() => void yukle()}
      />

      {selected && !formOpen ? (
        <RandevuDetailModal
          open
          randevu={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setFormOpen(true);
            setSelected(null);
          }}
          onDeleted={() => void yukle()}
        />
      ) : null}
    </section>
  );
}
