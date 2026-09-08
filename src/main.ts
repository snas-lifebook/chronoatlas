import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { type Dataset, dateWindow, positionByRoute, routeGeometry } from './schema';
import { createToken } from './token3d';
import { createPanel } from './panel';
import { initExport } from './export';
import { createStore, parseState, bindUrl, applyScene, DEFAULTS, type Scene } from './state';
import { buildStyle } from './map/style';

// 데이터셋 스위처: ?dataset=chuhan-206 으로 다른 도메인 로드(스키마 무관 증명). 기본=로마.
// 상태는 state.ts 하나. ?ds= 가 정식, ?dataset= 은 옛 링크 호환.
const store = createStore(parseState(location.search, { ...DEFAULTS, ds: new URLSearchParams(location.search).get('dataset') || 'rome-753-218' }));
const DATASET = store.get().ds;
// BASE_URL: dev='/', 빌드(GitHub Pages)='/visual-pipeline/'. 둘 다 끝에 슬래시라 그대로 이어붙인다.
const BASE = `${import.meta.env.BASE_URL}datasets/${DATASET}`;
const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;

async function j(p: string) {
  const r = await fetch(`${BASE}/${p}`);
  if (!r.ok) throw new Error(`${p} ${r.status}`);
  return r.json();
}

async function load(): Promise<Dataset> {
  const [manifest, actorsW, eventsW, territory, admin_regions, settlements, battles, movements] = await Promise.all([
    j('manifest.json'), j('entities/actors.json'), j('entities/events.json'),
    j('layers/territory.geojson'), j('layers/admin_regions.geojson'), j('layers/settlements.geojson'),
    j('layers/battles.geojson'), j('layers/movements.geojson'),
  ]);
  return { manifest, actors: actorsW.actors, events: eventsW.events, territory, admin_regions, settlements, battles, movements };
}

const formatYear = (y: number) => (y < 0 ? `기원전 ${-y}년` : `서기 ${y === 0 ? 1 : y}년`);

async function main() {
  const d = await load();
  // 첫 진입 = 장면 프리셋(DESIGN §4). URL에 연도가 있으면 그걸 존중.
  const scenes: Scene[] = d.manifest.scenes ?? [];
  const wanted = scenes.find(sc => sc.id === store.get().scene) ?? (new URLSearchParams(location.search).has('y') ? null : scenes[0]);
  if (wanted) applyScene(store, wanted);
  else if (!new URLSearchParams(location.search).has('y')) store.set({ year: d.manifest.time.to });
  bindUrl(store);
  let year = store.get().year;
  let loaded = false;
  let tokens: { route: string; token: ReturnType<typeof createToken> }[] = [];

  // 베이스맵(1.4): manifest.basemap → style.ts. 다크는 OS 설정을 따른다(astryx light-dark와 같은 기준).
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const style = buildStyle(d.manifest as any, import.meta.env.BASE_URL, DATASET, { dark });
  // pitch: 토큰(장기 말) 입체감. ponytail: 지도 기울기 노브 — 평면 원하면 0.
  const cam = wanted ?? {} as Scene;
  const view = store.get().view;
  const bb = (d.manifest as any).bbox as [number, number, number, number] | undefined;
  const map = new maplibregl.Map({ container: 'map', style, center: cam.center ?? d.manifest.center, zoom: cam.zoom ?? d.manifest.zoom, minZoom: 3, maxZoom: 9,
    pitch: view === '2d' ? 0 : (cam.pitch ?? 50), bearing: view === '2d' ? 0 : (cam.bearing ?? 0),
    maxBounds: bb ? [[bb[0], bb[1]], [bb[2], bb[3]]] : undefined, // 베이스맵 밖(클립 경계)이 안 보이게 — P13
    attributionControl: { compact: true, customAttribution: 'Natural Earth (PD) · 정본 온톨로지' } });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  const panel = createPanel(d);

  const fillColor: any = ['match', ['get', 'actor']];
  for (const a of d.actors) fillColor.push(a.id, a.color);
  fillColor.push('rgba(0,0,0,0)');

  // 전투 마커 색 = 승자 세력색 (로마=적, 카르타고=청). 흰 테두리로 정착지와 구분.
  const victorColor: any = ['match', ['get', 'victor']];
  for (const a of d.actors) victorColor.push(a.id, a.color);
  victorColor.push('#333');

  // 시간가변 레이어: [레이어id, 기본필터(rank 등, 없으면 null)]. 연도 변경 = setFilter (setData 아님).
  const timed: [string, any[] | null][] = [
    ['territory-fill', null],
    ['territory-outline', null],
    ['admin-line', null],
    ['settle-major', ['<=', ['get', 'rank'], 1]],
    ['settle-minor', ['>=', ['get', 'rank'], 2]],
    ['battle', null],
    ['movement', null],
  ];
  const filterFor = (base: any[] | null, y: number): any =>
    base ? ['all', base, ...dateWindow(y).slice(1)] : dateWindow(y);

  map.on('load', () => {
    map.addSource('territory', { type: 'geojson', data: d.territory as any });
    map.addLayer({ id: 'territory-fill', type: 'fill', source: 'territory', paint: { 'fill-color': fillColor, 'fill-opacity': 0.4 } });
    map.addLayer({ id: 'territory-outline', type: 'line', source: 'territory', paint: { 'line-color': '#5a4a32', 'line-width': 1 } });

    // 학술 속주(admin_regions) — 통치권(territory)과 별개 레이어. 점선 경계로 구분.
    map.addSource('admin_regions', { type: 'geojson', data: d.admin_regions as any });
    map.addLayer({ id: 'admin-line', type: 'line', source: 'admin_regions',
      paint: { 'line-color': '#4b3f8c', 'line-width': 2, 'line-dasharray': [3, 2] } });

    if (!map.getSource('settlements')) map.addSource('settlements', { type: 'geojson', data: d.settlements as any });
    // 줌별 노출(LOD) = 레이어 minzoom 네이티브. 시간필터(setFilter)와 병존.
    const before = map.getLayer('label-settle-1') ? 'label-settle-1' : undefined; // 마커는 라벨 아래
    const circle = (id: string, minzoom: number, radius: number) =>
      map.addLayer({ id, type: 'circle', source: 'settlements', minzoom,
        paint: { 'circle-radius': radius, 'circle-color': '#b8860b', 'circle-stroke-color': '#3a2f22', 'circle-stroke-width': 1.2 } }, before);
    circle('settle-major', 3, 5);
    circle('settle-minor', 5, 3.5);

    // 전투 지점 — 승자색 원 + 흰 테두리. 시간필터로 발생 연도부터 등장.
    map.addSource('battles', { type: 'geojson', data: d.battles as any });
    map.addLayer({ id: 'battle', type: 'circle', source: 'battles',
      paint: { 'circle-radius': 7, 'circle-color': victorColor, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });

    // 원정로(movements) — 시간 진행에 따라 구간이 그려짐. 라우트색(actor fill과 대비되게).
    map.addSource('movements', { type: 'geojson', data: d.movements as any });
    map.addLayer({ id: 'movement', type: 'line', source: 'movements',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#e67e22', 'line-width': 3, 'line-dasharray': [2, 1] } });

    // 클릭 → 상세 사이드 패널(panel.ts). 레이어별 kind 매핑, 팝업 대체.
    const kindByLayer: Record<string, 'territory' | 'settlement' | 'battle' | 'movement' | 'admin'> = {
      'territory-fill': 'territory', 'admin-line': 'admin',
      'settle-major': 'settlement', 'settle-minor': 'settlement',
      'battle': 'battle', 'movement': 'movement',
    };
    for (const [layerId, kind] of Object.entries(kindByLayer)) {
      map.on('click', layerId, e => panel.show(kind, e.features?.[0]?.properties ?? {}));
      map.on('mouseenter', layerId, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layerId, () => (map.getCanvas().style.cursor = ''));
    }

    // Three.js 토큰 — movements의 distinct route마다 1개, 색=그 route actor 색. 격리: 실패해도 베이스 지도는 유지.
    try {
      const routeIds = [...new Set(d.movements.features.map(f => f.properties.route))];
      tokens = routeIds.map(routeId => {
        const actorId = d.movements.features.find(f => f.properties.route === routeId)?.properties.actor;
        const color = d.actors.find(a => a.id === actorId)?.color ?? '#666';
        const token = createToken(color);
        token.setRoute(routeGeometry(d.movements.features, routeId).path);
        map.addLayer(token.layer);
        return { route: routeId, token };
      });
    } catch { tokens = []; }

    loaded = true;
    render(year);
  });

  function applyFilters(y: number) {
    if (!loaded) return;
    for (const [id, base] of timed) map.setFilter(id, filterFor(base, y));
  }

  // ---- 타임라인 ----
  const slider = $<HTMLInputElement>('#year');
  const label = $<HTMLElement>('#yearLabel');
  const note = $<HTMLElement>('#eventNote');
  slider.min = String(d.manifest.time.from);
  slider.max = String(d.manifest.time.to);
  slider.value = String(year);

  const nearestEvent = (y: number) => d.events.reduce<null | Dataset['events'][number]>(
    (best, e) => (!best || Math.abs(e.year - y) < Math.abs(best.year - y)) ? e : best, null);

  function applyYear(y: number) { store.set({ year: y }); }
  store.subscribe(s => { if (s.year !== year) render(s.year); });
  function render(y: number) {
    year = y;
    slider.value = String(y);
    label.textContent = formatYear(y);
    const ev = nearestEvent(y);
    note.textContent = ev ? `${formatYear(ev.year)} · ${ev.label}` : '';
    applyFilters(y);
    for (const { route, token } of tokens) token.setPosition(positionByRoute(d.movements.features, route, y));
  }
  slider.addEventListener('input', () => applyYear(parseInt(slider.value, 10)));

  // 사건 틱
  const ticks = $<HTMLElement>('#ticks');
  const span = d.manifest.time.to - d.manifest.time.from;
  for (const e of d.events) {
    const t = document.createElement('div');
    t.className = 'tick';
    t.style.left = `${((e.year - d.manifest.time.from) / span) * 100}%`;
    t.title = `${formatYear(e.year)} ${e.label}`;
    t.onclick = () => applyYear(e.year);
    ticks.appendChild(t);
  }

  // 재생
  let timer: number | null = null;
  const playBtn = $<HTMLButtonElement>('#play');
  playBtn.onclick = () => {
    if (timer) { clearInterval(timer); timer = null; playBtn.textContent = '▶'; return; }
    playBtn.textContent = '⏸';
    timer = window.setInterval(() => {
      const next = year + 5;
      if (next >= d.manifest.time.to) { applyYear(d.manifest.time.to); clearInterval(timer!); timer = null; playBtn.textContent = '▶'; return; }
      applyYear(next);
    }, 350);
  };

  // 범례
  $<HTMLElement>('#legend').innerHTML = d.actors.map(a => `<span><i style="background:${a.color}"></i>${a.label}</span>`).join('');

  // 타임슬라이스 내보내기 버튼(export.ts).
  initExport(d, () => year);

  render(year);
}

main().catch(err => {
  document.body.innerHTML = `<pre style="padding:20px">로드 실패: ${err.message}\n로컬 서버로 여세요 (npm run dev)</pre>`;
});
