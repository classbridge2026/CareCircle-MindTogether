/** Africa/Freetown is GMT all year, so calendar dates match UTC. */
export const BOOKING_TIMEZONE = "Africa/Freetown";

export function freetownDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BOOKING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function addDays(day: Date, days: number): Date {
  return new Date(day.getTime() + days * 86_400_000);
}

export function isoWeekday(day: Date): number {
  const sunday = day.getUTCDay();
  return sunday === 0 ? 7 : sunday;
}

export function minutesFromClock(value: Date): number {
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

export function clockFromMinutes(minutes: number): Date {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return new Date(Date.UTC(1970, 0, 1, hours, mins, 0, 0));
}

export function parseClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatClock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** A 12-hour clock, such as 7:00 AM or 4:00 PM. */
export function formatNormalClock(minutes: number): string {
  const day = 24 * 60;
  const normalized = ((Math.trunc(minutes) % day) + day) % day;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

export function atMinutes(day: Date, minutes: number): Date {
  return new Date(day.getTime() + minutes * 60_000);
}

export function formatBookingWhen(value: Date): string {
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: BOOKING_TIMEZONE,
  }).format(value);
  return `${date}, ${formatNormalClock(value.getUTCHours() * 60 + value.getUTCMinutes())}`;
}
