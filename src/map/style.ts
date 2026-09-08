// 베이스맵 스타일 (DESIGN v3 §1, TASKS 1.4). 순수 함수 — manifest → MapLibre 스타일. 데이터 레이어(영토·전투…)는 main이 이 위에 얹는다.
import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

// 지도 전용 토큰(DESIGN "토큰" 절). UI 토큰이 아니다 — 크롬 색은 astryx가 준다.
export const MAP = {
  light: { sea: '#D6E4EF', land: '#EEF0EC', coast: '#8FA3B4', river: '#9CBBD3', glacier: '#F7F8F6', label: '#111418', label2: '#7C8794', halo: '#FFFFFF',
    depth: ['#D6E4EF', '#CBDCE9', '#BFD2E3', '#B2C8DD', '#A6BED7', '#9AB4D1', '#8FAACB'] },
  dark:  { sea: '#1B2129', land: '#2A2E33', coast: '#4C5A67', river: '#3D5468', glacier: '#3A3F45', label: '#E6E8EB', label2: '#9AA3AE', halo: '#1B2129',
    depth: ['#1B2129', '#192028', '#171E26', '#151C24', '#131A22', '#111820', '#0F161E'] },
} as const;
const DEPTHS = [0, 200, 1000, 2000, 3000, 4000, 5000];
const FONT = { regular: ['KlokanTech Noto Sans CJK Regular'], bold: ['KlokanTech Noto Sans CJK Bold'] }; // ponytail: Pretendard 글리프로 교체 예정(fetch-external 참고)

export interface BasemapManifest { basemap?: string[]; relief?: boolean; bbox?: [number, number, number, number] }

export function buildStyle(m: BasemapManifest, root: string, ds: string, opt: { dark?: boolean } = {}): StyleSpecification {
  const c = opt.dark ? MAP.dark : MAP.light;
  const base = `${root}datasets/${ds}`;
  const has = (l: string) => (m.basemap ?? []).includes(l);
  const sources: StyleSpecification['sources'] = {};
  const layers: LayerSpecification[] = [{ id: 'sea', type: 'background', paint: { 'background-color': c.sea } }];
  const geo = (id: string) => { sources[id] = { type: 'geojson', data: `${base}/layers/${id}.geojson` }; };

  if (has('land')) { geo('land'); layers.push({ id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': c.land } }); }
  if (m.relief && m.bbox) {
    const [w, s, e, n] = m.bbox;
    sources.relief = { type: 'image', url: `${base}/rasters/relief.jpg`, coordinates: [[w, n], [e, n], [e, s], [w, s]] };
    // 밝은 톤은 착색된 원본 그대로, 다크는 어둡게. hillshade 실계산은 Mapterhorn DEM 붙을 때.
    layers.push({ id: 'relief', type: 'raster', source: 'relief', paint: opt.dark
      ? { 'raster-brightness-max': 0.32, 'raster-contrast': 0.2, 'raster-fade-duration': 0 }
      : { 'raster-fade-duration': 0, 'raster-contrast': -0.12 } });
  }
  if (has('bathy')) {
    geo('bathy');
    const ramp: any[] = ['step', ['get', 'depth'], c.depth[0]];
    DEPTHS.slice(1).forEach((d, i) => ramp.push(d, c.depth[i + 1]));
    layers.push({ id: 'bathy', type: 'fill', source: 'bathy', paint: { 'fill-color': ramp as any, 'fill-antialias': false } });
  }
  if (has('lakes')) { geo('lakes'); layers.push({ id: 'lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': c.sea } }); }
  if (has('glaciers')) { geo('glaciers'); layers.push({ id: 'glaciers', type: 'fill', source: 'glaciers', paint: { 'fill-color': c.glacier, 'fill-opacity': 0.8 } }); }
  if (has('rivers')) {
    geo('rivers');
    const width: any = ['interpolate', ['linear'], ['zoom'], 3, 0.4, 9, 1.6];
    layers.push({ id: 'rivers-major', type: 'line', source: 'rivers', minzoom: 3, filter: ['<=', ['get', 'scalerank'], 6], paint: { 'line-color': c.river, 'line-width': width } });
    layers.push({ id: 'rivers-minor', type: 'line', source: 'rivers', minzoom: 6, filter: ['>', ['get', 'scalerank'], 6], paint: { 'line-color': c.river, 'line-width': width } });
  }
  if (has('coast')) { geo('coast'); layers.push({ id: 'coast', type: 'line', source: 'coast', paint: { 'line-color': c.coast, 'line-width': 1 } }); }

  // 라벨 — 충돌 회피 P9(기본값 allow-overlap false). 바다·지역명은 대문자 라틴 자간 0.2em(Esri 관습).
  const sym = (id: string, source: string, layout: any, paint: any, extra: Partial<LayerSpecification> = {}): LayerSpecification =>
    ({ id, type: 'symbol', source, layout: { 'text-allow-overlap': false, 'text-padding': 4, ...layout }, paint, ...extra } as LayerSpecification);
  if (has('marine_labels')) {
    geo('marine_labels');
    layers.push(sym('label-marine', 'marine_labels',
      { 'text-field': ['upcase', ['get', 'name']], 'text-font': FONT.regular, 'text-letter-spacing': 0.2, 'text-max-width': 6,
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 7, 14], 'symbol-sort-key': ['get', 'scalerank'] },
      { 'text-color': c.label2, 'text-opacity': 0.85 },
      { minzoom: 3, filter: ['<=', ['get', 'scalerank'], ['step', ['zoom'], 1, 4, 3, 6, 9]] as any }));
  }
  if (has('region_labels')) {
    geo('region_labels');
    layers.push(sym('label-region', 'region_labels',
      { 'text-field': ['upcase', ['get', 'name']], 'text-font': FONT.regular, 'text-letter-spacing': 0.15, 'text-max-width': 8,
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 8, 12], 'symbol-sort-key': ['get', 'scalerank'] },
      { 'text-color': c.label2, 'text-opacity': 0.8 },
      { minzoom: 4, // 대륙(Continent)은 클립 조각마다 라벨이 붙어 지운다. 섬은 z7부터.
        filter: ['all', ['!', ['in', ['get', 'featurecla'], ['literal', ['Continent', 'Geoarea', 'Coast']]]],
          ['any', ['!', ['in', ['get', 'featurecla'], ['literal', ['Island', 'Island group']]]], ['>=', ['zoom'], 7]],
          ['<=', ['get', 'scalerank'], ['step', ['zoom'], 3, 5, 5, 7, 9]]] as any }));
  }
  // 정착지 라벨: 데이터셋 settlements(어댑터 산출) — rank LOD z3/5/7. 마커는 main이 같은 소스로 그린다.
  sources.settlements = { type: 'geojson', data: `${base}/layers/settlements.geojson` };
  for (const [rank, minzoom, size, font] of [[1, 3, 13, FONT.bold], [2, 5, 12, FONT.regular], [3, 7, 11, FONT.regular]] as const) {
    layers.push(sym(`label-settle-${rank}`, 'settlements',
      { 'text-field': ['get', 'name_ko'], 'text-font': [...font], 'text-size': size, 'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
        'text-radial-offset': 0.7, 'text-justify': 'auto' },
      { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 1.4 },
      { minzoom, filter: ['==', ['get', 'rank'], rank] as any }));
  }
  return { version: 8, glyphs: `${root}glyphs/{fontstack}/{range}.pbf`, sources, layers };
}
