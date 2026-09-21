import type { CalendarView } from "../types/randevu";

const TR_WEEKDAYS_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;
const TR_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

export const CALENDAR_HOUR_START = 8;
export const CALENDAR_HOUR_END = 20;
export const CALENDAR_SLOT_MINUTES = 60;
export const CALENDAR_SLOT_HEIGHT_PX = 56;

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toTimeInputValue(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(x, diff);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function combineLocalDateTime(dateStr: string, timeStr: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

export function localDateTimeToIso(dateStr: string, timeStr: string): string {
  return combineLocalDateTime(dateStr, timeStr).toISOString();
}

export function formatTimeTR(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTRLong(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
}

export function formatMonthYearTR(d: Date): string {
  return `${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatWeekdayShort(d: Date): string {
  const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
  return TR_WEEKDAYS_SHORT[idx];
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isPastAppointment(endIso: string, now = new Date()): boolean {
  const end = new Date(endIso);
  return !Number.isNaN(end.getTime()) && end < now;
}

export function getRangeForView(view: CalendarView, anchor: Date): { start: Date; end: Date } {
  if (view === "day") {
    return { start: startOfDay(anchor), end: endOfDay(anchor) };
  }
  if (view === "week") {
    const start = startOfWeekMonday(anchor);
    const end = endOfDay(addDays(start, 6));
    return { start, end };
  }
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeekMonday(monthStart);
  const monthEnd = endOfMonth(anchor);
  const gridEnd = endOfDay(addDays(startOfWeekMonday(monthEnd), 6));
  return { start: gridStart, end: gridEnd };
}

export function getMonthGridDays(anchor: Date): Date[] {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeekMonday(monthStart);
  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    days.push(addDays(gridStart, i));
  }
  return days;
}

export function getWeekDays(anchor: Date): Date[] {
  const start = startOfWeekMonday(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function getTodayRangeIso(): { baslangic: string; bitis: string } {
  const now = new Date();
  return { baslangic: startOfDay(now).toISOString(), bitis: endOfDay(now).toISOString() };
}

export function navigateAnchor(view: CalendarView, anchor: Date, dir: -1 | 1): Date {
  if (view === "day") return addDays(anchor, dir);
  if (view === "week") return addDays(anchor, dir * 7);
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
}

export function defaultEndTimeFromStart(startTime: string, durationMinutes = 60): string {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${pad2(nh)}:${pad2(nm)}`;
}

export function hourSlots(): number[] {
  const slots: number[] = [];
  for (let h = CALENDAR_HOUR_START; h <= CALENDAR_HOUR_END; h += 1) {
    slots.push(h);
  }
  return slots;
}

export function calendarSlotCount(): number {
  return CALENDAR_HOUR_END - CALENDAR_HOUR_START + 1;
}

export function calendarBodyHeightPx(): number {
  return calendarSlotCount() * CALENDAR_SLOT_HEIGHT_PX;
}

export function minutesSinceDayStart(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function appointmentLayoutPx(
  startIso: string,
  endIso: string,
  dayStartHour = CALENDAR_HOUR_START,
  dayEndHour = CALENDAR_HOUR_END,
): { topPx: number; heightPx: number } | null {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const slotCount = dayEndHour - dayStartHour + 1;
  const totalMinutes = slotCount * 60;
  const dayStartMin = dayStartHour * 60;
  const dayEndMin = dayStartMin + totalMinutes;
  const pxPerMinute = CALENDAR_SLOT_HEIGHT_PX / 60;

  const s = Math.max(dayStartMin, minutesSinceDayStart(start));
  const e = Math.min(dayEndMin, minutesSinceDayStart(end));
  if (e <= s) return null;

  return {
    topPx: (s - dayStartMin) * pxPerMinute,
    heightPx: (e - s) * pxPerMinute,
  };
}

export function overlapColumns<T extends { baslangicAt: string; bitisAt: string }>(
  items: T[],
): Array<T & { column: number; columns: number }> {
  const sorted = [...items].sort((a, b) => Date.parse(a.baslangicAt) - Date.parse(b.baslangicAt));
  const result: Array<T & { column: number; columns: number }> = [];
  const active: Array<{ end: number; column: number }> = [];

  for (const item of sorted) {
    const start = Date.parse(item.baslangicAt);
    const end = Date.parse(item.bitisAt);
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i]!.end <= start) active.splice(i, 1);
    }
    const used = new Set(active.map((a) => a.column));
    let column = 0;
    while (used.has(column)) column += 1;
    active.push({ end, column });
    const columns = Math.max(...active.map((a) => a.column), column) + 1;
    result.push({ ...item, column, columns });
  }

  const maxCols = Math.max(1, ...result.map((r) => r.columns));
  return result.map((r) => ({ ...r, columns: maxCols }));
}
