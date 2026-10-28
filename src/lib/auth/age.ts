import { MINIMUM_SELF_REGISTRATION_AGE } from "./constants";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOnly(value: string): string | null {
  const match = ISO_DATE.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function freetownDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Freetown",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isFutureDate(dateOnly: string, now: Date): boolean {
  return dateOnly > freetownDate(now);
}

export function ageInYears(dateOnly: string, now: Date): number {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = freetownDate(now).split("-").map(Number);
  let age = todayYear - year;
  if (todayMonth < month || (todayMonth === month && todayDay < day)) {
    age -= 1;
  }
  return age;
}

export function meetsSelfRegistrationAge(dateOnly: string, now: Date): boolean {
  return ageInYears(dateOnly, now) >= MINIMUM_SELF_REGISTRATION_AGE;
}
