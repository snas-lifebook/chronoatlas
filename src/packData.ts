// 카이사르 팩 교보재. 정본 어댑터 산출물이 아니라 data/overlays. teaching: true.
import type { Feature } from './schema';

const pompey = Object.values(import.meta.glob('../data/overlays/pack-pompey.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; features: Feature[] } | undefined;
const battles = Object.values(import.meta.glob('../data/overlays/pack-battles.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; features: Feature[] } | undefined;
const cast = Object.values(import.meta.glob('../data/overlays/pack-cast.json', { eager: true, import: 'default' }))[0] as
  import('./people').TeachingCast | undefined;

type HideRow = { id: string; valid_from: number; source: string };
const anachro = Object.values(import.meta.glob('../data/overlays/pack-anachronisms.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; hide_before: HideRow[]; hide_admin_before?: HideRow[] } | undefined;

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

export const PACK_MOVEMENTS: Feature[] = pompey?.features ?? [];
export const PACK_BATTLES: Feature[] = battles?.features ?? [];
export const PACK_CAST = cast ?? { teaching: true as const, people: [] };

export const ALESIA = Object.values(import.meta.glob('../data/overlays/pack-alesia.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; features: unknown[] } | undefined;

const legions = Object.values(import.meta.glob('../data/overlays/pack-legions.json', { eager: true, import: 'default' }))[0] as
  { by_person: Record<string, { year: number; legions: number | null; men_low: number | null; men_high: number | null; confidence?: string }[]> } | undefined;

/** 그 해에 이 사람이 쥔 군단 수와 병력. 해당 연도 이하에서 가장 가까운 기록을 쓴다 —
 *  자료가 있는 해만 찍혀 있어서(BC 58·55·53·52·49·48…) 그 사이 해는 직전 기록이 유효하다. */
export function legionsAt(personId: string, year: number) {
  const rows = legions?.by_person?.[personId];
  if (!rows?.length) return null;
  let best: (typeof rows)[number] | null = null;
  for (const r of rows) if (r.year <= year && (!best || r.year > best.year)) best = r;
  return best;
}

export const ROMA_URBS = Object.values(import.meta.glob('../data/overlays/pack-roma-urbs.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; features: unknown[] } | undefined;

/** 알렉산드리아 미시 지도. 카이사르가 갇혀 싸운 도시다 — 헵타스타디온이 그 전쟁의
 *  결정적 지형이고, River가 「알렉산드리아 도서관 도시」를 콕 집었다. */
export const ALEXANDRIA = Object.values(import.meta.glob('../data/overlays/pack-alexandria.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; features: unknown[]; view?: { center: [number, number]; zoom: number; minZoom: number } } | undefined;

const sceneText = Object.values(import.meta.glob('../data/overlays/pack-scene-text.json', { eager: true, import: 'default' }))[0] as
  { scenes: Record<string, { note?: string; event_ko?: string; look_for?: string; stat?: { value: string; label: string } }> } | undefined;

/** 북마크로 점프했을 때 발표자가 읽을 사건 설명. 장면 파일의 한 줄 note와 별개로,
 *  「무슨 일이 벌어지는가 · 왜 중요한가 · 지도에서 무엇을 볼 것인가」를 담는다. */
export function sceneBrief(id: string | null) {
  return (id && sceneText?.scenes?.[id]) || null;
}

/** 그 해에 아직 없는 이름의 정착지 id. 정착지 레이어에 연도 필드가 없어서 생기는 구멍이다
 *  — 어느 해를 띄워도 220개가 다 뜬다. 연도를 지어내지 않고, 확실히 후대인 이름만 가린다. */
export function hiddenPlaces(year: number): string[] {
  return (anachro?.hide_before ?? []).filter(h => year < h.valid_from).map(h => h.id);
}

/** 그 해에 아직 없던 속주 경계. 정착지와 같은 구멍이 admin_regions에도 있다 —
 *  아우구스투스가 만든 갈리아 속주 셋이 `valid_from: null`이라 **기원전 60년 판에도**
 *  보라 점선으로 그어져 있었다. 그 해 갈리아는 로마 땅도 아니었다. */
export function hiddenAdmin(year: number): string[] {
  return (anachro?.hide_admin_before ?? []).filter(h => year < h.valid_from).map(h => h.id);
}

// 발표 줌(4~6)에서 rank 3 도시가 안 떠서, 경로 정점만 이름표를 따로 켠다.
export const PACK_PLACES = [
  'place:로마', 'place:알레시아', 'place:루비콘강', 'place:브린디시',
  'place:일레르다', 'place:파르살루스', 'place:알렉산드리아', 'place:문다평원',
  'place:라벤나',
] as const;
// 라리사를 뺐다. 파르살루스에서 30km라 지중해 축척에서 **화면 8px** 거리인데, 이름표
// 자리다툼에서 먼저 놓이는 쪽(정착지)이 이겨서 **정작 그 장면의 제목인 「파르살루스」가
// 사라졌다.** 둘 다 띄울 방법은 없고(8px다) 이야기가 쓰는 쪽은 전투다. 폼페이우스가
// 패주해 들른 곳이지만 아홉 장 어디도 라리사를 말하지 않는다.
