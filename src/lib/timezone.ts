export const BUSINESS_TZ = 'Europe/Madrid';

/**
 * Returns YYYY-MM-DD in Europe/Madrid for a given UTC Date.
 */
export function formatDateMadrid(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Returns HH:MM (24h) in Europe/Madrid for a given UTC Date.
 */
export function formatTimeMadrid(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Returns day of week (0 = Sunday .. 6 = Saturday) in Europe/Madrid for YYYY-MM-DD.
 */
export function getDayOfWeekMadrid(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Noon UTC on that calendar day safely maps to the same calendar day in Europe/Madrid
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ,
    weekday: 'short',
  }).format(probe);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

/**
 * Converts a local wall-clock date ('YYYY-MM-DD') and time ('HH:MM') in Europe/Madrid
 * into an exact UTC Date, accurately handling CET (UTC+1) and CEST (UTC+2) DST transitions.
 */
export function madridLocalToUtc(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  // Initial UTC guess assuming UTC+0
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  // Measure what Europe/Madrid wall clock says at utcGuess
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(utcGuess);

  const getPart = (type: string) => Number(parts.find((p) => p.type === type)?.value || '0');
  const tzYear = getPart('year');
  const tzMonth = getPart('month');
  const tzDay = getPart('day');
  let tzHour = getPart('hour');
  if (tzHour === 24) tzHour = 0;
  const tzMinute = getPart('minute');

  const tzAsUtcMs = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0, 0);
  const offsetMs = tzAsUtcMs - utcGuess.getTime();
  const adjusted = new Date(utcGuess.getTime() - offsetMs);

  // Second pass to handle exact DST boundary hour transitions cleanly
  const parts2 = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(adjusted);
  const getPart2 = (type: string) => Number(parts2.find((p) => p.type === type)?.value || '0');
  let tzHour2 = getPart2('hour');
  if (tzHour2 === 24) tzHour2 = 0;
  const tzAsUtcMs2 = Date.UTC(
    getPart2('year'),
    getPart2('month') - 1,
    getPart2('day'),
    tzHour2,
    getPart2('minute'),
    0,
    0
  );
  const offsetMs2 = tzAsUtcMs2 - adjusted.getTime();
  return new Date(utcGuess.getTime() - offsetMs2);
}

/**
 * Parse HH:MM into minutes since midnight.
 */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Format minutes since midnight to HH:MM.
 */
export function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Add days to YYYY-MM-DD safely.
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return formatDateMadrid(dt);
}

/**
 * Format UTC Date for Spanish human display in Europe/Madrid.
 */
export function formatSpanishDate(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: BUSINESS_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
