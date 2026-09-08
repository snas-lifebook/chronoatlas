// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { indexGraph } from '../src/graph/data';
import { localGraph } from '../src/app/GraphPanel';

const g = indexGraph(JSON.parse(readFileSync('public/datasets/rome/graph.json', 'utf8')));

describe('GraphPanel.localGraph (P1 하이브리드 그래프)', () => {
  it('1홉: 선택(hop 0) + 이웃(hop 1), 노드 중복 없음, 간선은 전부 선택에서', () => {
    const { nodes, edges } = localGraph(g, 'person:카이사르', -44, 1);
    expect(nodes[0]).toMatchObject({ id: 'person:카이사르', hop: 0 });
    expect(new Set(nodes.map(n => n.id)).size).toBe(nodes.length);
    expect(edges.length).toBeGreaterThanOrEqual(nodes.length - 1); // 같은 이웃과 rel이 여럿이면 간선도 여럿
    for (const e of edges) expect(e.a).toBe('person:카이사르');
    expect(nodes.every(n => n.hop <= 1)).toBe(true);
  });
  it('2홉: 더 많고 상한(~48 + 1홉) 안, hop 2 노드는 선택과 직접 연결되지 않는다', () => {
    const one = localGraph(g, 'person:카이사르', -44, 1), two = localGraph(g, 'person:카이사르', -44, 2);
    expect(two.nodes.length).toBeGreaterThan(one.nodes.length);
    expect(two.nodes.length).toBeLessThanOrEqual(one.nodes.length + 48 + 8);
    const h2 = new Set(two.nodes.filter(n => n.hop === 2).map(n => n.id));
    for (const e of two.edges) if (e.a === 'person:카이사르') expect(h2.has(e.b)).toBe(false);
  });
});
