// MCP 툴 4개의 순수 구현(F10, TASKS 3.4). 서버(server.ts)와 테스트가 같이 쓴다. 브라우저 패널과 **같은 graph.json**을 읽는다(CONSTITUTION 10-1).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { indexGraph, neighborsOf, groupOf, GROUP_LABEL, REL_LABEL, type Graph } from '../src/graph/data.ts';
import { buildIndex, search } from '../src/search.ts';
import { stateAt } from '../src/time.ts';
import { ENTITY_TYPES, REL_GROUPS, SRC } from '../schema/ontology.ts';

export function openDataset(root: string, ds = 'rome') {
  const base = join(root, 'public', 'datasets', ds);
  const graph = indexGraph(JSON.parse(readFileSync(join(base, 'graph.json'), 'utf8')));
  const manifest = JSON.parse(readFileSync(join(base, 'manifest.json'), 'utf8'));
  const index = buildIndex([...graph.nodes.values()].map(n => ({ id: n.id, name: n.name, aliases: n.aliases, type: n.type })));
  return { graph, manifest, index };
}
export type Data = ReturnType<typeof openDataset>;

const brief = (g: Graph, id: string) => { const n = g.nodes.get(id)!; return { id: n.id, type: n.type, name: n.name, born: n.born, died: n.died, year: n.year, faction: n.faction, points: n.points, lonlat: n.lonlat }; };

export const tools = {
  get_schema: (d: Data) => ({
    entity_types: ENTITY_TYPES, rel_groups: REL_GROUPS, rel_labels: REL_LABEL, group_labels: GROUP_LABEL, src: SRC,
    dataset: { id: d.manifest.id, title: d.manifest.title, time: d.manifest.time, counts: d.manifest.counts, layers: d.manifest.layers, scenes: (d.manifest.scenes ?? []).map((s: any) => s.id) },
    note: '연도는 정수, 기원전은 음수(BC 49 = -49). id는 type:슬러그. 좌표는 [lon, lat].',
  }),
  find_entity: (d: Data, q: string, type?: string) =>
    search(d.index, q, 40).filter(r => !type || r.type === type).slice(0, 20).map(r => brief(d.graph, r.id)),
  neighbors: (d: Data, id: string, from_year?: number, to_year?: number, rels?: string[]) => {
    const node = d.graph.nodes.get(id); if (!node) return { error: `없는 id: ${id}. find_entity로 찾으세요.` };
    const list = neighborsOf(d.graph, id, to_year).filter(n => (from_year == null || n.link.from_year == null || n.link.from_year >= from_year) && (!rels?.length || rels.includes(n.rel)));
    return { node: brief(d.graph, id), state: to_year != null ? stateAt(node, to_year) : node.attrs, count: list.length,
      neighbors: list.map(n => ({ ...brief(d.graph, n.node.id), rel: n.rel, rel_label: REL_LABEL[n.rel] ?? n.rel, group: n.group, dir: n.dir, from_year: n.link.from_year ?? null, to_year: n.link.to_year ?? null, point: n.link.point ?? null, confidence: n.link.confidence ?? null, src: n.link.src })) };
  },
  // 최단 관계 경로 — BFS(무방향). graphology 없이 충분(650 노드).
  path: (d: Data, a: string, b: string, max_hops = 4) => {
    if (!d.graph.nodes.has(a) || !d.graph.nodes.has(b)) return { error: 'a 또는 b가 없는 id' };
    const prev = new Map<string, { from: string; rel: string; dir: 'in' | 'out' }>(); prev.set(a, null as any);
    let frontier = [a];
    for (let hop = 0; hop < max_hops && frontier.length; hop++) {
      const next: string[] = [];
      for (const cur of frontier) for (const n of neighborsOf(d.graph, cur)) if (!prev.has(n.node.id)) { prev.set(n.node.id, { from: cur, rel: n.rel, dir: n.dir }); next.push(n.node.id); }
      if (prev.has(b)) break;
      frontier = next;
    }
    if (!prev.has(b)) return { found: false, max_hops };
    const steps: any[] = []; let cur = b;
    while (cur !== a) { const p = prev.get(cur)!; steps.unshift({ from: p.from, to: cur, rel: p.rel, rel_label: REL_LABEL[p.rel] ?? p.rel, group: groupOf(p.rel), dir: p.dir }); cur = p.from; }
    return { found: true, hops: steps.length, path: [a, ...steps.map(s => s.to)].map(id => brief(d.graph, id)), steps };
  },
};
