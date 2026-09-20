// schema/micromap.ts: 미시지도 데이터 계약 (OVERHAUL §3.2, R47). zod는 여기만. src/는 import type만.
//
// 미시지도 한 장 = data/micromaps/<id>.json 파일 하나. 지형·건물 피처, 콜아웃, 카메라, 문턱, 도판, DEM 인셋, 말판 참조가
// 전부 여기 있다. 엔진은 kind 표(src/map/micro.ts KIND_PAINT)로 그리므로 새 지도는 JSON 한 장 + 근거 문서로 끝난다.
import { z } from 'zod';

/** 그리는 법이 정해진 kind만 허용한다. 늘리면 src/map/micro.ts의 KIND_PAINT에도 한 줄(테스트가 같은지 본다). */
export const KINDS = [
  'oppidum', 'inner_line', 'outer_line', 'camp', 'redoubt', 'gaul_camp', 'hill', 'river', 'plain', 'trap', 'ditch',
  'building', 'theatre', 'forum', 'temple', 'field', 'wall', 'boundary', 'gate', 'circus', 'road',
  'lighthouse', 'island', 'causeway', 'harbor', 'district', 'cape', 'lake',
] as const;
/** 정직성 태그. 확정(유구·현존) · 근사(자리 확실, 면은 단순화) · 복원(학설) · 논쟁(학계 갈림). MICROMAP-UX §4. */
export const GRADES = ['확정', '근사', '복원', '논쟁'] as const;

const LonLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const Geometry = z.object({ type: z.enum(['Point', 'LineString', 'Polygon', 'MultiLineString', 'MultiPolygon']), coordinates: z.any() });

export const MicroFeature = z.object({
  type: z.literal('Feature'),
  properties: z.object({
    id: z.string().regex(/^[a-z0-9-]+:[A-Za-z0-9_:-]+$/, 'id는 <지도>:<슬러그>'),   // 알레시아 alesia:campA · alesia:hill:rea 처럼 대문자·콜론도 쓴다
    name_ko: z.string().min(1),
    name_la: z.string().nullable().optional(),
    kind: z.enum(KINDS),
    grade: z.enum(GRADES),
    source: z.string().min(1),          // 사료·근거 문장. 알레시아는 BG 절 번호, 로마는 태그+설명. 자유 텍스트
    note_ko: z.string().nullable().optional(),
    wiki: z.string().url().nullable().optional(),
    /** 시기 피처(2026-09-21, R59). 지도 한 장이 여러 해를 맡을 때 — 로마 시내가 BC 44와 AD 41을 같이 싣는다.
     *  `built_year`: 그 해보다 앞이면 숨긴다(카스트라 프라이토리아 AD 23). `gone_year`: 그 해부터 숨긴다. 둘 다 없으면 늘 보인다. */
    built_year: z.number().int().optional(),
    gone_year: z.number().int().optional(),
  }).passthrough(),                     // attested·camp_letter 같은 지도별 필드는 그대로 둔다
  geometry: Geometry,
});

export const Callout = z.object({
  id: z.string().min(1),
  topic: z.enum(['terrain', 'unit', 'event']).default('terrain'),
  /** 콜아웃도 시기를 가질 수 있다(R59). 반열림 `[from_year, to_year)`. 없으면 늘 뜬다. */
  from_year: z.number().int().optional(),
  to_year: z.number().int().optional(),
  anchor: z.union([z.object({ feature: z.string().min(1) }), z.object({ lnglat: LonLat }), z.object({ unit: z.string().min(1) })]),
  side: z.enum(['left', 'right']),
  num: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().min(1).max(160),
  cite: z.string().min(1).nullable().optional(),
  links: z.array(z.object({ label: z.string().min(1), url: z.string().url() })).default([]),
  image: z.object({ url: z.string(), credit: z.string(), alt: z.string() }).nullable().default(null),
});

/** 미시지도 밑에 깔 도판. 모양은 옛 pack-basemaps.json 항목과 같다(지오레퍼런싱 결과를 다시 안 만든다). */
export const Basemap = z.object({
  id: z.string(), file: z.string(), corners: z.object({ w: z.number(), e: z.number(), n: z.number(), s: z.number() }),
  opacity: z.number().min(0).max(1).default(0.5), min_zoom: z.number().optional(),
  title: z.string().optional(), caveat: z.string().optional(), short_caveat: z.string().optional(), source: z.string().optional(), rms_m: z.number().optional(),
}).passthrough();

export const MicroMap = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  year: z.number().int(),
  teaching: z.literal(true),
  source: z.string().min(10),
  home: z.object({ at: LonLat, minZoom: z.number().min(8).max(14), span: z.number().positive().max(2) }),
  view: z.object({ center: LonLat, zoom: z.number().min(8).max(16), pitch: z.number().min(0).max(85).default(0), bearing: z.number().default(0) }),
  hide: z.array(z.string()).default(['movements']),
  basemap: Basemap.nullable().default(null),
  dem: z.object({ dir: z.string().regex(/^terrain-[a-z0-9-]+$/), minzoom: z.number().int().default(8), maxzoom: z.number().int().default(12) }).nullable().default(null),
  /** 토지피복 래스터 인셋(ESA WorldCover, CC BY 4.0). DEM 음영 밑에 깐다(OVERHAUL §3.6b). */
  landcover: z.object({ dir: z.string().regex(/^landcover-[a-z0-9-]+$/), minzoom: z.number().int().default(8), maxzoom: z.number().int().default(12), opacity: z.number().min(0).max(1).default(0.55) }).nullable().default(null),
  board: z.string().nullable().default(null),
  features: z.array(MicroFeature).min(1),
  callouts: z.array(Callout).default([]),
});

export type MicroMapDef = z.infer<typeof MicroMap>;
export type CalloutDef = z.infer<typeof Callout>;
export type MicroFeatureDef = z.infer<typeof MicroFeature>;

/** 스키마만으로 못 잡는 것. 빈 배열이면 통과. */
export function lintMicroMap(def: MicroMapDef, ctx: { boards: string[] }): string[] {
  const err: string[] = [];
  const ids = new Set<string>();
  for (const f of def.features) {
    if (!f.properties.id.startsWith(`${def.id}:`)) err.push(`${f.properties.id}: 접두사가 ${def.id}: 가 아니다`);
    if (ids.has(f.properties.id)) err.push(`${f.properties.id}: id 중복`);
    ids.add(f.properties.id);
  }
  const nums = def.callouts.map(c => c.num);
  if (new Set(nums).size !== nums.length) err.push('콜아웃 num 중복');
  for (const c of def.callouts) {
    if ('feature' in c.anchor && !ids.has(c.anchor.feature)) err.push(`${c.id}: 앵커 피처 없음 ${c.anchor.feature}`);
    if ('unit' in c.anchor && !def.board) err.push(`${c.id}: unit 앵커인데 board가 없다`);
    if (c.topic === 'unit' && !def.board) err.push(`${c.id}: topic unit인데 board가 없다`);
  }
  if (def.board && !ctx.boards.includes(def.board)) err.push(`board 없음 ${def.board}`);
  const [w, s, e, n] = [def.home.at[0] - def.home.span, def.home.at[1] - def.home.span, def.home.at[0] + def.home.span, def.home.at[1] + def.home.span];
  const [cx, cy] = def.view.center;
  if (cx < w || cx > e || cy < s || cy > n) err.push('view.center가 home 범위 밖');
  return err;
}
