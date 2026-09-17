// 지도 엔진 (TASKS 1.3·1.8): MapLibre + 데이터 레이어 + 토큰. store만 구독한다 — React 크롬과는 store로만 이야기한다.
import * as maplibregl from 'maplibre-gl';
import { type Dataset, dateWindow, MARCH_MAX_YEARS, OPEN_PAST, routeGeometry } from '../schema';
import { buildStyle, DEPTHS, MAP, type Skin, ELEV_RAMP, isImagery } from './style';
import { rememberPitch3d, roundCam, type Store, type Scene, type State } from '../state';
import type { Neighbor } from '../graph/data';
import { ARM_KO, FALLBACK_COLOR, type BoardData } from '../board';
import { BATTLE_LAYERS, type BattleCtl } from './battle';
import { insetAt } from '../insets';
// 주변 민족 교보재(11 kB gz)는 첫 페인트에 필요 없다. 자산 URL로 두고 받아서 얹는다(R46).
const peoplesUrl = new URL('../../data/overlays/pack-peoples.json', import.meta.url).href;
import { fitZoom, showGalliaOverlay, showGalliaRoman } from '../present';
import { createMicro, MICRO_LAYERS } from './micro';
import { loadMicro, microMapAt } from '../micromaps';
import type { MicroMapDef } from '../../schema/micromap';
import { annotateLegs, curveMovements, ROUTE_PHASES } from '../routes';
import { PACK_EMBLEMS, PACK_BATTLES, PACK_CLIENTS, PACK_PLAINS, PACK_MOVEMENTS, PACK_PLACES, PACK_POLITY_COLORS, PACK_REGIONS, clientsAt, hiddenAdmin, hiddenPlaces } from '../packData';

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
const MOVE_MAX_AGE = 40; // 이보다 오래된 행군 구간은 안 그린다(2026-09-17, 정본 경로 16종 유입)
const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };


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


/** 여정 순번 배지. 국면색 원반에 흰 숫자, 밖으로 종이색 테 한 겹.
 *
 *  레퍼런스 지도가 화살표 옆에 연도를 적어 순서를 말한다. 우리는 연도를 이미 이름표와
 *  HUD가 말하므로 **순번**을 적는다 — "①에서 시작해 ⑨에서 끝난다"가 한눈에 읽힌다.
 *
 *  숫자를 텍스트 레이어로 따로 얹지 않고 그림에 굽는 이유: 심볼 레이어 하나에 아이콘과
 *  글자를 같이 넣으면 글리프가 비동기로 와서 원반과 숫자가 한 프레임 어긋나 보이고,
 *  레이어를 둘로 쪼개면 배치 우선권이 갈려 숫자만 충돌에 밀려 사라진다. 구간은 열셋뿐이라
 *  전부 구워도 이미지 열세 장이다. */
function seqIcon(color: string, n: number): ImageData {
  const S = 44, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const r = 16;
  g.beginPath(); g.arc(S / 2, S / 2, r + 3, 0, Math.PI * 2);
  g.fillStyle = '#FFFFFF'; g.fill();
  g.beginPath(); g.arc(S / 2, S / 2, r, 0, Math.PI * 2);
  g.fillStyle = color; g.fill();
  g.fillStyle = '#FFFFFF';
  g.font = `700 ${n >= 10 ? 19 : 22}px sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), S / 2, S / 2 + 1);
  return g.getImageData(0, 0, S, S);
}

/** 사선 무늬. 「속국(client kingdom)」 표시에 쓴다.
 *
 *  왜 무늬인가. 속국은 **자기 색이 있으면서 동시에 로마 세력권**이다. 로마색으로 덮으면
 *  속주와 구별이 안 되고, 테두리만 두르면 축척이 작아 안 보인다. 역사 지도책이 이 자리에서
 *  쓰는 문법이 사선이다 — 바탕색(그 나라)이 비쳐 보이면서 사선(로마)이 겹친다.
 *
 *  16px 타일이고 세 줄을 타일 경계 너머까지 그어 **이어 붙어도 끊기지 않는다.** 한 줄만
 *  그으면 타일마다 계단이 생긴다. */
function hatchIcon(color: string, size = 16): ImageData {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.strokeStyle = color; g.lineWidth = 2; g.lineCap = 'butt';
  for (const k of [-1, 0, 1]) {
    g.beginPath();
    g.moveTo(k * size, size);
    g.lineTo((k + 1) * size, 0);
    g.stroke();
  }
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
/** 피처를 **대푯점 하나**로 줄인 점 FeatureCollection.
 *
 *  **circle 레이어를 폴리곤 소스에 얹으면 MapLibre가 정점마다 점을 찍는다.** River가
 *  알렉산드리아에서 「빨간점이 많어. 에러」로 잡은 것이 그것이다 — 대항구(정점 다수)와
 *  브루케이온의 외곽선이 붉은 점렬로 그려졌다. 알레시아 구원군 진영(정점 19·15)도 같은
 *  병으로 초록 점 호(弧)가 됐다. 점 피처만 있는 필터는 멀쩡해서 오래 안 드러났다.
 *
 *  대푯점은 **가장 큰 고리의 정점 평균**이다. 전체 평균은 조각이 멀면 엉뚱한 자리에
 *  떨어진다(peoples-label에서 같은 선택을 했다). */
function repPointsFC(features: unknown[], pick: (props: Record<string, unknown>) => boolean) {
  const out: unknown[] = [];
  for (const f of features as { properties?: Record<string, unknown>; geometry?: { type: string; coordinates: unknown } }[]) {
    const props = f.properties ?? {};
    if (!pick(props)) continue;
    const g = f.geometry;
    if (!g) continue;
    let c: number[] | null = null;
    if (g.type === 'Point') c = g.coordinates as number[];
    else {
      const rings: number[][][] = g.type === 'MultiPolygon' ? (g.coordinates as number[][][][]).map(x => x[0])
        : g.type === 'Polygon' ? [(g.coordinates as number[][][])[0]]
        : g.type === 'LineString' ? [g.coordinates as number[][]]
        : [];
      if (!rings.length) continue;
      const big = rings.reduce((a, b) => (b.length > a.length ? b : a), rings[0]);
      const sum = big.reduce((a, q) => [a[0] + q[0], a[1] + q[1]], [0, 0]);
      c = [sum[0] / big.length, sum[1] / big.length];
    }
    if (c) out.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: c } });
  }
  return { type: 'FeatureCollection', features: out };
}

export const LAYER_GROUPS: Record<string, string[]> = {
  // 평야·곡창은 **따로 켠다** — 항상 깔면 여덟 장이 노랗게 물든다. 장면이 `plains`를 쓸 때만.
  plains: ['plains-granary', 'plains-barren', 'plains-line', 'plains-label'],
  territory: ['territory-fill', 'territory-casing', 'territory-outline', 'territory-glow', 'territory-label', 'client-hatch', 'client-edge', 'peoples-fill', 'peoples-line', 'peoples-label', 'gallia-free', 'gallia-free-line', 'gallia-roman', 'gallia-roman-line'],
  admin_regions: ['admin-line'],
  settlements: ['settle-major', 'settle-minor', 'label-settle-1', 'label-settle-2', 'label-settle-3', 'label-settle-4', 'label-settle-5', 'label-sea', 'story-place', 'story-place-label'],
  // 정본 전투 전부. 지중해 판에서 **69개가 한꺼번에** 뜬다 — 대부분 이 발표와 무관한
  // 다른 세기의 전투다. 그래서 팩 장면은 이걸 안 켜고 story_battles만 켠다.
  battles: ['battle'],
  // 이 발표가 말하는 전투 넷(알레시아·파르살루스·젤라·문다). 교보재 오버레이라 수가 적다.
  story_battles: ['pack-battle', 'pack-battle-label'],
  movements: ['movement', 'movement-halo', 'movement-arrow', 'movement-seq'],
  relief: ['relief', 'elev-tint', 'hillshade'], // DEM이 있으면 hillshade가 relief.jpg를 대체한다(addTerrain에서 relief 제거)
  bathy: ['bathy'],
  rivers: ['rivers-major', 'rivers-minor'],
  labels: ['label-settle-1', 'label-settle-2', 'label-settle-3', 'label-settle-4', 'label-settle-5', 'label-sea', 'region-name'],
  // label-region이 여기 있는 이유: Natural Earth의 SAHARA·LIBYAN DESERT·ATLAS MOUNTAINS 같은
  // **라틴 대문자** 지명이다. 사양서가 「한글 이름표를 켠다. 라틴어 표기는 쓰지 않는다」로 못 박았고
  // 옅은 회색이라 읽히지도 않았다(River: "지리지역 텍스트 가독성이 안 좋다"). 지리 지명은 한글
  // 영역·정착지 이름표가 댄다. **그룹에서 그냥 빼면 안 된다** — 관리 대상이 아니게 되어
  // 아무도 끄지 않아 오히려 항상 켜진다. 팩 장면이 안 켜는 landmarks로 옮겨서 끈다.
  landmarks: ['landmark-region_labels', 'landmark-marine_labels', 'landmark-pleiades', 'label-region'],
  graph: ['ego-edge'], // 지도엔 선만 그린다(D4 하이브리드). 노드·이름표는 이미 settle-*·battle·label-settle-*가 그린 위에 겹칠 뿐이다
  board: [...BATTLE_LAYERS], // 말판 v2 렌더러(map/battle.ts). 지연 청크지만 층 이름은 상수라 여기서 안다
  people: ['people-dot', 'people-pad', 'people-label', 'people-standard', 'people-force'],
  // 미시지도(OVERHAUL §3.1): 어느 지도든 같은 층. 그리는 법은 map/micro.ts KIND_PAINT, 데이터는 data/micromaps/<id>.json
  micro: [...MICRO_LAYERS],
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
    // **그 해에 실제로 떠 있는 전투 이름표만** 뺀다(OVERHAUL-III III-3). 늘 빼면 전투 창(valid_from~valid_to)이 지난 해에는
    // 알렉산드리아가 어느 층에도 없어 어느 줌에서도 안 보였다(AD 400 실측).
    const battleIds = PACK_BATTLES.filter(f => { const p = (f as { properties: { valid_from?: number; valid_to?: number } }).properties ?? {}; return (p.valid_from ?? -1e9) <= year && year < (p.valid_to ?? 1e9); })
      .map(f => String((f as { properties: { id?: string } }).properties?.id ?? ''));
    const dup = id.startsWith('label-settle') ? [...PACK_PLACES]
      : id === 'story-place-label' ? battleIds : [];
    apply(id, [...hide, ...dup]);
  }
}

// 의미군 선색(DESIGN: 유채색은 데이터 색뿐 — 관계 의미도 데이터다)
export const GROUP_COLOR: Record<string, string> = { hostile: '#B4433E', ally: '#2F7D5B', rule: '#5B4B8A', lineage: '#8A6D3B', member: '#3E6F8C', act: '#6B6F76', locate: '#8A8F98', make: '#6B6F76', other: '#8A8F98' };

export function createEngine(container: HTMLElement, d: Dataset, store: Store, root: string, ds: string, dark = false, boards: BoardData[] = [], scenes: Scene[] = []) {
  const s0 = store.get();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; // DESIGN §4: 즉시 전환
  const dur = (ms: number) => (reduced ? 0 : ms);
  let isDark = dark;
  // 부팅 스킨은 스타일에 바로 넣는다. 나중에 setSkin으로 갈아끼우면 setStyle이 소스·레이어를 통째로
  // 다시 얹으므로(아래 setSkin 참고) 북마크로 들어온 스킨 때문에 스타일을 두 번 빌드하게 된다.
  const themeSkin: Skin = dark ? 'dark' : 'light';
  const style = buildStyle(d.manifest, root, ds, s0.skin && s0.skin !== themeSkin ? { skin: s0.skin } : { dark });
  /** 지금 화면에 깔린 스킨. **OS 테마(`isDark`)와 다를 수 있다.**
   *
   *  라벨 테두리를 `isDark`로 고르면 River의 맥처럼 OS가 다크일 때 **작전 스킨(밝은 양피지)
   *  위에 먹색 테두리**가 깔린다. 글자색까지 세력색(짙은 적·청)이라 이름표가 통째로 검은
   *  얼룩이 됐다 — 9/13 라이브에서 카이사르·폼페이우스·마우레타니아가 전부 그 모양이었고,
   *  납품한 아홉 장도 같은 상태로 나갔다. 테두리는 **바탕을 따라가야** 한다. 스킨 토큰이
   *  이미 `halo`를 갖고 있으니(style.ts MAP) 그걸 쓴다. */
  let activeSkin: Skin = s0.skin ?? themeSkin;
  const halo = () => MAP[activeSkin].halo as string;
  // 카메라는 상태에서 온다. main.tsx가 URL·장면을 이미 상태에 접어 넣은 뒤 엔진을 만든다.
  const bb = d.manifest.bbox;
  const bootZoom = fitZoom(s0.zoom ?? d.manifest.zoom, container.clientWidth);
  const map = new maplibregl.Map({ container, style, center: s0.center ?? d.manifest.center, zoom: bootZoom, minZoom: 3, maxZoom: s0.board ? BOARD_MAX_ZOOM : MAP_MAX_ZOOM,
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

  const notRegion: any = ['!=', ['get', 'kind'], 'region'];
  const dotKind: any = ['in', ['coalesce', ['get', 'kind'], 'city'], ['literal', ['city', 'battlefield', 'building']]];
  const fillColor: any = ['match', ['get', 'actor']]; for (const a of d.actors) fillColor.push(a.id, a.color); fillColor.push('#8A8F98');
  /** 폴리티 이름이 팔레트에 있으면 그 색, 없으면 세력색. 영토 채움·테·이름표가 같은 식을
   *  써야 「면 색과 글자 색이 다르다」가 안 생긴다. */
  // 팔레트 밖(기타중립) 폴리티는 fetch-external이 이름 해시로 구운 `color`(채도 30)를 쓴다(OVERHAUL-III III-2, R32). 없으면 회색 그대로.
  const neutralColor: any = ['case', ['==', ['get', 'actor'], '기타중립'], ['coalesce', ['get', 'color'], fillColor], fillColor];
  const polityColor: any = Object.keys(PACK_POLITY_COLORS).length
    ? (() => { const m: any = ['match', ['get', 'name']];
        for (const [n, c] of Object.entries(PACK_POLITY_COLORS)) m.push(n, c);
        m.push(neutralColor); return m; })()
    : neutralColor;
  const victorColor: any = ['match', ['get', 'victor']]; for (const a of d.actors) victorColor.push(a.id, a.color); victorColor.push('#333');
  const timed: [string, any[] | null][] = [['territory-fill', null], ['territory-casing', null], ['territory-outline', null], ['territory-label', ['all', ['==', ['geometry-type'], 'Point'], ['>', ['get', 'area'], ['case', ['==', ['get', 'actor'], '기타중립'], ['step', ['zoom'], 900000, 5, 300000, 7, 80000], ['step', ['zoom'], 80000, 7, 20000]]]] as any], ['admin-line', null],
    // `kind: region`은 **region-name 층이 가져갔다.** 여기 남겨 두면 같은 점을 두 층이 찍고,
    // 허용 목록에서 버린 이름(소아시아·북아프리카·독일…)이 이쪽으로 새어 나온다 — 실측으로 그랬다.
    // 점은 도시·전장·건물·종류 미상만(OVERHAUL-III III-3, R34). 바다·강·산·섬에 금색 점을 찍으면 도시로 읽힌다 — 이름만 쓴다.
    // 작은 점은 줌을 따라 단계로 는다(rank 2 → z6부터 3 → z8부터 전부). 이름표 없는 점이 먼저 쏟아지지 않게.
    ['settle-major', ['all', ['<=', ['get', 'rank'], 1], notRegion, dotKind]],
    ['settle-minor', ['all', ['>=', ['get', 'rank'], 2], ['<=', ['get', 'rank'], ['step', ['zoom'], 2, 6, 3, 8, 5]], notRegion, dotKind]], ['battle', null], ['pack-battle', null],
    // **주변 민족 교보재도 해 필터를 받는다.** 안 받으면 `valid_from: -60`인 사르마티아·
    // 게르마니아가 **어느 해에나** 뜬다 — 기원전 270년 화면에 사르마티아가 뜨면 그 자리는
    // 정본이 스키타이로 칠한 땅이다. 발표 여덟 장은 전부 기원전 60~27년이라 드러나지
    // 않았고, 「로마의 확장」 장면(BC 270·241·144)이 생기면서 나왔다.
    ['peoples-fill', null], ['peoples-line', null], ['peoples-label', null],
    ['plains-granary', null], ['plains-barren', null], ['plains-line', null], ['plains-label', null]];
  const filterFor = (base: any[] | null, y: number): any => base ? ['all', base, ...dateWindow(y).slice(1)] : dateWindow(y);
  // 지나온 행군만. valid_to가 먼 미래로 열려 있으면 아직 안 간 구간까지 한 줄로 깔린다.
  // 2026-09-17, 정본 경로 16종(102구간)이 산출물에 들어오면서 둘을 더했다.
  // ① 40년 넘게 지난 구간은 안 그린다. 안 그러면 BC 49 판에 한니발의 알프스 넘기가 옅게 깔린다.
  // ② 3년 넘는 구간은 행군이 아니라 체류라 선으로 안 그린다(schema.ts MARCH_MAX_YEARS와 같은 규칙).
  const legEnd: any = ['coalesce', ['get', 'to_year'], ['get', 'valid_from'], OPEN_PAST];
  const legSpan: any = ['-', legEnd, ['coalesce', ['get', 'from_year'], ['get', 'valid_from'], legEnd]];
  const movementFilter = (y: number): any => ['all', ['<=', legEnd, y], ['>=', legEnd, y - MOVE_MAX_AGE], ['<=', legSpan, MARCH_MAX_YEARS]];
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
    // 순번 배지는 **지난 구간도 남긴다** — "①에서 ⑨까지"가 여정 전체의 순서를 말하는
    // 것이 존재 이유다. 다만 올해 것이 제일 진하다. 0.5까지만 내려 옛 구간도 읽힌다.
    if (map.getLayer('movement-seq')) {
      map.setPaintProperty('movement-seq', 'icon-opacity', lerp(1, 0.5) as any);
      map.setLayoutProperty('movement-seq', 'icon-size', byZoom(1, 1.3, lerp(1, 0.8)));
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
    if (tokensHidden) fc = EMPTY_FC as typeof fc;   // 전투 미시지도 안에서는 초상 토큰을 안 놓는다(hideContinental). setPeople·상태 구독이 다시 불러도 그대로
    if (!tokenMod || !map.getStyle()) return;
    const seen = new Set<string>();
    if (peopleLayerOn) {
      for (const f of fc.features as { properties: { id: string; name: string; color: string; asset: string | null; scale?: number; legions?: number | null; faction?: string | null }; geometry: { coordinates: [number, number] } }[]) {
        const p = f.properties; if (!p?.id) continue;
        seen.add(p.id);
        let t = peopleTokens.get(p.id);
        if (!t) {
          // 초상을 말 윗면에 얹는다 — 말이 누구인지 색만으로는 안 갈린다(로마 안에서 편이 갈린다)
          // scale은 주역 1 · 조역 0.62(people.COMPANION_SCALE). 사람마다 고정이라 생성 때 한 번.
          // 군기에 세력 문장(있는 세력만, pack-emblems). 없으면 세력색 깃발(OVERHAUL-II §3.5)
          t = tokenMod.createToken(p.color || '#6B6F76', p.name, p.asset ? `${root}${p.asset}` : null, p.scale ?? 1, { emblem: p.faction && PACK_EMBLEMS.has(p.faction) ? `${root}assets/emblems/${p.faction}.png` : null });
          const path = tokenRoutes.get(p.id);
          if (path) t.setRoute(path);
          if (!map.getLayer(t.layer.id)) map.addLayer(t.layer);
          peopleTokens.set(p.id, t);
        }
        t.setPosition(f.geometry.coordinates as [number, number]);
        t.setLegions(p.legions ?? 0);   // 군단 무리·명패(pack-legions 사료 수치. 0이면 없다)
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
  let terrainSrc = 'dem';   // 지금 지형을 주는 소스. 미시지도 진입 때 인셋(dem-<id>)으로, 이탈 때 대륙(dem)으로 (OVERHAUL §3.7)
  const syncTerrain = () => {
    if (!map.getSource(terrainSrc)) return;
    const base = terrainMeta?.exaggeration ?? 1.4;
    const ex = Math.round(base * Math.min(11, Math.max(1, 2 ** ((9 - map.getZoom()) * 0.62))) * 10) / 10;
    if (ex === lastEx && map.getTerrain()?.source === terrainSrc) return;
    lastEx = ex; map.setTerrain({ source: terrainSrc, exaggeration: ex });
  };
  map.on('zoom', syncTerrain);
  function hillshadeTo(src: string, before?: string) {
    // 고도색(color-relief)은 음영 밑. 모든 스킨에서 옅게(0.15) — 「확대하면 빈 화면」의 대륙 쪽 처방(OVERHAUL §3.6b ①)
    // 위성 스킨은 이미지가 이미 색을 가지므로 고도색을 안 얹고, 음영도 옅게(0.3, 먹색 그림자)만 남긴다(OVERHAUL-III III-1).
    if (map.getLayer('elev-tint')) map.removeLayer('elev-tint');
    if (!isImagery(activeSkin)) map.addLayer({ id: 'elev-tint', type: 'color-relief', source: src, paint: { 'color-relief-color': ['interpolate', ['linear'], ['elevation'], ...ELEV_RAMP.flat()], 'color-relief-opacity': 0.15 } } as any, before);
    if (map.getLayer('hillshade')) map.removeLayer('hillshade');
    map.addLayer({ id: 'hillshade', type: 'hillshade', source: src, paint: isImagery(activeSkin)
      ? { 'hillshade-exaggeration': 0.3, 'hillshade-shadow-color': '#000000', 'hillshade-highlight-color': '#FFFFFF' }
      : { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': activeSkin === 'dark' ? '#0B0F14' : '#5C6157', 'hillshade-highlight-color': activeSkin === 'dark' ? '#3A424C' : '#FFFFFF' } }, before);
  }
  /** 지형 소스를 바꾼다. 미시지도 진입은 인셋, 이탈은 대륙. 음영 층도 그 소스로 다시 얹는다. */
  function useTerrain(src: string, before?: string) {
    if (!map.getSource(src)) return;
    terrainSrc = src; lastEx = 0;
    hillshadeTo(src, before ?? (map.getLayer('label-marine') ? 'label-marine' : undefined));
    syncTerrain();
  }
  // 세부 지도 둘은 **줌으로** 켠다 — 발표 장면 수는 아홉으로 묶여 있고(River),
  // 세부는 「거기로 들어가면 보인다」가 맞는 동작이다.

  // ── 미시지도 (OVERHAUL §3.1, R47): 레지스트리 하나. 어느 지도든 같은 층으로 그린다(map/micro.ts) ──────
  const microFns = new Set<(def: MicroMapDef | null) => void>();
  const micro = createMicro(map, { root, ds, palette: Object.fromEntries(d.actors.map(a => [a.id, a.color])), halo,
    before: () => map.getLayer('label-marine') ? 'label-marine' : undefined,
    onEnter: def => {
      hideContinental(true, def.hide);
      // 미시지도의 home은 자동으로 인셋이다(OVERHAUL §3.6b ③). DEM·토지피복 부착은 insets.json 인셋과 같은 길로
      const [lon, lat] = def.home.at, sp = def.home.span;
      attachInset({ id: def.id, bounds: [lon - sp, lat - sp, lon + sp, lat + sp], dem: def.dem ? { dir: def.dem.dir, minzoom: def.dem.minzoom, maxzoom: def.dem.maxzoom } : null,
        landcover: def.landcover ? { dir: def.landcover.dir, minzoom: def.landcover.minzoom, maxzoom: def.landcover.maxzoom, opacity: def.landcover.opacity } : null });
      microFns.forEach(fn => fn(def));
    },
    onLeave: () => {
      hideContinental(false);
      detachInset();
      microFns.forEach(fn => fn(null));
      syncInset();                           // 미시지도를 나왔지만 insets.json 인셋 안일 수 있다
    } });
  // ── 인셋 DEM·토지피복 (OVERHAUL §3.6b, R56): 미시지도 home과 data/insets.json 둘 다 이 둘로 붙인다 ──
  type InsetSpec = { id: string; bounds: [number, number, number, number]; dem: { dir: string; minzoom: number; maxzoom: number } | null; landcover: { dir: string; minzoom: number; maxzoom: number; opacity: number } | null };
  let activeInset: string | null = null;
  function attachInset(spec: InsetSpec) {
    if (activeInset === spec.id) return;
    detachInset();
    if (spec.dem) {
      const id = `dem-${spec.id}`;   // 범위(bounds)·minzoom이 있어 밖에서는 요청이 안 나간다
      if (!map.getSource(id)) map.addSource(id, { type: 'raster-dem', tiles: [`${root}datasets/${ds}/${spec.dem.dir}/{z}/{x}/{y}.png`], encoding: 'terrarium', tileSize: 256, minzoom: spec.dem.minzoom, maxzoom: spec.dem.maxzoom, bounds: spec.bounds });
      useTerrain(id);
    }
    if (spec.landcover) {
      const id = `landcover-${spec.id}`;   // 토지피복은 음영 **밑에**: 색은 피복이, 굴곡은 음영이 말한다. River: 「자연 환경이라도」
      if (!map.getSource(id)) map.addSource(id, { type: 'raster', tiles: [`${root}datasets/${ds}/${spec.landcover.dir}/{z}/{x}/{y}.png`], tileSize: 256, minzoom: spec.landcover.minzoom, maxzoom: spec.landcover.maxzoom, bounds: spec.bounds });
      if (!map.getLayer(id)) map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': spec.landcover.opacity, 'raster-fade-duration': 0 } }, map.getLayer('elev-tint') ? 'elev-tint' : (map.getLayer('hillshade') ? 'hillshade' : (map.getLayer('micro-fill') ? 'micro-fill' : undefined)));
      landcoverLayer = id;
    }
    activeInset = spec.id;
  }
  function detachInset() {
    if (!activeInset) return;
    if (map.getSource('dem')) useTerrain('dem');
    if (landcoverLayer && map.getLayer(landcoverLayer)) map.removeLayer(landcoverLayer);
    landcoverLayer = null; activeInset = null;
  }
  /** insets.json 인셋: 미시지도가 없어도 그 범위·줌에서 DEM·토지피복이 켜진다. 미시지도가 켜져 있으면 그쪽이 우선. */
  function syncInset() {
    if (micro.active()) return;
    const ins = insetAt(map.getZoom(), map.getCenter().toArray() as [number, number]);
    if (!ins) { detachInset(); return; }
    const sp = ins.span, z0 = ins.minzoom ?? 8, z1 = ins.maxzoom ?? 12;
    attachInset({ id: ins.id, bounds: [ins.at[0] - sp, ins.at[1] - sp, ins.at[0] + sp, ins.at[1] + sp], dem: { dir: `terrain-${ins.id}`, minzoom: z0, maxzoom: z1 }, landcover: { dir: `landcover-${ins.id}`, minzoom: z0, maxzoom: z1, opacity: 0.55 } });
  }
  let landcoverLayer: string | null = null;
  let battle: BattleCtl | null = null;
  const battleFns = new Set<(b: BattleCtl) => void>();
  let microWanted: string | null = null;
  /** 미시 축척에서 대륙 축척의 것들을 끈다. 이동 경로는 지중해를 가로지르는 선 몇 개일 뿐이고, 폴리티 이름표는
   *  면적 문턱만 봐서 64만 km² 왕국이 z14에서도 통과한다(River가 알렉산드리아 판에서 「프톨레마이오스 왕국」을 잡았다).
   *  나갈 때는 상태의 레이어 목록대로 되돌린다. */
  let tokensHidden = false;
  let hiddenGroups: string[] = ['movements'];   // 들어갈 때 끈 그룹을 기억했다가 나갈 때 그대로 되살린다(예전엔 movements만 되살려 people이 꺼진 채 남았다)
  function hideContinental(on: boolean, groups: string[] = hiddenGroups) {
    const set = (ids: string[], vis: boolean) => { for (const l of ids) if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', vis ? 'visible' : 'none'); };
    const st = store.get(); const lit = new Set(st.layers ?? d.manifest.layers ?? []);
    if (on) hiddenGroups = groups;
    for (const g of groups) set(LAYER_GROUPS[g] ?? [], !on && lit.has(g));
    // 인물 초상 토큰은 커스텀 층(token3d)이라 그룹 목록에 없다. 전투 미시지도(hide에 people)에서는 블록을 가리므로 같이 치운다
    if (groups.includes('people')) { tokensHidden = on; syncPeopleTokens(on || !lit.has('people') ? EMPTY_FC : peopleFc); }
    set(['territory-label', 'territory-outline', 'territory-glow', 'region-name', 'peoples-label', 'peoples-line', 'client-hatch', 'client-edge'], !on && lit.has('territory'));
  }
  function syncDetailMaps(scene: string | null) {
    const sc = scene ? scenes.find(x => x.id === scene) : null;
    const id = sc?.micro ?? microMapAt(map.getZoom(), map.getCenter().toArray() as [number, number]);
    if (id === microWanted && (id === null || micro.active()?.id === id)) return;
    microWanted = id;
    if (!id) { micro.leave(); return; }
    loadMicro(id).then(def => { if (microWanted === id) micro.enter(def); }).catch(err => console.warn(err));
  }
  map.on('zoomend', () => syncDetailMaps(store.get().scene)); // 스킨 전환(setStyle)마다 addTerrain이 다시 불려서, 리스너는 여기 한 번만 건다
  map.on('moveend', () => syncDetailMaps(store.get().scene)); // 이동만으로 지도를 벗어나는 경우
  map.on('zoomend', syncInset); map.on('moveend', syncInset);

  function addTerrain(before?: string) {
    const t = terrainMeta; if (!t) return;
    if (!map.getSource('dem')) map.addSource('dem', { type: 'raster-dem', tiles: [`${root}datasets/${ds}/terrain/{z}/{x}/{y}.png`], encoding: t.encoding ?? 'terrarium', tileSize: 256, minzoom: t.minzoom ?? 0, maxzoom: t.maxzoom ?? 8 });
    // 베이크된 relief.jpg(NE Gray Earth 1.85km/px)와 겹치면 그림자가 두 벌이라 능선이 뭉갠다 — DEM 음영이 해상도·광원 모두 낫다.
    if (map.getLayer('relief')) map.removeLayer('relief');
    const act = micro.active();
    if (act?.dem && map.getSource(`dem-${act.id}`)) useTerrain(`dem-${act.id}`, before); else useTerrain('dem', before);
    if (!act) { activeInset = null; syncInset(); }   // setStyle이 소스를 지웠으면 인셋을 다시 붙인다
  }

  let peoplesFc: { features: unknown[] } | null = null;
  fetch(peoplesUrl).then(r => (r.ok ? r.json() : null)).then(j => { peoplesFc = j; if (map.getStyle() && map.getSource('territory')) addPeoples(map.getLayer('label-marine') ? 'label-marine' : undefined); }).catch(() => {});
  function addPeoples(before?: string) {
    if (!peoplesFc?.features?.length || map.getSource('peoples') || !map.getLayer('territory-fill')) return;
    {
      map.addSource('peoples', { type: 'geojson', data: peoplesFc! as any });
      map.addLayer({ id: 'peoples-fill', type: 'fill', source: 'peoples',
        paint: { 'fill-color': polityColor, 'fill-opacity': 0.2 } }, 'territory-fill');
      map.addLayer({ id: 'peoples-line', type: 'line', source: 'peoples',
        paint: { 'line-color': polityColor, 'line-width': 1.2, 'line-dasharray': [4, 3], 'line-opacity': 0.65 } }, 'territory-fill');
      // **이름표는 따로 만든 점에 붙인다.** 폴리곤 소스에 직접 심볼을 얹으면 MapLibre가
      // **조각마다 하나씩** 찍는다 — 사르마티아(2조각)와 보스포루스 왕국(2조각)의 이름이
      // 나란히 두 번 떴다(실측). 대표점 하나를 뽑아 점 소스로 만들면 한 번만 찍힌다.
      map.addSource('peoples-pt', { type: 'geojson', data: {
        type: 'FeatureCollection',
        features: (peoplesFc!.features as any[]).map(f => {
          const g = f.geometry;
          const rings: number[][][] = g.type === 'MultiPolygon'
            ? (g.coordinates as number[][][][]).map(poly => poly[0])
            : [(g.coordinates as number[][][])[0]];
          // 가장 큰 조각의 정점 평균. 면적 가중이 아니라 「제일 큰 덩어리의 가운데」다 —
          // 두 조각이 멀리 떨어져 있을 때 전체 평균은 바다에 떨어진다.
          const big = rings.reduce((a, b) => (b.length > a.length ? b : a), rings[0]);
          const c = big.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]).map(v => v / big.length);
          return { type: 'Feature', properties: f.properties, geometry: { type: 'Point', coordinates: c } };
        }),
      } as any });
      map.addLayer({ id: 'peoples-label', type: 'symbol', source: 'peoples-pt',
        layout: { 'text-field': ['get', 'name_ko'], 'text-font': ['KlokanTech Noto Sans CJK Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 13, 6, 16] as any, 'text-max-width': 8,
          'text-allow-overlap': false, 'text-optional': true,
          'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.6 } as any,
        paint: { 'text-color': polityColor, 'text-halo-color': halo(), 'text-halo-width': 2.4 } }, before);
    }
  }

  function addData() {
    if (map.getSource('territory')) return; // setStyle 직후 load/style.load가 겹쳐 두 번 불릴 수 있다
    micro.reset(); microWanted = null;        // setStyle이 소스를 지웠다. 활성 미시지도는 끝에서 다시 들어온다
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
      paint: { 'fill-color': polityColor,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, terrOpacity(1), 12, terrOpacity(0.25)] as any } }, before);
    // 작전 스킨 v2(OVERHAUL-II §3.1, R51): 테를 두 겹으로. 먹색 케이싱(채움 위에 얹혀 세력색이 한 톤 어두워진다) + 밝은 점선 사슬.
    // 레퍼런스(Kings and Generals)의 굵은 어두운 테 + 점선. 다른 스킨은 한 겹 그대로.
    const chain = activeSkin === 'campaign';
    if (chain) map.addLayer({ id: 'territory-casing', type: 'line', source: 'territory', layout: { 'line-join': 'round' }, paint: { 'line-color': MAP[activeSkin].coast, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.2, 8, 4.2], 'line-opacity': 0.55 } }, before);
    map.addLayer({ id: 'territory-outline', type: 'line', source: 'territory', paint: chain
      ? { 'line-color': MAP[activeSkin].halo, 'line-width': 1.2, 'line-opacity': 0.9, 'line-dasharray': [2, 2] }
      : { 'line-color': polityColor, 'line-width': 1.6, 'line-opacity': 0.95 } }, before);
    // 안쪽 후광(OVERHAUL §3.6c, R57): 경계 안쪽 몇 px를 같은 색으로 흐리게. 「색이 바다로 샌다」는 인상을 지운다.
    // line-offset 음수 = 폴리곤 안쪽(외곽 고리가 시계 반대 방향일 때). 마스크가 바다 쪽을 덮으니 밖으로 새는 후광은 안 보인다.
    map.addLayer({ id: 'territory-glow', type: 'line', source: 'territory', layout: { 'line-join': 'round' },
      paint: { 'line-color': polityColor, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 3, 8, 9], 'line-offset': ['interpolate', ['linear'], ['zoom'], 3, -1.5, 8, -4.5],
        'line-blur': ['interpolate', ['linear'], ['zoom'], 3, 4, 8, 10], 'line-opacity': 0.16 } }, before);

    // ── 평야·곡창지대 교보재 ───────────────────────────────────────────────
    //
    // 대표님 강의의 **인과 축**이 여기다. "평야지대가 없는 거예요. 먹고 살게 없어요.
    // 그래서 제국이 이루어질 수 없어요. 제국이 이루어지려면 잉여 생산물이 많이 생겨야만."
    // 그런데 우리 지도에 평야가 한 조각도 없었다 — 이집트 장면이 「왜 이집트인가」에
    // 한 픽셀도 대답하지 못했다.
    //
    // **세력이 아니라 지리다.** `actor`가 없고 `kind`(granary/barren)만 본다 —
    // polityColor를 타면 안 된다. 정본 폴리티와 **일부러 겹치므로** 정본 아래에 깔고
    // 불투명도를 낮춘다(로마 영토색 위에 곡창이 얹히는 그림).
    if (PACK_PLAINS?.features?.length && !map.getSource('plains')) {
      map.addSource('plains', { type: 'geojson', data: PACK_PLAINS as any });
      const isKind = (k: string): any => ['==', ['get', 'kind'], k];
      // 곡창은 밀빛, 척박은 회사(灰砂). 채도를 낮게 둔다 — 이 층은 배경 설명이고
      // 주인공은 그 위의 영토·말·경로다.
      map.addLayer({ id: 'plains-granary', type: 'fill', source: 'plains', filter: isKind('granary'),
        paint: { 'fill-color': '#C9A83F', 'fill-opacity': 0.3 } }, 'territory-fill');
      map.addLayer({ id: 'plains-barren', type: 'fill', source: 'plains', filter: isKind('barren'),
        paint: { 'fill-color': '#9B8F7A', 'fill-opacity': 0.16 } }, 'territory-fill');
      map.addLayer({ id: 'plains-line', type: 'line', source: 'plains', filter: isKind('granary'),
        paint: { 'line-color': '#8A6D1B', 'line-width': 1, 'line-dasharray': [3, 2], 'line-opacity': 0.5 } }, 'territory-fill');
      // 이름표는 **대푯점**에 붙인다 — 발칸 2조각·시리아 3조각이라 폴리곤에 직접 얹으면
      // 조각마다 찍힌다(repPointsFC 주석 참고).
      map.addSource('plains-pt', { type: 'geojson', data: repPointsFC(PACK_PLAINS.features as unknown[], () => true) as any });
      map.addLayer({ id: 'plains-label', type: 'symbol', source: 'plains-pt',
        layout: { 'text-field': ['get', 'name_ko'], 'text-font': ['KlokanTech Noto Sans CJK Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 6, 14] as any, 'text-max-width': 9,
          'text-letter-spacing': 0.06, 'text-allow-overlap': false, 'text-optional': true,
          'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.5 } as any,
        paint: { 'text-color': ['case', isKind('granary'), '#6B5310', '#6B6353'] as any,
          'text-halo-color': halo(), 'text-halo-width': 2 } }, before);
    }

    // ── 주변 민족·왕국 교보재 ──────────────────────────────────────────────
    //
    // River: "다른 왕국들도 나오면 좋겠다. 지금 나오는 왕국들이 조금 적다는 느낌."
    // 진짜 원인은 정본이 **국가 단위 데이터셋**이라는 것이다 — 부족 연합이 구조적으로
    // 없어서 기원전 60년 프레임에 게르마니아·다키아·사르마티아·보스포루스·브리타니아가
    // 한 면도 안 뜬다. 갈리아가 없던 것과 같은 원인이고, 같은 방식(Natural Earth 정점
    // 복사 + 사료가 말하는 강·해안 경계)으로 채운다.
    //
    // **정본 폴리곤 아래에 깐다** — 교보재가 정본을 덮으면 안 된다. 테는 점선이다:
    // 이 경계들은 국경이 아니라 「이 민족이 살던 대략의 자리」이고, 점선이 그 정도를 말한다.
    addPeoples(before);
    // ── 로마의 속국(client kingdom) ─────────────────────────────────────────
    //
    // River: 기원전 60년 판에서 누미디아·마우레타니아·갈라티아·카파도키아·폰토스·유대·
    // 나바테아·트라키아가 전부 남의 나라 색으로 칠해져 「지중해는 이미 로마」라는 해설과
    // 그림이 어긋난다. 맞는 지적인데 **정본이 틀린 건 아니다** — 그들은 속주가 아니라
    // 속국이었고, 폴리티 단위 데이터셋은 속국을 별도 폴리티로 잡는 것이 맞다.
    //
    // 그래서 **기하를 새로 만들지 않는다.** 정본 폴리곤 그대로에 사선을 한 겹 얹고,
    // 어느 폴리티가 몇 년부터 몇 년까지 속국이었는지만 표로 둔다(pack-clients.json).
    // 그러면 「직접 지배 + 세력권」이 한 그림에서 갈려 보인다.
    if (PACK_CLIENTS.length) {
      const romeColor = d.actors.find(a => a.id === '로마')?.color ?? '#A4243B';
      if (!map.hasImage('hatch-client')) map.addImage('hatch-client', hatchIcon(romeColor), { pixelRatio: 2 });
      map.addLayer({ id: 'client-hatch', type: 'fill', source: 'territory',
        filter: ['in', ['get', 'name'], ['literal', []]] as any,   // apply()가 해마다 갈아 넣는다
        paint: { 'fill-pattern': 'hatch-client', 'fill-opacity': 0.5 } } as any, before);
      map.addLayer({ id: 'client-edge', type: 'line', source: 'territory',
        filter: ['in', ['get', 'name'], ['literal', []]] as any,
        paint: { 'line-color': romeColor, 'line-width': 1.4, 'line-dasharray': [3, 2], 'line-opacity': 0.7 } as any }, before);
    }
    // 갈리아 교보재. **연도로** 켠다(present.showGalliaOverlay). Cliopatria가 BC60/51을 안 갈라 줘서 정본 속주 셋만 칠한다.
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
    // ── 바다 마스크 (OVERHAUL §3.6c, R57) ──────────────────────────────────
    // 영역 폴리곤은 데이터에서 해안선을 안 자른다(자르면 정점이 6배로 뛴다, finish-territory.py 실측). 대신
    // bbox−육지 다각형(layers/ocean.geojson)을 바다색으로 **영역 위에** 덮어 어느 줌에서도 해안에 딱 맞게 한다.
    // 수심 띠·호수·해안선 잉크는 그 위에 다시 얹는다. 작은 섬은 land.geojson에 덧붙어 있어 마스크에 구멍이 나고,
    // 섬에 귀속된 영역색이 그 구멍으로 보인다. 94%라 바다 밑 음영이 살짝 비친다.
    {
      const sk = MAP[activeSkin];
      // 위성 스킨(OVERHAUL-III III-1): 색 한 장으로 덮으면 위성 바다가 사라진다. 같은 이미지의 바다 부분(satellite-sea.png, 육지는 투명)을
      // 같은 자리에 같은 id로 덮는다 — 영역색이 바다로 새는 것은 막고 수심 음영은 남는다. 수심 벡터·호수 덮개는 이미지가 대신한다.
      if (isImagery(activeSkin) && d.manifest.bbox) {
        const [w, s, e, n] = d.manifest.bbox;
        if (!map.getSource('imagery-sea')) map.addSource('imagery-sea', { type: 'image', url: `${root}datasets/${ds}/rasters/satellite-sea.png`, coordinates: [[w, n], [e, n], [e, s], [w, s]] });
        map.addLayer({ id: 'ocean-mask', type: 'raster', source: 'imagery-sea', paint: { 'raster-opacity': 0.94, 'raster-fade-duration': 0 } }, before);
      } else {
        if (!map.getSource('ocean')) map.addSource('ocean', { type: 'geojson', data: `${root}datasets/${ds}/layers/ocean.geojson` });
        map.addLayer({ id: 'ocean-mask', type: 'fill', source: 'ocean', paint: { 'fill-color': sk.sea, 'fill-opacity': 0.94, 'fill-antialias': false } }, before);
      }
      if (map.getSource('bathy')) {
        const ramp: any[] = ['step', ['get', 'depth'], sk.depth[0]];
        DEPTHS.slice(1).forEach((d, i) => ramp.push(d, sk.depth[i + 1]));
        map.addLayer({ id: 'bathy-over', type: 'fill', source: 'bathy', paint: { 'fill-color': ramp as any, 'fill-opacity': 0.9, 'fill-antialias': false } }, before);
      }
      if (map.getSource('lakes') && !isImagery(activeSkin)) map.addLayer({ id: 'lakes-over', type: 'fill', source: 'lakes', paint: { 'fill-color': sk.sea, 'fill-opacity': 0.94 } }, before);
      if (map.getSource('coast')) map.addLayer({ id: 'coast-ink', type: 'line', source: 'coast',
        paint: { 'line-color': sk.coast, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.7, 9, 1.5], 'line-opacity': 0.9 } }, before);
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
    // 존속연도 줄(OVERHAUL-III III-2, R32): z4.5부터 이름 아래 `BC 305~BC 30`(레퍼런스 `Gaul / 250 BC – 50 BC`의 한글 판, 작대기 대신 물결).
    // span_from/span_to는 fetch-external이 Cliopatria 전 구간에서 굽는다. 아직 없는 피처(교보재)는 이름만.
    const yr = (k: string): any => ['case', ['<', ['get', k], 0], ['concat', 'BC ', ['to-string', ['-', 0, ['get', k]]]], ['concat', 'AD ', ['to-string', ['get', k]]]];
    const spanText: any = ['concat', yr('span_from'), '~', yr('span_to')];
    const serif = activeSkin === 'campaign' || activeSkin === 'oldmap';
    const cinzel = { 'text-font': ['literal', ['Cinzel Regular']], 'font-scale': 1.0 };
    const twoLine: any[] = serif ? [['upcase', ['get', 'name_en']], cinzel, '\n', {}, ['get', 'name'], { 'text-font': ['literal', ['KlokanTech Noto Sans CJK Bold']], 'font-scale': 0.78 }] : [['get', 'name'], {}];
    const oneLine: any[] = serif ? [['upcase', ['get', 'name']], cinzel] : [['get', 'name'], {}];
    const withSpan = (parts: any[]): any => ['case', ['has', 'span_from'], ['format', ...parts, '\n', {}, spanText, { 'font-scale': 0.72 }], ['format', ...parts]];
    const nameOnly = (parts: any[]): any => ['format', ...parts];
    const field = (f: (parts: any[]) => any): any => serif ? ['case', ['all', ['has', 'name_en'], ['!=', ['get', 'name_en'], ['get', 'name']]], f(twoLine), f(oneLine)] : f(twoLine);
    map.addLayer({ id: 'territory-label', type: 'symbol', source: 'territory',
      // 세리프 자간 두 줄 이름표(OVERHAUL-II §3.3, River 승인 「Cinzel 라틴 대문자 + 한글 산세리프」): 작전·고지도 스킨에서만.
      // 윗줄 name_en 대문자 Cinzel(글리프는 scripts/build-glyphs.mjs가 레포에 굽는다), 아랫줄 한글. name_en이 name과 같으면(한글 이름 없음) 한 줄.
      // 심볼 layout은 **타일 정수 줌**에서 평가된다. 4.5로 두면 z4.8에서도 이름만 나온다(실측). 5 = z5 타일부터.
      layout: { 'text-field': ['step', ['zoom'], field(nameOnly), 5, field(withSpan)],
        'text-font': ['KlokanTech Noto Sans CJK Bold'], 'text-letter-spacing': (activeSkin === 'campaign' || activeSkin === 'oldmap') ? 0.12 : 0, 'text-max-width': 7, 'text-padding': 6, 'text-allow-overlap': false,
        // 고정 anchor면 자리가 막혔을 때 이름표가 그냥 사라진다. 갈라티아가 카파도키아 왕국과
        // 상자가 겹쳐 여덟 해 내내 그럴 위험이 있다(실측). 네 방향을 주면 옆으로 미끄러져 산다.
        'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.6,
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, ['case', ['>', ['get', 'area'], 2000000], 13, 11], 7, ['case', ['>', ['get', 'area'], 2000000], 18, 14]],
        'symbol-sort-key': ['-', 0, ['get', 'area']] } as any,
      // 가독성(River: "지리지역 텍스트 가독성이 안 좋다"). 세력색 글자가 같은 색 면 위에 얹혀
      // 대비가 낮았다. 후광을 두껍게 하고 불투명도를 올린다.
      paint: { 'text-color': polityColor, 'text-halo-color': halo(), 'text-halo-width': 2.6, 'text-opacity': 1 },
      filter: ['>', ['get', 'area'], ['case', ['==', ['get', 'actor'], '기타중립'], ['step', ['zoom'], 900000, 5, 300000, 7, 80000], ['step', ['zoom'], 80000, 7, 20000]]] as any }, before);
    map.addSource('admin_regions', { type: 'geojson', data: d.admin_regions as any });
    // 216개 「책의 지역」 점선이 대륙 축척(z4)을 뒤덮는다(2026-09-17 캡처). z5.5부터만 그린다.
    map.addLayer({ id: 'admin-line', type: 'line', source: 'admin_regions', minzoom: 5.5, paint: { 'line-color': '#4b3f8c', 'line-width': 1.5, 'line-dasharray': [3, 2], 'line-opacity': ['case', ['==', ['get', 'confidence'], 'low'], 0.45, 0.9] as any } }, before);
    if (!map.getSource('settlements')) map.addSource('settlements', { type: 'geojson', data: d.settlements as any, promoteId: 'id' });
    // hover: +반지름·외곽 1.5px / selected: 외곽 2px(세력색 대신 잉크 — 정착지는 세력 없음) — DESIGN §2, GPU만
    const hov = (base: number, plus: number) => ['case', ['boolean', ['feature-state', 'selected'], false], base + plus, ['boolean', ['feature-state', 'hover'], false], base + plus * 0.6, ['boolean', ['feature-state', 'linked'], false], base + plus * 0.6, base];
    const circle = (id: string, minzoom: number, radius: number) =>
      map.addLayer({ id, type: 'circle', source: 'settlements', minzoom, paint: { 'circle-radius': hov(radius, 2) as any, 'circle-color': '#b8860b',
        'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#111418', '#3a2f22'] as any, 'circle-stroke-width': hov(1.2, 1) as any, 'circle-opacity': 1 } }, before);
    circle('settle-major', 3, 5); circle('settle-minor', 4.5, 3.5);   // rank 2 이름표가 z4.5부터라 점도 같이(R34)
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
      paint: { 'text-color': '#3A2F22', 'text-halo-color': halo(), 'text-halo-width': 1.8 } }, before);
    // ── 알레시아 세부(BG 7.68~7.74). 포위선 두 겹이 이 장면의 전부다 —
    //    안쪽은 농성군을, 바깥쪽은 구원군을 막는다. 그 두 선이 보이면 「이중 포위」가 설명된다.
    // **지역 이름.** River: "다른 왕국들도 나오면 좋겠다. 지금 나오는 왕국들이 조금 적다."
    //
    // 없던 게 아니라 **묻혀 있었다.** 정본 `settlements.geojson`에 `kind: region` 58개가
    // 이미 있는데(다키아·일리리쿰·킬리키아·카파도키아·폰투스·스키타이·모이시아…) 대부분
    // `rank: 3`이라 label-settle-3이 높은 줌에서만 띄운다 — 발표 축척 z4.2에서는 rank 1
    // 여섯 개(갈리아·브리타니아·에스파냐·이집트·소아시아·페르시아)만 떴다.
    //
    // 그래서 지역 이름만 따로 한 층으로 뺀다. 허용 목록(PACK_REGIONS)이 시대를 거른다.
    // **스타일은 폴리티 이름표와 일부러 다르다** — 자간을 벌린 옅은 회갈색 소문자 느낌.
    // 역사 지도책이 「지역」과 「나라」를 구별하는 문법이고, 그래야 같은 화면에 둘이 같이
    // 있어도 층위가 읽힌다. 우선권도 낮다(`text-optional`) — 도시·전투·인물에 밀린다.
    if (PACK_REGIONS.length) {
      map.addLayer({ id: 'region-name', type: 'symbol', source: 'settlements',
        filter: ['all', ['==', ['get', 'kind'], 'region'],
                 ['in', ['get', 'name_ko'], ['literal', PACK_REGIONS]]] as any,
        layout: { 'text-field': ['get', 'name_ko'], 'text-font': ['KlokanTech Noto Sans CJK Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 12, 5, 15, 8, 18] as any,
          'text-letter-spacing': 0.12, 'text-max-width': 7,
          'text-allow-overlap': false, 'text-optional': true,
          'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.5 } as any,
        // **도시 이름표 밑에 넣는다**(OVERHAUL-III III-3). 심볼 충돌은 위 층이 이긴다. 위에 두면 「아프리카」(카르타고와 같은 좌표)·
        // 「시리아」가 카르타고·안티오키아 이름표를 지운다(AD 400 z4 실측). `text-optional`은 층 사이 우선권이 아니다.
        paint: { 'text-color': '#6B6353', 'text-halo-color': halo(), 'text-halo-width': 2, 'text-opacity': 0.92 } }, map.getLayer('label-settle-1') ? 'label-settle-1' : before);
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
        paint: { 'text-color': '#3A2F22', 'text-halo-color': halo(), 'text-halo-width': 1.8 } }, before);
    }
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
      paint: { 'text-color': ['get', 'color'], 'text-halo-color': halo(), 'text-halo-width': 2.2 } }, before);
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
      paint: { 'text-color': ['get', 'color'] as any, 'text-halo-color': halo(), 'text-halo-width': 2.4 } }, before);
    syncPeopleIcons(peopleFc);
    // **이야기 전투 이름을 도시 이름보다 먼저 놓는다.** MapLibre는 스타일 배열 순서대로
    // 자리를 잡아서, 먼저 온 레이어가 자리를 이긴다. 정착지 이름표가 먼저라 기원전 48년
    // 판에서 「라리사」가 자리를 먹고 **정작 그 장면의 제목인 「파르살루스」가 사라졌다.**
    // 그린 뒤에 한 번 옮겨서 우선권만 바꾼다(그림 순서는 둘 다 라벨 층이라 티가 안 난다).
    if (map.getLayer('pack-battle-label') && map.getLayer('story-place-label')) {
      map.moveLayer('pack-battle-label', 'story-place-label');
    }

    // 교보재 경로(pack-pompey)는 **정본에 같은 route가 없을 때만** 싣는다. 2026-09-17 adapt 뒤 정본이
    // 폼페이우스 6구간을 주므로 교보재 4구간을 겹쳐 그리면 선이 두 겹이 된다. 정본이 이긴다.
    const routesInData = new Set(d.movements.features.map(f => f.properties.route));
    const allMoves = { type: 'FeatureCollection' as const, features: [...d.movements.features, ...PACK_MOVEMENTS.filter(f => !routesInData.has(f.properties.route))] };
    // 화면에 깔리는 것은 **휜 사본**이다. 원본은 tokenRoutes가 그대로 쓴다 —
    // 말은 실제 정점을 밟아야 하고(walkRoute가 좌표 일치로 구간을 찾는다) 선만 활이 된다.
    // annotateLegs가 순번·국면·국면색을 properties에 얹고, curveMovements가 좌표만 휜다.
    const legs = annotateLegs(allMoves.features as any);
    map.addSource('movements', { type: 'geojson', data: { type: 'FeatureCollection', features: curveMovements(legs) } as any });
    // 경로는 세 겹이다. 아래에서부터 **테(paper) → 선(세력색) → 화살표**.
    //
    // 테를 까는 이유: 선을 연하게 만들면(River의 요구가 그것이다) 지형 음영·영토 색 위에서
    // 끊겨 보인다. 밑에 종이색 테를 한 겹 두면 연한 선도 끝까지 이어져 읽힌다. 지도에서
    // 흔히 쓰는 casing이고, 연하게 만들기와 읽히게 만들기를 동시에 푸는 유일한 방법이다.
    map.addLayer({ id: 'movement-halo', type: 'line', source: 'movements', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': halo(),
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 5, 6, 8] as any,
        'line-opacity': 0.55 } }, before);
    // **지난 구간일수록 옅다.** 옛 값은 전 구간이 0.92라 열세 줄이 똑같은 목소리로 떠들었다.
    // 지금 해의 구간이 제일 진하고 여덟 해 전 것이 제일 옅다. 선이 「지나온 길」이 아니라
    // 「지금 어디로 가는 중인가」를 먼저 말한다. 굵기도 같이 줄어 원근이 생긴다.
    // 실제 값은 연도를 알아야 나오므로 apply()의 fadeMovements가 해마다 다시 얹는다.
    // **색은 국면(여정)이 정한다.** 세력색이 아니다 — 카이사르 아홉 구간과 폼페이우스 넷이
    // 전부 `actor: 로마`라 세력색으로는 열세 줄이 한 색이었다(routes.ts 「국면」절 참고).
    map.addLayer({ id: 'movement', type: 'line', source: 'movements', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['coalesce', ['get', 'phaseColor'], fillColor] as any,
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.6, 6, 2.6] as any,
        'line-opacity': 0.7 } }, before);
    // 방향. symbol-placement: 'line'이 선의 진행 방향을 그대로 따르므로 **좌표 순서가 곧 화살표**다.
    // 국면색 사본을 미리 굽는다 — icon-color는 SDF 아이콘에만 듣고, 알파를 거리장으로 속여
    // 쓰면 삼각형 모서리가 뭉갠다. armIcon·standardIcon이 이미 같은 방식이다.
    for (const ph of ROUTE_PHASES) {
      const iid = `arrow-${ph.id}`;
      if (!map.hasImage(iid)) map.addImage(iid, arrowIcon(ph.color), { pixelRatio: 2 });
    }
    map.addLayer({ id: 'movement-arrow', type: 'symbol', source: 'movements',
      layout: { 'symbol-placement': 'line', 'symbol-spacing': 140,
        'icon-image': ['concat', 'arrow-', ['coalesce', ['get', 'phase'], 'other']] as any,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.85, 6, 1.15] as any,
        'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'viewport',
        // 화살촉은 작고 선의 일부다. 충돌 검사에 넣으면 도시 이름표에 밀려 **한 개도 안 뜬다** —
        // 실제로 그랬다. 자리를 뺏지도 않게 ignore-placement까지 켠다.
        'icon-allow-overlap': true, 'icon-ignore-placement': true } as any,
      paint: { 'icon-opacity': 0.85 } as any }, before);
    // 순번. 구간마다 하나, 선의 가운데('line-center')에. 구간이 열셋뿐이라 배지를 전부 굽는다.
    for (const f of legs) {
      const p: any = f.properties ?? {};
      const iid = `seq-${p.phase}-${p.seq}`;
      if (p.seq && !map.hasImage(iid)) map.addImage(iid, seqIcon(String(p.phaseColor), Number(p.seq)), { pixelRatio: 2 });
    }
    map.addLayer({ id: 'movement-seq', type: 'symbol', source: 'movements',
      filter: ['has', 'seq'],
      layout: { 'symbol-placement': 'line-center',
        'icon-image': ['concat', 'seq-', ['get', 'phase'], '-', ['get', 'seq']] as any,
        // 44px@2x = 자연 크기 22 CSS px. 지중해 축척(z4.2)에서 1.1배면 ~24px — 도시 이름표
        // 글자 높이와 같은 급이라 「선에 달린 번호」로 읽힌다. 0.68배(15px)로는 안 읽혔다.
        'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 1, 6, 1.3] as any,
        'icon-rotation-alignment': 'viewport', 'icon-pitch-alignment': 'viewport',
        // 홀·짝을 위아래로 떼어 놓는다. 왕복 구간(브린디시→일레르다→디르하키움)은 가운데가
        // 거의 같은 자리라 배지 둘이 겹쳐 찍혔다 — 실측으로 ③과 ④가 그랬다. 오프셋은
        // icon-size에 곱해지므로 3840판에서도 비율이 유지된다.
        'icon-offset': ['case', ['==', ['%', ['coalesce', ['get', 'seq'], 0], 2], 0],
          ['literal', [0, -14]], ['literal', [0, 14]]] as any,
        // 배지는 무조건 뜬다(River가 순번을 요구했다). 다만 **자리는 점유한다** —
        // ignore-placement를 켜면 도시 이름표가 배지 밑으로 깔린다.
        'icon-allow-overlap': true, 'icon-ignore-placement': false } as any,
      paint: { 'icon-opacity': 0.95 } as any }, before);

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
    syncDetailMaps(store.get().scene);   // 스킨 전환 뒤에도 활성 미시지도를 다시 얹는다
    battle?.refresh();                   // 말판도 같은 이유로
    apply(store.get());
  }
  map.on('load', addData);
  // 클릭 → 선택(store). 패널은 React가 store를 보고 그린다.
  for (const layerId of ['territory-fill', 'admin-line', 'settle-major', 'settle-minor', 'story-place', 'battle', 'pack-battle', 'movement', 'people-dot', 'landmark-region_labels', 'landmark-marine_labels', 'landmark-pleiades']) {
    map.on('click', layerId, e => {
      const f = e.features?.[0]; if (!f) return;
      if (layerId.startsWith('landmark-')) { // 점 객체가 위에 있으면 그쪽이 이긴다
        if (map.queryRenderedFeatures(e.point, { layers: ['settle-major', 'settle-minor', 'story-place', 'battle', 'pack-battle', 'people-dot'].filter(l => map.getLayer(l)) }).length) return;
        // 정본 place 아님 — NE·Pleiades 지형지물(제안 대상). Pleiades는 id, NE는 이름.
        // marine_labels(바다 마스크)는 properties가 통째로 비어 있다 — 'landmark:undefined'를 만들지 않는다.
        const key = f.properties.pid ?? f.properties.name;
        if (key != null) store.set({ sel: `landmark:${key}` });
        return; }
      if (layerId === 'territory-fill' && map.queryRenderedFeatures(e.point, { layers: ['settle-major', 'settle-minor', 'story-place', 'battle', 'pack-battle', 'people-dot', 'landmark-pleiades'].filter(l => map.getLayer(l)) }).length) return;
      if (layerId === 'people-dot') {
        const sel = f.properties?.id;
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
  const SRC_OF: Record<string, string> = { 'territory-fill': 'territory', 'settle-major': 'settlements', 'settle-minor': 'settlements', 'story-place': 'settlements', battle: 'battles', 'pack-battle': 'pack-battles', 'people-dot': 'people', 'landmark-region_labels': 'region_labels', 'landmark-marine_labels': 'marine_labels', 'landmark-pleiades': 'landmarks' };
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
      // 속국 사선은 해마다 다시 고른다. 폰토스가 기원전 48~47년에 빠지는 자리다(clientsAt).
      const cl = clientsAt(s.year);
      for (const id of ['client-hatch', 'client-edge']) if (map.getLayer(id))
        map.setFilter(id, ['all', ['==', ['geometry-type'], 'Polygon'], ['in', ['get', 'name'], ['literal', cl.all]], ...dateWindow(s.year).slice(1)] as any);
      // 동맹(형식상 대등)은 속국보다 옅게. 마우레타니아·트라키아가 그쪽이다 — 조공국과
      // 같은 세기로 칠하면 없는 종속을 주장하게 된다.
      if (map.getLayer('client-hatch'))
        map.setPaintProperty('client-hatch', 'fill-opacity',
          ['case', ['in', ['get', 'name'], ['literal', cl.ally]], 0.3, 0.52] as any);
      for (const id of ['movement', 'movement-halo']) if (map.getLayer(id)) map.setFilter(id, movementFilter(s.year) as any);
      // 배지는 'seq'가 있는 구간만. 해 필터를 덮어쓰면 안 간 구간의 번호까지 뜬다.
      if (map.getLayer('movement-seq')) map.setFilter('movement-seq', ['all', ['has', 'seq'], movementFilter(s.year)] as any);
      fadeMovements(s.year);
      micro.setYear(s.year);
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
      const b = boards.find(x => x.id === s.board) ?? null;
      map.setMaxZoom(b ? BOARD_MAX_ZOOM : MAP_MAX_ZOOM);
      // 전투 재생(말판 v2, OVERHAUL §3.6): 렌더러는 지연 청크다. 처음 말판이 켜질 때 싣는다.
      const apply = () => { if (!battle) return; if (!b) battle.setBoard(null); else if (!battle.playing() || Math.floor(battle.t()) !== s.phase) battle.setBoard(b, s.phase); };
      if (battle || !b) apply();
      else import('./battle').then(m => {
        if (battle) { apply(); return; }
        battle = m.createBattle(map, { palette: Object.fromEntries(d.actors.map(a => [a.id, a.color])), before: () => map.getLayer('label-marine') ? 'label-marine' : undefined, onSelect: sel => store.set({ sel }) });
        battle.onPhase(i => { if (store.get().phase !== i) store.set({ phase: i }); });
        battleFns.forEach(fn => fn(battle!)); apply();
      });
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
    /** 활성 미시지도 정의(없으면 null). 콜아웃·모바일 시트가 본다. */
    micro: () => micro.active(),
    /** 전투 재생 컨트롤러(말판이 한 번 켜진 뒤에만). */
    battle: () => battle,
    onBattle(fn: (b: BattleCtl) => void) { battleFns.add(fn); if (battle) fn(battle); return () => battleFns.delete(fn); },
    onMicro(fn: (def: MicroMapDef | null) => void) { microFns.add(fn); fn(micro.active()); return () => microFns.delete(fn); },
    setPeople(fc: { type: 'FeatureCollection'; features: object[] }) {
      peopleFc = fc as typeof EMPTY_FC;
      (map.getSource('people') as maplibregl.GeoJSONSource | undefined)?.setData(fc as any);
      syncPeopleIcons(peopleFc);
      syncPeopleTokens(peopleFc);
    },
    onData(fn: () => void) { onData = fn; },
    // 좁은 화면에서는 줌을 깎는다 — 장면은 데스크톱 프레임으로 잡혀 있다(present.fitZoom).
    flyTo(sc: Scene) { if (sc.center) map.flyTo({ center: sc.center, zoom: sc.zoom != null ? fitZoom(sc.zoom, container.clientWidth) : undefined, pitch: store.get().view === '2d' ? 0 : (sc.pitch ?? pitch3d), bearing: store.get().view === '2d' ? 0 : (sc.bearing ?? bearing3d), duration: dur(1400), essential: true }); },
    // 패널 관계 행 hover → 지도 위 상대 객체 펄스(feature-state hover). id 없으면 해제.
    pulse(id: string | null) {
      const source = id?.startsWith('event:') ? 'battles' : id?.startsWith('place:') ? 'settlements' : null;
      setHover(id && source && map.getSource(source) ? { source, id } : null);
    },
    home() { if (bb) map.fitBounds([[bb[0] + 12, bb[1] + 8], [bb[2] - 20, bb[3] - 10]], { padding: 40, duration: dur(900) }); },
    zoom(delta: number) { map.easeTo({ zoom: map.getZoom() + delta, duration: dur(300) }); },
    // 테마 전환: 베이스맵 스타일 재빌드 → 데이터 레이어 다시 얹기(setStyle이 소스·레이어를 지운다)
    setDark(dk: boolean) { isDark = dk; activeSkin = dk ? 'dark' : 'light'; loaded = false; map.once('style.load', addData); map.setStyle(buildStyle(d.manifest, root, ds, { dark: dk })); },
    // 스킨 갈아끼우기(내보내기용). idle까지 기다렸다 resolve.
    setSkin(skin: Skin | null): Promise<void> {
      activeSkin = skin ?? (isDark ? 'dark' : 'light'); // 라벨 테두리가 따라간다 — setStyle보다 **먼저**
      loaded = false; map.once('style.load', addData);
      map.setStyle(buildStyle(d.manifest, root, ds, skin ? { skin } : { dark: isDark }));
      return new Promise(res => map.once('idle', () => res()));
    },
  };
}
export type Engine = ReturnType<typeof createEngine>;

export const allLayers = (d: Dataset) => [...(d.manifest.layers ?? []), 'relief', 'bathy', 'rivers', 'labels', 'landmarks', 'graph', 'story_battles'];
