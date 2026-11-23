/** Formats seconds as m:ss.s, e.g. 1:05.3 */
export function formatTime(t: number): string {
  const v = Math.max(0, t || 0);
  const m = Math.floor(v / 60);
  const s = v - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
