// 그 해에 인물이 어디에 있나 (R38). 순수 함수 — 뷰는 이 산출물을 그리기만 한다.
//
// 규칙을 먼저 적는다. 위치를 지어내지 않는다(BACKLOG §G).
//
// 1. located_in — person → place, 그 해가 활성이고 place에 lonlat이 있을 때만.
//    활성 규칙은 year.ts의 edgeActive와 같다. 연도 없는 관계는 어느 해도 안 그린다
//    (한니발→이탈리아반도를 전 구간에 찍으면 안 된다).
// 2. 한 사람에 located_in이 여럿이면: 그 해의 점(from==to==year) > 짧은 구간 > 이름.
// 3. located_in이 없는 해는 movements 경로의 그 해 위치(positionByRoute).
//    located_in이 있으면 그게 이긴다 — BC 49 카이사르는 루비콘이지 일레르다가 아니다.
// 4. 둘 다 없으면, 그 해가 활성인 관계의 대상 place(lonlat 있는 것만).
//    우선: ruled > member_of(place) > participated_in 사건의 occurred_at 장소.
//    연도 없는 관계는 안 쓴다. 좌표는 정본 place lonlat이다.
// 5. 그래도 없으면 교보재(teaching). 정본 관계에 좌표 링크가 비어 있을 때만.
// 6. 군단 수·병력은 필드가 없다. 넣지 않는다.
// 7. 같은 좌표에 여러 명이면 고리로 살짝 벌린다(이름은 남기고 겹치지 않게). 장소 id는 그대로.
import { edgeActive } from './year';
import { positionByRoute, type Feature } from './schema';
import type { Graph } from './graph/data';
import { containingPolity, type LonLat } from './board';
import { tokenColor } from './tokenColor';

export interface PersonAt {
  id: string;
  name: string;
  at: [number, number];
  place: string | null;
  placeName: string | null;
  via: 'located_in' | 'movement' | 'rel' | 'teaching';
  faction: string | null;
  polity: string | null;
  polityName: string | null;
  asset: string | null;
  /** 이 발표가 좇는 인물인가. 사료의 지위가 아니라 **시선**이다 — pack-cast.json의
   *  teaching 필드에서 온다. 말 크기와 자리다툼 우선권이 여기서 갈린다. */
  principal?: boolean;
  /** 같은 칸에서 밀려난 방향(라디안, 0 = 동쪽). 혼자면 null. 이름표를 **바깥쪽으로**
   *  붙이는 데 쓴다 — 안 그러면 한 무더기의 이름이 서로 위에 겹쳐 찍힌다. */
  ringAngle?: number | null;
}

export interface TeachingCast {
  teaching?: boolean;
  people: { id: string; place: string; from_year: number; to_year: number }[];
  /** 그 해 뒤로는 안 그린다. 정본의 굵은 구간이 죽은 사람을 계속 세워 둘 때만 쓴다.
   *  **연도는 반드시 정본에서 나와야 한다** — `source`에 어느 링크에서 왔는지 적는다. */
  gone?: { id: string; after_year: number; source: string }[];
  /** 이 발표가 좇는 인물들. 사실 주장이 아니라 편집 판단이라 teaching 아래 둔다. */
  principals?: { note?: string; ids: string[] };
}

function span(l: { from_year?: number | null; to_year?: number | null }): number {
  const f = l.from_year, t = l.to_year;
  if (f == null || t == null) return Infinity;
  return t - f;
}

function attachPolity(p: PersonAt, year: number, territory?: { properties: Record<string, any>; geometry: { type: string; coordinates: any } }[]): PersonAt {
  if (!territory?.length) return p;
  const pol = containingPolity(p.at as LonLat, territory, year);
  return { ...p, polity: pol?.id ?? null, polityName: pol?.name ?? null };
}

export function companionsOf(people: PersonAt[], id: string): PersonAt[] {
  const me = people.find(p => p.id === id);
  if (!me) return [];
  return people.filter(p => p.id !== id && (me.place ? p.place === me.place : p.at[0] === me.at[0] && p.at[1] === me.at[1]));
}

const REL_RANK: Record<string, number> = { ruled: 0, participated_in: 1 }; // member_of 갈리아 같은 권역 중심점은 사람을 허공에 둔다

/** 권역(나라·지방)인가. 권역 중심점은 사람을 사막 한가운데 세운다.
 *
 *  실제로 클레오파트라가 알렉산드리아가 아니라 **이집트 권역 중심점**에 서 있었다.
 *  `ruled 알레산드리아 -51..-30`(21년)과 `ruled 이집트 -51..-44`(7년)가 둘 다 있는데
 *  동점 처리가 「짧은 구간이 이긴다」라서 권역이 이겼다. 도시가 있으면 도시가 낫다 —
 *  바로 위 주석이 `member_of`에 대해 이미 같은 말을 하고 있다. */
function isRegion(place: { attrs?: Record<string, unknown> }): boolean {
  return place.attrs?.type === 'region';
}

function occurredPlace(graph: Graph, eventId: string): { id: string; name: string; lonlat: [number, number] } | null {
  for (const e of graph.edges) {
    if (e.rel !== 'occurred_at' || e.from !== eventId) continue;
    const place = graph.nodes.get(e.to);
    if (place?.type === 'place' && place.lonlat) return { id: place.id, name: place.name, lonlat: place.lonlat };
  }
  return null;
}

/** 같은 칸의 말들을 벌릴 반지름(도). 말은 화면 픽셀이 거의 일정하므로 벌림도 화면
 *  기준이어야 한다 — 도(度) 고정값이면 넓은 줌에서 말 폭보다 훨씬 작아 그냥 겹친다.
 *  실제로 BC48 알렉산드리아에서 클레오파트라와 프톨레마이오스가 포개졌다.
 *
 *  식은 `token3d.tokenMeters`와 같다. **일부러 옮겨 적었다** — token3d는 THREE를 끌고 오는
 *  별 청크(516kB)라 여기서 import하면 코드 분할이 깨지고 초기 JS가 400kB 예산을 넘는다.
 *  한쪽을 고치면 다른 쪽도 고칠 것.
 *
 *  **배수는 0.8이었고 화면에서 틀렸다.** 「말 폭이 받침 지름 1.36단위니까 반지름 0.8배면
 *  떨어진다」는 계산이었는데, 실제로 재어 보면 기원전 60년 로마에 세 사람이 설 때 두 말이
 *  세로로 64px 떨어지고 말 지름은 74px이다 — 10px 겹친다. 메시의 흰 테·베젤과 위도별
 *  메르카토르 스케일이 계산에 안 들어갔다. **화면에서 잰 값**으로 1.15로 올린다. 그러면
 *  셋이 설 때 현(弦)이 92px, 둘이면 106px로 말 지름을 확실히 넘는다. */
export function spreadDeg(zoom: number): number {
  const m = Math.max(120, Math.min(145000, (40075016.686 / 512 / Math.pow(2, zoom)) * 60));
  return (m * 1.15) / 111320;
}

/** 조역 말의 크기 배율. 주역이 1이다.
 *
 *  0.62는 눈대중이 아니다 — 주역 받침이 지중해 줌에서 ~46 CSS px이고, 0.62면 조역이
 *  ~29px다. 두 말을 나란히 놓았을 때 **누가 주인공인지 한눈에 갈리는 최소 차이**가
 *  대략 1.6배이고(더 좁히면 그냥 「크기가 들쭉날쭉한 말들」로 읽힌다), 더 벌리면
 *  조역 얼굴이 뭉개진다. 1/1.6 ≈ 0.62. */
export const COMPANION_SCALE = 0.62;

/** 같은 칸에 여럿일 때 자리를 나눈다.
 *
 *  **주역은 안 움직인다.** 예전에는 전원을 같은 반지름 고리에 세웠는데, 그러면
 *  기원전 48년 알렉산드리아에서 폼페이우스와 클레오파트라가 나란히 서서 이름표가
 *  「폼페이우9클레오파트라 7세」로 겹쳤다(실측: x 59.5 대 62.8, 화면 3.3% = 63px,
 *  말 지름 60px). 그리고 주역이 제 좌표를 떠나는 것 자체가 틀렸다 — 카이사르가
 *  파르살루스에 있는데 지도의 파르살루스에 안 서 있게 된다.
 *
 *  그래서 주역은 제자리, 조역만 둘레로 비켜난다(River: "부하라던지 동료가 있다면
 *  크기를 다르게 해서 따라다녀야 한다"). 주역이 둘 이상이면 그때만 서로 벌린다. */
export function unstack(people: PersonAt[], radiusDeg = 0.32): PersonAt[] {
  const groups = new Map<string, PersonAt[]>();
  for (const p of people) {
    // 겹침은 좌표의 문제이므로 좌표로만 묶는다. place id로 묶으면 **같은 자리인데 경위도
    // 근거가 다른 두 사람이 안 묶인다** — BC52 알레시아에서 카이사르(경로, place=null)와
    // 베르킹게토릭스(교보재, place:알레시아)가 한 점에 포개졌다. 출력의 place는 그대로 둔다.
    const k = `${p.at[0].toFixed(3)},${p.at[1].toFixed(3)}`;
    const g = groups.get(k) ?? [];
    g.push(p);
    groups.set(k, g);
  }
  const out: PersonAt[] = [];
  const move = (p: PersonAt, a: number, r: number): PersonAt => {
    const [lng, lat] = p.at;
    const cos = Math.cos(lat * Math.PI / 180) || 1;
    return { ...p, at: [lng + r * Math.cos(a) / cos, lat + r * Math.sin(a)], ringAngle: a };
  };
  for (const group of groups.values()) {
    if (group.length === 1) { out.push({ ...group[0], ringAngle: null }); continue; }
    group.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const lead = group.filter(p => p.principal);
    const rest = group.filter(p => !p.principal);
    // 주역이 하나뿐이면 그 사람은 제자리를 지킨다. 둘 이상이면 예전처럼 서로 벌린다 —
    // 둘 다 주인공인 장면(기원전 60년 로마의 폼페이우스와 크라수스)이 실제로 있다.
    //
    // 고리를 **동쪽에서** 시작한다. 남쪽에서 시작하면 두 사람이 위아래로 서고,
    // 이름표가 점 아래에 붙으므로 위 말의 이름이 아래 말 몸통에 묻힌다. 기울기(pitch)가
    // 남북을 압축해서 더 심해진다. 동서로 벌리면 둘 다 제 이름을 옆에 끼고 선다.
    if (lead.length === 1) out.push({ ...lead[0], ringAngle: null });
    else for (let i = 0; i < lead.length; i++) out.push(move(lead[i], (2 * Math.PI * i) / lead.length, radiusDeg));
    // 조역은 바깥 고리로, **주역 사이 빈 방향에** 끼운다. 예전에는 조역도 0(동쪽)에서
    // 시작해서 기원전 48년 알렉산드리아에서 프톨레마이오스가 클레오파트라와 같은 방향,
    // 화면 17px 거리에 포개졌다(말 지름 74px). 주역이 M명이면 반 칸(π/M)을 돌려 끼운다.
    const rOut = radiusDeg * (lead.length ? 1.5 : 1);
    const skew = lead.length > 1 ? Math.PI / lead.length : lead.length === 1 ? Math.PI / 2 : 0;
    for (let i = 0; i < rest.length; i++) out.push(move(rest[i], skew + (2 * Math.PI * i) / rest.length, rOut));
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

/** 이름표를 말의 어느 쪽에 붙이나. 고리 각도에서 나온다 — **바깥쪽으로** 뻗게 한다.
 *
 *  혼자면 예전처럼 말 아래다. 여럿이면 이름이 서로 위에 겹쳐 찍히는데(기원전 48년
 *  알렉산드리아에서 세 이름이 한 덩어리로 뭉갰다) 말을 더 벌려서는 못 푼다 —
 *  한글 이름표가 150px쯤이라 겹치지 않게 벌리면 폼페이우스가 리비아로 간다.
 *  **이름을 말 둘레 바깥으로 돌려 붙이는 것**이 자리를 안 옮기고 푸는 방법이다.
 *
 *  MapLibre의 anchor는 「글상자의 어느 변이 기준점에 붙나」다. 그래서 'left'면 글이
 *  오른쪽으로 뻗고 'bottom'이면 위로 뻗는다. offset y는 아래가 양수다. */
export type LabelSide = { anchor: 'top' | 'bottom' | 'left' | 'right'; name: [number, number]; force: [number, number] };
export function labelSide(angle: number | null | undefined): LabelSide {
  if (angle == null) return { anchor: 'top', name: [0, 1.9], force: [0, 4.9] };
  const c = Math.cos(angle), s = Math.sin(angle);
  if (c > 0.5) return { anchor: 'left', name: [2.1, 0], force: [2.1, 1.5] };
  if (c < -0.5) return { anchor: 'right', name: [-2.1, 0], force: [-2.1, 1.5] };
  return s > 0
    ? { anchor: 'bottom', name: [0, -2.0], force: [0, -3.4] }   // 북쪽 — 이름이 말 위로, 병력은 그 위로
    : { anchor: 'top', name: [0, 2.0], force: [0, 3.5] };       // 남쪽 — 말 아래로
}

export function peopleAtYear(year: number, src: { graph: Graph | null; movements: Feature[]; territory?: { properties: Record<string, any>; geometry: { type: string; coordinates: any } }[]; teaching?: TeachingCast | null; zoom?: number }): PersonAt[] {
  const out = new Map<string, PersonAt>();
  const regionOnly = new Set<string>();   // 권역 중심점밖에 못 찾은 사람 — 교보재 도시가 이길 수 있다
  const { graph, movements } = src;

  if (graph) {
    const best = new Map<string, { span: number; point: boolean; name: string; at: PersonAt }>();
    for (const l of graph.edges) {
      if (l.rel !== 'located_in') continue;
      if (!edgeActive(l, year)) continue;
      const person = graph.nodes.get(l.from);
      const place = graph.nodes.get(l.to);
      if (person?.type !== 'person' || !place?.lonlat) continue;
      const point = l.from_year === year && l.to_year === year;
      const rec = {
        span: span(l), point, name: place.name,
        at: { id: person.id, name: person.name, at: place.lonlat, place: place.id, placeName: place.name, via: 'located_in' as const, faction: person.faction, polity: null, polityName: null, asset: person.asset },
      };
      const prev = best.get(person.id);
      if (!prev || (point && !prev.point) || (point === prev.point && (rec.span < prev.span || (rec.span === prev.span && rec.name < prev.name)))) {
        best.set(person.id, rec);
      }
    }
    for (const [id, r] of best) out.set(id, r.at);
  }

  const routes = new Map<string, { owner: string; route: string }>();
  for (const f of movements) {
    const owner = f.properties.owner as string | undefined;
    const route = f.properties.route as string | undefined;
    if (!owner?.startsWith('person:') || !route || routes.has(route)) continue;
    routes.set(route, { owner, route });
  }
  for (const { owner, route } of routes.values()) {
    if (out.has(owner)) continue;
    const pos = positionByRoute(movements, route, year);
    if (!pos) continue;
    const person = graph?.nodes.get(owner);
    out.set(owner, {
      id: owner,
      name: person?.name ?? owner.split(':').slice(1).join(':'),
      at: pos,
      place: null,
      placeName: null,
      via: 'movement',
      faction: person?.faction ?? null,
      polity: null, polityName: null, asset: person?.asset ?? null,
    });
  }

  if (graph) {
    const bestRel = new Map<string, { rank: number; span: number; point: boolean; name: string; region: boolean; at: PersonAt }>();
    for (const l of graph.edges) {
      const rank = REL_RANK[l.rel];
      if (rank == null) continue;
      if (!edgeActive(l, year)) continue;
      const person = graph.nodes.get(l.from);
      if (person?.type !== 'person' || out.has(person.id)) continue;
      let placeId: string | null = null;
      let placeName: string | null = null;
      let at: [number, number] | null = null;
      if (l.rel === 'participated_in') {
        const occ = occurredPlace(graph, l.to);
        if (!occ) continue;
        placeId = occ.id; placeName = occ.name; at = occ.lonlat;
      } else {
        const place = graph.nodes.get(l.to);
        if (place?.type !== 'place' || !place.lonlat) continue;
        placeId = place.id; placeName = place.name; at = place.lonlat;
      }
      const point = l.from_year === year && l.to_year === year;
      const placeNode = l.rel === 'participated_in' ? null : graph.nodes.get(l.to);
      const rec = {
        rank, span: span(l), point, name: placeName!,
        region: placeNode ? isRegion(placeNode) : false,   // 도시 > 권역 중심점
        at: { id: person.id, name: person.name, at: at!, place: placeId, placeName, via: 'rel' as const, faction: person.faction, polity: null, polityName: null, asset: person.asset },
      };
      const prev = bestRel.get(person.id);
      const better = !prev
        || rec.rank < prev.rank
        || (rec.rank === prev.rank && (
             (!rec.region && prev.region)                       // 권역보다 도시
             || (rec.region === prev.region && (
                  (point && !prev.point)
                  || (point === prev.point && (rec.span < prev.span
                       || (rec.span === prev.span && rec.name < prev.name)))))));
      if (better) bestRel.set(person.id, rec);
    }
    for (const [id, r] of bestRel) if (!out.has(id)) { out.set(id, r.at); if (r.region) regionOnly.add(id); }
  }

  if (src.teaching && graph) {
    for (const t of src.teaching.people) {
      // 규칙 5는 「정본 관계에 좌표가 비어 있을 때만」이다. 여기 한 칸을 더 연다 —
      // **권역 중심점밖에 없을 때도** 교보재 도시가 이긴다. 권역 중심점은 사람을 사막
      // 한가운데 세우기 때문이다(isRegion 주석 참조). 실제로 프톨레마이오스 13세가
      // `ruled 이집트` 하나뿐이라 이집트 권역 중심 — 화면 세로 90.6%, 대사창에 잘리는
      // 사막에 서 있었다. 클레오파트라는 도시 관계가 있어 정본 안에서 풀렸지만
      // 그는 도시 관계 자체가 없어 그 규칙이 안 걸린다. 좌표는 여전히 정본 place다.
      if (out.has(t.id) && !regionOnly.has(t.id)) continue;
      if (year < t.from_year || year > t.to_year) continue;
      const person = graph.nodes.get(t.id);
      const place = graph.nodes.get(t.place);
      if (person?.type !== 'person' || !place?.lonlat) continue;
      out.set(t.id, {
        id: t.id, name: person.name, at: place.lonlat, place: place.id, placeName: place.name,
        via: 'teaching', faction: person.faction, polity: null, polityName: null, asset: person.asset,
      });
    }
  }

  // 8. 정본의 굵은 구간이 죽은 사람을 세워 두는 자리를 걷어낸다. 규칙 6과 같은 정신이다 —
  //    없는 것을 넣지 않되, **정본이 스스로 말하는 종료 연도**는 따른다.
  const gone = new Map((src.teaching?.gone ?? []).map(g => [g.id, g.after_year]));
  const lead = new Set(src.teaching?.principals?.ids ?? []);
  const live = [...out.values()].filter(p => {
    const last = gone.get(p.id);
    return last == null || year <= last;
  });

  return unstack(live.map(p => ({ ...attachPolity(p, year, src.territory), principal: lead.has(p.id) })),
    src.zoom == null ? undefined : spreadDeg(src.zoom));
}

export interface PersonProps {
  id: string; name: string; via: PersonAt['via']; place: string | null; placeName: string | null;
  color: string; faction: string | null; polityName: string | null; asset: string | null;
  legions: number | null; force: string | null;   // 군기와 병력 표기
  principal: boolean; scale: number;              // 주역/조역 — 말·이름표·군기가 이 배율을 따른다
  anchor: LabelSide['anchor'];                    // 한 칸에 여럿일 때 이름을 바깥쪽으로 돌린다
  nameOffset: [number, number]; forceOffset: [number, number];
}
/** 「군단 10 · 4~6만」처럼 한 줄로. 숫자가 없으면 빈 칸을 만들지 않고 null. */
function forceLabel(l: { legions: number | null; men_low: number | null; men_high: number | null } | null): string | null {
  if (!l) return null;
  const man = (n: number) => (n >= 10000 ? `${Math.round(n / 10000)}만` : `${Math.round(n / 1000)}천`);
  const troops = l.men_low && l.men_high ? `${man(l.men_low)}~${man(l.men_high)}` : null;
  if (l.legions != null && l.legions > 0) return troops ? `${l.legions}군단 · ${troops}` : `${l.legions}군단`;
  return troops ? `${troops}명` : null;
}

export function peopleGeoJSON(people: PersonAt[], palette: Record<string, string>, legionOf?: (id: string) => { legions: number | null; men_low: number | null; men_high: number | null } | null):
  { type: 'FeatureCollection'; features: { type: 'Feature'; id: string; properties: PersonProps; geometry: { type: 'Point'; coordinates: [number, number] } }[] } {
  return {
    type: 'FeatureCollection',
    features: people.map(p => ({
      type: 'Feature' as const,
      id: p.id,
      properties: {
        ...(side => ({ anchor: side.anchor, nameOffset: side.name, forceOffset: side.force }))(labelSide(p.ringAngle)),
        id: p.id, name: p.name, via: p.via, place: p.place, placeName: p.placeName,
        color: tokenColor(p.id, p.faction, palette),
        faction: p.faction, polityName: p.polityName, asset: p.asset,
        legions: legionOf?.(p.id)?.legions ?? null,
        force: forceLabel(legionOf?.(p.id) ?? null),
        principal: !!p.principal,
        scale: p.principal ? 1 : COMPANION_SCALE,
      },
      geometry: { type: 'Point' as const, coordinates: p.at },
    })),
  };
}
