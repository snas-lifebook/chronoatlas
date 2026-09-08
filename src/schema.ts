// 재사용 시계열 GIS 데이터 계약 (SCHEMA.md 코드판).
// 균일 시간필터 모델: 모든 시간가변 피처가 valid_from/valid_to를 갖고 setFilter로 연도 필터된다.

export type Source = 'book' | 'web' | 'book+web';
export type Confidence = 'high' | 'medium' | 'low';

export interface Actor { id: string; label: string; color: string; source: Source; confidence: Confidence; }
export interface HistEvent { year: number; label: string; source: Source; confidence: Confidence; }
export interface Manifest {
  id: string; title: string; center: [number, number]; zoom: number;
  time: { from: number; to: number; unit: string };
  layers: string[]; skins: string[];
}
export interface Feature { type: 'Feature'; properties: Record<string, any>; geometry: { type: string; coordinates: any }; }
export interface FeatureCollection { type: 'FeatureCollection'; features: Feature[]; }

export interface Dataset {
  manifest: Manifest;
  actors: Actor[];
  events: HistEvent[];
  territory: FeatureCollection;      // 지역×통치구간 (dated) — _gen_territory.mjs 생성
  admin_regions: FeatureCollection;  // 학술 속주 경계 (dated) — _gen_admin.mjs 생성. territory와 별개
  settlements: FeatureCollection;
  battles: FeatureCollection;        // 전투 지점 (dated Point) — _gen_battles.mjs 생성
  movements: FeatureCollection;      // 원정로 세그먼트 (dated LineString) — _gen_movements.mjs 생성
  land: FeatureCollection | null;    // 육지(Natural Earth, 시간 불변). manifest.layers에 'land' 있을 때만
}

// 열린 시간범위 sentinel (valid_from/valid_to 없으면 상시). _gen_territory.mjs OPEN_FUTURE와 일치.
export const OPEN_PAST = -1000000;
export const OPEN_FUTURE = 1000000;

/** props가 해당 연도에 존재하나 (valid_from <= year < valid_to). 테스트·검증용 순수 헬퍼. */
export function withinDate(props: Record<string, any>, year: number): boolean {
  const from = props.valid_from ?? OPEN_PAST;
  const to = props.valid_to ?? OPEN_FUTURE;
  return from <= year && year < to;
}

/** MapLibre setFilter용 날짜창 표현식. setData 재계산 대신 이걸로 연도 필터. */
export function dateWindow(year: number): any[] {
  return ['all',
    ['<=', ['coalesce', ['get', 'valid_from'], OPEN_PAST], year],
    ['>', ['coalesce', ['get', 'valid_to'], OPEN_FUTURE], year]];
}

/** movements 세그먼트 중 year 시점 토큰 위치 = valid_from<=year인 마지막 세그먼트의 끝점(=도착지). 없으면 null. 순수 헬퍼. */
export function positionAtYear(features: Feature[], year: number): [number, number] | null {
  let best: Feature | null = null;
  let bestFrom = -Infinity;
  for (const f of features) {
    const vf = f.properties.valid_from ?? OPEN_PAST;
    if (vf <= year && vf >= bestFrom) { best = f; bestFrom = vf; }
  }
  if (!best) return null;
  const line = best.geometry.coordinates as number[][];
  return line[line.length - 1] as [number, number];
}

export interface RouteGeometry { path: [number, number][]; stops: { year: number; distAlong: number }[]; }

/** route 세그먼트를 연도순으로 이어붙인 전체 폴리라인 + 정거장(연도, 누적 호길이). 순수·테스트가능. */
export function routeGeometry(features: Feature[], route: string): RouteGeometry {
  const segs = features
    .filter(f => f.properties.route === route)
    .slice()
    .sort((a, b) => (a.properties.valid_from ?? OPEN_PAST) - (b.properties.valid_from ?? OPEN_PAST));

  const path: [number, number][] = [];
  const stops: { year: number; distAlong: number }[] = [];
  let dist = 0;
  for (const f of segs) {
    const line = f.geometry.coordinates as [number, number][];
    if (path.length === 0) {
      path.push(line[0]);
      stops.push({ year: f.properties.from_year ?? f.properties.valid_from, distAlong: 0 });
    }
    for (let i = 1; i < line.length; i++) {
      const prev = path[path.length - 1];
      const cur = line[i];
      dist += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      path.push(cur);
    }
    stops.push({ year: f.properties.to_year ?? f.properties.valid_from, distAlong: dist });
  }
  return { path, stops };
}

/** movements 세그먼트 중 특정 route의 year 시점 토큰 위치 = valid_from<=year인 마지막 세그먼트의 끝점. 없으면 null. 순수 헬퍼. */
export function positionByRoute(features: Feature[], route: string, year: number): [number, number] | null {
  let best: Feature | null = null;
  let bestFrom = -Infinity;
  for (const f of features) {
    if (f.properties.route !== route) continue;
    const vf = f.properties.valid_from ?? OPEN_PAST;
    if (vf <= year && vf >= bestFrom) { best = f; bestFrom = vf; }
  }
  if (!best) return null;
  const line = best.geometry.coordinates as number[][];
  return line[line.length - 1] as [number, number];
}

const SOURCES = new Set(['book', 'web', 'book+web']);
const CONFS = new Set(['high', 'medium', 'low']);

function eachCoord(geom: any, fn: (c: number[]) => void) {
  const walk = (a: any) => {
    if (typeof a[0] === 'number') fn(a as number[]);
    else for (const x of a) walk(x);
  };
  if (geom?.coordinates) walk(geom.coordinates);
}

function checkCoords(geom: any, id: string, err: string[]) {
  eachCoord(geom, ([lng, lat]) => {
    if (lng < -180 || lng > 180) err.push(`${id}: 경도 범위밖 ${lng} (좌표 flip?)`);
    if (lat < -90 || lat > 90) err.push(`${id}: 위도 범위밖 ${lat} (좌표 flip?)`);
  });
}

/** 데이터→렌더 계약 검증. errors[] 비어 있으면 통과. */
export function validateDataset(d: Dataset): string[] {
  const err: string[] = [];
  const actorIds = new Set(d.actors.map(a => a.id));

  // actors
  const seenA = new Set<string>();
  for (const a of d.actors) {
    if (seenA.has(a.id)) err.push(`actors: id 중복 ${a.id}`);
    seenA.add(a.id);
    if (!a.color) err.push(`actors ${a.id}: color 없음`);
    if (!SOURCES.has(a.source)) err.push(`actors ${a.id}: source 불명 ${a.source}`);
  }

  // territory: 지역×통치구간 날짜 피처
  const seenT = new Set<string>();
  const byRegion: Record<string, { from: number; to: number }[]> = {};
  for (const f of d.territory.features) {
    const p = f.properties;
    const id = p?.id ?? '(id없음)';
    if (seenT.has(id)) err.push(`territory: id 중복 ${id}`);
    seenT.add(id);
    if (!p.name_ko) err.push(`territory ${id}: name_ko 없음`);
    if (f.geometry?.type !== 'Polygon' && f.geometry?.type !== 'MultiPolygon') err.push(`territory ${id}: (Multi)Polygon 아님`);
    checkCoords(f.geometry, `territory ${id}`, err);
    if (!actorIds.has(p.actor)) err.push(`territory ${id}: 미정의 actor ${p.actor}`);
    if (!SOURCES.has(p.source)) err.push(`territory ${id}: source 불명`);
    if (!CONFS.has(p.confidence)) err.push(`territory ${id}: confidence 불명`);
    if (!(p.valid_from < p.valid_to)) err.push(`territory ${id}: valid_from < valid_to 아님`);
    (byRegion[p.region] ??= []).push({ from: p.valid_from, to: p.valid_to });
  }
  // 같은 지역 구간이 겹치거나(중복 소유주) 사이에 공백(무주공산 순간)이 없어야 한다
  for (const [region, ivs] of Object.entries(byRegion)) {
    ivs.sort((a, b) => a.from - b.from);
    for (let i = 1; i < ivs.length; i++) {
      if (ivs[i].from < ivs[i - 1].to) err.push(`territory ${region}: 구간 겹침 (${ivs[i - 1].to} > ${ivs[i].from})`);
      else if (ivs[i].from > ivs[i - 1].to) err.push(`territory ${region}: 구간 공백 (${ivs[i - 1].to}~${ivs[i].from})`);
    }
  }

  // admin_regions: 학술 속주 (MultiPolygon, dated). territory와 별개 레이어.
  const seenP = new Set<string>();
  for (const f of d.admin_regions.features) {
    const p = f.properties;
    const id = p?.id ?? '(id없음)';
    if (seenP.has(id)) err.push(`admin_regions: id 중복 ${id}`);
    seenP.add(id);
    if (!p.name_ko) err.push(`admin_regions ${id}: name_ko 없음`);
    if (f.geometry?.type !== 'MultiPolygon' && f.geometry?.type !== 'Polygon') err.push(`admin_regions ${id}: (Multi)Polygon 아님`);
    checkCoords(f.geometry, `admin_regions ${id}`, err);
    if (!SOURCES.has(p?.source)) err.push(`admin_regions ${id}: source 불명`);
    if (!CONFS.has(p?.confidence)) err.push(`admin_regions ${id}: confidence 불명`);
    if (p?.valid_from == null) err.push(`admin_regions ${id}: valid_from 없음`);
    if (p?.valid_to != null && !(p.valid_from < p.valid_to)) err.push(`admin_regions ${id}: valid_from < valid_to 아님`);
  }

  // settlements: 포인트 + 출처 완결 + 시간범위 온전
  for (const f of d.settlements.features) {
    const p = f.properties;
    const id = p?.id ?? '(id없음)';
    if (f.geometry?.type !== 'Point') err.push(`settlements ${id}: Point 아님`);
    checkCoords(f.geometry, `settlements ${id}`, err);
    if (!SOURCES.has(p?.source)) err.push(`settlements ${id}: source 불명`);
    if (!CONFS.has(p?.confidence)) err.push(`settlements ${id}: confidence 불명`);
    if (p?.valid_from != null && p?.valid_to != null && !(p.valid_from < p.valid_to))
      err.push(`settlements ${id}: valid_from < valid_to 아님`);
  }

  // battles: 전투 지점 (dated Point). victor·belligerents는 정의된 actor여야.
  const seenB = new Set<string>();
  for (const f of d.battles.features) {
    const p = f.properties;
    const id = p?.id ?? '(id없음)';
    if (seenB.has(id)) err.push(`battles: id 중복 ${id}`);
    seenB.add(id);
    if (!p.name_ko) err.push(`battles ${id}: name_ko 없음`);
    if (f.geometry?.type !== 'Point') err.push(`battles ${id}: Point 아님`);
    checkCoords(f.geometry, `battles ${id}`, err);
    if (!actorIds.has(p.victor)) err.push(`battles ${id}: 미정의 victor ${p.victor}`);
    for (const b of p.belligerents ?? []) if (!actorIds.has(b)) err.push(`battles ${id}: 미정의 belligerent ${b}`);
    if (typeof p.strength_a !== 'number' || typeof p.strength_b !== 'number') err.push(`battles ${id}: 병력 숫자 아님`);
    if (!SOURCES.has(p.source)) err.push(`battles ${id}: source 불명`);
    if (!CONFS.has(p.confidence)) err.push(`battles ${id}: confidence 불명`);
    if (!(p.valid_from < p.valid_to)) err.push(`battles ${id}: valid_from < valid_to 아님`);
    if (p.year < d.manifest.time.from || p.year > d.manifest.time.to) err.push(`battles ${id}: 연도 ${p.year} 시간범위 밖`);
  }

  // movements: 원정로 세그먼트 (dated LineString). actor는 정의된 actor여야.
  for (const f of d.movements.features) {
    const p = f.properties;
    const id = p?.id ?? '(id없음)';
    if (f.geometry?.type !== 'LineString') err.push(`movements ${id}: LineString 아님`);
    checkCoords(f.geometry, `movements ${id}`, err);
    if (!actorIds.has(p.actor)) err.push(`movements ${id}: 미정의 actor ${p.actor}`);
    if (!SOURCES.has(p.source)) err.push(`movements ${id}: source 불명`);
    if (!CONFS.has(p.confidence)) err.push(`movements ${id}: confidence 불명`);
    if (!(p.valid_from < p.valid_to)) err.push(`movements ${id}: valid_from < valid_to 아님`);
  }

  // events
  for (const e of d.events) if (e.year < d.manifest.time.from || e.year > d.manifest.time.to)
    err.push(`events: ${e.label} 연도 ${e.year} 시간범위 밖`);

  return err;
}
