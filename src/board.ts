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
export const ARM_KO = { infantry: '중보병', cavalry: '기병', light: '경보병', elephant: '전투코끼리', command: '지휘', fleet: '함대' } as const;
export type Arm = keyof typeof ARM_KO;
export const FALLBACK_COLOR = '#8A8F98'; // 팔레트 밖·기타중립. 지어낸 색이 아니다.

export interface BoardUnit {
  id: string; at: LonLat; actor: string; arm: Arm; label: string;
  strength?: number; facing?: number; entity?: string;
  status?: UnitStatus; path?: LonLat[] | null;   // v2 (아래)
}
export interface BoardPhase { t: number; title: string; note?: string; units: BoardUnit[]; caption?: string; cite?: string; quote?: BoardQuote | null; arrows?: BoardArrow[]; clashes?: BoardClash[] }
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

// ── 말판 v2: 프레임 보간·블록 기하 (OVERHAUL §3.6, R54). 순수 함수. 시뮬레이션이 아니라 보간이다. ──────────────
// River 08-13 원문: 「무거운 실시간 연산은 필요 없고 그렇게 "보여지기만" 하면 된다.」
export type UnitStatus = 'active' | 'routed' | 'destroyed';
export interface BoardArrow { from: LonLat; to: LonLat; via?: LonLat | null; actor: string; kind: 'advance' | 'retreat' | 'flank' }
export interface BoardClash { at: LonLat; label?: string }
export interface BoardQuote { text: string; who: string; cite: string }
export interface FrameUnit extends BoardUnit { opacity: number }
export interface Frame { i: number; frac: number; phase: BoardPhase; next: BoardPhase | null; units: FrameUnit[]; arrows: BoardArrow[]; clashes: BoardClash[]; caption?: string; cite?: string; quote: BoardQuote | null }

const opacityOf = (s?: UnitStatus) => s === 'destroyed' ? 0 : s === 'routed' ? 0.45 : 1;
const lerpAngle = (a: number, b: number, f: number) => { const d = ((b - a + 540) % 360) - 180; return (a + d * f + 360) % 360; };
function alongPath(path: LonLat[], f: number): LonLat {
  const seg = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  const total = seg.reduce((s, x) => s + x, 0);
  if (!total) return path[path.length - 1];
  let want = f * total;
  for (let i = 0; i < seg.length; i++) {
    if (want <= seg[i] || i === seg.length - 1) { const k = seg[i] ? want / seg[i] : 1; return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k]; }
    want -= seg[i];
  }
  return path[path.length - 1];
}

/** t는 실수 페이즈 좌표. 0 ≤ t ≤ phases.length−1. 정수면 그 페이즈 그대로, 사이면 선형(또는 path) 보간.
 *  다음 페이즈에 없는 유닛은 흐려지며 사라지고, 새로 나타나는 유닛은 흐리게 떠오른다. */
export function interpolate(board: BoardData, t: number): Frame {
  const n = board.phases.length, tt = Math.min(Math.max(t, 0), n - 1);
  const i = Math.min(Math.floor(tt), n - 1), frac = tt - i;
  const a = board.phases[i], b = board.phases[i + 1] ?? null;
  const units: FrameUnit[] = [];
  for (const u of a.units) {
    const v = b?.units.find(x => x.id === u.id);
    if (!b || frac === 0) { units.push({ ...u, opacity: opacityOf(u.status) }); continue; }
    if (!v) { units.push({ ...u, opacity: opacityOf(u.status) * (1 - frac) }); continue; }
    const at: LonLat = u.path && u.path.length >= 2 ? alongPath(u.path, frac) : [u.at[0] + (v.at[0] - u.at[0]) * frac, u.at[1] + (v.at[1] - u.at[1]) * frac];
    const facing = u.facing != null && v.facing != null ? lerpAngle(u.facing, v.facing, frac) : (v.facing ?? u.facing);
    const o0 = opacityOf(u.status), o1 = opacityOf(v.status);
    units.push({ ...v, at, facing, opacity: o0 + (o1 - o0) * frac });
  }
  if (b && frac > 0) for (const v of b.units) if (!a.units.some(x => x.id === v.id)) units.push({ ...v, opacity: opacityOf(v.status) * frac });
  // 화살표·교전은 「그 페이즈로 들어가는 기동」이다. 사이를 지나는 동안은 다음 페이즈의 것을 보여 블록과 화살표가 같이 움직인다.
  const m = b && frac > 0 ? b : a;
  return { i, frac, phase: a, next: b, units, arrows: m.arrows ?? [], clashes: m.clashes ?? [], caption: a.caption, cite: a.cite, quote: a.quote ?? null };
}

/** 병종별 블록 크기(m). 보병은 넓고 얕게, 기병은 좁고 깊게 (Epic History 전투전술 문법, A_공간지도). */
const SIZE_M: Record<Arm, [number, number]> = { infantry: [320, 90], cavalry: [200, 140], light: [220, 70], elephant: [160, 110], command: [110, 110], fleet: [420, 70] };
/** 병력은 로그 스케일로 폭만 키운다(1,000 → 0.7배, 10,000 → 1.05배, 45,000 → 1.27배). 수치 논쟁이 그림을 크게 안 바꾼다. */
const sizeK = (strength?: number) => Math.min(1.4, Math.max(0.7, 0.7 + 0.35 * Math.log10(Math.max(1, (strength ?? 1000) / 1000))));
/** 중심·향(도, 북 = 0, 시계방향)·병종 → 닫힌 사각형. front면 전면 30%의 앞띠(향을 말한다). */
export function unitPolygon(u: { at: LonLat; arm: Arm; facing?: number; strength?: number }, front = false, minPx = 0, zoom = 12): LonLat[] {
  const [w0, d0] = SIZE_M[u.arm];
  // 화면에서 최소 minPx 픽셀은 되게: 축척이 낮으면 블록을 미터로 키운다(장기말 tokenMeters와 같은 감각). z12 이상은 실제 미터.
  const mpp = 156543.03 * Math.cos((u.at[1] * Math.PI) / 180) / 2 ** zoom;
  const k = sizeK(u.strength) * Math.max(1, (minPx * mpp) / w0);
  const w = w0 * k, d = front ? d0 * k * 0.3 : d0 * k, off = front ? d0 * k * 0.35 : 0;
  const th = ((u.facing ?? 0) * Math.PI) / 180, mLat = 1 / 111320, mLon = 1 / (111320 * Math.cos((u.at[1] * Math.PI) / 180));
  const local: [number, number][] = [[-w / 2, -d / 2 + off], [w / 2, -d / 2 + off], [w / 2, d / 2 + off], [-w / 2, d / 2 + off]];
  const ring = local.map(([x, y]) => [u.at[0] + (x * Math.cos(th) + y * Math.sin(th)) * mLon, u.at[1] + (-x * Math.sin(th) + y * Math.cos(th)) * mLat] as LonLat);
  return [...ring, ring[0]];
}
export function bearingDeg(a: LonLat, b: LonLat): number {
  const dx = (b[0] - a[0]) * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180), dy = b[1] - a[1];
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}
/** 2차 베지어. via가 없으면 진행 방향 왼쪽으로 25% 휜다(직선은 시야를 가른다, PACK-CAESAR §10.5). */
export function arrowLine(a: BoardArrow, steps = 24): LonLat[] {
  const [x0, y0] = a.from, [x2, y2] = a.to;
  const [cx, cy] = a.via ?? [(x0 + x2) / 2 - (y2 - y0) * 0.25, (y0 + y2) / 2 + (x2 - x0) * 0.25];
  const out: LonLat[] = [];
  for (let i = 0; i <= steps; i++) { const t = i / steps, s = 1 - t; out.push([s * s * x0 + 2 * s * t * cx + t * t * x2, s * s * y0 + 2 * s * t * cy + t * t * y2]); }
  return out;
}
type FC = { type: 'FeatureCollection'; features: { type: 'Feature'; id?: string; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[] };
/** 프레임 → 소스 셋. units: 몸통·앞띠(면)+이름표(점) · arrows: 선+화살촉(점) · marks: 교전(점). */
export function battleGeoJSON(frame: Frame, palette: Record<string, string>, boardId: string, zoom = 12, minPx = 26): { units: FC; arrows: FC; marks: FC } {
  const color = (actor: string) => palette[actor] ?? FALLBACK_COLOR;
  const units: FC = { type: 'FeatureCollection', features: [] };
  for (const u of frame.units) {
    if (u.opacity <= 0.01) continue;
    const base = { id: u.id, board: boardId, actor: u.actor, color: color(u.actor), label: u.label, arm: u.arm, armKo: ARM_KO[u.arm], strength: u.strength ?? null, entity: u.entity ?? null, opacity: +u.opacity.toFixed(3), status: u.status ?? 'active' };
    units.features.push({ type: 'Feature', id: `${u.id}#body`, properties: { ...base, kind: 'body' }, geometry: { type: 'Polygon', coordinates: [unitPolygon(u, false, minPx, zoom)] } });
    units.features.push({ type: 'Feature', id: `${u.id}#front`, properties: { ...base, kind: 'front' }, geometry: { type: 'Polygon', coordinates: [unitPolygon(u, true, minPx, zoom)] } });
    units.features.push({ type: 'Feature', id: `${u.id}#label`, properties: { ...base, kind: 'label' }, geometry: { type: 'Point', coordinates: u.at } });
  }
  const arrows: FC = { type: 'FeatureCollection', features: [] };
  for (const [k, a] of frame.arrows.entries()) {
    const line = arrowLine(a), end = line[line.length - 1], prev = line[line.length - 2];
    arrows.features.push({ type: 'Feature', properties: { kind: 'arrow', color: color(a.actor), move: a.kind }, geometry: { type: 'LineString', coordinates: line } });
    arrows.features.push({ type: 'Feature', properties: { kind: 'head', color: color(a.actor), bearing: bearingDeg(prev, end), n: k }, geometry: { type: 'Point', coordinates: end } });
  }
  const marks: FC = { type: 'FeatureCollection', features: frame.clashes.map(c => ({ type: 'Feature' as const, properties: { kind: 'clash', label: c.label ?? '' }, geometry: { type: 'Point', coordinates: c.at } })) };
  return { units, arrows, marks };
}
