import * as fs from 'node:fs';

const SPARK_BLOCKS = '▁▂▃▄▅▆▇█';

export function readJsonl<T>(path: string): T[] {
  if (!fs.existsSync(path)) return [];
  const content = fs.readFileSync(path, 'utf8').trim();
  if (!content) return [];
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      const parsed = JSON.parse(line) as T | T[];
      return Array.isArray(parsed) ? parsed : [parsed];
    });
}

export function readJsonlSingle<T>(path: string): T[] {
  if (!fs.existsSync(path)) return [];
  const content = fs.readFileSync(path, 'utf8').trim();
  if (!content) return [];
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export function fmtTs(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').replace('.000Z', 'Z');
}

export function fmtHour(ts: number): string {
  return new Date(ts).toISOString().slice(0, 13) + ':00Z';
}

export function fmtNum(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

export function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '—';
  return (value * 100).toFixed(digits) + '%';
}

export function summarize(values: Array<number | null | undefined>): { min: number | null; max: number | null; first: number | null; last: number | null; delta: number | null } {
  const filtered = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (filtered.length === 0) {
    return { min: null, max: null, first: null, last: null, delta: null };
  }
  return {
    min: Math.min(...filtered),
    max: Math.max(...filtered),
    first: filtered[0],
    last: filtered[filtered.length - 1],
    delta: filtered[filtered.length - 1] - filtered[0],
  };
}

export function sparkline(values: Array<number | null | undefined>): string {
  const filtered = values.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null));
  const nums = filtered.filter((v): v is number => v != null);
  if (nums.length === 0) return '';
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) return '▅'.repeat(filtered.length);
  return filtered
    .map((v) => {
      if (v == null) return '·';
      const idx = Math.max(0, Math.min(SPARK_BLOCKS.length - 1, Math.round(((v - min) / (max - min)) * (SPARK_BLOCKS.length - 1))));
      return SPARK_BLOCKS[idx];
    })
    .join('');
}

export function nearestByTs<T extends { ts: number }>(rows: T[], ts: number): T | null {
  let best: T | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const distance = Math.abs(row.ts - ts);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = row;
    }
  }
  return best;
}
