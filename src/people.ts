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
}

export interface TeachingCast {
  teaching?: boolean;
  people: { id: string; place: string; from_year: number; to_year: number }[];
  /** 그 해 뒤로는 안 그린다. 정본의 굵은 구간이 죽은 사람을 계속 세워 둘 때만 쓴다.
   *  **연도는 반드시 정본에서 나와야 한다** — `source`에 어느 링크에서 왔는지 적는다. */
  gone?: { id: string; after_year: number; source: string }[];
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
 *  한쪽을 고치면 다른 쪽도 고칠 것. 말 폭은 받침 지름 1.36단위이므로 반지름 0.8배면
 *  두 말이 살짝 떨어진다. */
export function spreadDeg(zoom: number): number {
  const m = Math.max(14000, Math.min(145000, (40075016.686 / 512 / Math.pow(2, zoom)) * 60));
  return (m * 0.8) / 111320;
}

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
  for (const group of groups.values()) {
    if (group.length === 1) { out.push(group[0]); continue; }
    group.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    for (let i = 0; i < group.length; i++) {
      // 고리를 **동쪽에서** 시작한다. 남쪽에서 시작하면 두 사람이 위아래로 서고,
      // 이름표가 점 아래에 붙으므로 위 말의 이름이 아래 말 몸통에 묻힌다. 기울기(pitch)가
      // 남북을 압축해서 더 심해진다. 동서로 벌리면 둘 다 제 이름을 옆에 끼고 선다.
      const a = (2 * Math.PI * i) / group.length;
      const [lng, lat] = group[i].at;
      const cos = Math.cos(lat * Math.PI / 180) || 1;
      out.push({ ...group[i], at: [lng + radiusDeg * Math.cos(a) / cos, lat + radiusDeg * Math.sin(a)] });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

export function peopleAtYear(year: number, src: { graph: Graph | null; movements: Feature[]; territory?: { properties: Record<string, any>; geometry: { type: string; coordinates: any } }[]; teaching?: TeachingCast | null; zoom?: number }): PersonAt[] {
  const out = new Map<string, PersonAt>();
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
    for (const [id, r] of bestRel) if (!out.has(id)) out.set(id, r.at);
  }

  if (src.teaching && graph) {
    for (const t of src.teaching.people) {
      if (out.has(t.id)) continue;
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
  const live = [...out.values()].filter(p => {
    const last = gone.get(p.id);
    return last == null || year <= last;
  });

  return unstack(live.map(p => attachPolity(p, year, src.territory)),
    src.zoom == null ? undefined : spreadDeg(src.zoom));
}

export interface PersonProps {
  id: string; name: string; via: PersonAt['via']; place: string | null; placeName: string | null;
  color: string; faction: string | null; polityName: string | null; asset: string | null;
}
export function peopleGeoJSON(people: PersonAt[], palette: Record<string, string>):
  { type: 'FeatureCollection'; features: { type: 'Feature'; id: string; properties: PersonProps; geometry: { type: 'Point'; coordinates: [number, number] } }[] } {
  return {
    type: 'FeatureCollection',
    features: people.map(p => ({
      type: 'Feature' as const,
      id: p.id,
      properties: {
        id: p.id, name: p.name, via: p.via, place: p.place, placeName: p.placeName,
        color: tokenColor(p.id, p.faction, palette),
        faction: p.faction, polityName: p.polityName, asset: p.asset,
      },
      geometry: { type: 'Point' as const, coordinates: p.at },
    })),
  };
}
