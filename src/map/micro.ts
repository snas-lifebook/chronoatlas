// src/map/micro.ts: 미시지도 범용 렌더러 (OVERHAUL §3.1, R47).
//
// 소스 둘(피처 · 대푯점) + 층 열 안팎. 지도가 바뀌면 setData로 갈아끼운다. 어느 지도를 그리든 같은 층이라
// 새 미시지도는 data/micromaps/<id>.json 한 장이면 된다. 옛 엔진은 알레시아·로마·알렉산드리아마다 층을 따로
// 박아 31개였고, 넷째 지도부터 매번 엔진을 만져야 했다.
//
// kind → 그리는 법 표. 값은 옛 엔진 블록(2026-09-13)에서 그대로 옮겼다. 여기 없는 kind는 스키마가 막는다
// (schema/micromap.ts KINDS와 키가 같아야 한다. 테스트가 본다).
import type * as maplibregl from 'maplibre-gl';
import type { MicroMapDef, CalloutDef } from '../../schema/micromap';

type Paint = {
  fill?: { color: string | 'rome' | 'gaul'; opacity: number; outline?: string };
  line?: { color: string | 'rome' | 'gaul' | 'trap'; width: number; opacity?: number; dash?: 'short' | 'long' };
  point?: { radius: number; color: string | 'rome' | 'gaul'; stroke: string; strokeWidth: number };
  label?: boolean;
};
export const KIND_PAINT: Record<string, Paint> = {
  // 알레시아
  plain:      { fill: { color: '#C9B98A', opacity: 0.25 }, label: true },
  oppidum:    { fill: { color: 'gaul', opacity: 0.45, outline: 'gaul' }, label: true },
  river:      { line: { color: '#5B86A8', width: 3, opacity: 0.9 }, label: true },
  outer_line: { line: { color: 'rome', width: 3.4, opacity: 0.95, dash: 'short' }, label: true },
  inner_line: { line: { color: 'rome', width: 3.4, opacity: 0.95 }, label: true },
  redoubt:    { point: { radius: 3.4, color: 'rome', stroke: '#fff', strokeWidth: 1 } },
  camp:       { point: { radius: 7, color: 'rome', stroke: '#fff', strokeWidth: 2 }, label: true },
  gaul_camp:  { fill: { color: 'gaul', opacity: 0.18 }, point: { radius: 8, color: 'gaul', stroke: '#fff', strokeWidth: 2 }, label: true },
  hill:       { fill: { color: '#9C8C63', opacity: 0.28, outline: '#6B6353' }, point: { radius: 4, color: '#9C8C63', stroke: '#6B6353', strokeWidth: 1 }, label: true },
  ditch:      { line: { color: '#5B4A33', width: 2.6, opacity: 0.85 } },
  trap:       { line: { color: 'trap', width: 1.8, opacity: 0.9, dash: 'short' } },
  // 로마
  field:      { fill: { color: '#C9B98A', opacity: 0.3 }, label: true },
  circus:     { fill: { color: '#C9B98A', opacity: 0.3 }, label: true },
  forum:      { fill: { color: '#C9B98A', opacity: 0.3 }, point: { radius: 5, color: '#b8860b', stroke: '#3a2f22', strokeWidth: 1.4 }, label: true },
  boundary:   { line: { color: '#7A3E8C', width: 3, opacity: 0.95, dash: 'long' }, label: true },
  wall:       { line: { color: '#4A4538', width: 3.2, opacity: 0.9 }, label: true },
  road:       { line: { color: '#8A7B5C', width: 2.4, opacity: 0.8, dash: 'long' }, label: true },
  temple:     { point: { radius: 5, color: '#b8860b', stroke: '#3a2f22', strokeWidth: 1.4 }, label: true },
  theatre:    { point: { radius: 5, color: '#b8860b', stroke: '#3a2f22', strokeWidth: 1.4 }, label: true },
  building:   { point: { radius: 5, color: '#b8860b', stroke: '#3a2f22', strokeWidth: 1.4 }, label: true },
  gate:       { point: { radius: 5, color: '#b8860b', stroke: '#3a2f22', strokeWidth: 1.4 }, label: true },
  // 알렉산드리아
  lake:       { fill: { color: '#7FA6BE', opacity: 0.35 }, label: true },
  harbor:     { fill: { color: '#5B86A8', opacity: 0.3 }, label: true },
  island:     { fill: { color: '#C9B98A', opacity: 0.34, outline: '#8A7B5C' }, point: { radius: 6, color: '#b8860b', stroke: '#3a2f22', strokeWidth: 1.4 }, label: true },
  district:   { fill: { color: '#9C8C63', opacity: 0.22, outline: '#6B6353' }, label: true },
  causeway:   { line: { color: '#6B5D45', width: 6, opacity: 0.95 }, label: true },
  lighthouse: { point: { radius: 6, color: '#b8860b', stroke: '#3a2f22', strokeWidth: 1.4 }, label: true },
  cape:       { point: { radius: 6, color: '#b8860b', stroke: '#3a2f22', strokeWidth: 1.4 }, label: true },
};

export const MICRO_LAYERS = ['micro-basemap', 'micro-fill', 'micro-fill-outline', 'micro-line', 'micro-line-dash-short', 'micro-line-dash-long',
  'micro-tower', 'micro-trap-label', 'micro-point', 'micro-mark', 'micro-label'] as const;
const EMPTY = { type: 'FeatureCollection', features: [] } as const;
/** 함정 종류색. 벽에서 멀어지는 쪽이 킵피 → 릴리아 → 스티물루스(BG 7.73). */
const TRAP_COLOR: any = ['match', ['get', 'trap_type'], 'cippi', '#8A3E3E', 'lilia', '#B4553A', 'stimuli', '#C98A3C', '#8A3E3E'];
/** 「사건 자리」 표식. 로마의 암살 자리, 알렉산드리아 전쟁의 세 자리. 데이터 플래그가 말한다. */
const MARK_FLAGS = ['assassination', 'fleet_fire', 'siege', 'caesar_swim'] as const;

export function representativePoint(g: { type: string; coordinates: unknown } | undefined): [number, number] | null {
  if (!g) return null;
  if (g.type === 'Point') return g.coordinates as [number, number];
  if (g.type === 'LineString') { const c = g.coordinates as [number, number][]; return c.length ? c[Math.floor(c.length / 2)] : null; }
  const rings: number[][][] = g.type === 'MultiPolygon' ? (g.coordinates as number[][][][]).map(x => x[0]) : g.type === 'Polygon' ? [(g.coordinates as number[][][])[0]] : [];
  if (!rings.length) return null;
  const big = rings.reduce((a, b) => (b.length > a.length ? b : a), rings[0]);
  const sum = big.reduce((a, q) => [a[0] + q[0], a[1] + q[1]], [0, 0]);
  return [sum[0] / big.length, sum[1] / big.length];
}

export interface ResolvedCallout extends CalloutDef { at: [number, number] }
/** 앵커를 좌표로 푼다. 못 푼 것은 버리고 콘솔에 남긴다(test/micromap.test.ts가 같은 것을 CI에서 막는다).
 *  `year`를 주면 시기 밖 콜아웃(`[from_year, to_year)`)은 뺀다 — 로마 시내 한 장이 BC 44와 AD 41을 같이 싣는다(R59). */
export function resolveCallouts(def: MicroMapDef, unitAt?: (unitId: string) => [number, number] | null, year?: number | null): ResolvedCallout[] {
  return def.callouts.flatMap(c => {
    if (year != null && ((c.from_year != null && year < c.from_year) || (c.to_year != null && year >= c.to_year))) return [];
    let at: [number, number] | null = null;
    if ('lnglat' in c.anchor) at = c.anchor.lnglat;
    else if ('feature' in c.anchor) { const fid = c.anchor.feature; at = representativePoint(def.features.find(f => f.properties.id === fid)?.geometry); }
    else if ('unit' in c.anchor) at = unitAt?.(c.anchor.unit) ?? null;
    if (!at) { if (import.meta.env?.DEV) console.warn('콜아웃 앵커를 못 찾았다', c.id); return []; }
    return [{ ...c, at }];
  });
}

/** 망루 아이콘. 흰 테 먼저, 색 몸통과 성가퀴(옛 엔진 towerIcon 그대로). */
function towerIcon(color: string): ImageData {
  const S = 14, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#FFFFFF'; g.fillRect(1, 1, 12, 12);
  g.fillStyle = color; g.fillRect(2.5, 3, 9, 9);
  g.fillRect(3, 1, 2.2, 2.4); g.fillRect(8.8, 1, 2.2, 2.4);
  return g.getImageData(0, 0, S, S);
}

/** 대푯점 소스: 면·선 피처 중 점 표식(진영·사건 자리)이 필요한 것만. 폴리곤 소스에 circle을 얹으면 정점마다 점이 찍힌다. */
function markPoints(def: MicroMapDef) {
  const out: object[] = [];
  for (const f of def.features) {
    const p = f.properties as Record<string, unknown>;
    const flagged = MARK_FLAGS.some(k => p[k] === true);
    const rep = p.kind === 'gaul_camp' || (p.kind === 'hill' && f.geometry.type !== 'Point');
    if (!flagged && !rep) continue;
    const at = representativePoint(f.geometry);
    if (at) out.push({ type: 'Feature', properties: { ...p, mark: flagged ? 'event' : 'rep' }, geometry: { type: 'Point', coordinates: at } });
  }
  return { type: 'FeatureCollection', features: out };
}

export function createMicro(map: maplibregl.Map, opts: {
  root: string; ds: string; palette: Record<string, string>; halo: () => string;
  before?: () => string | undefined; onEnter?: (def: MicroMapDef) => void; onLeave?: () => void;
}) {
  let active: MicroMapDef | null = null;
  const color = (c: string) => c === 'rome' ? (opts.palette['로마'] ?? '#A4243B') : c === 'gaul' ? (opts.palette['갈리아'] ?? '#3E7C4F') : c;
  const kinds = (pred: (p: Paint) => boolean) => ['literal', Object.entries(KIND_PAINT).filter(([, p]) => pred(p)).map(([k]) => k)] as any;
  const matchExpr = (pick: (p: Paint) => string | number | undefined, fallback: string | number) =>
    ['match', ['get', 'kind'], ...Object.entries(KIND_PAINT).flatMap(([k, p]) => { const v = pick(p); return v === undefined ? [] : [k, typeof v === 'string' ? (v === 'trap' ? TRAP_COLOR : color(v)) : v]; }), fallback] as any;
  const isPoly: any = ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]];
  const isLine: any = ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]];
  const fillOpacity = (wash: number) => ['*', wash, matchExpr(p => p.fill?.opacity, 0.3)] as any;

  function ensureLayers() {
    if (map.getSource('micro')) return;
    const before = opts.before?.();
    const rome = color('rome');
    map.addSource('micro', { type: 'geojson', data: EMPTY as any, promoteId: 'id' });
    map.addSource('micro-pt', { type: 'geojson', data: EMPTY as any });
    map.addLayer({ id: 'micro-fill', type: 'fill', source: 'micro', filter: ['all', isPoly, ['in', ['get', 'kind'], kinds(p => !!p.fill)]],
      paint: { 'fill-color': matchExpr(p => p.fill?.color, '#CCCCCC'), 'fill-opacity': fillOpacity(1) } }, before);
    map.addLayer({ id: 'micro-fill-outline', type: 'line', source: 'micro', filter: ['all', isPoly, ['in', ['get', 'kind'], kinds(p => !!p.fill?.outline)]],
      paint: { 'line-color': matchExpr(p => p.fill?.outline, '#888888'), 'line-width': 1, 'line-opacity': 0.9 } }, before);
    map.addLayer({ id: 'micro-line', type: 'line', source: 'micro', filter: ['all', isLine, ['in', ['get', 'kind'], kinds(p => !!p.line && !p.line.dash)]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': matchExpr(p => p.line?.color, '#888888'), 'line-width': matchExpr(p => p.line?.width, 1.5), 'line-opacity': matchExpr(p => p.line?.opacity, 0.9) } }, before);
    // 점선은 dasharray가 match 표현식을 못 받는다(MapLibre 제약). 짧은 점선·긴 점선 두 층.
    for (const [suffix, dash, kind] of [['short', [3, 1.6], 'short'], ['long', [5, 2.5], 'long']] as const) {
      map.addLayer({ id: `micro-line-dash-${suffix}`, type: 'line', source: 'micro', filter: ['all', ['any', isLine, isPoly], ['in', ['get', 'kind'], kinds(p => p.line?.dash === kind)]],
        paint: { 'line-color': matchExpr(p => p.line?.color, '#888888'), 'line-width': matchExpr(p => p.line?.width, 1.5), 'line-dasharray': [...dash], 'line-opacity': matchExpr(p => p.line?.opacity, 0.9) } }, before);
    }
    // 망루는 두 포위선 위에. 실제 간격이 아니라 보이는 간격이다.
    if (!map.hasImage('micro-tower')) map.addImage('micro-tower', towerIcon(rome), { pixelRatio: 2 });
    map.addLayer({ id: 'micro-tower', type: 'symbol', source: 'micro', filter: ['in', ['get', 'kind'], ['literal', ['inner_line', 'outer_line']]],
      layout: { 'symbol-placement': 'line', 'symbol-spacing': 30, 'icon-image': 'micro-tower', 'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 13, 0.9, 15, 1.5],
        'icon-rotation-alignment': 'viewport', 'icon-pitch-alignment': 'viewport', 'icon-allow-overlap': true, 'icon-ignore-placement': true }, paint: { 'icon-opacity': 0.95 } }, before);
    // 띠 이름표(함정·해자). z13.2부터, 선을 따라 반복(line-center는 링 가운데가 화면 밖이면 아무것도 안 그린다).
    map.addLayer({ id: 'micro-trap-label', type: 'symbol', source: 'micro', filter: ['in', ['get', 'kind'], ['literal', ['trap', 'ditch']]], minzoom: 13.2,
      layout: { 'symbol-placement': 'line', 'symbol-spacing': 420, 'text-field': ['coalesce', ['get', 'name_la'], ['get', 'name_ko']], 'text-font': ['KlokanTech Noto Sans CJK Regular'], 'text-size': 11, 'text-letter-spacing': 0.08, 'text-optional': true, 'text-allow-overlap': false },
      paint: { 'text-color': TRAP_COLOR, 'text-halo-color': opts.halo(), 'text-halo-width': 2 } }, before);
    map.addLayer({ id: 'micro-point', type: 'circle', source: 'micro', filter: ['all', ['==', ['geometry-type'], 'Point'], ['in', ['get', 'kind'], kinds(p => !!p.point)]],
      paint: { 'circle-radius': matchExpr(p => p.point?.radius, 5), 'circle-color': matchExpr(p => p.point?.color, '#b8860b'), 'circle-stroke-color': matchExpr(p => p.point?.stroke, '#3a2f22'), 'circle-stroke-width': matchExpr(p => p.point?.strokeWidth, 1.4) } }, before);
    // 대푯점: 진영(면)과 사건 자리(플래그). 사건 자리는 크게, 세력색.
    map.addLayer({ id: 'micro-mark', type: 'circle', source: 'micro-pt',
      paint: { 'circle-radius': ['case', ['==', ['get', 'mark'], 'event'], 11, matchExpr(p => p.point?.radius, 6)], 'circle-color': ['case', ['==', ['get', 'mark'], 'event'], rome, matchExpr(p => p.point?.color, '#9C8C63')],
        'circle-stroke-color': '#fff', 'circle-stroke-width': ['case', ['==', ['get', 'mark'], 'event'], 3, 2], 'circle-opacity': 0.9 } }, before);
    map.addLayer({ id: 'micro-label', type: 'symbol', source: 'micro', filter: ['in', ['get', 'kind'], kinds(p => !!p.label)],
      layout: { 'text-field': ['get', 'name_ko'], 'text-font': ['KlokanTech Noto Sans CJK Bold'], 'text-size': 13, 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.9, 'text-max-width': 9, 'text-optional': true, 'text-allow-overlap': false },
      paint: { 'text-color': '#2B2721', 'text-halo-color': opts.halo(), 'text-halo-width': 2.2 } }, before);
  }
  function setBasemap(def: MicroMapDef | null) {
    if (map.getLayer('micro-basemap')) map.removeLayer('micro-basemap');
    if (map.getSource('micro-basemap')) map.removeSource('micro-basemap');
    const bm = def?.basemap; if (!bm) return;
    const { w, e, n, s } = bm.corners;
    map.addSource('micro-basemap', { type: 'image', url: `${opts.root}datasets/${opts.ds}/rasters/${bm.file}`, coordinates: [[w, n], [e, n], [e, s], [w, s]] });
    // 도판은 배경이고 우리 마킹이 주인공이다: 미시 채움 층 아래에 깐다.
    map.addLayer({ id: 'micro-basemap', type: 'raster', source: 'micro-basemap', minzoom: bm.min_zoom ?? 11, paint: { 'raster-opacity': bm.opacity ?? 0.85, 'raster-fade-duration': 0 } }, 'micro-fill');
  }
  /** 그 해에 아직 안 세워진 건물을 가린다(옛 엔진 hideUnbuilt). 피처의 `built_year`가 해보다 크면 숨긴다. 연도 없는 피처는 늘 보인다.
   *  카이사레움(BC 30년대 착수)이 BC 47 알렉산드리아 판에, 폼페이우스 극장(BC 55 봉헌)이 BC 60 로마 판에 서 있던 구멍이다. */
  const BASE = new Map<string, unknown>();
  let year: number | null = null;
  function applyYear() {
    if (year == null || !map.getSource('micro')) return;
    // built_year: 그 해보다 앞이면 숨김 · gone_year: 그 해부터 숨김(R59, 로마 시내 BC 44/AD 41 겸용)
    const f: any = ['all',
      ['any', ['!', ['has', 'built_year']], ['<=', ['get', 'built_year'], year]],
      ['any', ['!', ['has', 'gone_year']], ['>', ['get', 'gone_year'], year]]];
    for (const id of MICRO_LAYERS) {
      if (id === 'micro-basemap' || !map.getLayer(id)) continue;
      if (!BASE.has(id)) BASE.set(id, map.getFilter(id) ?? null);
      const base = BASE.get(id);
      map.setFilter(id, (base ? ['all', base, f] : f) as any);
    }
  }
  return {
    active: () => active,
    /** 연도가 바뀌면 부른다. 건물의 built_year를 본다. */
    setYear(y: number) { year = y; applyYear(); },
    /** setStyle이 소스를 지운 뒤 다시 들어오게 한다(같은 id면 enter가 조기 반환하므로). */
    reset() { active = null; BASE.clear(); },
    enter(def: MicroMapDef) {
      if (active?.id === def.id && map.getSource('micro')) return;
      ensureLayers();
      active = def;
      (map.getSource('micro') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: def.features } as any);
      (map.getSource('micro-pt') as maplibregl.GeoJSONSource).setData(markPoints(def) as any);
      setBasemap(def);
      // 도판이 깔리면 채움을 씻어 내린다(옛 SCAN_WASH). 도판이 없으면 원래 값.
      map.setPaintProperty('micro-fill', 'fill-opacity', fillOpacity(def.basemap ? 0.45 : 1));
      applyYear();
      opts.onEnter?.(def);
    },
    leave() {
      if (!active) return;
      active = null;
      (map.getSource('micro') as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY as any);
      (map.getSource('micro-pt') as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY as any);
      setBasemap(null);
      opts.onLeave?.();
    },
  };
}
export type Micro = ReturnType<typeof createMicro>;
