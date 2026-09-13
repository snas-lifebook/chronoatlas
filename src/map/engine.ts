// 지도 엔진 (TASKS 1.3·1.8): MapLibre + 데이터 레이어 + 토큰. store만 구독한다 — React 크롬과는 store로만 이야기한다.
import * as maplibregl from 'maplibre-gl';
import { type Dataset, dateWindow, OPEN_PAST, routeGeometry } from '../schema';
import { buildStyle, type Skin } from './style';
import { rememberPitch3d, roundCam, type Store, type Scene, type State } from '../state';
import type { Neighbor } from '../graph/data';
import { ARM_KO, FALLBACK_COLOR, phaseOf, unitsGeoJSON, type BoardData } from '../board';
import { showAlesia, showGalliaOverlay, showGalliaRoman } from '../present';
import { ALESIA, PACK_BATTLES, PACK_MOVEMENTS, PACK_PLACES, hiddenPlaces } from '../packData';

const GALLIA_FREE = Object.values(import.meta.glob('../../data/overlays/gallia-free.json', { eager: true, import: 'default' }))[0] as { type: string; features: object[] } | undefined;

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

function portraitIcon(img: CanvasImageSource | null, color: string, initial: string): ImageData {
  const size = 64, c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.closePath();
  g.save(); g.clip();
  if (img) g.drawImage(img, 4, 4, 56, 56);
  else {
    g.fillStyle = color; g.fillRect(0, 0, size, size);
    g.fillStyle = '#fff';
    g.font = '600 26px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(initial || '·', 32, 34);
  }
  g.restore();
  g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2);
  g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke();
  g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2);
  g.strokeStyle = color; g.lineWidth = 3; g.stroke();
  return g.getImageData(0, 0, size, size);
}

// 레이어 카탈로그 id → MapLibre 레이어 id들. 켜고 끄는 단위(DESIGN P6). 'labels'는 지명 토글.
export const LAYER_GROUPS: Record<string, string[]> = {
  territory: ['territory-fill', 'territory-outline', 'territory-label', 'gallia-free', 'gallia-free-line', 'gallia-roman', 'gallia-roman-line'],
  admin_regions: ['admin-line'],
  settlements: ['settle-major', 'settle-minor', 'label-settle-1', 'label-settle-2', 'label-settle-3', 'story-place', 'story-place-label'],
  battles: ['battle', 'pack-battle', 'pack-battle-label'],
  movements: ['movement'],
  relief: ['relief', 'hillshade'], // DEM이 있으면 hillshade가 relief.jpg를 대체한다(addTerrain에서 relief 제거)
  bathy: ['bathy'],
  rivers: ['rivers-major', 'rivers-minor'],
  labels: ['label-settle-1', 'label-settle-2', 'label-settle-3'],
  // label-region이 여기 있는 이유: Natural Earth의 SAHARA·LIBYAN DESERT·ATLAS MOUNTAINS 같은
  // **라틴 대문자** 지명이다. 사양서가 「한글 이름표를 켠다. 라틴어 표기는 쓰지 않는다」로 못 박았고
  // 옅은 회색이라 읽히지도 않았다(River: "지리지역 텍스트 가독성이 안 좋다"). 지리 지명은 한글
  // 영역·정착지 이름표가 댄다. **그룹에서 그냥 빼면 안 된다** — 관리 대상이 아니게 되어
  // 아무도 끄지 않아 오히려 항상 켜진다. 팩 장면이 안 켜는 landmarks로 옮겨서 끈다.
  landmarks: ['landmark-region_labels', 'landmark-marine_labels', 'landmark-pleiades', 'label-region'],
  graph: ['ego-edge'], // 지도엔 선만 그린다(D4 하이브리드). 노드·이름표는 이미 settle-*·battle·label-settle-*가 그린 위에 겹칠 뿐이다
  board: ['board-unit', 'board-label'],
  people: ['people-dot', 'people-label'],
  // 알레시아 세부(포위선 두 겹·진영 8·보루 23). 그 장면에서만 켠다 — present.showAlesia
  alesia: ['alesia-plain', 'alesia-oppidum', 'alesia-river', 'alesia-outer', 'alesia-inner',
           'alesia-redoubt', 'alesia-camp', 'alesia-gaulcamp', 'alesia-label'],
};
// 정착지 레이어에 연도 필드가 없어서(220개 전부) 기원전 지도에 후대 이름이 섞인다.
// 실제로 BC 48 지도에 「콘스탄티노플」(AD 330 봉헌)이 떴다. 교보재 목록에 있는 것만,
// 그 해가 되기 전이면 가린다. 원래 필터는 한 번만 읽어 두고 AND로 덧붙인다.
const BASE_FILTER = new Map<string, unknown>();
function hideAnachronisticPlaces(map: maplibregl.Map, year: number) {
  const hide = hiddenPlaces(year);
  for (const id of LAYER_GROUPS.settlements) {
    if (!map.getLayer(id)) continue;
    if (!BASE_FILTER.has(id)) BASE_FILTER.set(id, map.getFilter(id) ?? null);
    const base = BASE_FILTER.get(id) as any;
    // story-place-label이 이미 크게 쓰는 이름을 label-settle-*가 또 쓴다. 발표 줌에서
    // rank2를 켜면서 「로마」·「알렉산드리아」가 두 번 찍혔다. 겹치는 쪽을 뺀다.
    // story-place-label이 이미 크게 쓰는 이름을 label-settle-*가 또 쓴다.
    // 그리고 전투점 교보재에 place:일레르다처럼 **정착지와 같은 id**가 있어서
    // story-place-label과 pack-battle-label이 같은 이름을 두 번 찍었다.
    const battleIds = PACK_BATTLES.map(f => String((f as { properties: { id?: string } }).properties?.id ?? ''));
    const dup = id.startsWith('label-settle') ? [...PACK_PLACES]
      : id === 'story-place-label' ? battleIds : [];
    const out = [...hide, ...dup];
    const excl: any = ['!', ['in', ['get', 'id'], ['literal', out]]];
    map.setFilter(id, (out.length ? (base ? ['all', base, excl] : excl) : base) as any);
  }
}

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
  let pitch3d = (s0.pitch != null && s0.pitch >= 15) ? s0.pitch : 50;
  let bearing3d = s0.bearing ?? 0; // 평면으로 눕혔다 다시 세울 때 돌아갈 각도
  let echo = false; // 지금 들어온 상태 변경이 지도 자신이 낸 것인가(되먹임 차단)
  map.on('moveend', () => {
    const st = store.get();
    const p = map.getPitch();
    if (st.view === '3d' && p >= 15) { pitch3d = rememberPitch3d(pitch3d, p, st.view); bearing3d = map.getBearing(); }
    echo = true;
    store.set(roundCam(map.getCenter(), map.getZoom(), map.getPitch(), map.getBearing()));
    echo = false;
  });

  const fillColor: any = ['match', ['get', 'actor']]; for (const a of d.actors) fillColor.push(a.id, a.color); fillColor.push('#8A8F98');
  const victorColor: any = ['match', ['get', 'victor']]; for (const a of d.actors) victorColor.push(a.id, a.color); victorColor.push('#333');
  const timed: [string, any[] | null][] = [['territory-fill', null], ['territory-outline', null], ['territory-label', ['all', ['==', ['geometry-type'], 'Point'], ['>', ['get', 'area'], ['case', ['==', ['get', 'actor'], '기타중립'], ['step', ['zoom'], 900000, 5, 300000, 7, 80000], ['step', ['zoom'], 250000, 5, 90000, 7, 20000]]]] as any], ['admin-line', null],
    ['settle-major', ['<=', ['get', 'rank'], 1]], ['settle-minor', ['>=', ['get', 'rank'], 2]], ['battle', null], ['pack-battle', null]];
  const filterFor = (base: any[] | null, y: number): any => base ? ['all', base, ...dateWindow(y).slice(1)] : dateWindow(y);
  // 지나온 행군만. valid_to가 먼 미래로 열려 있으면 아직 안 간 구간까지 한 줄로 깔린다.
  const movementFilter = (y: number): any => ['<=', ['coalesce', ['get', 'to_year'], ['get', 'valid_from'], OPEN_PAST], y];

  let loaded = false;
  let tokenMod: typeof import('../token3d') | null = null;
  const peopleTokens = new Map<string, import('../token3d').Token>();
  const tokenRoutes = new Map<string, [number, number][]>();
  let peopleFc: { type: 'FeatureCollection'; features: object[] } = EMPTY_FC;
  let peopleLayerOn = true;
  const portraitQueued = new Set<string>();
  function syncPeopleIcons(fc: { type: 'FeatureCollection'; features: object[] }) {
    if (!map.getStyle()) return;
    if (!map.hasImage('person-fallback')) map.addImage('person-fallback', portraitIcon(null, '#6B6F76', '·'), { pixelRatio: 2 });
    for (const f of fc.features as { properties: { id: string; name: string; color: string; asset: string | null } }[]) {
      const p = f.properties; if (!p?.id) continue;
      const iid = `person-${p.id}`;
      const initial = String(p.name || '·').replace(/\s+/g, '').slice(0, 1);
      if (!map.hasImage(iid)) {
        map.addImage(iid, portraitIcon(null, p.color || '#6B6F76', initial), { pixelRatio: 2 });
        portraitQueued.delete(iid);
      }
      if (!p.asset || portraitQueued.has(iid)) continue;
      portraitQueued.add(iid);
      const img = new Image();
      img.onload = () => {
        if (!map.getStyle()) return;
        const data = portraitIcon(img, p.color || '#6B6F76', initial);
        if (map.hasImage(iid)) map.updateImage(iid, data);
        else map.addImage(iid, data, { pixelRatio: 2 });
      };
      img.src = `${root}${p.asset}`;
    }
  }

  function syncPeopleTokens(fc: { type: 'FeatureCollection'; features: object[] }) {
    if (!tokenMod || !map.getStyle()) return;
    const seen = new Set<string>();
    if (peopleLayerOn) {
      for (const f of fc.features as { properties: { id: string; name: string; color: string; asset: string | null }; geometry: { coordinates: [number, number] } }[]) {
        const p = f.properties; if (!p?.id) continue;
        seen.add(p.id);
        let t = peopleTokens.get(p.id);
        if (!t) {
          // 초상을 말 윗면에 얹는다 — 말이 누구인지 색만으로는 안 갈린다(로마 안에서 편이 갈린다)
          t = tokenMod.createToken(p.color || '#6B6F76', p.name, p.asset ? `${root}${p.asset}` : null);
          const path = tokenRoutes.get(p.id);
          if (path) t.setRoute(path);
          if (!map.getLayer(t.layer.id)) map.addLayer(t.layer);
          peopleTokens.set(p.id, t);
        }
        t.setPosition(f.geometry.coordinates as [number, number]);
      }
    }
    for (const [id, t] of peopleTokens) if (!seen.has(id)) t.setPosition(null);
  }

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
  map.on('zoom', syncTerrain);
  map.on('zoomend', () => { const st = store.get(); if (map.getLayer('alesia-inner')) { const on = showAlesia(st.scene, map.getZoom()); for (const id of LAYER_GROUPS.alesia) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); } }); // 스킨 전환(setStyle)마다 addTerrain이 다시 불려서, 리스너는 여기 한 번만 건다

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
    // 갈리아 교보재. pack-extent-60에만 켠다. Cliopatria가 BC60/51을 안 갈라 줘서 정본 속주 셋만 칠한다.
    if (GALLIA_FREE && !map.getSource('gallia-free')) {
      map.addSource('gallia-free', { type: 'geojson', data: GALLIA_FREE as any });
      map.addLayer({ id: 'gallia-free', type: 'fill', source: 'gallia-free',
        paint: { 'fill-color': '#3E7C4F', 'fill-opacity': 0.28 } }, before);
      map.addLayer({ id: 'gallia-free-line', type: 'line', source: 'gallia-free',
        paint: { 'line-color': '#2F5D3A', 'line-width': 1.5, 'line-opacity': 0.9, 'line-dasharray': [2, 1] } }, before);
      // 같은 소스를 로마색으로 한 겹 더. pack-extent-51에만 켠다 — present.showGalliaRoman 참조.
      // 색은 정본 팔레트에서 꺼낸다(P2: 지도 유채색은 데이터 색뿐). 불투명도는 territory-fill과 같은 0.22.
      const romeColor = d.actors.find(a => a.id === '로마')?.color ?? FALLBACK_COLOR;
      // **속주보다 옅게.** BC 51에 갈리아는 정복됐지만 속주가 아니다 — 갈리아 코마타의 속주
      // 편성은 아우구스투스 때다(BC 27 인구조사, 3분할은 보통 BC 22로 잡고 학계 폭은 27~13).
      // 나르보넨시스(BC 121부터 정식 속주)와 같은 농도로 칠하면 그 차이가 지워진다.
      // 그래서 면은 옅게, 테두리는 점선으로 — 「로마 손에 들어왔으나 아직 속주는 아님」.
      map.addLayer({ id: 'gallia-roman', type: 'fill', source: 'gallia-free',
        paint: { 'fill-color': romeColor, 'fill-opacity': 0.12 } }, before);
      map.addLayer({ id: 'gallia-roman-line', type: 'line', source: 'gallia-free',
        paint: { 'line-color': romeColor, 'line-width': 1.6, 'line-opacity': 0.9, 'line-dasharray': [4, 2] } }, before);
    }
    // 영토 이름(F16): 면적 큰 것부터. 회색(팔레트 밖)은 더 크게 커야 뜬다 — 지도가 이름표로 덮이지 않게.
    map.addLayer({ id: 'territory-label', type: 'symbol', source: 'territory',
      layout: { 'text-field': ['get', 'name'], 'text-font': ['KlokanTech Noto Sans CJK Bold'], 'text-max-width': 7, 'text-padding': 6, 'text-allow-overlap': false,
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, ['case', ['>', ['get', 'area'], 2000000], 13, 11], 7, ['case', ['>', ['get', 'area'], 2000000], 18, 14]],
        'symbol-sort-key': ['-', 0, ['get', 'area']] } as any,
      // 가독성(River: "지리지역 텍스트 가독성이 안 좋다"). 세력색 글자가 같은 색 면 위에 얹혀
      // 대비가 낮았다. 후광을 두껍게 하고 불투명도를 올린다.
      paint: { 'text-color': fillColor, 'text-halo-color': isDark ? '#1B2129' : '#FFFFFF', 'text-halo-width': 2.6, 'text-opacity': 1 },
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
    const storyFilter: any = ['in', ['get', 'id'], ['literal', [...PACK_PLACES]]];
    map.addLayer({ id: 'story-place', type: 'circle', source: 'settlements', minzoom: 3,
      filter: storyFilter,
      paint: { 'circle-radius': hov(6, 2) as any, 'circle-color': '#b8860b',
        'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#111418', '#3a2f22'] as any,
        'circle-stroke-width': hov(1.4, 1) as any, 'circle-opacity': 1 } }, before);
    map.addLayer({ id: 'story-place-label', type: 'symbol', source: 'settlements', minzoom: 3,
      filter: storyFilter,
      layout: { 'text-field': ['get', 'name_ko'], 'text-font': ['KlokanTech Noto Sans CJK Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 12, 6, 15] as any,
        // 고정 anchor면 그 자리가 막혔을 때 이름표가 그냥 사라진다. 네 방향을 주면 옆으로
        // 미끄러져 산다. variable-anchor는 text-offset을 무시하므로 radial-offset을 쓴다.
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 1.05,
        'text-optional': true, 'text-allow-overlap': false },
      paint: { 'text-color': '#3A2F22', 'text-halo-color': isDark ? '#1B2129' : '#FFFFFF', 'text-halo-width': 1.8 } }, before);
    // ── 알레시아 세부(BG 7.68~7.74). 포위선 두 겹이 이 장면의 전부다 —
    //    안쪽은 농성군을, 바깥쪽은 구원군을 막는다. 그 두 선이 보이면 「이중 포위」가 설명된다.
    if (ALESIA?.features?.length && !map.getSource('alesia')) {
      const romeC = d.actors.find(a => a.id === '로마')?.color ?? '#A4243B';
      const gaulC = d.actors.find(a => a.id === '갈리아')?.color ?? '#3E7C4F';
      const only = (...k: string[]) => ['in', ['get', 'kind'], ['literal', k]] as any;
      map.addSource('alesia', { type: 'geojson', data: { type: 'FeatureCollection', features: ALESIA.features } as any });
      const add = (l: maplibregl.LayerSpecification) => map.addLayer({ ...l, layout: { ...(l as any).layout, visibility: 'none' } } as any, before);
      add({ id: 'alesia-plain', type: 'fill', source: 'alesia', filter: only('plain'),
        paint: { 'fill-color': '#C9B98A', 'fill-opacity': 0.25 } } as any);
      add({ id: 'alesia-oppidum', type: 'fill', source: 'alesia', filter: only('oppidum'),
        paint: { 'fill-color': gaulC, 'fill-opacity': 0.45, 'fill-outline-color': gaulC } } as any);
      add({ id: 'alesia-river', type: 'line', source: 'alesia', filter: only('river'),
        paint: { 'line-color': '#5B86A8', 'line-width': 2.4, 'line-opacity': 0.9 } } as any);
      // 바깥선은 점선 — 「밖을 향한 선」임을 선 모양으로 구분한다
      add({ id: 'alesia-outer', type: 'line', source: 'alesia', filter: only('outer_line'),
        paint: { 'line-color': romeC, 'line-width': 3.4, 'line-opacity': 0.95, 'line-dasharray': [3, 1.6] } } as any);
      add({ id: 'alesia-inner', type: 'line', source: 'alesia', filter: only('inner_line'),
        paint: { 'line-color': romeC, 'line-width': 3.4, 'line-opacity': 0.95 } } as any);
      add({ id: 'alesia-redoubt', type: 'circle', source: 'alesia', filter: only('redoubt'),
        paint: { 'circle-radius': 3.4, 'circle-color': romeC, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } } as any);
      add({ id: 'alesia-camp', type: 'circle', source: 'alesia', filter: only('camp'),
        paint: { 'circle-radius': 7, 'circle-color': romeC, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } } as any);
      add({ id: 'alesia-gaulcamp', type: 'circle', source: 'alesia', filter: only('gaul_camp'),
        paint: { 'circle-radius': 8, 'circle-color': gaulC, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } } as any);
      add({ id: 'alesia-label', type: 'symbol', source: 'alesia',
        filter: only('oppidum', 'camp', 'gaul_camp', 'hill', 'river', 'plain', 'inner_line', 'outer_line'),
        layout: { 'text-field': ['get', 'name_ko'], 'text-font': ['KlokanTech Noto Sans CJK Bold'],
          'text-size': 13, 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.9,
          'text-max-width': 9, 'text-optional': true, 'text-allow-overlap': false },
        paint: { 'text-color': '#2B2721', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2.2 } } as any);
    }
    map.addSource('battles', { type: 'geojson', data: d.battles as any, promoteId: 'id' });
    map.addLayer({ id: 'battle', type: 'circle', source: 'battles', paint: { 'circle-radius': hov(7, 2) as any, 'circle-color': victorColor, 'circle-stroke-color': '#fff', 'circle-stroke-width': hov(2, 1) as any, 'circle-opacity': 1 } }, before);
    if (PACK_BATTLES.length && !map.getSource('pack-battles')) {
      map.addSource('pack-battles', { type: 'geojson', data: { type: 'FeatureCollection', features: PACK_BATTLES } as any, promoteId: 'id' });
      map.addLayer({ id: 'pack-battle', type: 'circle', source: 'pack-battles',
        paint: { 'circle-radius': hov(8, 2) as any, 'circle-color': victorColor, 'circle-stroke-color': '#fff', 'circle-stroke-width': hov(2, 1) as any, 'circle-opacity': 1 } }, before);
      map.addLayer({ id: 'pack-battle-label', type: 'symbol', source: 'pack-battles',
        layout: { 'text-field': ['get', 'name_ko'], 'text-font': ['KlokanTech Noto Sans CJK Bold'],
          'text-size': 13, 'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
          'text-radial-offset': 1.1, 'text-optional': true, 'text-allow-overlap': false },
        paint: { 'text-color': '#3A2F22', 'text-halo-color': isDark ? '#1B2129' : '#FFFFFF', 'text-halo-width': 1.8 } }, before);
    }
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
    if (!map.hasImage('person-fallback')) map.addImage('person-fallback', portraitIcon(null, '#6B6F76', '·'), { pixelRatio: 2 });
    // 말은 Three.js 장기말. 이 레이어는 클릭 히트박스 + 이름만(초상 뱃지는 줌 4에서 안 보인다).
    map.addLayer({ id: 'people-dot', type: 'circle', source: 'people',
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 14, 6, 18, 9, 22] as any,
        'circle-color': '#000', 'circle-opacity': 0, 'circle-stroke-width': 0 } }, before);
    map.addLayer({ id: 'people-label', type: 'symbol', source: 'people',
      layout: { 'text-field': ['get', 'name'], 'text-font': ['KlokanTech Noto Sans CJK Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 14, 6, 16, 9, 18] as any,
        // 말이 커질 때마다 여기가 문제가 된다. 얼굴 판을 넣은 뒤 말 반지름이 ~32 CSS px이고,
        // 이름표는 후광까지 그 밖으로 나가야 한다. 말 크기를 바꾸면 여기도 같이 본다.
        'text-offset': [0, 1.9], 'text-anchor': 'top', 'text-optional': false,
        // allow-overlap은 유지한다 — 인물 이름은 무조건 뜬다(R45g). 다만 ignore-placement는
        // 껐다. true면 이 라벨이 충돌 색인에 안 올라가서, 전투·도시 이름표가 인물 이름이
        // 거기 있는 줄도 모르고 위에 겹쳐 찍혔다. pack-greece-48에서 디르하키움·브룬디시가
        // 검은 얼룩이 된 원인이 이것이다. false면 인물 이름이 자리를 점유하므로 남들이 비켜 간다.
        'text-allow-overlap': true, 'text-ignore-placement': false,
        'text-pitch-alignment': 'viewport' },
      paint: { 'text-color': ['get', 'color'], 'text-halo-color': isDark ? '#1B2129' : '#FFFFFF', 'text-halo-width': 2.2 } }, before);
    syncPeopleIcons(peopleFc);

    map.addLayer({ id: 'board-label', type: 'symbol', source: 'board', minzoom: 10,
      layout: { 'text-field': ['get', 'label'], 'text-font': ['KlokanTech Noto Sans CJK Regular'], 'text-size': 11,
        'text-offset': [0, 1.35], 'text-anchor': 'top', 'text-max-width': 8, 'text-allow-overlap': false, 'text-optional': true },
      paint: { 'text-color': ['get', 'color'], 'text-halo-color': isDark ? '#1B2129' : '#FFFFFF', 'text-halo-width': 1.4 } }, before);
    const allMoves = { type: 'FeatureCollection' as const, features: [...d.movements.features, ...PACK_MOVEMENTS] };
    map.addSource('movements', { type: 'geojson', data: allMoves as any });
    map.addLayer({ id: 'movement', type: 'line', source: 'movements', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': fillColor, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.4, 6, 4] as any,
        'line-opacity': 0.92 } }, before);

    // 관계 그래프 오버레이(2.1, 하이브리드): 선택 객체 ↔ 좌표 있는 이웃 선. 좌표 없는 이웃은 GraphPanel.
    map.addSource('ego', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id' });
    map.addLayer({ id: 'ego-edge', type: 'line', source: 'ego', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 1.6, 'line-opacity': 0.85, 'line-dasharray': ['case', ['==', ['get', 'confidence'], 'low'], ['literal', [2, 2]], ['literal', [1, 0]]] } as any });
    // ego-node·ego-label은 없다. setEgo가 만드는 건 LineString뿐인데 두 레이어는 Point로 필터해서
    // 한 번도 그려진 적이 없었다(클릭·hover 핸들러까지 죽은 대상에 걸려 있었다).
    // 선의 끝점은 이미 settle-*·battle 원이고 이름표는 label-settle-*이라 애초에 겹쳐 그릴 것이 없다.
    if (ego) setEgo(ego.sel, ego.name, ego.neighbors);

    // Three.js 장기말은 인물 레이어가 켤 때. 경로가 있으면 그 선을 따라 걷는다.
    tokenRoutes.clear();
    for (const f of allMoves.features) {
      const owner = f.properties.owner as string | undefined;
      const route = f.properties.route as string | undefined;
      if (!owner || !route || tokenRoutes.has(owner)) continue;
      tokenRoutes.set(owner, routeGeometry(allMoves.features, route).path);
    }
    import('../token3d').then(mod => { tokenMod = mod; syncPeopleTokens(peopleFc); }).catch(() => { tokenMod = null; });
    loaded = true; lastYear = null; lastLayers = ''; lastSel = undefined; lastBoard = undefined; lastPhase = undefined; selectedFs = [];
    apply(store.get());
  }
  map.on('load', addData);
  // 클릭 → 선택(store). 패널은 React가 store를 보고 그린다.
  for (const layerId of ['territory-fill', 'admin-line', 'settle-major', 'settle-minor', 'story-place', 'battle', 'pack-battle', 'movement', 'board-unit', 'people-dot', 'landmark-region_labels', 'landmark-marine_labels', 'landmark-pleiades']) {
    map.on('click', layerId, e => {
      const f = e.features?.[0]; if (!f) return;
      if (layerId.startsWith('landmark-')) { // 점 객체가 위에 있으면 그쪽이 이긴다
        if (map.queryRenderedFeatures(e.point, { layers: ['settle-major', 'settle-minor', 'story-place', 'battle', 'pack-battle', 'board-unit', 'people-dot'].filter(l => map.getLayer(l)) }).length) return;
        // 정본 place 아님 — NE·Pleiades 지형지물(제안 대상). Pleiades는 id, NE는 이름.
        // marine_labels(바다 마스크)는 properties가 통째로 비어 있다 — 'landmark:undefined'를 만들지 않는다.
        const key = f.properties.pid ?? f.properties.name;
        if (key != null) store.set({ sel: `landmark:${key}` });
        return; }
      if (layerId === 'territory-fill' && map.queryRenderedFeatures(e.point, { layers: ['settle-major', 'settle-minor', 'story-place', 'battle', 'pack-battle', 'board-unit', 'people-dot', 'landmark-pleiades'].filter(l => map.getLayer(l)) }).length) return;
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
  const SRC_OF: Record<string, string> = { 'territory-fill': 'territory', 'settle-major': 'settlements', 'settle-minor': 'settlements', 'story-place': 'settlements', battle: 'battles', 'pack-battle': 'pack-battles', 'board-unit': 'board', 'people-dot': 'people', 'landmark-region_labels': 'region_labels', 'landmark-marine_labels': 'marine_labels', 'landmark-pleiades': 'landmarks' };
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
    if (sel && map.getSource('pack-battles')) {
      const fs = { source: 'pack-battles', id: sel };
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
    for (const id of ['settle-major', 'settle-minor', 'story-place', 'battle', 'pack-battle']) if (map.getLayer(id)) map.setPaintProperty(id, 'circle-opacity', (selectedFs.length ? dimExpr(0.6) : 1) as any);
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
      for (const [id, base] of timed) if (map.getLayer(id)) map.setFilter(id, filterFor(base, s.year));
      if (map.getLayer('movement')) map.setFilter('movement', movementFilter(s.year) as any);
      if (map.getLayer('pack-battle-label')) map.setFilter('pack-battle-label', dateWindow(s.year) as any);
    }
    const on = new Set(s.layers ?? allLayers(d));
    const key = [...on].join(',');
    peopleLayerOn = on.has('people');
    if (key !== lastLayers || s.board !== lastBoard) {
      lastLayers = key;
      for (const [group, ids] of Object.entries(LAYER_GROUPS)) {
        const vis = group === 'board' ? !!s.board : group === 'labels' ? on.has('labels') : on.has(group);
        for (const id of ids) if (map.getLayer(id)) {
          // 정착지 라벨은 settlements와 labels 둘 다 켜져야 보인다
          const v = id.startsWith('label-settle') || id === 'story-place-label' ? on.has('settlements') && on.has('labels') : vis;
          map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none');
        }
      }
      syncPeopleTokens(peopleLayerOn ? peopleFc : EMPTY_FC);
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
    if (map.getLayer('gallia-free')) {
      const onTerr = s.layers == null || new Set(s.layers).has('territory');
      const showGaul = showGalliaOverlay(s.scene, s.year) && onTerr;
      map.setLayoutProperty('gallia-free', 'visibility', showGaul ? 'visible' : 'none');
      if (map.getLayer('gallia-free-line')) map.setLayoutProperty('gallia-free-line', 'visibility', showGaul ? 'visible' : 'none');
      const showRoman = showGalliaRoman(s.scene, s.year) && onTerr;
      if (map.getLayer('gallia-roman')) map.setLayoutProperty('gallia-roman', 'visibility', showRoman ? 'visible' : 'none');
      if (map.getLayer('gallia-roman-line')) map.setLayoutProperty('gallia-roman-line', 'visibility', showRoman ? 'visible' : 'none');
    }
    hideAnachronisticPlaces(map, s.year);
    if (map.getLayer('alesia-inner')) {
      const on = showAlesia(s.scene, map.getZoom());
      for (const id of LAYER_GROUPS.alesia) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
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
      syncPeopleIcons(peopleFc);
      syncPeopleTokens(peopleFc);
    },
    onData(fn: () => void) { onData = fn; },
    flyTo(sc: Scene) { if (sc.center) map.flyTo({ center: sc.center, zoom: sc.zoom, pitch: store.get().view === '2d' ? 0 : (sc.pitch ?? pitch3d), bearing: store.get().view === '2d' ? 0 : (sc.bearing ?? bearing3d), duration: dur(1400), essential: true }); },
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
