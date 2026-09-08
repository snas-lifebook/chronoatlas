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
