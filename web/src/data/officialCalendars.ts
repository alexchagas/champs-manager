import officialCalendarsRaw from './officialCalendars.json' with { type: 'json' };

export type DayOfWeekPt = 'domingo' | 'segunda' | 'terça' | 'quarta' | 'quinta' | 'sexta' | 'sábado';

const DOW_NAMES: DayOfWeekPt[] = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
];

export const OFFICIAL_CALENDARS: Record<string, string[]> = officialCalendarsRaw as Record<string, string[]>;

/**
 * Converts a Brasfoot DD/MM date string into an ISO YYYY-MM-DD date and Portuguese day of week.
 */
export function parseBrasfootDate(ddMm: string, seasonYear = 2026): {
  date: string;
  dayOfWeek: DayOfWeekPt;
} {
  const [dayStr, monthStr] = ddMm.split('/');
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);

  // Use UTC to prevent local timezone shifts
  const d = new Date(Date.UTC(seasonYear, month - 1, day, 12, 0, 0));
  const isoDate = `${seasonYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dow = DOW_NAMES[d.getUTCDay()];

  return {
    date: isoDate,
    dayOfWeek: dow,
  };
}

/**
 * Retrieves the official dates for a given competition type (e.g. 'estaduais', 'nacional', 'copa_nacional', 'libertadores', etc.).
 */
export function getOfficialDates(calendarKey: string, seasonYear = 2026): { date: string; dayOfWeek: DayOfWeekPt; raw: string }[] {
  const dates = OFFICIAL_CALENDARS[calendarKey] || [];
  return dates.map((ddMm) => {
    const parsed = parseBrasfootDate(ddMm, seasonYear);
    return {
      date: parsed.date,
      dayOfWeek: parsed.dayOfWeek,
      raw: ddMm,
    };
  });
}
