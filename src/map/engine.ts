// 지도 엔진 (TASKS 1.3·1.8): MapLibre + 데이터 레이어 + 토큰. store만 구독한다 — React 크롬과는 store로만 이야기한다.
import * as maplibregl from 'maplibre-gl';
import { type Dataset, dateWindow, positionByRoute, routeGeometry } from '../schema';
import { createToken } from '../token3d';
import { buildStyle } from './style';
import type { Store, Scene, State } from '../state';
import type { Neighbor } from '../graph/data';

// 레이어 카탈로그 id → MapLibre 레이어 id들. 켜고 끄는 단위(DESIGN P6). 'labels'는 지명 토글.
export const LAYER_GROUPS: Record<string, string[]> = {
  territory: ['territory-fill', 'territory-outline'],
  admin_regions: ['admin-line'],
  settlements: ['settle-major', 'settle-minor', 'label-settle-1', 'label-settle-2', 'label-settle-3'],
  battles: ['battle'],
  movements: ['movement'],
  relief: ['relief'],
  bathy: ['bathy'],
  rivers: ['rivers-major', 'rivers-minor'],
  labels: ['label-marine', 'label-region', 'label-settle-1', 'label-settle-2', 'label-settle-3'],
  landmarks: ['landmark-region_labels', 'landmark-marine_labels'],
  graph: ['ego-edge', 'ego-node', 'ego-label'],
};
// 의미군 선색(DESIGN: 유채색은 데이터 색뿐 — 관계 의미도 데이터다)
export const GROUP_COLOR: Record<string, string> = { hostile: '#B4433E', ally: '#2F7D5B', rule: '#5B4B8A', lineage: '#8A6D3B', member: '#3E6F8C', act: '#6B6F76', locate: '#8A8F98', make: '#6B6F76', other: '#8A8F98' };

export function createEngine(container: HTMLElement, d: Dataset, store: Store, root: string, ds: string, dark = false) {
  const s0 = store.get();
  const style = buildStyle(d.manifest, root, ds, { dark });
  const scenes: Scene[] = d.manifest.scenes ?? [];
  const cam = scenes.find(sc => sc.id === s0.scene) ?? {} as Scene;
  const bb = d.manifest.bbox;
  const map = new maplibregl.Map({ container, style, center: cam.center ?? d.manifest.center, zoom: cam.zoom ?? d.manifest.zoom, minZoom: 3, maxZoom: 9,
    pitch: s0.view === '2d' ? 0 : (cam.pitch ?? 50), bearing: s0.view === '2d' ? 0 : (cam.bearing ?? 0),
    maxBounds: bb ? [[bb[0], bb[1]], [bb[2], bb[3]]] : undefined, // 베이스맵 밖이 안 보이게 — P13
    attributionControl: false });

  const fillColor: any = ['match', ['get', 'actor']]; for (const a of d.actors) fillColor.push(a.id, a.color); fillColor.push('rgba(0,0,0,0)');
  const victorColor: any = ['match', ['get', 'victor']]; for (const a of d.actors) victorColor.push(a.id, a.color); victorColor.push('#333');
  const timed: [string, any[] | null][] = [['territory-fill', null], ['territory-outline', null], ['admin-line', null],
    ['settle-major', ['<=', ['get', 'rank'], 1]], ['settle-minor', ['>=', ['get', 'rank'], 2]], ['battle', null], ['movement', null]];
  const filterFor = (base: any[] | null, y: number): any => base ? ['all', base, ...dateWindow(y).slice(1)] : dateWindow(y);

  let loaded = false;
  let tokens: { route: string; token: ReturnType<typeof createToken> }[] = [];

  function addData() {
    if (map.getSource('territory')) return; // setStyle 직후 load/style.load가 겹쳐 두 번 불릴 수 있다
    const before = map.getLayer('label-marine') ? 'label-marine' : undefined; // 데이터 레이어는 라벨 아래
    map.addSource('territory', { type: 'geojson', data: d.territory as any, promoteId: 'id' });
    map.addLayer({ id: 'territory-fill', type: 'fill', source: 'territory', paint: { 'fill-color': fillColor, 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.68, 0.55] as any } }, before);
    map.addLayer({ id: 'territory-outline', type: 'line', source: 'territory', paint: { 'line-color': fillColor, 'line-width': 1 } }, before);
    map.addSource('admin_regions', { type: 'geojson', data: d.admin_regions as any });
    map.addLayer({ id: 'admin-line', type: 'line', source: 'admin_regions', paint: { 'line-color': '#4b3f8c', 'line-width': 1.5, 'line-dasharray': [3, 2] } }, before);
    if (!map.getSource('settlements')) map.addSource('settlements', { type: 'geojson', data: d.settlements as any, promoteId: 'id' });
    // hover: +반지름·외곽 1.5px / selected: 외곽 2px(세력색 대신 잉크 — 정착지는 세력 없음) — DESIGN §2, GPU만
    const hov = (base: number, plus: number) => ['case', ['boolean', ['feature-state', 'selected'], false], base + plus, ['boolean', ['feature-state', 'hover'], false], base + plus * 0.6, base];
    const circle = (id: string, minzoom: number, radius: number) =>
      map.addLayer({ id, type: 'circle', source: 'settlements', minzoom, paint: { 'circle-radius': hov(radius, 2) as any, 'circle-color': '#b8860b',
        'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#111418', '#3a2f22'] as any, 'circle-stroke-width': hov(1.2, 1) as any, 'circle-opacity': 1 } }, before);
    circle('settle-major', 3, 5); circle('settle-minor', 5, 3.5);
    map.addSource('battles', { type: 'geojson', data: d.battles as any, promoteId: 'id' });
    map.addLayer({ id: 'battle', type: 'circle', source: 'battles', paint: { 'circle-radius': hov(7, 2) as any, 'circle-color': victorColor, 'circle-stroke-color': '#fff', 'circle-stroke-width': hov(2, 1) as any, 'circle-opacity': 1 } }, before);
    map.addSource('movements', { type: 'geojson', data: d.movements as any });
    map.addLayer({ id: 'movement', type: 'line', source: 'movements', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#e67e22', 'line-width': 3, 'line-dasharray': [2, 1] } }, before);

    // 관계 그래프 오버레이(2.1): 선택 객체의 1홉. 좌표 없는 노드는 앵커 주위 링에 놓는다(setEgo).
    map.addSource('ego', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id' });
    map.addLayer({ id: 'ego-edge', type: 'line', source: 'ego', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 1.6, 'line-opacity': 0.85, 'line-dasharray': ['case', ['==', ['get', 'confidence'], 'low'], ['literal', [2, 2]], ['literal', [1, 0]]] } as any });
    map.addLayer({ id: 'ego-node', type: 'circle', source: 'ego', filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': ['case', ['boolean', ['get', 'anchor'], false], 9, hov(6, 2)] as any, 'circle-color': '#111418', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
    map.addLayer({ id: 'ego-label', type: 'symbol', source: 'ego', filter: ['==', ['geometry-type'], 'Point'],
      layout: { 'text-field': ['get', 'name'], 'text-font': ['KlokanTech Noto Sans CJK Regular'], 'text-size': 12, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false },
      paint: { 'text-color': '#111418', 'text-halo-color': '#fff', 'text-halo-width': 1.4 } });
    if (ego) setEgo(ego.sel, ego.name, ego.neighbors);

    try {
      const routeIds = [...new Set(d.movements.features.map(f => f.properties.route))];
      tokens = routeIds.map(routeId => {
        const actorId = d.movements.features.find(f => f.properties.route === routeId)?.properties.actor;
        const token = createToken(d.actors.find(a => a.id === actorId)?.color ?? '#666');
        token.setRoute(routeGeometry(d.movements.features, routeId).path);
        map.addLayer(token.layer);
        return { route: routeId, token };
      });
    } catch { tokens = []; }
    loaded = true; lastYear = null; lastLayers = ''; lastSel = undefined; selectedFs = null;
    apply(store.get());
  }
  map.on('load', addData);
  // 클릭 → 선택(store). 패널은 React가 store를 보고 그린다.
  for (const layerId of ['territory-fill', 'admin-line', 'settle-major', 'settle-minor', 'battle', 'movement', 'landmark-region_labels', 'landmark-marine_labels', 'ego-node']) {
    map.on('click', layerId, e => {
      const f = e.features?.[0]; if (!f) return;
      if (layerId.startsWith('landmark-')) { // 점 객체가 위에 있으면 그쪽이 이긴다
        if (map.queryRenderedFeatures(e.point, { layers: ['settle-major', 'settle-minor', 'battle'].filter(l => map.getLayer(l)) }).length) return;
        store.set({ sel: `landmark:${f.properties.name}` }); return; } // 정본 place 아님 — NE 지형지물(제안 대상)
      if (f.properties?.id) store.set({ sel: f.properties.id });
    });
    map.on('mouseenter', layerId, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', layerId, () => (map.getCanvas().style.cursor = ''));
  }
  map.on('click', e => { if (!map.queryRenderedFeatures(e.point, { layers: Object.values(LAYER_GROUPS).flat().filter(l => map.getLayer(l)) }).length) store.set({ sel: null }); });

  // hover feature-state + 툴팁(120ms 지연, 이름·연도 한 줄). 소스별 id는 promoteId 'id'.
  const SRC_OF: Record<string, string> = { 'territory-fill': 'territory', 'settle-major': 'settlements', 'settle-minor': 'settlements', battle: 'battles', 'landmark-region_labels': 'region_labels', 'landmark-marine_labels': 'marine_labels', 'ego-node': 'ego' };
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
      const label = p.name_ko ?? p.name ?? p.id, sub = yr != null ? (yr < 0 ? `BC ${-yr}` : `AD ${yr}`) : p.featurecla ?? '';
      tipTimer = window.setTimeout(() => tip.setLngLat(e.lngLat).setHTML(`<b>${label}</b>${sub ? ` · ${sub}` : ''}`).addTo(map), 120);
    });
    map.on('mouseleave', layerId, () => { setHover(null); if (tipTimer) clearTimeout(tipTimer); tip.remove(); });
  }
  // selected feature-state + 나머지 40% 디밍(선택 있을 때만 페인트 교체)
  let selectedFs: { source: string; id: string | number } | null = null;
  const dimExpr = (v: number) => ['case', ['boolean', ['feature-state', 'selected'], false], 1, v];
  function applySel(sel: string | null) {
    if (selectedFs) { map.setFeatureState(selectedFs, { selected: false }); selectedFs = null; }
    const source = sel?.startsWith('event:') ? 'battles' : sel?.startsWith('place:') ? 'settlements' : null;
    if (sel && source && map.getSource(source)) { selectedFs = { source, id: sel }; map.setFeatureState(selectedFs, { selected: true }); }
    if (sel?.startsWith('landmark:')) {
      const name = sel.slice('landmark:'.length);
      for (const src of ['region_labels', 'marine_labels']) {
        const f = map.querySourceFeatures(src).find(f => f.properties?.name === name);
        if (f && f.id != null) { selectedFs = { source: src, id: f.id as any }; map.setFeatureState(selectedFs, { selected: true }); break; }
      }
    }
    for (const id of ['settle-major', 'settle-minor', 'battle']) if (map.getLayer(id)) map.setPaintProperty(id, 'circle-opacity', (selectedFs ? dimExpr(0.6) : 1) as any);
  }



  let lastYear: number | null = null, lastLayers = '', lastView = '', lastSel: string | null | undefined = undefined;
  function apply(s: State) {
    if (!loaded) return;
    if (s.year !== lastYear) {
      lastYear = s.year;
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
    if (s.view !== lastView) { lastView = s.view; map.easeTo({ pitch: s.view === '2d' ? 0 : (cam.pitch ?? 50), bearing: s.view === '2d' ? 0 : (cam.bearing ?? 0), duration: 600 }); }
  }
  store.subscribe(apply);

  // ---- 1홉 오버레이 데이터. 좌표 있는 이웃은 제자리, 없는 이웃은 앵커 주위 반지름 150px 링(의미군 순, 줌 바뀌면 다시 계산).
  let ego: { sel: string; name: string; neighbors: Neighbor[] } | null = null;
  const coordOf = (id: string): [number, number] | null => {
    const f = (id.startsWith('event:') ? d.battles : d.settlements).features.find(f => f.properties.id === id);
    return f ? (f.geometry.coordinates as [number, number]) : null;
  };
  function setEgo(sel: string | null, name: string, neighbors: Neighbor[]) {
    ego = sel ? { sel, name, neighbors } : null;
    const src = map.getSource('ego') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    if (!sel || !neighbors.length) { src.setData({ type: 'FeatureCollection', features: [] }); return; }
    const geoN = neighbors.filter(n => coordOf(n.node.id)), freeN = neighbors.filter(n => !coordOf(n.node.id));
    let anchor = coordOf(sel);
    if (!anchor && geoN.length) { const cs = geoN.map(n => coordOf(n.node.id)!); anchor = [cs.reduce((a, c) => a + c[0], 0) / cs.length, cs.reduce((a, c) => a + c[1], 0) / cs.length]; }
    if (!anchor) { const c = map.getCenter(); anchor = [c.lng, c.lat]; }
    const apx = map.project(anchor as any);
    const order = ['hostile', 'ally', 'rule', 'lineage', 'member', 'act', 'locate', 'make', 'other'];
    const sorted = [...freeN].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
    const R = Math.min(150, 40 + sorted.length * 9);
    const feats: any[] = [];
    const pos = new Map<string, [number, number]>();
    sorted.forEach((n, i) => { const t = -Math.PI / 2 + (2 * Math.PI * i) / sorted.length; const ll = map.unproject([apx.x + R * Math.cos(t), apx.y + R * Math.sin(t)]); pos.set(n.node.id, [ll.lng, ll.lat]); });
    for (const n of geoN) pos.set(n.node.id, coordOf(n.node.id)!);
    for (const n of neighbors) {
      const p = pos.get(n.node.id)!;
      feats.push({ type: 'Feature', properties: { id: `edge:${n.node.id}`, color: GROUP_COLOR[n.group], confidence: n.link.confidence ?? 'medium', rel: n.rel }, geometry: { type: 'LineString', coordinates: [anchor, p] } });
      if (!coordOf(n.node.id)) feats.push({ type: 'Feature', properties: { id: n.node.id, name: n.node.name, type: n.node.type, group: n.group }, geometry: { type: 'Point', coordinates: p } });
    }
    if (!coordOf(sel)) feats.push({ type: 'Feature', properties: { id: sel, name, anchor: true }, geometry: { type: 'Point', coordinates: anchor } });
    src.setData({ type: 'FeatureCollection', features: feats });
  }
  map.on('zoomend', () => { if (ego) setEgo(ego.sel, ego.name, ego.neighbors); });

  return {
    map,
    setEgo,
    flyTo(sc: Scene) { if (sc.center) map.flyTo({ center: sc.center, zoom: sc.zoom, pitch: store.get().view === '2d' ? 0 : sc.pitch, bearing: store.get().view === '2d' ? 0 : sc.bearing, duration: 1400, essential: true }); },
    // 패널 관계 행 hover → 지도 위 상대 객체 펄스(feature-state hover). id 없으면 해제.
    pulse(id: string | null) {
      const source = id?.startsWith('event:') ? 'battles' : id?.startsWith('place:') ? 'settlements' : null;
      setHover(id && source && map.getSource(source) ? { source, id } : null);
    },
    home() { if (bb) map.fitBounds([[bb[0] + 12, bb[1] + 8], [bb[2] - 20, bb[3] - 10]], { padding: 40, duration: 900 }); },
    zoom(delta: number) { map.easeTo({ zoom: map.getZoom() + delta, duration: 300 }); },
    // 테마 전환: 베이스맵 스타일 재빌드 → 데이터 레이어 다시 얹기(setStyle이 소스·레이어를 지운다)
    setDark(dk: boolean) { loaded = false; map.once('style.load', addData); map.setStyle(buildStyle(d.manifest, root, ds, { dark: dk })); },
  };
}
export type Engine = ReturnType<typeof createEngine>;

export const allLayers = (d: Dataset) => [...(d.manifest.layers ?? []), 'relief', 'bathy', 'rivers', 'labels', 'landmarks', 'graph'];
