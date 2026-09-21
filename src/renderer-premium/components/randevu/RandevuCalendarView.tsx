import { Fragment } from "react";
import type { Randevu } from "@shared/types/randevu";
import {
  appointmentLayoutPx,
  CALENDAR_SLOT_HEIGHT_PX,
  formatTimeTR,
  getMonthGridDays,
  getWeekDays,
  hourSlots,
  isPastAppointment,
  isSameDay,
  overlapColumns,
  pad2,
  toDateInputValue,
} from "@shared/lib/randevuCalendar";

type CalendarProps = {
  view: "day" | "week" | "month";
  anchor: Date;
  items: Randevu[];
  onSlotClick: (date: Date, hour: number) => void;
  onDayClick: (date: Date) => void;
  onAppointmentClick: (randevu: Randevu) => void;
};

function AppointmentCard({
  randevu,
  compact,
  onClick,
}: {
  randevu: Randevu;
  compact?: boolean;
  onClick: () => void;
}) {
  const past = isPastAppointment(randevu.bitisAt);
  const muvekkil = randevu.muvekkilAd?.trim();

  return (
    <button
      type="button"
      className={`pm-randevu-cal-event${past ? " pm-randevu-cal-event--past" : ""}${compact ? " pm-randevu-cal-event--compact" : ""}`}
      onClick={onClick}
    >
      <span className="pm-randevu-cal-event-wash" aria-hidden />
      <div style={{ position: "relative", display: "flex", minWidth: 0, width: "100%", height: compact ? undefined : "100%" }}>
        <span className="pm-randevu-cal-event-accent" aria-hidden />
        <div className="pm-randevu-cal-event-body">
          <p className="pm-randevu-cal-event-title">{randevu.baslik}</p>
          {!compact ? (
            <>
              <p className="pm-randevu-cal-event-sub">
                {formatTimeTR(randevu.baslangicAt)} – {formatTimeTR(randevu.bitisAt)}
              </p>
              {muvekkil ? <p className="pm-randevu-cal-event-mvk">{muvekkil}</p> : null}
            </>
          ) : (
            <p className="pm-randevu-cal-event-sub">{muvekkil || formatTimeTR(randevu.baslangicAt)}</p>
          )}
        </div>
      </div>
    </button>
  );
}

function MonthView({
  anchor,
  items,
  onDayClick,
  onAppointmentClick,
}: Omit<CalendarProps, "view" | "onSlotClick">) {
  const days = getMonthGridDays(anchor);
  const month = anchor.getMonth();
  const today = new Date();

  return (
    <div className="pm-randevu-cal">
      <div className="pm-randevu-month-head">
        {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="pm-randevu-month-grid">
        {days.map((day) => {
          const dayItems = items.filter((r) => isSameDay(new Date(r.baslangicAt), day));
          const inMonth = day.getMonth() === month;
          const isToday = isSameDay(day, today);
          const visible = dayItems.slice(0, 3);
          const more = dayItems.length - visible.length;
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={`pm-randevu-month-day${!inMonth ? " pm-randevu-month-day--muted" : ""}${isToday && inMonth ? " pm-randevu-month-day--today" : ""}`}
              onClick={() => onDayClick(day)}
            >
              <span className="pm-randevu-month-day-num">{day.getDate()}</span>
              <div className="pm-randevu-month-events">
                {visible.map((r) => (
                  <div
                    key={r.id}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") e.stopPropagation();
                    }}
                  >
                    <AppointmentCard randevu={r} compact onClick={() => onAppointmentClick(r)} />
                  </div>
                ))}
                {more > 0 ? <p className="pm-randevu-month-more">+{more} daha</p> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimeGridView({
  days,
  items,
  onSlotClick,
  onAppointmentClick,
}: {
  days: Date[];
  items: Randevu[];
  onSlotClick: (date: Date, hour: number) => void;
  onAppointmentClick: (randevu: Randevu) => void;
}) {
  const slots = hourSlots();
  const gridTemplateColumns = `56px repeat(${days.length}, minmax(0, 1fr))`;
  const gridTemplateRows = `auto repeat(${slots.length}, ${CALENDAR_SLOT_HEIGHT_PX}px)`;
  const today = new Date();

  return (
    <div className="pm-randevu-cal pm-randevu-cal-scroll">
      <div className="pm-randevu-cal-minw">
        <div className="pm-randevu-cal-grid" style={{ gridTemplateColumns, gridTemplateRows }}>
          <div className="pm-randevu-cal-head-cell" style={{ gridColumn: 1, gridRow: 1 }} />
          {days.map((d, colIdx) => {
            const isToday = isSameDay(d, today);
            return (
              <div
                key={`hdr-${d.toISOString()}`}
                className={`pm-randevu-cal-head-cell${isToday ? " pm-randevu-cal-head-cell--today" : ""}`}
                style={{ gridColumn: colIdx + 2, gridRow: 1 }}
              >
                <p className="pm-randevu-cal-head-weekday">{d.toLocaleDateString("tr-TR", { weekday: "short" })}</p>
                <p className={`pm-randevu-cal-head-day${isToday ? " pm-randevu-cal-head-day--today" : ""}`}>{d.getDate()}</p>
              </div>
            );
          })}

          {slots.map((h, rowIdx) => {
            const gridRow = rowIdx + 2;
            return (
              <Fragment key={`slot-${h}`}>
                <div className="pm-randevu-cal-time" style={{ gridColumn: 1, gridRow }}>
                  {pad2(h)}:00
                </div>
                {days.map((day, colIdx) => {
                  const isToday = isSameDay(day, today);
                  return (
                    <button
                      key={`${day.toISOString()}-${h}`}
                      type="button"
                      className={`pm-randevu-cal-slot${isToday ? " pm-randevu-cal-slot--today" : ""}`}
                      style={{ gridColumn: colIdx + 2, gridRow }}
                      onClick={() => onSlotClick(day, h)}
                      aria-label={`${toDateInputValue(day)} ${pad2(h)}:00`}
                    />
                  );
                })}
              </Fragment>
            );
          })}

          {days.map((day, colIdx) => {
            const dayItems = items.filter((r) => isSameDay(new Date(r.baslangicAt), day));
            const laid = overlapColumns(dayItems);
            return (
              <div
                key={`overlay-${day.toISOString()}`}
                className="pm-randevu-cal-overlay"
                style={{
                  gridColumn: colIdx + 2,
                  gridRow: `2 / ${slots.length + 2}`,
                }}
              >
                {laid.map((r) => {
                  const layout = appointmentLayoutPx(r.baslangicAt, r.bitisAt);
                  if (!layout) return null;
                  const widthPct = 100 / r.columns;
                  const leftPct = r.column * widthPct;
                  const topPx = Math.round(layout.topPx);
                  const heightPx = Math.max(Math.round(layout.heightPx), 18);
                  const insetX = r.columns > 1 ? 2 : 1;
                  return (
                    <div
                      key={r.id}
                      className="pm-randevu-cal-event-wrap"
                      style={{
                        top: topPx,
                        height: heightPx,
                        left: `calc(${leftPct}% + ${insetX}px)`,
                        width: `calc(${widthPct}% - ${insetX * 2}px)`,
                      }}
                    >
                      <AppointmentCard randevu={r} onClick={() => onAppointmentClick(r)} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function RandevuCalendarView(props: CalendarProps) {
  const { view, anchor, items, onSlotClick, onDayClick, onAppointmentClick } = props;

  if (view === "month") {
    return <MonthView anchor={anchor} items={items} onDayClick={onDayClick} onAppointmentClick={onAppointmentClick} />;
  }

  const days = view === "day" ? [anchor] : getWeekDays(anchor);
  return <TimeGridView days={days} items={items} onSlotClick={onSlotClick} onAppointmentClick={onAppointmentClick} />;
}
