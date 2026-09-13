// 콜아웃 데이터 로딩과 앵커 좌표 풀이. 순수 함수 — 뷰는 이 산출물을 그리기만 한다.
//
// 콜아웃은 `anchor.feature`로 미시 지도 피처를 가리킨다(`alesia:inner`, `roma:pomerium`,
// `alexandria:heptastadion` …). 화면에 찍으려면 좌표가 필요하고, 피처는 점·선·면이 섞여
// 있다. **대푯점을 여기서 한 번 구해 둔다** — 렌더마다 다시 재면 지도를 움직일 때마다
// 같은 계산을 반복한다.
import { ALESIA, ROMA_URBS, ALEXANDRIA } from './packData';
import { ALESIA_MIN_ZOOM, ROMA_MIN_ZOOM, ALEXANDRIA_MIN_ZOOM } from './present';

export type MicroMap = 'alesia' | 'roma' | 'alexandria';

export interface Callout {
  id: string;
  map: MicroMap;
  num: number;
  side: 'left' | 'right';
  title: string;
  body: string;
  cite?: string | null;
  links?: { label: string; url: string }[];
  image?: { url: string; credit: string; alt: string } | null;
  /** 레포에 구운 썸네일. **라이선스가 허락한 것만 있다** — 자세한 것은 `THUMBS` 참고. */
  thumb?: { file: string; license: string; page: string } | null;
  at: [number, number];
}

const thumbRaw = Object.values(import.meta.glob('../data/overlays/pack-callout-thumbs.json', { eager: true, import: 'default' }))[0] as
  { thumbs?: Record<string, { baked?: boolean; file?: string; license?: string; page?: string; why?: string }> } | undefined;
/** 콜아웃 id → 구운 썸네일.
 *
 *  River: "각 설명에서 사진이 있으면 작게 사진을 해당 콜아웃 안에 넣으면 좋을듯."
 *
 *  그런데 사진을 **런타임에 커먼즈에서 불러올 수 없다** — 레포 `AGENTS.md`가 「런타임 외부
 *  호출 0」이다. 그래서 빌드 전에 구워 레포에 넣는데, 거기에 두 번째 제약이 걸린다:
 *  같은 문서가 「카피레프트 데이터는 재배포하지 않는다」고 못 박는다. 열한 장의 라이선스를
 *  커먼즈 API로 **파일마다 직접 확인**한 결과(데이터에 적힌 credit 문자열을 믿지 않았다)
 *  퍼블릭 도메인 넷 + CC BY 하나만 구울 수 있고, CC BY-SA 여섯은 링크로 남는다.
 *  그래서 카드에 **썸네일이 있는 것과 없는 것이 섞인다** — 게으름이 아니라 라이선스다. */
export const THUMBS: Record<string, { file: string; license: string; page: string }> = Object.fromEntries(
  Object.entries(thumbRaw?.thumbs ?? [])
    .filter(([, v]) => v.baked && v.file)
    .map(([k, v]) => [k, { file: v.file!, license: v.license ?? '', page: v.page ?? '' }]));

type Geom = { type: string; coordinates: unknown };
type Feat = { properties?: { id?: string }; geometry?: Geom };

/** 피처의 대푯점. 면은 정점 평균, 선은 가운데 정점, 점은 그대로.
 *
 *  면에 무게중심(centroid)을 안 쓴 이유: 알레시아 포위선처럼 **가늘고 길게 휜 고리**는
 *  무게중심이 고리 한가운데 빈 땅에 떨어진다. 정점 평균도 같은 문제가 있지만 고리에서는
 *  선 위 가운데 정점이 제일 낫고, 실제로 포위선 둘은 LineString이라 그 경로를 탄다. */
export function representativePoint(g: Geom | undefined): [number, number] | null {
  if (!g) return null;
  if (g.type === 'Point') return g.coordinates as [number, number];
  if (g.type === 'LineString') {
    const c = g.coordinates as [number, number][];
    return c.length ? c[Math.floor(c.length / 2)] : null;
  }
  const pts: [number, number][] = [];
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') { pts.push(c as [number, number]); return; }
    if (Array.isArray(c)) for (const x of c) walk(x);
  };
  walk(g.coordinates);
  if (!pts.length) return null;
  const n = pts.length;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
}

const raw = Object.values(import.meta.glob('../data/overlays/pack-callouts.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; callouts: (Omit<Callout, 'at'> & { anchor: { feature?: string; lnglat?: [number, number] } })[] } | undefined;

const SOURCES: Record<MicroMap, { features?: unknown[] } | undefined> = {
  alesia: ALESIA, roma: ROMA_URBS, alexandria: ALEXANDRIA,
};

function anchorPoint(mapId: MicroMap, a: { feature?: string; lnglat?: [number, number] }): [number, number] | null {
  if (a.lnglat) return a.lnglat;
  if (!a.feature) return null;
  const f = (SOURCES[mapId]?.features as Feat[] | undefined)?.find(x => x.properties?.id === a.feature);
  return representativePoint(f?.geometry);
}

/** 좌표를 못 찾은 콜아웃은 **버린다.** 지도 밖 (0,0)에 핀을 찍느니 없는 게 낫다.
 *  버린 것은 개발 콘솔에 남긴다 — 데이터 오타를 조용히 삼키면 다음 사람이 못 찾는다. */
export const CALLOUTS: Callout[] = (raw?.callouts ?? []).flatMap(c => {
  const at = anchorPoint(c.map, c.anchor);
  if (!at) { if (import.meta.env?.DEV) console.warn('콜아웃 앵커를 못 찾았다', c.id, c.anchor); return []; }
  const { anchor: _drop, ...rest } = c;
  return [{ ...rest, at, thumb: THUMBS[c.id] ?? null }];
});

/** 지금 화면이 어느 미시 지도인가. 줌이 문턱을 넘고 **그 지도 근처**여야 한다 —
 *  줌만 보면 로마에서 z13으로 당겼을 때 알레시아 콜아웃이 같이 뜬다. */
const HOME: Record<MicroMap, { at: [number, number]; min: number; span: number }> = {
  alesia: { at: [4.4958, 47.535], min: ALESIA_MIN_ZOOM, span: 0.6 },
  roma: { at: [12.4823, 41.8925], min: ROMA_MIN_ZOOM, span: 0.35 },
  alexandria: { at: [29.897, 31.199], min: ALEXANDRIA_MIN_ZOOM, span: 0.35 },
};

export function microMapAt(zoom: number, center: [number, number]): MicroMap | null {
  let best: { id: MicroMap; d: number } | null = null;
  for (const [id, h] of Object.entries(HOME) as [MicroMap, typeof HOME[MicroMap]][]) {
    if (zoom < h.min) continue;
    const d = Math.hypot(center[0] - h.at[0], center[1] - h.at[1]);
    if (d > h.span) continue;
    if (!best || d < best.d) best = { id, d };
  }
  return best?.id ?? null;
}
