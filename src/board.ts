// 말판 자석(R39) — 순수 함수. 렌더도 zod도 없다(계약은 schema/board.ts, 브라우저 번들엔 안 들어간다).
//
// BACKLOG §G: 「자석은 두 단계다. 크게는 territory 폴리곤 point-in-polygon(어느 나라 안인가),
// 세부는 가까운 settlement로 스냅(어느 도시인가). **계층이 이미 데이터에 있다** — 새로 만들 필요 없다.」
// 그 말이 맞아서 여기엔 격자도 색인도 없다. 유닛 스무 개짜리 말판에 필요한 건 선형 훑기뿐이다.

type Feat = { properties: Record<string, any>; geometry: { type: string; coordinates: any } };
export type LonLat = [number, number];

const R = 6371;
/** 두 점 사이 거리(km). 대권거리 — 말판 규모(수 km)에선 평면 근사와 차이가 없지만 경계에서 안 틀리게. */
export function distanceKm(a: LonLat, b: LonLat): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** 고리 하나에 대한 ray casting. 경계 위의 점은 들어간 것으로 친다(말판에선 붙는 편이 낫다). */
function inRing(p: LonLat, ring: number[][]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Polygon·MultiPolygon 안인가. 구멍(두 번째 고리부터)은 빼고 센다. */
export function inPolygon(p: LonLat, geom: { type: string; coordinates: any }): boolean {
  const polys: number[][][][] = geom.type === 'MultiPolygon' ? geom.coordinates : geom.type === 'Polygon' ? [geom.coordinates] : [];
  for (const poly of polys) {
    if (!poly.length || !inRing(p, poly[0])) continue;
    if (poly.slice(1).some(hole => inRing(p, hole))) continue; // 구멍에 빠졌다
    return true;
  }
  return false;
}

/** 세부 자석: 가까운 정착지. maxKm 밖이면 안 붙는다(엉뚱한 도시에 끌려가지 않게). */
export function nearestSettlement(at: LonLat, settlements: Feat[], maxKm = 30):
  { id: string; name: string; km: number } | null {
  let best: { id: string; name: string; km: number } | null = null;
  for (const f of settlements) {
    if (f.geometry?.type !== 'Point') continue;
    const km = distanceKm(at, f.geometry.coordinates as LonLat);
    if (km <= maxKm && (!best || km < best.km)) best = { id: f.properties.id, name: f.properties.name_ko ?? f.properties.id, km: +km.toFixed(2) };
  }
  return best;
}

/** 큰 자석: 그 해에 이 점을 품은 정치체. 겹치면 면적이 작은 쪽이 이긴다 — 큰 제국 안의 작은 나라를 살린다. */
export function containingPolity(at: LonLat, territory: Feat[], year: number):
  { id: string; name: string; actor: string; area: number } | null {
  let best: { id: string; name: string; actor: string; area: number } | null = null;
  for (const f of territory) {
    const p = f.properties;
    if (String(p.id ?? '').endsWith(':label')) continue;
    if (!((p.valid_from ?? -Infinity) <= year && year < (p.valid_to ?? Infinity))) continue;
    if (!inPolygon(at, f.geometry)) continue;
    const area = Number(p.area) || 0;
    if (!best || area < best.area) best = { id: p.id, name: p.name ?? p.name_en, actor: p.actor, area };
  }
  return best;
}

/** 두 단계를 한 번에. 어느 나라 안인지 + 어느 도시 옆인지. */
export function snap(at: LonLat, ctx: { settlements: Feat[]; territory: Feat[]; year: number }, maxKm = 30) {
  return { settlement: nearestSettlement(at, ctx.settlements, maxKm), polity: containingPolity(at, ctx.territory, ctx.year) };
}
