// history fold (TASKS 1.2, SCHEMA v2): base attrs 위에 year 이하의 patch를 연도순으로 덮은 "그 해의 상태". 순수 함수.
export interface Historied { attrs?: Record<string, unknown>; history?: { year: number; patch: Record<string, unknown> }[] }
export function stateAt(e: Historied, year: number): Record<string, unknown> {
  const patches = (e.history ?? []).filter(h => h.year <= year).sort((a, b) => a.year - b.year);
  return patches.reduce((acc, h) => ({ ...acc, ...h.patch }), { ...(e.attrs ?? {}) });
}
