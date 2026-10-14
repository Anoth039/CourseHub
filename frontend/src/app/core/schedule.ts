/** Órarendi időpontok feldolgozása: „Hétfő 10:00 - 11:30” */
export interface TimeRange { day: number; start: number; end: number; }

const DAYS = ['hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat', 'vasárnap'];
const RE = /^\s*([^\s\d]+)\s+(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})\s*$/;

export const SCHEDULE_FORMAT_HINT = 'Az időpont formátuma: Nap ÓÓ:PP - ÓÓ:PP (pl. Hétfő 10:00 - 11:30).';

export function parseSchedule(s: string): TimeRange | null {
  const m = RE.exec(s ?? '');
  if (!m) return null;
  const day = DAYS.indexOf(m[1].toLocaleLowerCase('hu'));
  const start = Number(m[2]) * 60 + Number(m[3]);
  const end = Number(m[4]) * 60 + Number(m[5]);
  if (day < 0 || Number(m[2]) > 23 || Number(m[4]) > 23 || Number(m[3]) > 59 || Number(m[5]) > 59) return null;
  if (end <= start) return null;
  return { day, start, end };
}

/** Két időpont ütközik, ha ugyanazon a napon átfedik egymást (az egymás utáni, érintkező sávok nem ütköznek). */
export function schedulesOverlap(a: string, b: string): boolean {
  const x = parseSchedule(a), y = parseSchedule(b);
  if (!x || !y) return false;
  return x.day === y.day && x.start < y.end && y.start < x.end;
}
