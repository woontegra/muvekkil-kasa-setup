import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalendarView, Randevu } from "@shared/types/randevu";
import {
  defaultEndTimeFromStart,
  getRangeForView,
  navigateAnchor,
  pad2,
  toDateInputValue,
} from "@shared/lib/randevuCalendar";
import { PremiumButton } from "../components/PremiumButton";
import { RandevuCalendarView } from "../components/randevu/RandevuCalendarView";
import { RandevuDetailModal } from "../components/randevu/RandevuDetailModal";
import { RandevuFormModal, type RandevuFormPrefill } from "../components/randevu/RandevuFormModal";

function headerLabel(view: CalendarView, anchor: Date): string {
  if (view === "day") {
    return anchor.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
  }
  if (view === "week") {
    const { start, end } = getRangeForView("week", anchor);
    return `${start.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}`;
  }
  return anchor.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

type Props = {
  initialMuvekkilId?: number;
  initialView?: CalendarView;
};

export function RandevularPage({ initialMuvekkilId, initialView }: Props) {
  const [view, setView] = useState<CalendarView>(initialView ?? "week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [items, setItems] = useState<Randevu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [prefill, setPrefill] = useState<RandevuFormPrefill | undefined>();
  const [selected, setSelected] = useState<Randevu | null>(null);
  const [editing, setEditing] = useState<Randevu | null>(null);

  const range = useMemo(() => getRangeForView(view, anchor), [view, anchor]);

  const yukle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await window.api.randevuList({
        baslangic: range.start.toISOString(),
        bitis: range.end.toISOString(),
        ...(initialMuvekkilId ? { muvekkilId: initialMuvekkilId } : {}),
      });
      setItems(list);
    } catch {
      setItems([]);
      setError("Randevular yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end, initialMuvekkilId]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  function openCreate(pref?: RandevuFormPrefill) {
    setFormMode("create");
    setEditing(null);
    setPrefill({
      ...pref,
      muvekkilId: pref?.muvekkilId ?? initialMuvekkilId,
    });
    setFormOpen(true);
  }

  function onSlotClick(date: Date, hour: number) {
    openCreate({
      date: toDateInputValue(date),
      startTime: `${pad2(hour)}:00`,
      endTime: defaultEndTimeFromStart(`${pad2(hour)}:00`),
    });
  }

  function onDayClick(date: Date) {
    setAnchor(date);
    setView("day");
  }

  return (
    <div className="pm-randevu-page pm-page-enter">
      <div className="pm-randevu-toolbar">
        <p className="pm-randevu-period-label">{headerLabel(view, anchor)}</p>
        <PremiumButton type="button" variant="ghost" onClick={() => setAnchor(new Date())}>
          Bugün
        </PremiumButton>
        <PremiumButton type="button" variant="ghost" onClick={() => setAnchor((a) => navigateAnchor(view, a, -1))}>
          Önceki
        </PremiumButton>
        <PremiumButton type="button" variant="ghost" onClick={() => setAnchor((a) => navigateAnchor(view, a, 1))}>
          Sonraki
        </PremiumButton>
        <div className="pm-randevu-toolbar-spacer" />
        <div className="pm-randevu-view-switch" role="tablist" aria-label="Takvim görünümü">
          {(["day", "week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={`pm-randevu-view-btn${view === v ? " pm-randevu-view-btn--active" : ""}`}
              onClick={() => setView(v)}
            >
              {v === "day" ? "Gün" : v === "week" ? "Hafta" : "Ay"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="pm-skeleton pm-skeleton--block" style={{ minHeight: 420 }} />
      ) : error ? (
        <div className="pm-overview-inline-error">
          <p>{error}</p>
          <button type="button" className="pm-btn pm-btn--ghost" onClick={() => void yukle()}>
            Yeniden dene
          </button>
        </div>
      ) : (
        <RandevuCalendarView
          view={view}
          anchor={anchor}
          items={items}
          onSlotClick={onSlotClick}
          onDayClick={onDayClick}
          onAppointmentClick={setSelected}
        />
      )}

      <RandevuFormModal
        open={formOpen}
        mode={formMode}
        randevu={editing ?? undefined}
        prefill={prefill}
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
            setFormMode("edit");
            setEditing(selected);
            setPrefill(undefined);
            setFormOpen(true);
            setSelected(null);
          }}
          onDeleted={() => void yukle()}
        />
      ) : null}
    </div>
  );
}
