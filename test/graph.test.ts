import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { indexGraph, neighborsOf, groupOf } from '../src/graph/data';

const raw = JSON.parse(readFileSync('public/datasets/rome/graph.json', 'utf8'));
const g = indexGraph(raw);

describe('graph data (TASKS 2.2)', () => {
  it('노드 650, 카이사르 이웃이 있다', () => {
    expect(g.nodes.size).toBe(650);
    const n = neighborsOf(g, 'person:카이사르');
    expect(n.length).toBeGreaterThan(5);
    for (const x of n) { expect(x.node).toBeTruthy(); expect(x.rel).toBeTruthy(); }
  });
  it('의미군: rel → group', () => {
    expect(groupOf('allied_with')).toBe('ally'); expect(groupOf('opposed')).toBe('hostile'); expect(groupOf('zzz')).toBe('other');
  });
  it('연도 필터: from_year > year인 링크는 빠진다', () => {
    const all = neighborsOf(g, 'person:카이사르');
    const early = neighborsOf(g, 'person:카이사르', -200);
    expect(early.length).toBeLessThanOrEqual(all.length);
    for (const x of early) expect(x.link.from_year == null || x.link.from_year <= -200).toBe(true);
  });
  it('방향: from이면 out, to면 in', () => {
    const n = neighborsOf(g, 'person:카이사르');
    expect(n.some(x => x.dir === 'out') || n.some(x => x.dir === 'in')).toBe(true);
  });
});

import { shortestPath } from '../src/graph/data';
describe('shortestPath (F14)', () => {
  it('카이사르 → 한니발은 이어지고, 각 단계는 실제 인접', () => {
    const p = shortestPath(g, 'person:카이사르', 'person:한니발', 6)!;
    expect(p).not.toBeNull(); expect(p[0].from).toBe('person:카이사르'); expect(p[p.length - 1].to).toBe('person:한니발');
    for (const st of p) expect(neighborsOf(g, st.from).some(n => n.node.id === st.to && n.rel === st.rel)).toBe(true);
  });
  it('자기 자신은 0홉, 없는 id는 null, 홉 제한 1이면 먼 노드는 null', () => {
    expect(shortestPath(g, 'person:카이사르', 'person:카이사르')).toEqual([]);
    expect(shortestPath(g, 'person:없음', 'person:한니발')).toBeNull();
    expect(shortestPath(g, 'person:카이사르', 'person:한니발', 1)).toBeNull();
  });
});
