// lib/quarters.ts

export type Quarter = `${number}Q${1 | 2 | 3 | 4}`;

export function normalizeQuarter(q: string): Quarter {
  // Accept "2025Q3" or "2025-Q3" (case-insensitive on the 'Q')
  const m = q.trim().match(/^(\d{4})[-\s]?Q([1-4])$/i);
  if (!m) throw new Error(`Invalid quarter format: ${q}`);

  const year = parseInt(m[1], 10);           // <- coerce to number
  const qi = parseInt(m[2], 10) as 1 | 2 | 3 | 4;

  return `${year}Q${qi}` as Quarter;
}

export function quarterRange(q: Quarter): { start: Date; end: Date } {
  const year = Number(q.slice(0, 4));
  const qi = Number(q.slice(-1)) as 1 | 2 | 3 | 4;
  const startMonth = (qi - 1) * 3; // 0,3,6,9
  const start = new Date(Date.UTC(year, startMonth, 1));
  // end = last day of the quarter
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  return { start, end };
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}