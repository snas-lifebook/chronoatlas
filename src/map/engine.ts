// 지도 엔진 (TASKS 1.3·1.8): MapLibre + 데이터 레이어 + 토큰. store만 구독한다 — React 크롬과는 store로만 이야기한다.
import * as maplibregl from 'maplibre-gl';
import { type Dataset, dateWindow, OPEN_PAST, routeGeometry } from '../schema';
import { buildStyle, type Skin } from './style';
import { rememberPitch3d, roundCam, type Store, type Scene, type State } from '../state';
import type { Neighbor } from '../graph/data';
import { ARM_KO, FALLBACK_COLOR, phaseOf, unitsGeoJSON, type BoardData } from '../board';
import { showAlesia, showAlexandria, showGalliaOverlay, showGalliaRoman, showRomaUrbs } from '../present';
import { curveMovements } from '../routes';
import { ALESIA, ALEXANDRIA, ROMA_URBS, PACK_BATTLES, PACK_MOVEMENTS, PACK_PLACES, hiddenAdmin, hiddenPlaces } from '../packData';

const GALLIA_FREE = Object.values(import.meta.glob('../../data/overlays/gallia-free.json', { eager: true, import: 'default' }))[0] as { type: string; features: object[] } | undefined;

// 9였다. 베이스맵이 거기서 바닥나기 때문인데, **세부 오버레이가 생기면서 천장이 막이 됐다** —
// 알레시아 포위선은 z12.4, 로마 시내는 z14가 있어야 보이는데 z9에서 잘려 영영 도달할 수 없었다.
// 말판이 같은 이유로 이미 12로 올려 두고 있었다. 그 위는 지형 음영이 흐려지지만
// 그 축척의 내용은 벡터 오버레이가 댄다.
const MAP_MAX_ZOOM = 15;
const BOARD_MAX_ZOOM = 12; // 칸나이 전장 ~5km. z9면 유닛이 한 점에 겹친다.
// 경로가 다 옅어지는 데 걸리는 해. 카이사르 원정이 기원전 58~45년 열세 해라
// 8이면 발표 장면 안에서 「올해 · 최근 · 옛날」 세 단계가 눈에 갈린다.
const FADE_SPAN = 8;
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

/** 군기(vexillum). 장대에 가로대, 거기 늘어뜨린 네모 깃발, 그 위에 군단 수.
 *  로마 군단기가 장대에 가로대를 달고 천을 늘어뜨린 형태라 그 실루엣을 따랐다.
 *  숫자를 깃발에 박아 「몇 개인지」가 말 옆에서 바로 읽힌다. */
function standardIcon(color: string, n: number | null): ImageData {
  const W = 72, H = 84, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#3A2F22'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(14, 8); g.lineTo(14, H - 6); g.stroke();
  g.beginPath(); g.moveTo(6, 16); g.lineTo(60, 16); g.stroke();
  g.fillStyle = color; g.strokeStyle = '#FFFFFF'; g.lineWidth = 3;
  g.beginPath(); g.rect(16, 20, 44, 38); g.fill(); g.stroke();
  if (n != null && n > 0) {
    g.fillStyle = '#FFFFFF';
    g.font = `700 ${n >= 10 ? 26 : 30}px sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), 38, 40);
  }
  return g.getImageData(0, 0, W, H);
}

/** 경로 화살촉. 선 위를 따라 일정 간격으로 앉는다(symbol-placement: 'line').
 *  속을 채우지 않고 갈매기(chevron) 두 획으로 그린다 — 채운 삼각형은 연한 선 위에서
 *  저 혼자 진해져 점렬처럼 보인다. 획이면 선의 일부로 읽힌다. */
function arrowIcon(color: string): ImageData {
  const W = 28, H = 28, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#FFFFFF'; g.lineWidth = 7;   // 종이색 테 — 영토 위에서도 화살표가 산다
  g.beginPath(); g.moveTo(9, 7); g.lineTo(20, 14); g.lineTo(9, 21); g.stroke();
  g.strokeStyle = color; g.lineWidth = 3.6;
  g.beginPath(); g.moveTo(9, 7); g.lineTo(20, 14); g.lineTo(9, 21); g.stroke();
  return g.getImageData(0, 0, W, H);
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
  // 정본 전투 전부. 지중해 판에서 **69개가 한꺼번에** 뜬다 — 대부분 이 발표와 무관한
  // 다른 세기의 전투다. 그래서 팩 장면은 이걸 안 켜고 story_battles만 켠다.
  battles: ['battle'],
  // 이 발표가 말하는 전투 넷(알레시아·파르살루스·젤라·문다). 교보재 오버레이라 수가 적다.
  story_battles: ['pack-battle', 'pack-battle-label'],
  movements: ['movement', 'movement-halo', 'movement-arrow'],
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
  people: ['people-dot', 'people-pad', 'people-label', 'people-standard', 'people-force'],
  // 알레시아 세부(포위선 두 겹·진영 8·보루 23). 그 장면에서만 켠다 — present.showAlesia
  alesia: ['alesia-plain', 'alesia-oppidum', 'alesia-river', 'alesia-outer', 'alesia-inner',
           'alesia-redoubt', 'alesia-camp', 'alesia-gaulcamp', 'alesia-label'],
  // 로마 시내 미시 지도. 줌 12 이상에서 자동으로. 포메리움이 이 지도의 요점이다 —
  // 장군이 무장한 채 넘을 수 없던 선이고, 루비콘이 왜 사건인지가 거기서 설명된다.
  roma: ['roma-field', 'roma-hill', 'roma-pomerium', 'roma-wall', 'roma-river', 'roma-road',
         'roma-site', 'roma-ides', 'roma-label'],
  // 알렉산드리아 미시 지도. 헵타스타디온이 이 지도의 요점이다 — 섬과 본토를 잇는 둑길
  // 하나가 항구를 둘로 가르고, 카이사르의 알렉산드리아 전쟁이 그 둑길에서 갈렸다.
  alexandria: ['alx-lake', 'alx-harbor', 'alx-island', 'alx-district', 'alx-causeway',
               'alx-road', 'alx-site', 'alx-siege', 'alx-label'],
};
// 정착지 레이어에 연도 필드가 없어서(220개 전부) 기원전 지도에 후대 이름이 섞인다.
// 실제로 BC 48 지도에 「콘스탄티노플」(AD 330 봉헌)이 떴다. 교보재 목록에 있는 것만,
// 그 해가 되기 전이면 가린다.
//
// **원래 필터를 지도에서 되읽으면 안 된다.** 이 함수는 apply() 안에서 `timed` 루프
// **뒤에** 돈다. 그 시점의 필터에는 이미 그 해의 dateWindow가 섞여 있어서, 그걸 「원래
// 것」으로 캐시해 두면 해가 바뀌어도 **첫 해의 창이 계속 덧씌워진다** — settle-major와
// admin-line의 연도 필터가 통째로 얼어붙는다(나르보넨시스 valid_from -121도 같이).
// 그래서 시간 필터를 쓰는 레이어는 `timed` 표의 원본을 보고 여기서 직접 조립한다.
const BASE_FILTER = new Map<string, unknown>();
// 미시 지도 레이어의 **원래** 필터(kind 분류). built_year 조건을 AND로 덧붙일 때 쓴다.
const UNBUILT_BASE = new Map<string, unknown>();
function hideAnachronisticPlaces(map: maplibregl.Map, year: number,
                                 timedBase: (id: string) => { timed: boolean; base: any },
                                 compose: (base: any, y: number) => any) {
  const hide = hiddenPlaces(year);
  const apply = (id: string, out: string[]) => {
    const t = timedBase(id);
    let base: any;
    if (t.timed) base = compose(t.base, year);
    else {
      if (!BASE_FILTER.has(id)) BASE_FILTER.set(id, map.getFilter(id) ?? null);
      base = BASE_FILTER.get(id);
    }
    const excl: any = ['!', ['in', ['get', 'id'], ['literal', out]]];
    map.setFilter(id, (out.length ? (base ? ['all', base, excl] : excl) : base) as any);
  };
  // 속주 경계에도 같은 구멍이 있다 — 아우구스투스 속주 셋이 연도 없이 늘 그려진다.
  if (map.getLayer('admin-line')) apply('admin-line', hiddenAdmin(year));
  for (const id of LAYER_GROUPS.settlements) {
    if (!map.getLayer(id)) continue;
    // story-place-label이 이미 크게 쓰는 이름을 label-settle-*가 또 쓴다. 발표 줌에서
    // rank2를 켜면서 「로마」·「알렉산드리아」가 두 번 찍혔다. 겹치는 쪽을 뺀다.
    // story-place-label이 이미 크게 쓰는 이름을 label-settle-*가 또 쓴다.
    // 그리고 전투점 교보재에 place:일레르다처럼 **정착지와 같은 id**가 있어서
    // story-place-label과 pack-battle-label이 같은 이름을 두 번 찍었다.
    const battleIds = PACK_BATTLES.map(f => String((f as { properties: { id?: string } }).properties?.id ?? ''));
    const dup = id.startsWith('label-settle') ? [...PACK_PLACES]
      : id === 'story-place-label' ? battleIds : [];
    apply(id, [...hide, ...dup]);
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

  /** 컨테이너 배경을 지금 스킨의 바다색으로 맞춘다.
   *
   *  **지형(DEM)을 켜면 커버리지 밖이 통째로 투명해진다.** `setTerrain()` 뒤에는 background
   *  레이어조차 DEM 타일이 없는 곳에 안 그려진다 — 실측으로 경도 -15 서쪽 대서양이
   *  알파 0이 되고, 페이지 배경이 흰색이라 **바다가 흰 얼룩으로** 보인다.
   *  `scripts/shoot-pack.py`가 내보낼 때 바다색으로 받치고 있던 그 구멍이다.
   *
   *  지금 github.io에는 타일이 없어서(용량·라이선스로 .gitignore) 이 증상이 안 나지만,
   *  타일을 올리는 날 조용히 되살아난다. 컨테이너 배경 한 줄이면 어느 쪽이든 바다로 읽힌다. */
  function syncBackdrop() {
    const bg = map.getStyle()?.layers?.find(l => l.type === 'background');
    const c = (bg as { paint?: { 'background-color'?: string } } | undefined)?.paint?.['background-color'];
    if (typeof c === 'string') container.style.background = c;
  }
  map.on('style.load', syncBackdrop);
  map.once('load', syncBackdrop);

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
  const timed: [string, any[] | null][] = [['territory-fill', null], ['territory-outline', null], ['territory-label', ['all', ['==', ['geometry-type'], 'Point'], ['>', ['get', 'area'], ['case', ['==', ['get', 'actor'], '기타중립'], ['step', ['zoom'], 900000, 5, 300000, 7, 80000], ['step', ['zoom'], 80000, 7, 20000]]]] as any], ['admin-line', null],
    ['settle-major', ['<=', ['get', 'rank'], 1]], ['settle-minor', ['>=', ['get', 'rank'], 2]], ['battle', null], ['pack-battle', null]];
  const filterFor = (base: any[] | null, y: number): any => base ? ['all', base, ...dateWindow(y).slice(1)] : dateWindow(y);
  // 지나온 행군만. valid_to가 먼 미래로 열려 있으면 아직 안 간 구간까지 한 줄로 깔린다.
  const movementFilter = (y: number): any => ['<=', ['coalesce', ['get', 'to_year'], ['get', 'valid_from'], OPEN_PAST], y];
  // 그 해로부터 얼마나 지난 구간인가(0 = 올해, 1 = FADE_SPAN년 전 이상).
  const legAge = (y: number): any =>
    ['min', 1, ['max', 0, ['/', ['-', y, ['coalesce', ['get', 'to_year'], ['get', 'valid_from'], y]], FADE_SPAN]]];
  /** 경로를 나이순으로 재운다. River: "조금 연할 필요가 있고."
   *  올해 구간 0.78 → 여덟 해 전 0.14. 굵기와 테도 같이 줄어 세 층이 한 몸으로 옅어진다. */
  function fadeMovements(y: number) {
    const a = legAge(y);
    const lerp = (hi: number, lo: number): any => ['interpolate', ['linear'], a, 0, hi, 1, lo];
    // 굵기는 줌과 나이 둘 다에 걸린다. **zoom interpolate를 곱 안에 넣으면 안 된다** —
    // MapLibre가 거부하고 그 속성만 조용히 안 먹는다(people-label은 같은 실수로 레이어째
    // 사라졌다). 곱을 각 줌 정점의 출력 쪽에 넣으면 zoom이 최상위 입력으로 남는다.
    const byZoom = (lo: number, hi: number, fade: any): any =>
      ['interpolate', ['linear'], ['zoom'], 3, ['*', lo, fade], 6, ['*', hi, fade]];
    if (map.getLayer('movement')) {
      map.setPaintProperty('movement', 'line-opacity', lerp(0.78, 0.14) as any);
      map.setPaintProperty('movement', 'line-width', byZoom(1.6, 2.6, lerp(1, 0.62)));
    }
    if (map.getLayer('movement-halo')) {
      map.setPaintProperty('movement-halo', 'line-opacity', lerp(0.5, 0.1) as any);
      map.setPaintProperty('movement-halo', 'line-width', byZoom(5, 8, lerp(1, 0.62)));
    }
    // 화살표는 **올해 구간에만** 남긴다. 열세 구간에 전부 찍으면 화살촉이 예순 개가 되어
    // 연하게 만든 보람이 없다. 방향이 필요한 것은 지금 움직이는 줄기 하나다.
    if (map.getLayer('movement-arrow')) map.setFilter('movement-arrow',
      ['all', movementFilter(y), ['>=', ['coalesce', ['get', 'to_year'], ['get', 'valid_from'], OPEN_PAST], y - 1]] as any);
  }

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
    for (const f of fc.features as { properties: { id: string; name: string; color: string; asset: string | null; legions?: number | null } }[]) {
      const p = f.properties; if (!p?.id) continue;
      const iid = `person-${p.id}`;
      const initial = String(p.name || '·').replace(/\s+/g, '').slice(0, 1);
      // 군기 — 세력색 × 군단 수 조합마다 하나. 조합이 몇 개 안 된다.
      const lg = (p as { legions?: number | null }).legions ?? null;
      const sid = `std-${p.color}-${lg ?? 0}`;
      if (lg != null && lg > 0 && !map.hasImage(sid)) map.addImage(sid, standardIcon(p.color || '#6B6F76', lg), { pixelRatio: 2 });
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
      for (const f of fc.features as { properties: { id: string; name: string; color: string; asset: string | null; scale?: number }; geometry: { coordinates: [number, number] } }[]) {
        const p = f.properties; if (!p?.id) continue;
        seen.add(p.id);
        let t = peopleTokens.get(p.id);
        if (!t) {
          // 초상을 말 윗면에 얹는다 — 말이 누구인지 색만으로는 안 갈린다(로마 안에서 편이 갈린다)
          // scale은 주역 1 · 조역 0.62(people.COMPANION_SCALE). 사람마다 고정이라 생성 때 한 번.
          t = tokenMod.createToken(p.color || '#6B6F76', p.name, p.asset ? `${root}${p.asset}` : null, p.scale ?? 1);
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
  // 세부 지도 둘은 **줌으로** 켠다 — 발표 장면 수는 아홉으로 묶여 있고(River),
  // 세부는 「거기로 들어가면 보인다」가 맞는 동작이다.
  function syncDetailMaps(scene: string | null) {
    const z = map.getZoom();
    const set = (ids: string[], on: boolean) => { for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };
    if (map.getLayer('alesia-inner')) set(LAYER_GROUPS.alesia, showAlesia(scene, z));
    if (map.getLayer('roma-pomerium')) set(LAYER_GROUPS.roma, showRomaUrbs(z));
    // 알렉산드리아와 로마는 문턱이 같다(z12). 둘 다 켜지면 화면에 없는 쪽은 그냥 안 보인다 —
    // 지도 밖이라 그린 것이 없다. 굳이 위치로 가르지 않는다(콜아웃은 위치까지 본다).
    if (map.getLayer('alx-causeway')) set(LAYER_GROUPS.alexandria, showAlexandria(z));
    // 미시 축척에서 **이동 경로를 끈다.** 지중해를 건너는 자취라 도시 지도에서는 화면을
    // 통째로 가로지르는 붉은 선 몇 개일 뿐이다 — 알렉산드리아 시내 판에서 실제로 그랬다.
    // 층 자체를 끄지 않고 여기서만 가린다(넓은 축척으로 나가면 다시 켜진다).
    const micro = showRomaUrbs(z) || showAlexandria(z) || showAlesia(scene, z);
    if (micro) set(LAYER_GROUPS.movements, false);
  }
  map.on('zoomend', () => syncDetailMaps(store.get().scene)); // 스킨 전환(setStyle)마다 addTerrain이 다시 불려서, 리스너는 여기 한 번만 건다

  /** 그 해에 아직 안 세워진 건물을 가린다.
   *
   *  미시 지도 피처에 `built_year`가 달려 있는데 **아무도 안 보고 있었다.** 그래서
   *  카이사레움(기원전 30년대 착수)이 **기원전 47년 알렉산드리아 판에** 서 있었고,
   *  폼페이우스 극장(기원전 55년 봉헌)이 기원전 60년 로마 판에 서 있었다. 정착지·속주에
   *  냈던 것과 같은 구멍인데 이쪽은 **데이터가 이미 연도를 들고 있다** — 지어낼 것이 없고
   *  필터 한 줄이면 된다. 연도가 없는 피처(대부분)는 늘 보인다. */
  function hideUnbuilt(year: number) {
    const f: any = ['any', ['!', ['has', 'built_year']], ['<=', ['get', 'built_year'], year]];
    for (const id of [...LAYER_GROUPS.roma, ...LAYER_GROUPS.alexandria]) {
      if (!map.getLayer(id)) continue;
      const base = UNBUILT_BASE.get(id) ?? (UNBUILT_BASE.set(id, map.getFilter(id) ?? null), map.getFilter(id) ?? null);
      map.setFilter(id, (base ? ['all', base, f] : f) as any);
    }
  }

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
    // 미시 축척에서는 영역 채움을 걷어낸다. 도시 지도 전체에 깔린 세력색 한 겹이
    // 지형 음영과 건물 색을 통째로 덮어 **분홍 베일**이 된다 — 로마 시내 판이 그랬다.
    // 그 축척에서 「여기가 로마 땅」은 이미 자명하고, 정작 봐야 할 것은 언덕과 성벽이다.
    // 곱을 zoom interpolate **밖에** 두면 MapLibre가 거부하므로 정점마다 값을 따로 준다.
    const terrOpacity = (k: number): any =>
      ['case', ['boolean', ['feature-state', 'hover'], false], 0.45 * k, ['==', ['get', 'actor'], '기타중립'], 0.1 * k, 0.22 * k];
    map.addLayer({ id: 'territory-fill', type: 'fill', source: 'territory',
      paint: { 'fill-color': fillColor,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, terrOpacity(1), 12, terrOpacity(0.25)] as any } }, before);
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
    //
    // **일반 액터 문턱 250,000 → 80,000.** River: "마우레타니아, 갈라티아나 이런 국가나
    // 부족들도 지도 상에서 텍스트로 국가 이름이 나오면 좋겠어. 안 나오니까 답답함."
    // 실측하면 아홉 해 내내 이름이 뜨는 것이 **넷뿐**이었다(파르티아·로마·인도스키타이·
    // 프톨레마이오스). 화면에 색칠된 나라는 열아홉인데.
    //
    // 80,000에서 정확히 다섯이 더 뜬다 — 마우레타니아·누미디아 왕국·카파도키아 왕국·
    // 갈라티아·폰토스 왕국. **그 아래로 더 내려도(50,000·20,000) 늘어나는 것이 없다.**
    // 기타중립 문턱(900,000)은 **일부러 안 건드렸다** — 그쪽을 내리면 정본의 미번역 이름
    // 아홉(Caucasian Albania·Himyarite Kingdom·Kingdom of Osroene…)이 한글 판에 샌다.
    // 지금 추천으로는 영문 유입 0건이다.
    map.addLayer({ id: 'territory-label', type: 'symbol', source: 'territory',
      layout: { 'text-field': ['get', 'name'], 'text-font': ['KlokanTech Noto Sans CJK Bold'], 'text-max-width': 7, 'text-padding': 6, 'text-allow-overlap': false,
        // 고정 anchor면 자리가 막혔을 때 이름표가 그냥 사라진다. 갈라티아가 카파도키아 왕국과
        // 상자가 겹쳐 여덟 해 내내 그럴 위험이 있다(실측). 네 방향을 주면 옆으로 미끄러져 산다.
        'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.6,
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, ['case', ['>', ['get', 'area'], 2000000], 13, 11], 7, ['case', ['>', ['get', 'area'], 2000000], 18, 14]],
        'symbol-sort-key': ['-', 0, ['get', 'area']] } as any,
      // 가독성(River: "지리지역 텍스트 가독성이 안 좋다"). 세력색 글자가 같은 색 면 위에 얹혀
      // 대비가 낮았다. 후광을 두껍게 하고 불투명도를 올린다.
      paint: { 'text-color': fillColor, 'text-halo-color': isDark ? '#1B2129' : '#FFFFFF', 'text-halo-width': 2.6, 'text-opacity': 1 },
      filter: ['>', ['get', 'area'], ['case', ['==', ['get', 'actor'], '기타중립'], ['step', ['zoom'], 900000, 5, 300000, 7, 80000], ['step', ['zoom'], 80000, 7, 20000]]] as any }, before);
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
    // ── 로마 시내(공화정 말기). 암살 자리는 따로 표시한다.
    if (ROMA_URBS?.features?.length && !map.getSource('roma-urbs')) {
      const romeC = d.actors.find(a => a.id === '로마')?.color ?? '#A4243B';
      const kin = (...k: string[]) => ['in', ['get', 'kind'], ['literal', k]] as any;
      map.addSource('roma-urbs', { type: 'geojson', data: { type: 'FeatureCollection', features: ROMA_URBS.features } as any });
      const addR = (l: object) => map.addLayer({ ...(l as object), layout: { ...((l as { layout?: object }).layout ?? {}), visibility: 'none' } } as any, before);
      addR({ id: 'roma-field', type: 'fill', source: 'roma-urbs', filter: kin('field', 'circus', 'forum'),
        paint: { 'fill-color': '#C9B98A', 'fill-opacity': 0.3 } });
      addR({ id: 'roma-hill', type: 'fill', source: 'roma-urbs', filter: kin('hill'),
        paint: { 'fill-color': '#9C8C63', 'fill-opacity': 0.28, 'fill-outline-color': '#6B6353' } });
      // 포메리움 — 무장한 장군이 넘을 수 없던 선. 점선으로, 성벽과 구분되게.
      addR({ id: 'roma-pomerium', type: 'line', source: 'roma-urbs', filter: kin('boundary'),
        paint: { 'line-color': '#7A3E8C', 'line-width': 3, 'line-dasharray': [4, 2], 'line-opacity': 0.95 } });
      addR({ id: 'roma-wall', type: 'line', source: 'roma-urbs', filter: kin('wall'),
        paint: { 'line-color': '#4A4538', 'line-width': 3.2, 'line-opacity': 0.9 } });
      addR({ id: 'roma-river', type: 'line', source: 'roma-urbs', filter: kin('river'),
        paint: { 'line-color': '#5B86A8', 'line-width': 4, 'line-opacity': 0.9 } });
      addR({ id: 'roma-road', type: 'line', source: 'roma-urbs', filter: kin('road'),
        paint: { 'line-color': '#8A7B5C', 'line-width': 2.2, 'line-dasharray': [6, 3], 'line-opacity': 0.8 } });
      addR({ id: 'roma-site', type: 'circle', source: 'roma-urbs', filter: kin('temple', 'theatre', 'building', 'gate'),
        paint: { 'circle-radius': 5, 'circle-color': '#b8860b', 'circle-stroke-color': '#3a2f22', 'circle-stroke-width': 1.4 } });
      // 3월 15일 자리
      addR({ id: 'roma-ides', type: 'circle', source: 'roma-urbs', filter: ['==', ['get', 'assassination'], true] as any,
        paint: { 'circle-radius': 11, 'circle-color': romeC, 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
      addR({ id: 'roma-label', type: 'symbol', source: 'roma-urbs',
        layout: { 'text-field': ['get', 'name_ko'], 'text-font': ['KlokanTech Noto Sans CJK Bold'],
          'text-size': 13, 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.9,
          'text-max-width': 9, 'text-optional': true, 'text-allow-overlap': false },
        paint: { 'text-color': '#2B2721', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2.2 } });
    }
    // ── 알렉산드리아(기원전 48~47). 카이사르가 갇혀 싸운 도시다.
    if (ALEXANDRIA?.features?.length && !map.getSource('alexandria')) {
      const romeC = d.actors.find(a => a.id === '로마')?.color ?? '#A4243B';
      const kin = (...k: string[]) => ['in', ['get', 'kind'], ['literal', k]] as any;
      map.addSource('alexandria', { type: 'geojson', data: { type: 'FeatureCollection', features: ALEXANDRIA.features } as any });
      const addA = (l: object) => map.addLayer({ ...(l as object), layout: { ...((l as { layout?: object }).layout ?? {}), visibility: 'none' } } as any, before);
      addA({ id: 'alx-lake', type: 'fill', source: 'alexandria', filter: kin('lake'),
        paint: { 'fill-color': '#7FA6BE', 'fill-opacity': 0.35 } });
      // 항구는 물이다 — 호수보다 짙게 해서 「바다에서 파고든 만」으로 읽히게.
      addA({ id: 'alx-harbor', type: 'fill', source: 'alexandria', filter: kin('harbor'),
        paint: { 'fill-color': '#5B86A8', 'fill-opacity': 0.3 } });
      addA({ id: 'alx-island', type: 'fill', source: 'alexandria', filter: kin('island'),
        paint: { 'fill-color': '#C9B98A', 'fill-opacity': 0.34, 'fill-outline-color': '#8A7B5C' } });
      addA({ id: 'alx-district', type: 'fill', source: 'alexandria', filter: kin('district'),
        paint: { 'fill-color': '#9C8C63', 'fill-opacity': 0.22, 'fill-outline-color': '#6B6353' } });
      // 헵타스타디온 — 7스타디온(약 1.2km) 둑길. 굵게, 실선으로. 이 지도의 주인공이다.
      addA({ id: 'alx-causeway', type: 'line', source: 'alexandria', filter: kin('causeway'),
        paint: { 'line-color': '#6B5D45', 'line-width': 6, 'line-opacity': 0.95 } });
      addA({ id: 'alx-road', type: 'line', source: 'alexandria', filter: kin('road'),
        paint: { 'line-color': '#8A7B5C', 'line-width': 2.6, 'line-dasharray': [6, 3], 'line-opacity': 0.85 } });
      addA({ id: 'alx-site', type: 'circle', source: 'alexandria', filter: kin('lighthouse', 'building', 'temple', 'cape'),
        paint: { 'circle-radius': 6, 'circle-color': '#b8860b', 'circle-stroke-color': '#3a2f22', 'circle-stroke-width': 1.4 } });
      // 알렉산드리아 전쟁의 세 자리. `roma-ides`(3월 15일 자리)와 같은 역할이다 —
      // 함대 소각(대항구) · 카이사르가 갇힌 곳(브루케이온) · 수영 탈출(파로스 등대).
      // 데이터가 플래그로 표시해 뒀고(pack-alexandria.json), 이 세 점이 그 전쟁의 줄기다.
      addA({ id: 'alx-siege', type: 'circle', source: 'alexandria',
        filter: ['any', ['==', ['get', 'fleet_fire'], true], ['==', ['get', 'siege'], true], ['==', ['get', 'caesar_swim'], true]] as any,
        paint: { 'circle-radius': 11, 'circle-color': romeC, 'circle-stroke-color': '#fff', 'circle-stroke-width': 3, 'circle-opacity': 0.85 } });
      addA({ id: 'alx-label', type: 'symbol', source: 'alexandria',
        layout: { 'text-field': ['get', 'name_ko'], 'text-font': ['KlokanTech Noto Sans CJK Bold'],
          'text-size': 13, 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.9,
          'text-max-width': 9, 'text-optional': true, 'text-allow-overlap': false },
        paint: { 'text-color': '#2B2721', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2.2 } });
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
          'text-radial-offset': 1.4, 'text-optional': true, 'text-allow-overlap': false },
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
    // **말의 발자국.** 장기말은 Three.js custom layer라 MapLibre 충돌 색인에 없다. 그래서
    // 도시·전투 이름표가 말이 거기 있는 줄도 모르고 말 밑으로 깔린다 — 기원전 48년 판에서
    // 「파르살루스」와 「그리스」가 카이사르 얼굴에 반쯤 묻혔다. 투명 아이콘을 말 크기로
    // 한 겹 얹어 자리만 점유한다. 그리는 것은 없고(opacity 0) 남들이 비켜 가기만 한다.
    if (!map.hasImage('token-pad')) {
      const pc = document.createElement('canvas'); pc.width = pc.height = 72;
      map.addImage('token-pad', pc.getContext('2d')!.getImageData(0, 0, 72, 72), { pixelRatio: 2 });
    }
    map.addLayer({ id: 'people-pad', type: 'symbol', source: 'people',
      layout: { 'icon-image': 'token-pad', 'icon-size': ['*', 1.15, ['coalesce', ['get', 'scale'], 1]],
        'icon-allow-overlap': true, 'icon-ignore-placement': false } as any,
      paint: { 'icon-opacity': 0 } }, before);
    map.addLayer({ id: 'people-label', type: 'symbol', source: 'people',
      layout: { 'text-field': ['get', 'name'], 'text-font': ['KlokanTech Noto Sans CJK Bold'],
        // 조역은 이름도 작다(scale 0.62). 말만 줄이고 이름을 그대로 두면 작은 말 옆에
        // 큰 이름이 붙어 오히려 조역이 더 눈에 띈다. offset은 em 단위라 같이 줄어든다.
        //
        // **배율을 interpolate 밖에서 곱하면 안 된다.** `['*', k, ['interpolate', …['zoom']…]]`은
        // MapLibre가 「zoom 표현식은 최상위 step/interpolate의 입력으로만」이라며 거부하고,
        // addLayer가 조용히 **레이어를 안 만든다**. 실제로 그 한 줄 때문에 인물 이름표가
        // 통째로 사라진 채로 지도가 멀쩡히 떴다(에러 이벤트만 나고 화면은 그대로다).
        // 그래서 곱은 **출력 쪽에** 넣는다 — zoom은 여전히 최상위 입력이다.
        'text-size': ['interpolate', ['linear'], ['zoom'],
          3, ['*', 14, ['coalesce', ['get', 'scale'], 1]],
          6, ['*', 16, ['coalesce', ['get', 'scale'], 1]],
          9, ['*', 18, ['coalesce', ['get', 'scale'], 1]]] as any,
        // 말이 커질 때마다 여기가 문제가 된다. 얼굴 판을 넣은 뒤 말 반지름이 ~32 CSS px이고,
        // 이름표는 후광까지 그 밖으로 나가야 한다. 말 크기를 바꾸면 여기도 같이 본다.
        // 한 칸에 여럿이면 이름이 서로 위에 겹쳐 찍힌다. 말을 더 벌려서는 못 푼다 —
        // 한글 이름표가 150px쯤이라 안 겹치게 벌리면 폼페이우스가 리비아로 간다.
        // 그래서 **이름을 말 둘레 바깥으로 돌려 붙인다**(people.labelSide). 혼자면 예전대로 아래.
        'text-offset': ['array', 'number', 2, ['get', 'nameOffset']],
        'text-anchor': ['coalesce', ['get', 'anchor'], 'top'], 'text-optional': false,
        // allow-overlap은 유지한다 — 인물 이름은 무조건 뜬다(R45g). 다만 ignore-placement는
        // 껐다. true면 이 라벨이 충돌 색인에 안 올라가서, 전투·도시 이름표가 인물 이름이
        // 거기 있는 줄도 모르고 위에 겹쳐 찍혔다. pack-greece-48에서 디르하키움·브룬디시가
        // 검은 얼룩이 된 원인이 이것이다. false면 인물 이름이 자리를 점유하므로 남들이 비켜 간다.
        'text-allow-overlap': true, 'text-ignore-placement': false,
        'text-pitch-alignment': 'viewport' },
      paint: { 'text-color': ['get', 'color'], 'text-halo-color': isDark ? '#1B2129' : '#FFFFFF', 'text-halo-width': 2.2 } }, before);
    // 군기 + 병력. **말 위로 세로로 쌓는다** — 깃발 / 말 / 이름 / 병력.
    //
    // 예전에는 깃발이 오른쪽(anchor bottom-left, offset [26,10])에 섰다. 그러면 옆에 다른
    // 말이 있을 때 깃발이 **그쪽으로 걸어 들어간다** — 기원전 52년에 카이사르의 10군단기가
    // 80px 떨어진 베르킹게토릭스를 절반 덮었다. 머리 위는 옆 사람과 안 싸우고, 실제로도
    // 군기는 장군 뒤에 서는 물건이라 그림으로도 맞다.
    //
    // icon-offset은 icon-size를 곱한 뒤 픽셀이 된다. 그래서 size에 scale을 물리면
    // 조역의 깃발은 작아지면서 **자리도 같이 당겨져** 작은 말에 딱 붙는다.
    map.addLayer({ id: 'people-standard', type: 'symbol', source: 'people',
      filter: ['>', ['coalesce', ['get', 'legions'], 0], 0] as any,
      layout: { 'icon-image': ['concat', 'std-', ['get', 'color'], '-', ['to-string', ['get', 'legions']]],
        'icon-size': ['*', 0.7, ['coalesce', ['get', 'scale'], 1]], 'icon-anchor': 'bottom', 'icon-offset': [0, -30],
        // ignore-placement를 껐다. true면 깃발이 충돌 색인에 안 올라가서 **도시 이름표가
        // 깃발이 거기 있는 줄도 모르고 밑으로 깔린다**(River: "지명이나 지리나 도시 위치를
        // 가리면 안 된다"). false면 깃발이 자리를 점유하므로 이름표들이 비켜 간다.
        // allow-overlap은 유지 — 군기는 무조건 뜬다, 다만 남이 피해 간다.
        'icon-allow-overlap': true, 'icon-ignore-placement': false } as any }, before);
    map.addLayer({ id: 'people-force', type: 'symbol', source: 'people',
      filter: ['has', 'force'] as any,
      layout: { 'text-field': ['coalesce', ['get', 'force'], ''], 'text-font': ['KlokanTech Noto Sans CJK Bold'],
        // 이름표가 1.9em(24px 기준 46px)에 앉고 높이가 있으니 그 아래로 확실히 내린다
        'text-size': ['*', 12, ['coalesce', ['get', 'scale'], 1]] as any,
        'text-offset': ['array', 'number', 2, ['get', 'forceOffset']],
        'text-anchor': ['coalesce', ['get', 'anchor'], 'top'],
        'text-allow-overlap': true, 'text-optional': true, 'text-pitch-alignment': 'viewport' } as any,
      paint: { 'text-color': ['get', 'color'] as any, 'text-halo-color': isDark ? '#1B2129' : '#FFFFFF', 'text-halo-width': 2.4 } }, before);
    syncPeopleIcons(peopleFc);
    // **이야기 전투 이름을 도시 이름보다 먼저 놓는다.** MapLibre는 스타일 배열 순서대로
    // 자리를 잡아서, 먼저 온 레이어가 자리를 이긴다. 정착지 이름표가 먼저라 기원전 48년
    // 판에서 「라리사」가 자리를 먹고 **정작 그 장면의 제목인 「파르살루스」가 사라졌다.**
    // 그린 뒤에 한 번 옮겨서 우선권만 바꾼다(그림 순서는 둘 다 라벨 층이라 티가 안 난다).
    if (map.getLayer('pack-battle-label') && map.getLayer('story-place-label')) {
      map.moveLayer('pack-battle-label', 'story-place-label');
    }

    map.addLayer({ id: 'board-label', type: 'symbol', source: 'board', minzoom: 10,
      layout: { 'text-field': ['get', 'label'], 'text-font': ['KlokanTech Noto Sans CJK Regular'], 'text-size': 11,
        'text-offset': [0, 1.35], 'text-anchor': 'top', 'text-max-width': 8, 'text-allow-overlap': false, 'text-optional': true },
      paint: { 'text-color': ['get', 'color'], 'text-halo-color': isDark ? '#1B2129' : '#FFFFFF', 'text-halo-width': 1.4 } }, before);
    const allMoves = { type: 'FeatureCollection' as const, features: [...d.movements.features, ...PACK_MOVEMENTS] };
    // 화면에 깔리는 것은 **휜 사본**이다. 원본은 tokenRoutes가 그대로 쓴다 —
    // 말은 실제 정점을 밟아야 하고(walkRoute가 좌표 일치로 구간을 찾는다) 선만 활이 된다.
    map.addSource('movements', { type: 'geojson', data: { type: 'FeatureCollection', features: curveMovements(allMoves.features as any) } as any });
    // 경로는 세 겹이다. 아래에서부터 **테(paper) → 선(세력색) → 화살표**.
    //
    // 테를 까는 이유: 선을 연하게 만들면(River의 요구가 그것이다) 지형 음영·영토 색 위에서
    // 끊겨 보인다. 밑에 종이색 테를 한 겹 두면 연한 선도 끝까지 이어져 읽힌다. 지도에서
    // 흔히 쓰는 casing이고, 연하게 만들기와 읽히게 만들기를 동시에 푸는 유일한 방법이다.
    map.addLayer({ id: 'movement-halo', type: 'line', source: 'movements', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': isDark ? '#11161C' : '#F3EFE4',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 5, 6, 8] as any,
        'line-opacity': 0.55 } }, before);
    // **지난 구간일수록 옅다.** 옛 값은 전 구간이 0.92라 열세 줄이 똑같은 목소리로 떠들었다.
    // 지금 해의 구간이 제일 진하고 여덟 해 전 것이 제일 옅다. 선이 「지나온 길」이 아니라
    // 「지금 어디로 가는 중인가」를 먼저 말한다. 굵기도 같이 줄어 원근이 생긴다.
    // 실제 값은 연도를 알아야 나오므로 apply()의 fadeMovements가 해마다 다시 얹는다.
    map.addLayer({ id: 'movement', type: 'line', source: 'movements', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': fillColor, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.6, 6, 2.6] as any,
        'line-opacity': 0.7 } }, before);
    // 방향. symbol-placement: 'line'이 선의 진행 방향을 그대로 따르므로 **좌표 순서가 곧 화살표**다.
    // 세력색 사본을 미리 굽는다 — icon-color는 SDF 아이콘에만 듣고, 알파를 거리장으로 속여
    // 쓰면 삼각형 모서리가 뭉갠다. armIcon·standardIcon이 이미 같은 방식이다.
    for (const a of [...d.actors, { id: '_', color: FALLBACK_COLOR }]) {
      const iid = `arrow-${a.id}`;
      if (!map.hasImage(iid)) map.addImage(iid, arrowIcon(a.color), { pixelRatio: 2 });
    }
    map.addLayer({ id: 'movement-arrow', type: 'symbol', source: 'movements',
      layout: { 'symbol-placement': 'line', 'symbol-spacing': 140,
        'icon-image': ['concat', 'arrow-', ['case', ['in', ['get', 'actor'], ['literal', d.actors.map(a => a.id)]], ['get', 'actor'], '_']] as any,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.85, 6, 1.15] as any,
        'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'viewport',
        // 화살촉은 작고 선의 일부다. 충돌 검사에 넣으면 도시 이름표에 밀려 **한 개도 안 뜬다** —
        // 실제로 그랬다. 자리를 뺏지도 않게 ignore-placement까지 켠다.
        'icon-allow-overlap': true, 'icon-ignore-placement': true } as any,
      paint: { 'icon-opacity': 0.85 } as any }, before);

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
      for (const id of ['movement', 'movement-halo']) if (map.getLayer(id)) map.setFilter(id, movementFilter(s.year) as any);
      fadeMovements(s.year);
      hideUnbuilt(s.year);
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
    hideAnachronisticPlaces(map, s.year,
      id => { const row = timed.find(t => t[0] === id); return { timed: !!row, base: row ? row[1] : null }; },
      filterFor);
    syncDetailMaps(s.scene);
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

export const allLayers = (d: Dataset) => [...(d.manifest.layers ?? []), 'relief', 'bathy', 'rivers', 'labels', 'landmarks', 'graph', 'story_battles'];
