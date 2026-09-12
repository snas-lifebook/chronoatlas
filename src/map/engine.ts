// 지도 엔진 (TASKS 1.3·1.8): MapLibre + 데이터 레이어 + 토큰. store만 구독한다 — React 크롬과는 store로만 이야기한다.
import * as maplibregl from 'maplibre-gl';
import { type Dataset, dateWindow, positionByRoute, routeGeometry } from '../schema';
import { buildStyle, type Skin } from './style';
import { roundCam, type Store, type Scene, type State } from '../state';
import type { Neighbor } from '../graph/data';
import { ARM_KO, FALLBACK_COLOR, phaseOf, unitsGeoJSON, type BoardData } from '../board';

const MAP_MAX_ZOOM = 9;
const BOARD_MAX_ZOOM = 12; // 칸나이 전장 ~5km. z9면 유닛이 한 점에 겹친다.
const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

function armIcon(arm: string, color: string): ImageData {
  const size = 64, c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.translate(size / 2, size / 2);
  g.fillStyle = color;
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.beginPath();
  if (arm === 'cavalry') { g.moveTo(0, -18); g.lineTo(14, 0); g.lineTo(0, 18); g.lineTo(-14, 0); }
  else if (arm === 'light') g.arc(0, 0, 11, 0, Math.PI * 2);
  else if (arm === 'elephant') g.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
  else if (arm === 'command') { g.moveTo(0, -18); g.lineTo(16, 14); g.lineTo(-16, 14); }
  else g.rect(-12, -14, 24, 28);
  g.closePath(); g.fill(); g.stroke();
  return g.getImageData(0, 0, size, size);
}

// 레이어 카탈로그 id → MapLibre 레이어 id들. 켜고 끄는 단위(DESIGN P6). 'labels'는 지명 토글.
export const LAYER_GROUPS: Record<string, string[]> = {
  territory: ['territory-fill', 'territory-outline', 'territory-label'],
  admin_regions: ['admin-line'],
  settlements: ['settle-major', 'settle-minor', 'label-settle-1', 'label-settle-2', 'label-settle-3'],
  battles: ['battle'],
  movements: ['movement'],
  relief: ['relief', 'hillshade'], // DEM이 있으면 hillshade가 relief.jpg를 대체한다(addTerrain에서 relief 제거)
  bathy: ['bathy'],
  rivers: ['rivers-major', 'rivers-minor'],
  labels: ['label-region', 'label-settle-1', 'label-settle-2', 'label-settle-3'],
  landmarks: ['landmark-region_labels', 'landmark-marine_labels', 'landmark-pleiades'],
  graph: ['ego-edge'], // 지도엔 선만 그린다(D4 하이브리드). 노드·이름표는 이미 settle-*·battle·label-settle-*가 그린 위에 겹칠 뿐이다
  board: ['board-unit', 'board-label'],
  people: ['people-dot', 'people-label'],
};
// 의미군 선색(DESIGN: 유채색은 데이터 색뿐 — 관계 의미도 데이터다)
export const GROUP_COLOR: Record<string, string> = { hostile: '#B4433E', ally: '#2F7D5B', rule: '#5B4B8A', lineage: '#8A6D3B', member: '#3E6F8C', act: '#6B6F76', locate: '#8A8F98', make: '#6B6F76', other: '#8A8F98' };

export function createEngine(container: HTMLElement, d: Dataset, store: Store, root: string, ds: string, dark = false, boards: BoardData[] = []) {
  const s0 = store.get();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; // DESIGN §4: 즉시 전환
  const dur = (ms: number) => (reduced ? 0 : ms);
  let isDark = dark;
  // 부팅 스킨은 스타일에 바로 넣는다. 나중에 setSkin으로 갈아끼우면 setStyle이 소스·레이어를 통째로
  // 다시 얹으므로(아래 setSkin 참고) 북마크로 들어온 스킨 때문에 스타일을 두 번 빌드하게 된다.
  const themeSkin: Skin = dark ? 'dark' : 'light';
  const style = buildStyle(d.manifest, root, ds, s0.skin && s0.skin !== themeSkin ? { skin: s0.skin } : { dark });
  // 카메라는 상태에서 온다. main.tsx가 URL·장면을 이미 상태에 접어 넣은 뒤 엔진을 만든다.
  const bb = d.manifest.bbox;
  const map = new maplibregl.Map({ container, style, center: s0.center ?? d.manifest.center, zoom: s0.zoom ?? d.manifest.zoom, minZoom: 3, maxZoom: s0.board ? BOARD_MAX_ZOOM : MAP_MAX_ZOOM,
    pitch: s0.view === '2d' ? 0 : (s0.pitch ?? 50), bearing: s0.view === '2d' ? 0 : (s0.bearing ?? 0),
    maxBounds: bb ? [[bb[0], bb[1]], [bb[2], bb[3]]] : undefined, // 베이스맵 밖이 안 보이게 — P13
    attributionControl: false, canvasContextAttributes: { preserveDrawingBuffer: true } }); // 내보내기(3.1)가 캔버스를 읽는다
  // MapLibre는 ResizeObserver 첫 콜백을 버린다 — 컨테이너가 0×0에서 시작하면(숨긴 패널·iframe) 400×300에 갇힌다. 우리가 직접 본다.
  new ResizeObserver(() => map.resize()).observe(container);

  // 카메라 → 상태 (R35·F8). URL이 지금 화면을 담아야 '링크 복사'와 북마크가 쓸모 있다.
  // move가 아니라 moveend라 팬·줌 한 동작에 한 번만 돈다. 값은 roundCam으로 깎아 넣는다 —
  // 안 그러면 부동소수 잡음마다 store가 바뀌어 앱 전체(useSyncExternalStore)가 다시 그려진다.
  let pitch3d = s0.pitch ?? 50, bearing3d = s0.bearing ?? 0; // 평면으로 눕혔다 다시 세울 때 돌아갈 각도
  let echo = false; // 지금 들어온 상태 변경이 지도 자신이 낸 것인가(되먹임 차단)
  map.on('moveend', () => {
    if (store.get().view === '3d') { pitch3d = map.getPitch(); bearing3d = map.getBearing(); }
    echo = true;
    store.set(roundCam(map.getCenter(), map.getZoom(), map.getPitch(), map.getBearing()));
    echo = false;
  });

  const fillColor: any = ['match', ['get', 'actor']]; for (const a of d.actors) fillColor.push(a.id, a.color); fillColor.push('#8A8F98');
  const victorColor: any = ['match', ['get', 'victor']]; for (const a of d.actors) victorColor.push(a.id, a.color); victorColor.push('#333');
  const timed: [string, any[] | null][] = [['territory-fill', null], ['territory-outline', null], ['territory-label', ['all', ['==', ['geometry-type'], 'Point'], ['>', ['get', 'area'], ['case', ['==', ['get', 'actor'], '기타중립'], ['step', ['zoom'], 900000, 5, 300000, 7, 80000], ['step', ['zoom'], 250000, 5, 90000, 7, 20000]]]] as any], ['admin-line', null],
    ['settle-major', ['<=', ['get', 'rank'], 1]], ['settle-minor', ['>=', ['get', 'rank'], 2]], ['battle', null], ['movement', null]];
  const filterFor = (base: any[] | null, y: number): any => base ? ['all', base, ...dateWindow(y).slice(1)] : dateWindow(y);

  let loaded = false;
  let tokens: { route: string; token: import('../token3d').Token }[] = [];
  let peopleFc: { type: 'FeatureCollection'; features: object[] } = EMPTY_FC;

  // 기하 3D 지형(River 9/9 "3D인데 굴곡이 없다"): DEM 타일이 있으면 켠다.
  // 타일은 용량·라이선스 때문에 레포에 없다(.gitignore) — public/datasets/<ds>/terrain/meta.json이 있으면 그걸 보고 런타임에 켠다.
  // manifest에 박지 않는 이유: manifest는 커밋되는데 타일은 아니라서, 없는 타일을 요청하게 된다.
  let terrainMeta: { encoding?: 'terrarium' | 'mapbox'; minzoom?: number; maxzoom?: number; exaggeration?: number } | null = null;
  const terrainReady = fetch(`${root}datasets/${ds}/terrain/meta.json`).then(r => r.ok ? r.json() : null).then(m => { terrainMeta = m; }).catch(() => {});
  // 고도 과장은 줌에 따라 — 낮은 줌에서 1.4배는 화면상 1~2px라 "3D인데 굴곡이 없다"가 된다.
  // 산이 화면에서 비슷한 높이로 보이도록 줌이 낮을수록 크게(z3 12배 → z9 1.4배). setTerrain은 표현식을 못 받아서 zoom 이벤트로 갱신.
  let lastEx = 0;
  const syncTerrain = () => {
    if (!terrainMeta || !map.getSource('dem')) return;
    const base = terrainMeta.exaggeration ?? 1.4;
    const ex = Math.round(base * Math.min(11, Math.max(1, 2 ** ((9 - map.getZoom()) * 0.62))) * 10) / 10;
    if (ex === lastEx && map.getTerrain()) return;
    lastEx = ex; map.setTerrain({ source: 'dem', exaggeration: ex });
  };
  map.on('zoom', syncTerrain); // 스킨 전환(setStyle)마다 addTerrain이 다시 불려서, 리스너는 여기 한 번만 건다

  function addTerrain(before?: string) {
    const t = terrainMeta; if (!t) return;
    if (!map.getSource('dem')) map.addSource('dem', { type: 'raster-dem', tiles: [`${root}datasets/${ds}/terrain/{z}/{x}/{y}.png`], encoding: t.encoding ?? 'terrarium', tileSize: 256, minzoom: t.minzoom ?? 0, maxzoom: t.maxzoom ?? 12 });
    if (!map.getLayer('hillshade')) map.addLayer({ id: 'hillshade', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': isDark ? '#0B0F14' : '#5C6157', 'hillshade-highlight-color': isDark ? '#3A424C' : '#FFFFFF' } }, before);
    // 베이크된 relief.jpg(NE Gray Earth 1.85km/px)와 겹치면 그림자가 두 벌이라 능선이 뭉갠다 — DEM 음영이 해상도·광원 모두 낫다.
    if (map.getLayer('relief')) map.removeLayer('relief');
    syncTerrain();
  }

  function addData() {
    if (map.getSource('territory')) return; // setStyle 직후 load/style.load가 겹쳐 두 번 불릴 수 있다
    const before = map.getLayer('label-marine') ? 'label-marine' : undefined; // 데이터 레이어는 라벨 아래
    terrainReady.then(() => { if (map.getStyle()) addTerrain(map.getLayer('label-marine') ? 'label-marine' : undefined); });
    map.addSource('territory', { type: 'geojson', data: d.territory as any, promoteId: 'id' });
    map.addLayer({ id: 'territory-fill', type: 'fill', source: 'territory', paint: { 'fill-color': fillColor, 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.45, ['==', ['get', 'actor'], '기타중립'], 0.1, 0.22] as any } }, before);
    map.addLayer({ id: 'territory-outline', type: 'line', source: 'territory', paint: { 'line-color': fillColor, 'line-width': 1.6, 'line-opacity': 0.95 } }, before);
    // 영토 이름(F16): 면적 큰 것부터. 회색(팔레트 밖)은 더 크게 커야 뜬다 — 지도가 이름표로 덮이지 않게.
    map.addLayer({ id: 'territory-label', type: 'symbol', source: 'territory',
      layout: { 'text-field': ['get', 'name'], 'text-font': ['KlokanTech Noto Sans CJK Bold'], 'text-max-width': 7, 'text-padding': 6, 'text-allow-overlap': false,
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, ['case', ['>', ['get', 'area'], 2000000], 13, 11], 7, ['case', ['>', ['get', 'area'], 2000000], 18, 14]],
        'symbol-sort-key': ['-', 0, ['get', 'area']] } as any,
      paint: { 'text-color': fillColor, 'text-halo-color': isDark ? '#1B2129' : '#FFFFFF', 'text-halo-width': 1.6, 'text-opacity': 0.95 },
      filter: ['>', ['get', 'area'], ['case', ['==', ['get', 'actor'], '기타중립'], ['step', ['zoom'], 900000, 5, 300000, 7, 80000], ['step', ['zoom'], 250000, 5, 90000, 7, 20000]]] as any }, before);
    map.addSource('admin_regions', { type: 'geojson', data: d.admin_regions as any });
    map.addLayer({ id: 'admin-line', type: 'line', source: 'admin_regions', paint: { 'line-color': '#4b3f8c', 'line-width': 1.5, 'line-dasharray': [3, 2], 'line-opacity': ['case', ['==', ['get', 'confidence'], 'low'], 0.45, 0.9] as any } }, before);
    if (!map.getSource('settlements')) map.addSource('settlements', { type: 'geojson', data: d.settlements as any, promoteId: 'id' });
    // hover: +반지름·외곽 1.5px / selected: 외곽 2px(세력색 대신 잉크 — 정착지는 세력 없음) — DESIGN §2, GPU만
    const hov = (base: number, plus: number) => ['case', ['boolean', ['feature-state', 'selected'], false], base + plus, ['boolean', ['feature-state', 'hover'], false], base + plus * 0.6, ['boolean', ['feature-state', 'linked'], false], base + plus * 0.6, base];
    const circle = (id: string, minzoom: number, radius: number) =>
      map.addLayer({ id, type: 'circle', source: 'settlements', minzoom, paint: { 'circle-radius': hov(radius, 2) as any, 'circle-color': '#b8860b',
        'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#111418', '#3a2f22'] as any, 'circle-stroke-width': hov(1.2, 1) as any, 'circle-opacity': 1 } }, before);
    circle('settle-major', 3, 5); circle('settle-minor', 5, 3.5);
    map.addSource('battles', { type: 'geojson', data: d.battles as any, promoteId: 'id' });
    map.addLayer({ id: 'battle', type: 'circle', source: 'battles', paint: { 'circle-radius': hov(7, 2) as any, 'circle-color': victorColor, 'circle-stroke-color': '#fff', 'circle-stroke-width': hov(2, 1) as any, 'circle-opacity': 1 } }, before);
    // 말판(R37). 페이즈마다 통째로 setData. 보간하지 않는다. 아이콘 색은 팔레트(데이터 색, P2).
    const actorIds = d.actors.map(a => a.id);
    for (const a of [...d.actors, { id: '_', color: FALLBACK_COLOR }]) {
      for (const arm of Object.keys(ARM_KO)) {
        const iid = `board-${arm}-${a.id}`;
        if (!map.hasImage(iid)) map.addImage(iid, armIcon(arm, a.color), { pixelRatio: 2 });
      }
    }
    if (!map.getSource('board')) map.addSource('board', { type: 'geojson', data: EMPTY_FC as any, promoteId: 'id' });
    const boardIcon: any = ['concat', 'board-', ['get', 'arm'], '-', ['case', ['in', ['get', 'actor'], ['literal', actorIds]], ['get', 'actor'], '_']];
    map.addLayer({ id: 'board-unit', type: 'symbol', source: 'board',
      layout: { 'icon-image': boardIcon, 'icon-size': ['match', ['get', 'arm'], 'command', 1, 'elephant', 1.1, 'light', 0.7, 0.9] as any,
        'icon-rotate': ['get', 'facing'], 'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'viewport',
        'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, ['boolean', ['feature-state', 'hover'], false], 1, 0.92] as any } }, before);
    if (!map.getSource('people')) map.addSource('people', { type: 'geojson', data: peopleFc as any, promoteId: 'id' });
    else (map.getSource('people') as maplibregl.GeoJSONSource).setData(peopleFc as any);
    map.addLayer({ id: 'people-dot', type: 'circle', source: 'people',
      paint: { 'circle-radius': ['case', ['boolean', ['feature-state', 'selected'], false], 8, ['boolean', ['feature-state', 'hover'], false], 7, 6] as any,
        'circle-color': ['get', 'color'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.6, 'circle-opacity': 1 } }, before);
    map.addLayer({ id: 'people-label', type: 'symbol', source: 'people', minzoom: 4,
      layout: { 'text-field': ['get', 'name'], 'text-font': ['KlokanTech Noto Sans CJK Bold'], 'text-size': 12,
        'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true, 'text-allow-overlap': false },
      paint: { 'text-color': ['get', 'color'], 'text-halo-color': isDark ? '#1B2129' : '#FFFFFF', 'text-halo-width': 1.4 } }, before);

    map.addLayer({ id: 'board-label', type: 'symbol', source: 'board', minzoom: 10,
      layout: { 'text-field': ['get', 'label'], 'text-font': ['KlokanTech Noto Sans CJK Regular'], 'text-size': 11,
        'text-offset': [0, 1.35], 'text-anchor': 'top', 'text-max-width': 8, 'text-allow-overlap': false, 'text-optional': true },
      paint: { 'text-color': ['get', 'color'], 'text-halo-color': isDark ? '#1B2129' : '#FFFFFF', 'text-halo-width': 1.4 } }, before);
    map.addSource('movements', { type: 'geojson', data: d.movements as any });
    map.addLayer({ id: 'movement', type: 'line', source: 'movements', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': fillColor, 'line-width': 2.5, 'line-dasharray': [2, 1.2], 'line-opacity': 0.9 } }, before);

    // 관계 그래프 오버레이(2.1, 하이브리드): 선택 객체 ↔ 좌표 있는 이웃 선. 좌표 없는 이웃은 GraphPanel.
    map.addSource('ego', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id' });
    map.addLayer({ id: 'ego-edge', type: 'line', source: 'ego', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 1.6, 'line-opacity': 0.85, 'line-dasharray': ['case', ['==', ['get', 'confidence'], 'low'], ['literal', [2, 2]], ['literal', [1, 0]]] } as any });
    // ego-node·ego-label은 없다. setEgo가 만드는 건 LineString뿐인데 두 레이어는 Point로 필터해서
    // 한 번도 그려진 적이 없었다(클릭·hover 핸들러까지 죽은 대상에 걸려 있었다).
    // 선의 끝점은 이미 settle-*·battle 원이고 이름표는 label-settle-*이라 애초에 겹쳐 그릴 것이 없다.
    if (ego) setEgo(ego.sel, ego.name, ego.neighbors);

    // Three.js 토큰은 이동 경로가 있을 때만 동적 import(DESIGN §4 JS 예산). 실패해도 베이스 지도는 유지.
    const routeIds = [...new Set(d.movements.features.map(f => f.properties.route))];
    if (routeIds.length) import('../token3d').then(({ createToken }) => {
      tokens = routeIds.map(routeId => {
        const actorId = d.movements.features.find(f => f.properties.route === routeId)?.properties.actor;
        const token = createToken(d.actors.find(a => a.id === actorId)?.color ?? '#666');
        token.setRoute(routeGeometry(d.movements.features, routeId).path);
        map.addLayer(token.layer);
        return { route: routeId, token };
      });
      for (const { route, token } of tokens) token.setPosition(positionByRoute(d.movements.features, route, store.get().year));
    }).catch(() => { tokens = []; });
    loaded = true; lastYear = null; lastLayers = ''; lastSel = undefined; lastBoard = undefined; lastPhase = undefined; selectedFs = [];
    apply(store.get());
  }
  map.on('load', addData);
  // 클릭 → 선택(store). 패널은 React가 store를 보고 그린다.
  for (const layerId of ['territory-fill', 'admin-line', 'settle-major', 'settle-minor', 'battle', 'movement', 'board-unit', 'people-dot', 'landmark-region_labels', 'landmark-marine_labels', 'landmark-pleiades']) {
    map.on('click', layerId, e => {
      const f = e.features?.[0]; if (!f) return;
      if (layerId.startsWith('landmark-')) { // 점 객체가 위에 있으면 그쪽이 이긴다
        if (map.queryRenderedFeatures(e.point, { layers: ['settle-major', 'settle-minor', 'battle', 'board-unit', 'people-dot'].filter(l => map.getLayer(l)) }).length) return;
        // 정본 place 아님 — NE·Pleiades 지형지물(제안 대상). Pleiades는 id, NE는 이름.
        // marine_labels(바다 마스크)는 properties가 통째로 비어 있다 — 'landmark:undefined'를 만들지 않는다.
        const key = f.properties.pid ?? f.properties.name;
        if (key != null) store.set({ sel: `landmark:${key}` });
        return; }
      if (layerId === 'territory-fill' && map.queryRenderedFeatures(e.point, { layers: ['settle-major', 'settle-minor', 'battle', 'board-unit', 'people-dot', 'landmark-pleiades'].filter(l => map.getLayer(l)) }).length) return;
      if (layerId === 'people-dot') {
        const sel = f.properties?.id;
        if (sel) store.set({ sel });
        return;
      }
      if (layerId === 'board-unit') {
        const sel = f.properties?.entity || f.properties?.event;
        if (sel) store.set({ sel });
        return;
      }
      // 한 사건이 두 곳에서 벌어지면 두 번째 점의 id는 '<사건>#2'다(adapt). 선택은 언제나 사건 id로 한다.
      const sel = f.properties?.entity ?? f.properties?.id;
      if (sel) store.set({ sel });
    });
    map.on('mouseenter', layerId, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', layerId, () => (map.getCanvas().style.cursor = ''));
  }
  map.on('click', e => { if (!map.queryRenderedFeatures(e.point, { layers: Object.values(LAYER_GROUPS).flat().filter(l => map.getLayer(l)) }).length) store.set({ sel: null }); });

  // hover feature-state + 툴팁(120ms 지연, 이름·연도 한 줄). 소스별 id는 promoteId 'id'.
  const SRC_OF: Record<string, string> = { 'territory-fill': 'territory', 'settle-major': 'settlements', 'settle-minor': 'settlements', battle: 'battles', 'board-unit': 'board', 'people-dot': 'people', 'landmark-region_labels': 'region_labels', 'landmark-marine_labels': 'marine_labels', 'landmark-pleiades': 'landmarks' };
  let hovered: { source: string; id: string | number } | null = null;
  const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'ca-tip', maxWidth: '240px' });
  let tipTimer: number | null = null;
  const setHover = (next: { source: string; id: string | number } | null) => {
    if (hovered && (hovered.source !== next?.source || hovered.id !== next?.id)) map.setFeatureState(hovered, { hover: false });
    if (next) map.setFeatureState(next, { hover: true });
    hovered = next;
  };
  for (const [layerId, source] of Object.entries(SRC_OF)) {
    map.on('mousemove', layerId, e => {
      const f = e.features?.[0]; if (!f || f.id == null) return;
      setHover({ source, id: f.id });
      if (tipTimer) clearTimeout(tipTimer);
      const p = f.properties, yr = p.year ?? p.valid_from;
      const label = p.label ?? p.name_ko ?? p.name ?? p.id;
      const sub = p.arm
        ? [ARM_KO[p.arm as keyof typeof ARM_KO], p.strength != null ? `${Number(p.strength).toLocaleString()}명` : '', p.teaching ? '교보재' : ''].filter(Boolean).join(' · ')
        : p.via
          ? [p.via === 'located_in' ? (p.placeName ?? '위치') : '경로'].filter(Boolean).join(' · ')
        : yr != null ? (yr < 0 ? `BC ${-yr}` : `AD ${yr}`) : p.kind_ko ?? p.featurecla ?? '';
      // marine_labels(바다 마스크)는 properties가 비어 있어 이름이 없다. 그대로 두면 툴팁에 'undefined'가 뜬다.
      if (label == null) { tip.remove(); return; }
      // setHTML이 아니라 DOM으로 넣는다: 이름은 Pleiades·Cliopatria·NE에서 온 남의 문자열이라
      // 문자열 보간으로 지도 팝업에 꽂으면 maplibre의 sanitize가 유일한 방어선이 된다(그 sanitize에 우회가 보고돼 있다).
      const body = document.createElement('div');
      const strong = document.createElement('b'); strong.textContent = String(label); body.append(strong);
      if (sub) body.append(document.createTextNode(` · ${sub}`));
      tipTimer = window.setTimeout(() => tip.setLngLat(e.lngLat).setDOMContent(body).addTo(map), 120);
    });
    // 겹친 레이어(지형지물 라벨 위의 도시 점) 중 하나를 떠나도 다른 하나가 아직 밑에 있으면 툴팁을 살린다
    map.on('mouseleave', layerId, e => {
      if (map.queryRenderedFeatures(e.point, { layers: Object.keys(SRC_OF).filter(l => l !== layerId && map.getLayer(l)) }).length) return;
      setHover(null); if (tipTimer) clearTimeout(tipTimer); tip.remove(); });
  }
  // selected feature-state + 나머지 40% 디밍(선택 있을 때만 페인트 교체)
  // 한 사건이 두 곳에서 벌어지면 점이 둘이고 id가 '#2'로 갈린다(adapt). 선택하면 둘 다 밝힌다 — 그래서 배열이다.
  let selectedFs: { source: string; id: string | number }[] = [];
  const dimExpr = (v: number) => ['case', ['boolean', ['feature-state', 'selected'], false], 1, v];
  function applySel(sel: string | null) {
    for (const fs of selectedFs) map.setFeatureState(fs, { selected: false });
    selectedFs = [];
    const source = sel?.startsWith('event:') ? 'battles' : sel?.startsWith('place:') ? 'settlements' : null;
    if (sel && source && map.getSource(source)) {
      const ids = source === 'battles'
        ? d.battles.features.filter(f => (f.properties.entity ?? f.properties.id) === sel).map(f => f.properties.id)
        : [sel];
      for (const id of ids.length ? ids : [sel]) { const fs = { source, id }; map.setFeatureState(fs, { selected: true }); selectedFs.push(fs); }
    }
    if (sel?.startsWith('landmark:')) {
      needLandmarks();
      const key = sel.slice('landmark:'.length);
      for (const src of ['landmarks', 'region_labels', 'marine_labels']) {
        if (!map.getSource(src)) continue;
        const f = map.querySourceFeatures(src).find(f => String(f.properties?.pid ?? f.properties?.name) === key);
        if (f && f.id != null) { const fs = { source: src, id: f.id as any }; map.setFeatureState(fs, { selected: true }); selectedFs.push(fs); break; }
      }
    }
    if (sel?.startsWith('person:') && map.getSource('people')) {
      const fs = { source: 'people', id: sel };
      map.setFeatureState(fs, { selected: true }); selectedFs.push(fs);
    }
    if (map.getSource('board')) {
      for (const f of map.querySourceFeatures('board')) {
        if (f.id == null) continue;
        if (sel && (f.properties?.entity === sel || f.properties?.event === sel)) {
          const fs = { source: 'board', id: f.id };
          map.setFeatureState(fs, { selected: true }); selectedFs.push(fs);
        }
      }
    }
    for (const id of ['settle-major', 'settle-minor', 'battle']) if (map.getLayer(id)) map.setPaintProperty(id, 'circle-opacity', (selectedFs.length ? dimExpr(0.6) : 1) as any);
  }



  // 영토 버킷 지연 로드(F16): manifest.territory = { bucket, from, to } 이면 layers/territory/<from>.geojson을 연도에 맞춰 받는다. d.territory를 갈아끼워 범례·내보내기가 같은 걸 본다.
  const tb = d.manifest.territory; const bucketCache = new Map<number, Promise<any>>(); let curBucket: number | null = null;
  function loadTerritory(year: number) {
    if (!tb) return;
    const b = Math.max(tb.from, Math.min(tb.to - tb.bucket, Math.floor((year - tb.from) / tb.bucket) * tb.bucket + tb.from));
    if (b === curBucket) return; curBucket = b;
    if (!bucketCache.has(b)) bucketCache.set(b, fetch(`${root}datasets/${ds}/layers/territory/${b}.geojson`).then(r => r.ok ? r.json() : { type: 'FeatureCollection', features: [] }));
    bucketCache.get(b)!.then(fc => { if (curBucket !== b) return; d.territory.features = fc.features; (map.getSource('territory') as maplibregl.GeoJSONSource | undefined)?.setData(fc); onData?.(); });
  }
  let onData: (() => void) | null = null;

  // 지형지물 상세(1.2MB)는 인스펙터에서만 쓴다. 지도는 style.ts가 같은 파일을 URL 소스로 따로 받아 그린다.
  // 첫 페인트에서 빼고 지형지물을 처음 고른 순간에만 받는다(대개 한 번도 안 받는다). 받아지면 onData로 패널을 다시 그린다.
  let lmLoading = false;
  function needLandmarks() {
    if (d.landmarks || lmLoading) return;
    lmLoading = true;
    fetch(`${root}datasets/${ds}/layers/landmarks.geojson`)
      .then(r => r.ok ? r.json() : null)
      .then(fc => { if (fc) { d.landmarks = fc; onData?.(); } })
      .catch(() => { lmLoading = false; });
  }

  let lastYear: number | null = null, lastLayers = '', lastView = '', lastSel: string | null | undefined = undefined;
  let lastBoard: string | null | undefined = undefined, lastPhase: number | undefined = undefined;
  // 지도를 이 카메라로 만들었으니 첫 apply에서 같은 자리로 다시 날아가지 않게 미리 채워 둔다
  let lastCam = `${s0.center?.join(',') ?? ''}|${s0.zoom ?? ''}|${s0.pitch ?? ''}|${s0.bearing ?? ''}`;
  function apply(s: State) {
    if (!loaded) return;
    if (s.year !== lastYear) {
      lastYear = s.year;
      loadTerritory(s.year);
      for (const [id, base] of timed) map.setFilter(id, filterFor(base, s.year));
      for (const { route, token } of tokens) token.setPosition(positionByRoute(d.movements.features, route, s.year));
    }
    const on = new Set(s.layers ?? allLayers(d));
    const key = [...on].join(',');
    if (key !== lastLayers || s.board !== lastBoard) {
      lastLayers = key;
      for (const [group, ids] of Object.entries(LAYER_GROUPS)) {
        const vis = group === 'board' ? !!s.board : group === 'labels' ? on.has('labels') : on.has(group);
        for (const id of ids) if (map.getLayer(id)) {
          // 정착지 라벨은 settlements와 labels 둘 다 켜져야 보인다
          const v = id.startsWith('label-settle') ? on.has('settlements') && on.has('labels') : vis;
          map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none');
        }
      }
    }
    if (s.board !== lastBoard || s.phase !== lastPhase) {
      lastBoard = s.board; lastPhase = s.phase;
      const b = boards.find(x => x.id === s.board);
      const src = map.getSource('board') as maplibregl.GeoJSONSource | undefined;
      map.setMaxZoom(b ? BOARD_MAX_ZOOM : MAP_MAX_ZOOM);
      if (!b) src?.setData(EMPTY_FC as any);
      else {
        const palette = Object.fromEntries(d.actors.map(a => [a.id, a.color]));
        src?.setData(unitsGeoJSON(phaseOf(b, s.phase), palette, { event: b.event }) as any);
        if (s.sel) applySel(s.sel);
      }
    }
    if (s.sel !== lastSel) { lastSel = s.sel; applySel(s.sel); }
    // 상태 → 카메라. 북마크·뒤로가기·장면으로 들어온 값만 지도를 움직인다.
    // 지도가 스스로 움직여 moveend로 되돌아온 값(echo)에는 반응하지 않는다.
    const camKey = `${s.center?.join(',') ?? ''}|${s.zoom ?? ''}|${s.pitch ?? ''}|${s.bearing ?? ''}`;
    if (camKey !== lastCam) {
      const wasEcho = echo; lastCam = camKey;
      if (!wasEcho && s.center) map.easeTo({ center: s.center, zoom: s.zoom ?? map.getZoom(),
        pitch: s.view === '2d' ? 0 : (s.pitch ?? map.getPitch()), bearing: s.view === '2d' ? 0 : (s.bearing ?? map.getBearing()), duration: dur(600) });
    }
    // 평면/입체 토글은 '눕히기 전 각도'로 돌아간다. 부팅 장면(cam)이 아니라 마지막으로 세워 뒀던 각도다.
    if (s.view !== lastView) { lastView = s.view; map.easeTo({ pitch: s.view === '2d' ? 0 : pitch3d, bearing: s.view === '2d' ? 0 : bearing3d, duration: dur(600) }); }
  }
  store.subscribe(apply);

  // ---- 관계 오버레이(하이브리드): 지도엔 좌표 있는 이웃(도시·사건)까지의 선만. 좌표 없는 인물·집단은 GraphPanel(force 레이아웃)이 맡는다.
  let ego: { sel: string; name: string; neighbors: Neighbor[] } | null = null;
  let linked: { source: string; id: string }[] = [];
  const coordOf = (id: string): [number, number] | null => {
    const f = (id.startsWith('event:') ? d.battles : d.settlements).features.find(f => f.properties.id === id);
    return f ? (f.geometry.coordinates as [number, number]) : null;
  };
  function setEgo(sel: string | null, name: string, neighbors: Neighbor[]) {
    ego = sel ? { sel, name, neighbors } : null;
    const src = map.getSource('ego') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    for (const l of linked) map.setFeatureState(l, { linked: false }); linked = [];
    const geoN = neighbors.filter(n => coordOf(n.node.id));
    // 선택에 좌표가 있고 이웃이 적을 때만 선. 인물·집단(좌표 없음)이나 로마처럼 이웃이 많으면 관련 지점 강조만 — 지도 위 '사방팔방'은 그리지 않는다
    const anchor = sel && geoN.length <= 12 ? coordOf(sel) : null; // ponytail: 임계 12는 눈대중. 거슬리면 GraphPanel hover 때만 선으로
    if (!anchor) for (const n of geoN) { const l = { source: n.node.id.startsWith('event:') ? 'battles' : 'settlements', id: n.node.id }; map.setFeatureState(l, { linked: true }); linked.push(l); }
    const feats: any[] = anchor ? geoN.map(n => ({ type: 'Feature', properties: { id: `edge:${n.node.id}`, color: GROUP_COLOR[n.group], confidence: n.link.confidence ?? 'medium', rel: n.rel }, geometry: { type: 'LineString', coordinates: [anchor, coordOf(n.node.id)!] } })) : [];
    src.setData({ type: 'FeatureCollection', features: feats });
  }

  return {
    map,
    setEgo,
    setPeople(fc: { type: 'FeatureCollection'; features: object[] }) {
      peopleFc = fc as typeof EMPTY_FC;
      (map.getSource('people') as maplibregl.GeoJSONSource | undefined)?.setData(fc as any);
    },
    onData(fn: () => void) { onData = fn; },
    flyTo(sc: Scene) { if (sc.center) map.flyTo({ center: sc.center, zoom: sc.zoom, pitch: store.get().view === '2d' ? 0 : sc.pitch, bearing: store.get().view === '2d' ? 0 : sc.bearing, duration: dur(1400), essential: true }); },
    // 패널 관계 행 hover → 지도 위 상대 객체 펄스(feature-state hover). id 없으면 해제.
    pulse(id: string | null) {
      const source = id?.startsWith('event:') ? 'battles' : id?.startsWith('place:') ? 'settlements' : null;
      setHover(id && source && map.getSource(source) ? { source, id } : null);
    },
    home() { if (bb) map.fitBounds([[bb[0] + 12, bb[1] + 8], [bb[2] - 20, bb[3] - 10]], { padding: 40, duration: dur(900) }); },
    zoom(delta: number) { map.easeTo({ zoom: map.getZoom() + delta, duration: dur(300) }); },
    // 테마 전환: 베이스맵 스타일 재빌드 → 데이터 레이어 다시 얹기(setStyle이 소스·레이어를 지운다)
    setDark(dk: boolean) { isDark = dk; loaded = false; map.once('style.load', addData); map.setStyle(buildStyle(d.manifest, root, ds, { dark: dk })); },
    // 스킨 갈아끼우기(내보내기용). idle까지 기다렸다 resolve.
    setSkin(skin: Skin | null): Promise<void> {
      loaded = false; map.once('style.load', addData);
      map.setStyle(buildStyle(d.manifest, root, ds, skin ? { skin } : { dark: isDark }));
      return new Promise(res => map.once('idle', () => res()));
    },
  };
}
export type Engine = ReturnType<typeof createEngine>;

export const allLayers = (d: Dataset) => [...(d.manifest.layers ?? []), 'relief', 'bathy', 'rivers', 'labels', 'landmarks', 'graph'];
