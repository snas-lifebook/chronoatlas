// 그 해에 인물이 어디에 있나 (R38). 순수 함수 — 뷰는 이 산출물을 그리기만 한다.
//
// 규칙을 먼저 적는다. 위치를 지어내지 않는다(BACKLOG §G).
//
// 1. located_in — person → place, 그 해가 활성이고 place에 lonlat이 있을 때만.
//    활성 규칙은 year.ts의 edgeActive와 같다. 연도 없는 관계는 어느 해도 안 그린다
//    (한니발→이탈리아반도를 전 구간에 찍으면 안 된다).
// 2. 한 사람에 located_in이 여럿이면: 그 해의 점(from==to==year) > 짧은 구간 > 이름.
// 3. located_in이 없는 해는 movements 경로의 그 해 위치(positionByRoute). 경로가 이긴다.
//    located_in이 있으면 그게 이긴다 — BC 49 카이사르는 루비콘이지 일레르다가 아니다.
// 4. 군단 수·병력은 필드가 없다. 넣지 않는다.
import { edgeActive } from './year';
import { positionByRoute, type Feature } from './schema';
import type { Graph } from './graph/data';
import { FALLBACK_COLOR } from './board';

export interface PersonAt {
  id: string;
  name: string;
  at: [number, number];
  place: string | null;
  placeName: string | null;
  via: 'located_in' | 'movement';
  faction: string | null;
}

function span(l: { from_year?: number | null; to_year?: number | null }): number {
  const f = l.from_year, t = l.to_year;
  if (f == null || t == null) return Infinity;
  return t - f;
}

export function peopleAtYear(year: number, src: { graph: Graph | null; movements: Feature[] }): PersonAt[] {
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
        at: { id: person.id, name: person.name, at: place.lonlat, place: place.id, placeName: place.name, via: 'located_in' as const, faction: person.faction },
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
    });
  }

  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

export interface PersonProps {
  id: string; name: string; via: PersonAt['via']; place: string | null; placeName: string | null; color: string; faction: string | null;
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
        color: (p.faction && palette[p.faction]) || FALLBACK_COLOR,
        faction: p.faction,
      },
      geometry: { type: 'Point' as const, coordinates: p.at },
    })),
  };
}
