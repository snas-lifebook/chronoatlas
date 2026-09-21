// 카이사르 팩 교보재. 정본 어댑터 산출물이 아니라 data/overlays. teaching: true.
import type { Feature } from './schema';

const pompey = Object.values(import.meta.glob('../data/overlays/pack-pompey.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; features: Feature[] } | undefined;
const battles = Object.values(import.meta.glob('../data/overlays/pack-battles.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; features: Feature[] } | undefined;
const cast = Object.values(import.meta.glob('../data/overlays/pack-cast.json', { eager: true, import: 'default' }))[0] as
  import('./people').TeachingCast | undefined;

type HideRow = { id: string; valid_from: number; source: string };
/** 정본 오류를 정정 전까지 가리는 행(R59). `layer`는 settlements(기본) 또는 battle. 예: place:본곶이 프랑스 좌표로 들어 있다. */
type HideIdRow = { id: string; layer?: 'settlements' | 'battle'; source: string };
const anachro = Object.values(import.meta.glob('../data/overlays/pack-anachronisms.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; hide_before: HideRow[]; hide_admin_before?: HideRow[]; hide?: HideIdRow[] } | undefined;

const regions = Object.values(import.meta.glob('../data/overlays/pack-regions.json', { eager: true, import: 'default' }))[0] as
  { show?: string[] } | undefined;
/** 발표 축척에서 띄울 **지역 이름** 허용 목록. 기하는 정본(`settlements.geojson`의
 *  `kind: region` 58개)에 이미 있고, 이 목록은 그중 기원전 1세기에 통용된 이름만 고른다 —
 *  「독일」·「러시아」·「팔레스티나」처럼 시대가 안 맞는 것과 중복(`유다`/`유대`)을 뺀다.
 *  버린 근거는 pack-regions.json의 `drop`에 이름마다 한 줄로 적혀 있다. */
export const PACK_REGIONS: string[] = regions?.show ?? [];

const polityColors = Object.values(import.meta.glob('../data/overlays/pack-polity-colors.json', { eager: true, import: 'default' }))[0] as
  { colors?: Record<string, { color: string; why?: string }> } | undefined;
/** 폴리티 이름 → 색. 정본 `actor` 팔레트를 **덮는다**(기하·연도는 그대로).
 *
 *  정본 색은 세력 계열 단위라 한 계열에 여러 나라가 묶이면 같은 색이 된다 — 기원전 60년
 *  프레임에서 `기타중립` 하나에 12개 폴리티가 몰려 파르티아·아르메니아·트라키아·나바테아·
 *  유대가 전부 같은 회색이었다. 여기서 이름마다 색을 준다. 안 덮는 것(갈라티아 = 갈리아
 *  초록)은 그 색이 **맞는 정보**이기 때문이고, 근거는 JSON의 `keep`에 적혀 있다. */
export const PACK_POLITY_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(polityColors?.colors ?? {}).map(([k, v]) => [k, v.color]));

export type ClientRow = { name: string; from: number; to: number; kind?: 'client' | 'ally' | 'hostile'; why?: string; source?: string; confidence?: string };
const clients = Object.values(import.meta.glob('../data/overlays/pack-clients.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; clients?: ClientRow[] } | undefined;
/** 「로마의 속국」 연표. **기하가 없다** — 정본 폴리곤 이름만 가리킨다.
 *
 *  **구간은 반열림 `[from, to)`이다.** 자연어 「기원전 48~47년」을 `to: -47`로 옮기면
 *  기원전 47년이 빠져 젤라 장에서 폰토스가 속국으로 칠해진다 — 정답은 `to: -46`.
 *  「기원전 27년까지」를 `to: -27`로 옮기면 아우구스투스 장에서 무늬가 통째로 사라진다 —
 *  정답은 `to: -26`. 둘 다 실제로 났고 **렌더는 에러를 안 내서 눈으로는 못 잡는다.** */
export const PACK_CLIENTS: ClientRow[] = clients?.clients ?? [];

/** 그 해에 로마의 세력권이던 폴리티 이름들.
 *
 *  `hostile` 구간은 **뺀다.** 폰토스가 그 자리다 — 기원전 63년 폼페이우스가 왕국을 해체한
 *  뒤로는 속국이지만, 기원전 48~47년에는 파르나케스 2세가 반기를 들어 되찾으려 했고
 *  카이사르가 젤라에서 그를 쳤다. 그 두 해에 폰토스에 사선을 얹으면 일곱째 장이
 *  「로마 세력권을 로마가 친다」가 된다. */
export function clientsAt(year: number): { client: string[]; ally: string[]; all: string[] } {
  const live = (k?: string) => PACK_CLIENTS.filter(c => (c.kind ?? 'client') === k && c.from <= year && year < c.to);
  const hostile = new Set(live('hostile').map(c => c.name));
  const pick = (k: 'client' | 'ally') => [...new Set(live(k).filter(c => !hostile.has(c.name)).map(c => c.name))];
  const client = pick('client'), ally = pick('ally');
  return { client, ally, all: [...new Set([...client, ...ally])] };
}

// 아래 셋은 **살아 있는 배열**이다. 포인트 묶음 교보재(loadPack)가 늦게 와서 여기에 합쳐진다(R59). 새 배열로 바꾸지 말 것.
export const PACK_MOVEMENTS: Feature[] = pompey?.features ?? [];
export const PACK_BATTLES: Feature[] = battles?.features ?? [];
export const PACK_CAST: import('./people').TeachingCast = cast ?? { teaching: true as const, people: [] };

/** 비국가 민족·주변 왕국 교보재. 정본이 국가 단위로만 코딩돼 게르마니아·다키아·
 *  사르마티아·아오르시·보스포루스·브리타니아가 한 면도 없다 — 갈리아와 같은 원인이다.
 *  기하는 Natural Earth(PD) 정점 복사이고 정본 폴리티와 겹침 0으로 잘라 냈다. */
/** 평야·곡창지대 교보재. **세력이 아니라 지리**라서 `actor`가 없고 `kind`(granary/barren)만
 *  본다 — `polityColor`를 타면 안 된다. 정본 폴리티와 **일부러 겹친다**(로마 영토 위에 곡창이
 *  얹히는 그림이 맞다). 대표님 강의의 인과 축이 여기다 — 「평야 = 잉여생산물 = 제국」. */
export const PACK_PLAINS = Object.values(import.meta.glob('../data/overlays/pack-plains.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; features: Feature[] } | undefined;

// 세력 문장이 있는 세력(scripts/build-emblems.py가 쓴다). 장기말 깃발·배너 카드가 본다. 목록만 실린다(작다).
const emblems = Object.values(import.meta.glob('../data/overlays/pack-emblems.json', { eager: true, import: 'default' }))[0] as { actors?: string[] } | undefined;
export const PACK_EMBLEMS = new Set<string>(emblems?.actors ?? []);
// 주변 민족(pack-peoples.json)은 엔진이 자산 URL로 받는다(R46). 여기서 eager로 실으면 초기 번들 11 kB.

// 미시지도 셋(알레시아·로마·알렉산드리아)과 도판은 2026-09-17에 data/micromaps/<id>.json 레지스트리로 갔다.

type LegionRow = { year: number; legions: number | null; men_low: number | null; men_high: number | null; confidence?: string };
const LEGIONS: Record<string, LegionRow[]> = {};   // 살아 있는 표. loadLegions(카이사르 팩)·loadPack(묶음)이 채운다(R59)
let legionsReady: Promise<void> | null = null;
/** 카이사르 팩 군단 표(pack-legions.json, 5.6 kB gz)는 첫 페인트에 필요 없다 — 말의 병력 줄에만 쓴다. 자산 URL로 받는다(R46).
 *  2026-09-21에 eager에서 뺐다: 포인트 묶음 기반을 얹자 초기 JS가 400.1 kB로 게이트를 넘었다. 받으면 App이 dataTick을 올려 말을 다시 세운다. */
export function loadLegions(): Promise<void> {
  if (!legionsReady) legionsReady = fetch(new URL('../data/overlays/pack-legions.json', import.meta.url).href)
    .then(r => (r.ok ? r.json() : undefined))
    .then(j => { for (const [pid, rows] of Object.entries((j?.by_person as Record<string, LegionRow[]> | undefined) ?? {})) (LEGIONS[pid] ??= []).push(...rows); })
    .catch(() => {});
  return legionsReady;
}

/** 그 해에 이 사람이 쥔 군단 수와 병력. 해당 연도 이하에서 가장 가까운 기록을 쓴다 —
 *  자료가 있는 해만 찍혀 있어서(BC 58·55·53·52·49·48…) 그 사이 해는 직전 기록이 유효하다. */
export function legionsAt(personId: string, year: number) {
  const rows = LEGIONS[personId];
  if (!rows?.length) return null;
  let best: (typeof rows)[number] | null = null;
  for (const r of rows) if (r.year <= year && (!best || r.year > best.year)) best = r;
  return best;
}

// 발표 설명문(4.5 kB gz)은 발표 모드에서만 읽는다. 자산 URL로 두고 받는다(R46). 받기 전엔 sceneBrief가 null이고 App이 받은 뒤 다시 그린다.
type SceneText = { scenes: Record<string, { note?: string; event_ko?: string; look_for?: string; stat?: { value: string; label: string } }> };
let sceneText: SceneText | undefined;
let sceneTextReady: Promise<void> | null = null;
export function loadSceneText(): Promise<void> {
  if (!sceneTextReady) sceneTextReady = fetch(new URL('../data/overlays/pack-scene-text.json', import.meta.url).href).then(r => (r.ok ? r.json() : undefined)).then(j => { sceneText = j; }).catch(() => {});
  return sceneTextReady;
}

/** 북마크로 점프했을 때 발표자가 읽을 사건 설명. 장면 파일의 한 줄 note와 별개로,
 *  「무슨 일이 벌어지는가 · 왜 중요한가 · 지도에서 무엇을 볼 것인가」를 담는다. */
export function sceneBrief(id: string | null) {
  return (id && sceneText?.scenes?.[id]) || null;
}

const HIDE_BEFORE: HideRow[] = anachro?.hide_before ?? [];         // 살아 있는 배열. loadPack이 합친다(R59)
const HIDE_ADMIN: HideRow[] = anachro?.hide_admin_before ?? [];
const HIDE_IDS: HideIdRow[] = anachro?.hide ?? [];

/** 어느 해든 가릴 id(정본 오류 임시 가리기). 정본이 고쳐지면 행을 지운다. */
export function hiddenIds(layer: 'settlements' | 'battle'): string[] {
  // 'battles'(층 이름 복수)로 적힌 행도 받는다 — 교보재 초안이 그렇게 썼다.
  const norm = (l?: string) => (l === 'battles' ? 'battle' : (l ?? 'settlements'));
  return HIDE_IDS.filter(h => norm(h.layer) === layer).map(h => h.id);
}

/** 그 해에 아직 없는 이름의 정착지 id. 정착지 레이어에 연도 필드가 없어서 생기는 구멍이다
 *  — 어느 해를 띄워도 220개가 다 뜬다. 연도를 지어내지 않고, 확실히 후대인 이름만 가린다. */
export function hiddenPlaces(year: number): string[] {
  return HIDE_BEFORE.filter(h => year < h.valid_from).map(h => h.id);
}

/** 그 해에 아직 없던 속주 경계. 정착지와 같은 구멍이 admin_regions에도 있다 —
 *  아우구스투스가 만든 갈리아 속주 셋이 `valid_from: null`이라 **기원전 60년 판에도**
 *  보라 점선으로 그어져 있었다. 그 해 갈리아는 로마 땅도 아니었다. */
export function hiddenAdmin(year: number): string[] {
  return HIDE_ADMIN.filter(h => year < h.valid_from).map(h => h.id);
}

// 발표 줌(4~6)에서 rank 3 도시가 안 떠서, 이야기 장소만 이름표를 따로 켠다(story-place-label).
// **해마다 다르다**(R59): 카이사르 팩의 알레시아·루비콘 강·브린디시가 기원전 321년 판에 굵게 뜨면 그 장의 이야기가 아니다.
// 살아 있는 배열이다 — 포인트 묶음의 `<묶음>-places.json`이 자기 이야기 장소를 (그 묶음의 연도 창으로) 더한다.
export type StoryPlace = { id: string; from?: number; to?: number };   // 반열림 [from, to)
export const STORY_PLACES: StoryPlace[] = [
  { id: 'place:로마' },
  { id: 'place:알렉산드리아', from: -331 },
  ...['place:알레시아', 'place:루비콘강', 'place:브린디시', 'place:일레르다', 'place:파르살루스', 'place:문다평원', 'place:라벤나']
    .map(id => ({ id, from: -100, to: 0 })),
];
export function storyPlacesAt(year: number): string[] {
  return STORY_PLACES.filter(p => (p.from ?? -1e9) <= year && year < (p.to ?? 1e9)).map(p => p.id);
}
// 라리사를 뺐다. 파르살루스에서 30km라 지중해 축척에서 **화면 8px** 거리인데, 이름표
// 자리다툼에서 먼저 놓이는 쪽(정착지)이 이겨서 **정작 그 장면의 제목인 「파르살루스」가
// 사라졌다.** 둘 다 띄울 방법은 없고(8px다) 이야기가 쓰는 쪽은 전투다. 폼페이우스가
// 패주해 들른 곳이지만 아홉 장 어디도 라리사를 말하지 않는다.

// ── 포인트 묶음 교보재 (2026-09-21, R59) ────────────────────────────────────
// p12(포인트 01·02) · p345(03·04·05) · p911(09·10·11). 파일은 `data/overlays/<묶음>-<종류>.json`이고 **지연 로드**다 —
// eager로 실으면 초기 번들 400 kB 게이트를 넘는다(R46). 그 해(PACK_YEARS, 반열림)나 그 묶음의 장면(`p12-…`)에
// 들어설 때 받아 위의 살아 있는 배열에 합친다. 합친 뒤에는 엔진 refreshPack()이 소스를 다시 싣는다.
//
// 종류(파일 이름 접미)와 합쳐지는 자리:
//   cast → PACK_CAST.people(+principals.ids) · battles → PACK_BATTLES · routes → PACK_MOVEMENTS(정본에 같은 route가 있으면 엔진이 뺀다)
//   places → PACK_PLACES · anachronisms → hide_before/hide_admin_before · legions → by_person
//   그 밖(hatch·islands·rivers…) → PACK_EXTRA['<묶음>-<종류>'] 에 원문 그대로. 엔진이 이름으로 집는다.
export const PACK_YEARS: Record<string, [number, number]> = { p12: [-800, -230], p345: [-230, -60], p911: [-45, 70] };
const PACK_LOADERS: Record<string, Record<string, () => Promise<unknown>>> = {
  p12: import.meta.glob('../data/overlays/p12-*.json', { import: 'default' }),
  p345: import.meta.glob('../data/overlays/p345-*.json', { import: 'default' }),
  p911: import.meta.glob('../data/overlays/p911-*.json', { import: 'default' }),
};
export const PACK_EXTRA: Record<string, unknown> = {};
const packDone = new Map<string, Promise<boolean>>();

/** 이 해·이 장면이 필요로 하는 묶음 id. 장면 id 접두(`p345-`)가 연도 창보다 우선 — 창 경계의 장면도 제 교보재를 받는다. */
export function packsFor(year: number, scene: string | null): string[] {
  const out = Object.entries(PACK_YEARS).filter(([, [lo, hi]]) => lo <= year && year < hi).map(([k]) => k);
  const m = scene?.match(/^(p12|p345|p911)-/);
  if (m && !out.includes(m[1])) out.push(m[1]);
  return out;
}

/** 한 묶음을 받아 합친다. **처음 받은 때만 true** — 그때만 엔진 refreshPack과 다시 그리기가 필요하다. */
export function loadPack(id: string): Promise<boolean> {
  const done = packDone.get(id);
  if (done) return done.then(() => false);
  const loaders = PACK_LOADERS[id];
  if (!loaders) return Promise.resolve(false);
  const p = Promise.all(Object.entries(loaders).map(async ([path, load]) =>
      [path.replace(/^.*\/p\d+-([a-z0-9_-]+)\.json$/, '$1'), await load()] as const))
    .then(entries => { for (const [kind, json] of entries) mergePack(id, kind, json as Record<string, unknown> | undefined); return true; })
    .catch(() => false);
  packDone.set(id, p);
  return p;
}

function mergePack(pack: string, kind: string, j: Record<string, unknown> | undefined) {
  if (!j) return;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  if (kind === 'cast') {
    PACK_CAST.people.push(...arr<TeachingCast['people'][number]>(j.people));
    const ids = arr<string>((j.principals as { ids?: unknown } | undefined)?.ids);
    if (ids.length) (PACK_CAST.principals ??= { ids: [] }).ids.push(...ids.filter(x => !PACK_CAST.principals!.ids.includes(x)));
  }
  else if (kind === 'battles') PACK_BATTLES.push(...arr<Feature>(j.features));
  else if (kind === 'routes') PACK_MOVEMENTS.push(...arr<Feature>(j.features));
  else if (kind === 'places') {
    // 문자열이면 그 묶음의 연도 창, 객체면 제 창. 같은 id라도 창이 다르면 둘 다 둔다.
    const [lo, hi] = PACK_YEARS[pack] ?? [-1e9, 1e9];
    for (const row of arr<string | StoryPlace>(j.places)) {
      const p: StoryPlace = typeof row === 'string' ? { id: row, from: lo, to: hi } : { from: lo, to: hi, ...row };
      if (!STORY_PLACES.some(q => q.id === p.id && q.from === p.from && q.to === p.to)) STORY_PLACES.push(p);
    }
  }
  else if (kind === 'anachronisms') { HIDE_BEFORE.push(...arr<HideRow>(j.hide_before)); HIDE_ADMIN.push(...arr<HideRow>(j.hide_admin_before)); HIDE_IDS.push(...arr<HideIdRow>(j.hide)); }
  else if (kind === 'legions') { for (const [pid, rows] of Object.entries((j.by_person as Record<string, unknown>) ?? {})) (LEGIONS[pid] ??= []).push(...arr<LegionRow>(rows)); }
  else PACK_EXTRA[`${pack}-${kind}`] = j;
}
type TeachingCast = import('./people').TeachingCast;

// ── 묶음 사선·강 강조 (R59, p911) ────────────────────────────────────────────
export type HatchRow = { name: string; actor: string; from: number; to: number; source?: string };
/** 그 해에 칠할 사선(모든 묶음의 `-hatch` 세트). 같은 이름에 둘이면 **늦게 시작한 행**이 이긴다 — 기증(BC 34)이 삼두 분할(BC 42) 위에 얹힌다. 반열림 [from, to). */
export function packHatchAt(year: number): { rows: HatchRow[]; colors: Record<string, string> } {
  const rows = new Map<string, HatchRow>(); const colors: Record<string, string> = {};
  for (const [k, v] of Object.entries(PACK_EXTRA)) {
    if (!k.endsWith('-hatch')) continue;
    const h = v as { sets?: Record<string, { rows?: HatchRow[] }>; colors?: Record<string, string> };
    Object.assign(colors, h.colors ?? {});
    for (const set of Object.values(h.sets ?? {})) for (const r of set.rows ?? []) {
      if (!(r.from <= year && year < r.to)) continue;
      const prev = rows.get(r.name);
      if (!prev || r.from > prev.from) rows.set(r.name, r);
    }
  }
  return { rows: [...rows.values()], colors };
}
/** 장면이 지목한 강 강조 이름(`-rivers`, rivers.geojson의 name 문자열). `scenes`가 있으면 그 장면에서만. */
export function packRiversFor(scene: string | null): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(PACK_EXTRA)) {
    if (!k.endsWith('-rivers')) continue;
    const r = v as { scenes?: string[]; rivers?: { canon_names?: string[] }[] };
    if (r.scenes && !(scene && r.scenes.includes(scene))) continue;
    for (const x of r.rivers ?? []) out.push(...(x.canon_names ?? []));
  }
  return out;
}
