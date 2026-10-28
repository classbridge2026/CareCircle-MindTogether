import { addDays, atMinutes, isoWeekday, parseCalendarDate } from "./time";

export type SlotMode = "ONLINE" | "IN_PERSON";

export type ScheduleRule = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  mode: SlotMode | null;
  locationId: string | null;
  offeringId: string | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
};

export type TimeBlock = { startsAt: Date; endsAt: Date };

export function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

export function intervalsOverlap(a: TimeBlock, b: TimeBlock): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

function dateInRange(day: string, from: string | null, until: string | null): boolean {
  if (from && day < from) return false;
  if (until && day > until) return false;
  return true;
}

export function availabilityModeLabel(mode: SlotMode | null): string {
  if (mode === "IN_PERSON") return "In person";
  if (mode === "ONLINE") return "Online";
  return "Online or in person";
}

export function ruleMatches(rule: ScheduleRule, input: { day: string; weekday: number; mode: SlotMode; locationId: string | null; offeringId: string }): boolean {
  if (!rule.isActive || rule.dayOfWeek !== input.weekday) return false;
  if (!dateInRange(input.day, rule.validFrom, rule.validUntil)) return false;
  if (rule.mode && rule.mode !== input.mode) return false;
  if (rule.offeringId && rule.offeringId !== input.offeringId) return false;
  if (input.mode === "ONLINE") return rule.mode === null || rule.locationId === null;
  return Boolean(input.locationId) && rule.locationId === input.locationId;
}

export function rulesConflict(left: ScheduleRule, right: ScheduleRule): boolean {
  if (!left.isActive || !right.isActive || left.dayOfWeek !== right.dayOfWeek) return false;
  if (!rangesOverlap(left.startMinute, left.endMinute, right.startMinute, right.endMinute)) return false;
  const from = left.validFrom && right.validFrom ? (left.validFrom > right.validFrom ? left.validFrom : right.validFrom) : left.validFrom ?? right.validFrom;
  const until = left.validUntil && right.validUntil ? (left.validUntil < right.validUntil ? left.validUntil : right.validUntil) : left.validUntil ?? right.validUntil;
  if (from && until && from > until) return false;
  return true;
}

export type SlotAvailability = "open" | "booked" | "passed";

export type DaySlot = { startsAt: Date; availability: SlotAvailability };

export function describeDaySlots(input: {
  day: string;
  durationMinutes: number;
  mode: SlotMode;
  locationId: string | null;
  offeringId: string;
  rules: ScheduleRule[];
  blocks: TimeBlock[];
  now: Date;
}): DaySlot[] {
  const dayStart = parseCalendarDate(input.day);
  if (!dayStart || input.durationMinutes < 1) return [];
  const weekday = isoWeekday(dayStart);
  const windows = input.rules.filter((rule) => ruleMatches(rule, { day: input.day, weekday, mode: input.mode, locationId: input.locationId, offeringId: input.offeringId }));
  const slots: DaySlot[] = [];
  for (const window of windows) {
    for (let minute = window.startMinute; minute + input.durationMinutes <= window.endMinute; minute += input.durationMinutes) {
      const startsAt = atMinutes(dayStart, minute);
      const endsAt = atMinutes(dayStart, minute + input.durationMinutes);
      const slot = { startsAt, endsAt };
      const availability: SlotAvailability = startsAt <= input.now
        ? "passed"
        : input.blocks.some((block) => intervalsOverlap(slot, block))
          ? "booked"
          : "open";
      slots.push({ startsAt, availability });
    }
  }
  const unique = [...new Map(slots.map((slot) => [slot.startsAt.getTime(), slot])).values()];
  unique.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return unique;
}

export function visibleBookingSlots<T extends { startsAt: string; availability: SlotAvailability }>(slots: T[], nowMs: number | null): T[] {
  return slots.filter((slot) => {
    if (slot.availability === "passed") return false;
    if (nowMs === null || slot.availability !== "open") return true;
    const starts = Date.parse(slot.startsAt);
    return !Number.isFinite(starts) || starts > nowMs;
  });
}

export function slotsForDay(input: {
  day: string;
  durationMinutes: number;
  mode: SlotMode;
  locationId: string | null;
  offeringId: string;
  rules: ScheduleRule[];
  blocks: TimeBlock[];
  now: Date;
}): Date[] {
  return describeDaySlots(input).filter((slot) => slot.availability === "open").map((slot) => slot.startsAt);
}

export function slotIsOpen(input: {
  startsAt: Date;
  endsAt: Date;
  mode: SlotMode;
  locationId: string | null;
  offeringId: string;
  rules: ScheduleRule[];
  blocks: TimeBlock[];
  now: Date;
}): boolean {
  if (input.endsAt <= input.startsAt || input.startsAt <= input.now) return false;
  const day = input.startsAt.toISOString().slice(0, 10);
  const duration = Math.round((input.endsAt.getTime() - input.startsAt.getTime()) / 60_000);
  return slotsForDay({
    day,
    durationMinutes: duration,
    mode: input.mode,
    locationId: input.locationId,
    offeringId: input.offeringId,
    rules: input.rules,
    blocks: input.blocks,
    now: input.now,
  }).some((slot) => slot.getTime() === input.startsAt.getTime());
}

export function upcomingDates(from: Date, days: number): string[] {
  const start = parseCalendarDate(from.toISOString().slice(0, 10)) ?? from;
  const count = Math.min(Math.max(days, 1), 21);
  return Array.from({ length: count }, (_, index) => addDays(start, index).toISOString().slice(0, 10));
}
