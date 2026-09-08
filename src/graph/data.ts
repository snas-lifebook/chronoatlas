// graph.json(어댑터 산출) 인메모리 인덱스 + 이웃 조회. 패널·Sigma·검색이 같이 쓴다(2.2). 지연 로드 — 패널이 처음 열릴 때.
import { REL_GROUPS } from '../../schema/ontology.ts';

export interface GNode { id: string; type: string; name: string; aliases: string[]; points: number[]; born: number | null; died: number | null; year: number | null;
  lonlat: [number, number] | null; faction: string | null; asset: string | null; /* 웹 경로 assets/portraits·icons/*.webp */ tier: string | null; confidence: string | null; desc: string; src: string; ext: Record<string, string | null>;
  attrs: Record<string, unknown>; history: { year: number; patch: Record<string, unknown> }[] }
export interface GLink { from: string; to: string; rel: string; point?: number; from_year?: number | null; to_year?: number | null; src: string; confidence?: string; note?: string }
export interface Graph { nodes: Map<string, GNode>; edges: GLink[]; adjacency: Record<string, number[]> }
export interface Neighbor { node: GNode; link: GLink; rel: string; dir: 'in' | 'out'; group: string }

export const GROUP_LABEL: Record<string, string> = { ally: '동맹', hostile: '적대', rule: '통치', lineage: '혈연', member: '소속', locate: '장소', act: '행위', make: '생성', other: '기타' };
export const REL_LABEL: Record<string, string> = { allied_with: '동맹', protected: '보호', opposed: '적대', ruled: '통치', conquered: '정복', controls: '지배', claims: '요구', core: '핵심', succeeded: '계승', child_of: '자녀', married: '혼인',
  member_of: '소속', held_office: '관직', aligned_with: '동조', located_in: '위치', occurred_at: '발생지', participated_in: '참여', decided: '결정', triggers: '촉발', created: '창설', applied_to: '적용', grants: '부여' };

const relToGroup = new Map<string, string>();
for (const [g, rels] of Object.entries(REL_GROUPS)) for (const r of rels) relToGroup.set(r, g);
export const groupOf = (rel: string) => relToGroup.get(rel) ?? 'other';

export function indexGraph(raw: { nodes: GNode[]; edges: GLink[]; adjacency: Record<string, number[]> }): Graph {
  return { nodes: new Map(raw.nodes.map(n => [n.id, n])), edges: raw.edges, adjacency: raw.adjacency };
}

// 1홉 이웃. year가 있으면 from_year ≤ year인 링크만(연도 미상은 포함 — 지우면 관계가 반 이상 사라진다).
export function neighborsOf(g: Graph, id: string, year?: number): Neighbor[] {
  const out: Neighbor[] = [];
  for (const i of g.adjacency[id] ?? []) {
    const l = g.edges[i];
    if (year != null && l.from_year != null && l.from_year > year) continue;
    const dir = l.from === id ? 'out' : 'in';
    const node = g.nodes.get(dir === 'out' ? l.to : l.from);
    if (node) out.push({ node, link: l, rel: l.rel, dir, group: groupOf(l.rel) });
  }
  return out.sort((a, b) => (a.link.from_year ?? 9999) - (b.link.from_year ?? 9999));
}

// 최단 관계 경로 — BFS(무방향). graphology 없이 충분(650 노드). MCP `path`와 인스펙터 경로(F14)가 같이 쓴다.
export interface PathStep { from: string; to: string; rel: string; dir: 'in' | 'out' }
export function shortestPath(g: Graph, a: string, b: string, maxHops = 4): PathStep[] | null {
  if (!g.nodes.has(a) || !g.nodes.has(b)) return null;
  const prev = new Map<string, PathStep | null>([[a, null]]);
  let frontier = [a];
  for (let hop = 0; hop < maxHops && frontier.length && !prev.has(b); hop++) {
    const next: string[] = [];
    for (const cur of frontier) for (const n of neighborsOf(g, cur)) if (!prev.has(n.node.id)) { prev.set(n.node.id, { from: cur, to: n.node.id, rel: n.rel, dir: n.dir }); next.push(n.node.id); }
    frontier = next;
  }
  if (!prev.has(b)) return null;
  const steps: PathStep[] = []; for (let cur = b; cur !== a; cur = prev.get(cur)!.from) steps.unshift(prev.get(cur)!);
  return steps;
}

let cache: Promise<Graph> | null = null;
export function loadGraph(base: string): Promise<Graph> {
  return cache ??= fetch(`${base}/graph.json`).then(r => { if (!r.ok) throw new Error(`graph.json ${r.status}`); return r.json(); }).then(indexGraph);
}
