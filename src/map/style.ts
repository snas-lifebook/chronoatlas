// 베이스맵 스타일 (DESIGN v3 §1, TASKS 1.4). 순수 함수 — manifest → MapLibre 스타일. 데이터 레이어(영토·전투…)는 main이 이 위에 얹는다.
import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

// 지도 전용 토큰(DESIGN "토큰" 절). UI 토큰이 아니다 — 크롬 색은 astryx가 준다.
// 스킨 = 지도 토큰 한 벌 (Azgaar FMG처럼 같은 데이터 위에 갈아끼운다). light/dark는 웹 UI가 쓰고, 나머지는 내보내기 전용(DESIGN P12).
export const MAP = {
  light: { sea: '#D6E4EF', land: '#EEF0EC', coast: '#8FA3B4', river: '#9CBBD3', glacier: '#F7F8F6', label: '#111418', label2: '#7C8794', halo: '#FFFFFF',
    depth: ['#D6E4EF', '#CBDCE9', '#BFD2E3', '#B2C8DD', '#A6BED7', '#9AB4D1', '#8FAACB'], relief: { brightnessMax: 1, contrast: 0.06, saturation: 0, opacity: 1 } },
  dark:  { sea: '#1B2129', land: '#2A2E33', coast: '#4C5A67', river: '#3D5468', glacier: '#3A3F45', label: '#E6E8EB', label2: '#9AA3AE', halo: '#1B2129',
    depth: ['#1B2129', '#192028', '#171E26', '#151C24', '#131A22', '#111820', '#0F161E'], relief: { brightnessMax: 0.38, contrast: 0.32, saturation: 0, opacity: 1 } },
  // 고지도: 양피지 육지·먹색 선·옅은 청록 바다(토탈워 고지도 참조). 라벨은 같은 글리프(세리프 글리프는 P1)
  oldmap: { sea: '#CFDCD3', land: '#E9DFC7', coast: '#6B5A3E', river: '#7F9A93', glacier: '#F2EEE3', label: '#3A2F22', label2: '#7A6A4F', halo: '#EFE6D0',
    depth: ['#CFDCD3', '#C6D4CB', '#BCCBC2', '#B2C2B9', '#A8B9B0', '#9EB0A7', '#94A79E'], relief: { brightnessMax: 0.95, contrast: 0.12, saturation: -0.3, opacity: 0.9 } },
  // 신문톤: 무채색 — 룬델 정적 관계지도와 같은 문법
  press:  { sea: '#E8E8E8', land: '#F7F7F7', coast: '#5A5A5A', river: '#B0B0B0', glacier: '#FFFFFF', label: '#111111', label2: '#666666', halo: '#FFFFFF',
    depth: ['#E8E8E8', '#E2E2E2', '#DCDCDC', '#D6D6D6', '#D0D0D0', '#CACACA', '#C4C4C4'], relief: { brightnessMax: 1, contrast: 0.1, saturation: -1, opacity: 0.9 } },
  // 작전지도: 카키 육지·짙은 음영(지형 과장)·먹선 — 군사사 도해(원정로·전투) 내보내기용. 세리프 글리프는 River 맥(font-maker)에서
  campaign: { sea: '#C7D2CB', land: '#E2DFCF', coast: '#4A4538', river: '#7E9A96', glacier: '#F0EFE8', label: '#2B2721', label2: '#6B6353', halo: '#EDEADF',
    depth: ['#C7D2CB', '#BFCAC3', '#B7C2BB', '#AFBAB3', '#A7B2AB', '#9FAAA3', '#97A29B'], relief: { brightnessMax: 0.9, contrast: 0.25, saturation: -0.4, opacity: 1 } },
  // 위성(OVERHAUL-III §1, R52·R19): NASA Blue Marble 2004-07 topo+bathy(PD)를 relief.jpg처럼 한 장으로 깐다(scripts/bake-satellite.py).
  // 육지 채움·relief·수심 벡터·고도색은 이미지가 대신하므로 buildStyle·engine이 `isImagery`로 뺀다. sea·depth·relief 값은 타입을 고르게 하려고 있을 뿐 그려지지 않는다.
  // 글자는 흰 글자 + 먹색 후광. 좌상단 연도는 CSS가 반투명 먹색 판을 준다(이미지 위 맨글씨는 명암비를 못 지킨다, BACKLOG §E와 같은 병).
  satellite: { sea: '#0B1B2B', land: '#2E3A2C', coast: '#DCE6EC', river: '#8FBFE0', glacier: '#2A3640', label: '#FFFFFF', label2: '#D5DEE5', halo: '#0B1620',
    depth: ['#0B1B2B', '#0B1B2B', '#0B1B2B', '#0B1B2B', '#0B1B2B', '#0B1B2B', '#0B1B2B'], relief: { brightnessMax: 1, contrast: 0, saturation: 0, opacity: 0 } },
} as const;
export type Skin = keyof typeof MAP;
/** 이미지가 베이스맵인 스킨. 육지·relief·수심 벡터·고도색을 그리지 않고 `imagery` 래스터 + `satellite-sea.png` 마스크를 쓴다. */
export const isImagery = (s: Skin) => s === 'satellite';

/** 고도색 램프(DESIGN 토큰 `--ramp-elev`, hypsometric 7단: 저지 녹회 → 고지 갈회 → 설선 흰). 모든 스킨에서 hillshade 밑에 불투명도 0.15로 깔린다(OVERHAUL §3.6b ①).
 *  [고도 m, 색]. 바다는 DEM에서 0으로 눌려 있어 0 m 색이 바다에도 깔리지만 그 위를 ocean-mask가 덮는다. */
export const ELEV_RAMP: [number, string][] = [[0, '#A9B79C'], [200, '#B8BFA0'], [500, '#C6BE9C'], [1000, '#C9B48E'], [1500, '#B9A088'], [2500, '#C9C1B8'], [3500, '#F4F3EE']];
export const SKINS: { id: Skin; label: string }[] = [{ id: 'light', label: '중립' }, { id: 'dark', label: '야간' }, { id: 'oldmap', label: '고지도' }, { id: 'press', label: '신문톤' }, { id: 'campaign', label: '작전' }, { id: 'satellite', label: '위성' }];

/** 지도 위에 **판 없이 맨글씨로** 얹는 크롬(좌상단 연도·제목·각주·「그 해」)이 쓸 색.
 *  증상: River가 「좌 상단에 년도나 하는 메타데이터들이 너무 잘 안 보여」 — 실측 1.20:1.
 *  원인: 크롬 색은 OS 테마(`prefers-color-scheme`)를 따라가는데 지도 스킨은 그와 무관하다.
 *    맥이 다크라 글자가 흰색이 됐고, 작전 스킨 양피지(#E2DFCF)·바다(#C7D2CB) 위에 얹혔다.
 *    라벨 테두리가 앓던 것과 **같은 병**이다(engine.ts halo, 4b789ca).
 *  그래서: 같은 약으로 — 글자는 스킨의 `label`, 테두리는 `halo`. 바탕을 따라가면 OS 테마가
 *    무엇이든 맞는다. 판을 주지 않는 이유는 44px 연도의 판이 지도를 그만큼 가리기 때문이고
 *    (지도가 주인공이다), 테두리를 같이 주는 이유는 바탕이 단색이 아니기 때문이다 —
 *    음영·수심·영토 채우기 위에도 얹힌다.
 *  `label2`(부제용 흐린 색)는 쓰지 않는다: 12px 글자로 쓰면 작전 스킨 바다 위에서 3.8:1로
 *    AA에 못 미친다. 위계는 크기·굵기로 낸다(투명도는 금지 — shell.css .shell-tool .sub 주석). */
export const chromeTone = (skin: Skin): Record<'--map-ink' | '--map-halo', string> =>
  ({ '--map-ink': MAP[skin].label, '--map-halo': MAP[skin].halo });
export const DEPTHS = [0, 200, 1000, 2000, 3000, 4000, 5000];
const FONT = { regular: ['KlokanTech Noto Sans CJK Regular'], bold: ['KlokanTech Noto Sans CJK Bold'] }; // ponytail: Pretendard 글리프로 교체 예정(fetch-external 참고)

export interface BasemapManifest { basemap?: string[]; relief?: boolean; bbox?: [number, number, number, number] }

export function buildStyle(m: BasemapManifest, root: string, ds: string, opt: { dark?: boolean; skin?: Skin } = {}): StyleSpecification {
  const c = MAP[opt.skin ?? (opt.dark ? 'dark' : 'light')];
  const base = `${root}datasets/${ds}`;
  const has = (l: string) => (m.basemap ?? []).includes(l);
  const sources: StyleSpecification['sources'] = {};
  const layers: LayerSpecification[] = [{ id: 'sea', type: 'background', paint: { 'background-color': c.sea } }];
  const geo = (id: string) => { sources[id] = { type: 'geojson', data: `${base}/layers/${id}.geojson`, generateId: true }; };

  const imagery = isImagery(opt.skin ?? 'light') && !!m.bbox;
  // 위성 스킨: 이미지 한 장이 육지·바다·수심·고도색을 다 낸다. land·relief·bathy는 안 깐다(engine의 ocean-mask도 래스터로 갈린다).
  if (imagery) {
    const [w, s, e, n] = m.bbox!;
    sources.imagery = { type: 'image', url: `${base}/rasters/satellite.jpg`, coordinates: [[w, n], [e, n], [e, s], [w, s]] };
    layers.push({ id: 'imagery', type: 'raster', source: 'imagery', paint: { 'raster-fade-duration': 0 } });
  }
  if (has('land') && !imagery) { geo('land'); layers.push({ id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': c.land } }); }
  if (m.relief && m.bbox && !imagery) {
    const [w, s, e, n] = m.bbox;
    sources.relief = { type: 'image', url: `${base}/rasters/relief.jpg`, coordinates: [[w, n], [e, n], [e, s], [w, s]] };
    // 밝은 톤은 착색된 원본 그대로, 다크는 어둡게. hillshade 실계산은 Mapterhorn DEM 붙을 때.
    layers.push({ id: 'relief', type: 'raster', source: 'relief', paint: { 'raster-brightness-max': c.relief.brightnessMax, 'raster-contrast': c.relief.contrast, 'raster-saturation': c.relief.saturation, 'raster-opacity': c.relief.opacity, 'raster-fade-duration': 0 } });
  }
  if (has('bathy') && !imagery) {
    geo('bathy');
    const ramp: any[] = ['step', ['get', 'depth'], c.depth[0]];
    DEPTHS.slice(1).forEach((d, i) => ramp.push(d, c.depth[i + 1]));
    layers.push({ id: 'bathy', type: 'fill', source: 'bathy', paint: { 'fill-color': ramp as any, 'fill-antialias': false } });
  }
  if (has('lakes')) { geo('lakes'); layers.push({ id: 'lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': c.sea } }); }
  if (has('glaciers') && !imagery) { geo('glaciers'); layers.push({ id: 'glaciers', type: 'fill', source: 'glaciers', paint: { 'fill-color': c.glacier, 'fill-opacity': 0.8 } }); }
  if (has('rivers')) {
    geo('rivers');
    // 강은 지형을 읽는 단서다(River 9/9 피드백) — 등급별로 굵기를 벌리고 z5부터 지류도.
    const width = (mul: number): any => ['interpolate', ['linear'], ['zoom'], 3, 0.6 * mul, 6, 1.4 * mul, 9, 3.2 * mul];
    layers.push({ id: 'rivers-major', type: 'line', source: 'rivers', minzoom: 3, filter: ['<=', ['get', 'scalerank'], 6], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.river, 'line-width': width(1), 'line-opacity': 0.95 } });
    layers.push({ id: 'rivers-minor', type: 'line', source: 'rivers', minzoom: 5, filter: ['>', ['get', 'scalerank'], 6], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.river, 'line-width': width(0.6), 'line-opacity': 0.75 } });
  }
  if (has('coast')) { geo('coast'); layers.push({ id: 'coast', type: 'line', source: 'coast', paint: { 'line-color': c.coast, 'line-width': 1 } }); }

  // 지형지물 객체(1.7, P5): 지역·바다 폴리곤 자체가 클릭 대상. 평소 투명, hover 시 옅게.
  for (const src of ['region_labels', 'marine_labels'] as const) if (has(src)) {
    if (!sources[src]) geo(src);
    layers.push({ id: `landmark-${src}`, type: 'fill', source: src, paint: { 'fill-color': c.label2, 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.12, ['boolean', ['feature-state', 'selected'], false], 0.18, 0] as any } });
  }

  // 라벨 — 충돌 회피 P9(기본값 allow-overlap false). 바다·지역명은 대문자 라틴 자간 0.2em(Esri 관습).
  const sym = (id: string, source: string, layout: any, paint: any, extra: Partial<LayerSpecification> = {}): LayerSpecification =>
    ({ id, type: 'symbol', source, layout: { 'text-allow-overlap': false, 'text-padding': 4, ...layout }, paint, ...extra } as LayerSpecification);
  // 바다 이름표 레이어는 없다. marine_labels.geojson은 이름 없는 GeometryCollection(바다 마스크)이라
  // properties가 들어갈 자리 자체가 없다 — text-field가 읽을 name도, filter가 읽을 scalerank도 없어
  // 필터가 매 로드마다 null 경고를 내고 항상 false로 떨어졌다(글자를 한 번도 그린 적이 없다).
  // 바다 이름은 정본 place(kind:sea) 11종이 settlements를 타고 label-settle-*로 이미 나온다.
  // 이 소스는 바다를 클릭 대상으로 만드는 landmark-marine_labels 채우기에만 쓴다(P5).
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
  // 지형지물(1.7, Pleiades CC BY): 점 + 작은 라벨, lod 1/2/3 = z5/6/8. 무채색(P2) — 정착지 라벨보다 낮은 우선순위. 클릭 객체(P5).
  if (has('landmarks')) {
    geo('landmarks');
    layers.push(sym('landmark-pleiades', 'landmarks',
      { 'text-field': ['case', ['has', 'elev'], ['concat', '▲ ', ['get', 'name'], '  ', ['get', 'elev'], 'm'], ['get', 'name']], 'text-font': FONT.regular, 'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 9, 11], 'text-max-width': 8, 'symbol-sort-key': ['case', ['has', 'elev'], -1, ['+', ['get', 'lod'], 10]] },
      { 'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], c.label, c.label2], 'text-halo-color': c.halo, 'text-halo-width': 1, 'text-opacity': ['case', ['==', ['get', 'precision'], 'rough'], 0.6, 0.9] },
      { minzoom: 5, filter: ['<=', ['get', 'lod'], ['step', ['zoom'], 1, 7, 2, 9, 3]] as any }));
  }
  // 정착지 라벨: 데이터셋 settlements(어댑터 산출) — rank LOD z3/5/7. 마커는 main이 같은 소스로 그린다.
  sources.settlements = { type: 'geojson', data: `${base}/layers/settlements.geojson`, promoteId: 'id' }; // 엔진의 hover·selected·linked feature-state가 이 id를 쓴다
  // 발표 시점이 지중해 전역(z4.2)에 고정돼 있다. rank2 minzoom이 5면 그 화면에서
  // 그리스·시리아·카르타고·안티오키아가 통째로 안 뜬다 — 「국가·지명·도시가 나와야 한다」.
  // LOD 5단(OVERHAUL-III III-3, R34): rank는 adapt.ts가 포인트 수·차수·종류로 매긴다. 층마다 minzoom 3 · 4.5 · 6 · 7.5 · 9.
  for (const [rank, minzoom, size, font] of [[1, 3, 13, FONT.bold], [2, 4.5, 12, FONT.regular], [3, 6, 11, FONT.regular], [4, 7.5, 11, FONT.regular], [5, 9, 10.5, FONT.regular]] as const) {
    layers.push(sym(`label-settle-${rank}`, 'settlements',
      { 'text-field': ['get', 'name_ko'], 'text-font': [...font], 'text-size': size, 'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
        'text-radial-offset': 0.7, 'text-justify': 'auto' },
      { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 2.2 },   // 가독성: 후광 1.4 → 2.2
      // `kind: region`(다키아·트라키아…)은 engine의 region-name 층이 가져갔다. 여기 남기면
      // 같은 점을 두 층이 찍고, 시대가 안 맞는 이름(독일·소아시아·팔레스티나)까지 새어 나온다. 바다는 아래 label-sea가 다른 문법으로 쓴다.
      { minzoom, filter: ['all', ['==', ['get', 'rank'], rank], ['!', ['in', ['coalesce', ['get', 'kind'], 'city'], ['literal', ['region', 'sea']]]]] as any }));
  }
  // 바다 이름: 역사 지도책 문법대로 자간을 벌린 흐린 글자(도시와 다른 층위). rank 1(흑해·지중해·아드리아해)은 z3부터, 나머지는 z5부터.
  layers.push(sym('label-sea', 'settlements',
    { 'text-field': ['get', 'name_ko'], 'text-font': FONT.regular, 'text-letter-spacing': 0.25, 'text-max-width': 6,
      'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 7, 14] },
    { 'text-color': c.label2, 'text-halo-color': c.halo, 'text-halo-width': 1.6, 'text-opacity': 0.9 },
    { minzoom: 3, filter: ['all', ['==', ['get', 'kind'], 'sea'], ['<=', ['get', 'rank'], ['step', ['zoom'], 1, 5, 3]]] as any }));
  return { version: 8, glyphs: `${root}glyphs/{fontstack}/{range}.pbf`, sources, layers };
}
