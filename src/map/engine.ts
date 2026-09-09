// 지도 엔진 (TASKS 1.3·1.8): MapLibre + 데이터 레이어 + 토큰. store만 구독한다 — React 크롬과는 store로만 이야기한다.
import * as maplibregl from 'maplibre-gl';
import { type Dataset, dateWindow, positionByRoute, routeGeometry } from '../schema';
import { buildStyle, type Skin } from './style';
import type { Store, Scene, State } from '../state';
import type { Neighbor } from '../graph/data';

// 레이어 카탈로그 id → MapLibre 레이어 id들. 켜고 끄는 단위(DESIGN P6). 'labels'는 지명 토글.
export const LAYER_GROUPS: Record<string, string[]> = {
  territory: ['territory-fill', 'territory-outline', 'territory-label'],
  admin_regions: ['admin-line'],
  settlements: ['settle-major', 'settle-minor', 'label-settle-1', 'label-settle-2', 'label-settle-3'],
  battles: ['battle'],
  movements: ['movement'],
  relief: ['relief'],
  bathy: ['bathy'],
  rivers: ['rivers-major', 'rivers-minor'],
  labels: ['label-marine', 'label-region', 'label-settle-1', 'label-settle-2', 'label-settle-3'],
  landmarks: ['landmark-region_labels', 'landmark-marine_labels', 'landmark-pleiades'],
  graph: ['ego-edge', 'ego-node', 'ego-label'],
};
// 의미군 선색(DESIGN: 유채색은 데이터 색뿐 — 관계 의미도 데이터다)
export const GROUP_COLOR: Record<string, string> = { hostile: '#B4433E', ally: '#2F7D5B', rule: '#5B4B8A', lineage: '#8A6D3B', member: '#3E6F8C', act: '#6B6F76', locate: '#8A8F98', make: '#6B6F76', other: '#8A8F98' };

export function createEngine(container: HTMLElement, d: Dataset, store: Store, root: string, ds: string, dark = false) {
  const s0 = store.get();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; // DESIGN §4: 즉시 전환
  const dur = (ms: number) => (reduced ? 0 : ms);
  let isDark = dark;
  const style = buildStyle(d.manifest, root, ds, { dark });
  const scenes: Scene[] = d.manifest.scenes ?? [];
  const cam = scenes.find(sc => sc.id === s0.scene) ?? {} as Scene;
  const bb = d.manifest.bbox;
  const map = new maplibregl.Map({ container, style, center: cam.center ?? d.manifest.center, zoom: cam.zoom ?? d.manifest.zoom, minZoom: 3, maxZoom: 9,
    pitch: s0.view === '2d' ? 0 : (cam.pitch ?? 50), bearing: s0.view === '2d' ? 0 : (cam.bearing ?? 0),
    maxBounds: bb ? [[bb[0], bb[1]], [bb[2], bb[3]]] : undefined, // 베이스맵 밖이 안 보이게 — P13
    attributionControl: false, canvasContextAttributes: { preserveDrawingBuffer: true } }); // 내보내기(3.1)가 캔버스를 읽는다
  // MapLibre는 ResizeObserver 첫 콜백을 버린다 — 컨테이너가 0×0에서 시작하면(숨긴 패널·iframe) 400×300에 갇힌다. 우리가 직접 본다.
  new ResizeObserver(() => map.resize()).observe(container);

  const fillColor: any = ['match', ['get', 'actor']]; for (const a of d.actors) fillColor.push(a.id, a.color); fillColor.push('#8A8F98');
  const victorColor: any = ['match', ['get', 'victor']]; for (const a of d.actors) victorColor.push(a.id, a.color); victorColor.push('#333');
  const timed: [string, any[] | null][] = [['territory-fill', null], ['territory-outline', null], ['territory-label', ['all', ['==', ['geometry-type'], 'Point'], ['>', ['get', 'area'], ['case', ['==', ['get', 'actor'], '기타중립'], ['step', ['zoom'], 900000, 5, 300000, 7, 80000], ['step', ['zoom'], 250000, 5, 90000, 7, 20000]]]] as any], ['admin-line', null],
    ['settle-major', ['<=', ['get', 'rank'], 1]], ['settle-minor', ['>=', ['get', 'rank'], 2]], ['battle', null], ['movement', null]];
  const filterFor = (base: any[] | null, y: number): any => base ? ['all', base, ...dateWindow(y).slice(1)] : dateWindow(y);

  let loaded = false;
  let tokens: { route: string; token: import('../token3d').Token }[] = [];

  // 기하 3D 지형(River 9/9 "3D인데 굴곡이 없다"): manifest.terrain이 있으면 raster-dem을 켠다.
  // DEM 타일은 용량·라이선스 때문에 레포에 없다 — public/datasets/<ds>/terrain/{z}/{x}/{y}.png(terrarium)를 두면 자동으로 켜진다.
  function addTerrain(before?: string) {
    const t = d.manifest.terrain; if (!t) return;
    if (!map.getSource('dem')) map.addSource('dem', { type: 'raster-dem', tiles: [`${root}datasets/${ds}/terrain/{z}/{x}/{y}.png`], encoding: t.encoding ?? 'terrarium', tileSize: 256, minzoom: t.minzoom ?? 0, maxzoom: t.maxzoom ?? 12 });
    if (!map.getLayer('hillshade')) map.addLayer({ id: 'hillshade', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': isDark ? '#0B0F14' : '#5C6157', 'hillshade-highlight-color': isDark ? '#3A424C' : '#FFFFFF' } }, before);
    map.setTerrain({ source: 'dem', exaggeration: t.exaggeration ?? 1.4 });
  }

  function addData() {
    if (map.getSource('territory')) return; // setStyle 직후 load/style.load가 겹쳐 두 번 불릴 수 있다
    const before = map.getLayer('label-marine') ? 'label-marine' : undefined; // 데이터 레이어는 라벨 아래
    addTerrain(before);
    map.addSource('territory', { type: 'geojson', data: d.territory as any, promoteId: 'id' });
    map.addLayer({ id: 'territory-fill', type: 'fill', source: 'territory', paint: { 'fill-color': fillColor, 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.5, ['==', ['get', 'actor'], '기타중립'], 0.18, 0.38] as any } }, before);
    map.addLayer({ id: 'territory-outline', type: 'line', source: 'territory', paint: { 'line-color': fillColor, 'line-width': 1, 'line-opacity': 0.8 } }, before);
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
    map.addSource('movements', { type: 'geojson', data: d.movements as any });
    map.addLayer({ id: 'movement', type: 'line', source: 'movements', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': fillColor, 'line-width': 2.5, 'line-dasharray': [2, 1.2], 'line-opacity': 0.9 } }, before);

    // 관계 그래프 오버레이(2.1, 하이브리드): 선택 객체 ↔ 좌표 있는 이웃 선. 좌표 없는 이웃은 GraphPanel.
    map.addSource('ego', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id' });
    map.addLayer({ id: 'ego-edge', type: 'line', source: 'ego', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 1.6, 'line-opacity': 0.85, 'line-dasharray': ['case', ['==', ['get', 'confidence'], 'low'], ['literal', [2, 2]], ['literal', [1, 0]]] } as any });
    map.addLayer({ id: 'ego-node', type: 'circle', source: 'ego', filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 9, 'circle-color': isDark ? '#E6E8EB' : '#111418', 'circle-stroke-color': isDark ? '#1B2129' : '#fff', 'circle-stroke-width': 1.5 } });
    map.addLayer({ id: 'ego-label', type: 'symbol', source: 'ego', filter: ['==', ['geometry-type'], 'Point'],
      layout: { 'text-field': ['get', 'name'], 'text-font': ['KlokanTech Noto Sans CJK Regular'], 'text-size': 12, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false },
      paint: { 'text-color': isDark ? '#E6E8EB' : '#111418', 'text-halo-color': isDark ? '#1B2129' : '#fff', 'text-halo-width': 1.4 } });
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
    loaded = true; lastYear = null; lastLayers = ''; lastSel = undefined; selectedFs = null;
    apply(store.get());
  }
  map.on('load', addData);
  // 클릭 → 선택(store). 패널은 React가 store를 보고 그린다.
  for (const layerId of ['territory-fill', 'admin-line', 'settle-major', 'settle-minor', 'battle', 'movement', 'landmark-region_labels', 'landmark-marine_labels', 'landmark-pleiades', 'ego-node']) {
    map.on('click', layerId, e => {
      const f = e.features?.[0]; if (!f) return;
      if (layerId.startsWith('landmark-')) { // 점 객체가 위에 있으면 그쪽이 이긴다
        if (map.queryRenderedFeatures(e.point, { layers: ['settle-major', 'settle-minor', 'battle'].filter(l => map.getLayer(l)) }).length) return;
        store.set({ sel: `landmark:${f.properties.pid ?? f.properties.name}` }); return; } // 정본 place 아님 — NE·Pleiades 지형지물(제안 대상). Pleiades는 id, NE는 이름
      if (layerId === 'territory-fill' && map.queryRenderedFeatures(e.point, { layers: ['settle-major', 'settle-minor', 'battle', 'landmark-pleiades'].filter(l => map.getLayer(l)) }).length) return;
      if (f.properties?.id) store.set({ sel: f.properties.id });
    });
    map.on('mouseenter', layerId, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', layerId, () => (map.getCanvas().style.cursor = ''));
  }
  map.on('click', e => { if (!map.queryRenderedFeatures(e.point, { layers: Object.values(LAYER_GROUPS).flat().filter(l => map.getLayer(l)) }).length) store.set({ sel: null }); });

  // hover feature-state + 툴팁(120ms 지연, 이름·연도 한 줄). 소스별 id는 promoteId 'id'.
  const SRC_OF: Record<string, string> = { 'territory-fill': 'territory', 'settle-major': 'settlements', 'settle-minor': 'settlements', battle: 'battles', 'landmark-region_labels': 'region_labels', 'landmark-marine_labels': 'marine_labels', 'landmark-pleiades': 'landmarks', 'ego-node': 'ego' };
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
      const label = p.name_ko ?? p.name ?? p.id, sub = yr != null ? (yr < 0 ? `BC ${-yr}` : `AD ${yr}`) : p.kind_ko ?? p.featurecla ?? '';
      tipTimer = window.setTimeout(() => tip.setLngLat(e.lngLat).setHTML(`<b>${label}</b>${sub ? ` · ${sub}` : ''}`).addTo(map), 120);
    });
    // 겹친 레이어(지형지물 라벨 위의 도시 점) 중 하나를 떠나도 다른 하나가 아직 밑에 있으면 툴팁을 살린다
    map.on('mouseleave', layerId, e => {
      if (map.queryRenderedFeatures(e.point, { layers: Object.keys(SRC_OF).filter(l => l !== layerId && map.getLayer(l)) }).length) return;
      setHover(null); if (tipTimer) clearTimeout(tipTimer); tip.remove(); });
  }
  // selected feature-state + 나머지 40% 디밍(선택 있을 때만 페인트 교체)
  let selectedFs: { source: string; id: string | number } | null = null;
  const dimExpr = (v: number) => ['case', ['boolean', ['feature-state', 'selected'], false], 1, v];
  function applySel(sel: string | null) {
    if (selectedFs) { map.setFeatureState(selectedFs, { selected: false }); selectedFs = null; }
    const source = sel?.startsWith('event:') ? 'battles' : sel?.startsWith('place:') ? 'settlements' : null;
    if (sel && source && map.getSource(source)) { selectedFs = { source, id: sel }; map.setFeatureState(selectedFs, { selected: true }); }
    if (sel?.startsWith('landmark:')) {
      const key = sel.slice('landmark:'.length);
      for (const src of ['landmarks', 'region_labels', 'marine_labels']) {
        if (!map.getSource(src)) continue;
        const f = map.querySourceFeatures(src).find(f => String(f.properties?.pid ?? f.properties?.name) === key);
        if (f && f.id != null) { selectedFs = { source: src, id: f.id as any }; map.setFeatureState(selectedFs, { selected: true }); break; }
      }
    }
    for (const id of ['settle-major', 'settle-minor', 'battle']) if (map.getLayer(id)) map.setPaintProperty(id, 'circle-opacity', (selectedFs ? dimExpr(0.6) : 1) as any);
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

  let lastYear: number | null = null, lastLayers = '', lastView = '', lastSel: string | null | undefined = undefined;
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
    if (key !== lastLayers) {
      lastLayers = key;
      for (const [group, ids] of Object.entries(LAYER_GROUPS)) {
        const vis = group === 'labels' ? (on.has('labels')) : on.has(group);
        for (const id of ids) if (map.getLayer(id)) {
          // 정착지 라벨은 settlements와 labels 둘 다 켜져야 보인다
          const v = id.startsWith('label-settle') ? on.has('settlements') && on.has('labels') : vis;
          map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none');
        }
      }
    }
    if (s.sel !== lastSel) { lastSel = s.sel; applySel(s.sel); }
    if (s.view !== lastView) { lastView = s.view; map.easeTo({ pitch: s.view === '2d' ? 0 : (cam.pitch ?? 50), bearing: s.view === '2d' ? 0 : (cam.bearing ?? 0), duration: dur(600) }); }
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
