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

// ── 렌더 계약 (R37). 뷰는 이 산출물을 그리기만 한다. 페이즈 사이를 보간하지 않는다. ────────
// schema/board.ts의 zod를 여기로 들이지 않는다 — 예전에 graph가 상수 하나 때문에 zod를 번들에 실었다.
export const ARM_KO = { infantry: '중보병', cavalry: '기병', light: '경보병', elephant: '전투코끼리', command: '지휘' } as const;
export type Arm = keyof typeof ARM_KO;
export const FALLBACK_COLOR = '#8A8F98'; // 팔레트 밖·기타중립. 지어낸 색이 아니다.

export interface BoardUnit {
  id: string; at: LonLat; actor: string; arm: Arm; label: string;
  strength?: number; facing?: number; entity?: string;
}
export interface BoardPhase { t: number; title: string; note?: string; units: BoardUnit[] }
export interface BoardData {
  id: string; title: string; year: number; event?: string;
  center: LonLat; zoom?: number; bearing?: number;
  teaching: true; source: string; phases: BoardPhase[];
}

export function clampPhase(board: BoardData, t: number): number {
  const ts = board.phases.map(p => p.t);
  if (ts.includes(t)) return t;
  return ts.reduce((best, x) => Math.abs(x - t) < Math.abs(best - t) ? x : best, ts[0]);
}

export function phaseOf(board: BoardData, t: number): BoardPhase {
  const n = clampPhase(board, t);
  return board.phases.find(p => p.t === n) ?? board.phases[0];
}

export function pickBoard(boards: BoardData[], year: number): BoardData | null {
  if (!boards.length) return null;
  return boards.find(b => b.year === year) ?? boards[0];
}

export interface UnitProps {
  id: string; actor: string; arm: Arm; label: string; color: string;
  strength: number | null; facing: number; entity: string | null;
  teaching: true; event: string | null;
}
export function unitsGeoJSON(phase: BoardPhase, palette: Record<string, string>, meta: { event?: string } = {}):
  { type: 'FeatureCollection'; features: { type: 'Feature'; id: string; properties: UnitProps; geometry: { type: 'Point'; coordinates: LonLat } }[] } {
  return {
    type: 'FeatureCollection',
    features: phase.units.map(u => ({
      type: 'Feature' as const,
      id: u.id,
      properties: {
        id: u.id, actor: u.actor, arm: u.arm, label: u.label,
        color: palette[u.actor] ?? FALLBACK_COLOR,
        strength: u.strength ?? null, facing: u.facing ?? 0,
        entity: u.entity ?? null, teaching: true as const,
        event: meta.event ?? null,
      },
      geometry: { type: 'Point' as const, coordinates: u.at },
    })),
  };
}
