/**
 * Formatting helpers for durations and byte counts. Ported from the approved
 * web prototype so the native app renders identical strings.
 */

export interface Duration {
  h: number;
  m: number;
  s: number;
  label: string;
}

/** Break a millisecond span into h/m/s plus a short human label. */
export function fmtDuration(ms: number): Duration {
  if (ms <= 0) return {h: 0, m: 0, s: 0, label: '0m'};
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  let label: string;
  if (h > 0) label = `${h}h ${m}m`;
  else if (m > 0) label = `${m}m ${s}s`;
  else label = `${s}s`;
  return {h, m, s, label};
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "14h 32m 08s" style uptime string used on the Home screen. */
export function fmtUptime(ms: number): string {
  const {h, m, s} = fmtDuration(ms);
  return `${h}h ${pad2(m)}m ${pad2(s)}s`;
}

/** "MM:SS" / "H:MM:SS" clock string. */
export function clockString(ms: number): string {
  const {h, m, s} = fmtDuration(ms);
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

/** Format a raw byte count to MB under 1 GB, otherwise GB. */
export function fmtBytes(bytes: number): {value: string; unit: string} {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return {value: (mb / 1024).toFixed(2), unit: 'GB'};
  return {value: mb.toFixed(1), unit: 'MB'};
}

/** Days until an ISO date; negative if already past. null if no date. */
export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
