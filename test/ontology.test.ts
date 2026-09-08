import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { Entity, Link, RELS } from '../schema/ontology';
import { lint } from '../scripts/lint';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const graph = JSON.parse(readFileSync(join(ROOT, 'public/datasets/rome/graph.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(ROOT, 'public/datasets/rome/manifest.json'), 'utf8'));
const settlements = JSON.parse(readFileSync(join(ROOT, 'public/datasets/rome/layers/settlements.geojson'), 'utf8'));

describe('어댑터 산출물 == 정본 (F1)', () => {
  it('노드·엣지 수가 manifest.counts와 같다', () => {
    expect(graph.nodes.length).toBe(manifest.counts.entities);
    expect(graph.edges.length).toBe(manifest.counts.links);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(650);
  });
  it('엣지 전부가 Link 스키마를 통과하고 rel이 정의 안에 있다', () => {
    for (const e of graph.edges) { Link.parse(e); expect(RELS).toContain(e.rel); }
  });
  it('settlements 좌표는 [lon, lat]이고 지중해 세계 범위 안', () => {
    for (const f of settlements.features) {
      const [lon, lat] = f.geometry.coordinates;
      expect(lon).toBeGreaterThan(-15); expect(lon).toBeLessThan(130);
      expect(lat).toBeGreaterThan(0); expect(lat).toBeLessThan(72);
    }
    const roma = settlements.features.find((f: any) => f.properties.id === 'place:로마');
    expect(roma.geometry.coordinates[0]).toBeCloseTo(12.49, 1); // lon 먼저 — 뒤집히면 여기서 죽는다
  });
});

describe('스키마 (F11)', () => {
  it('src 없는 엔티티는 거부', () => {
    expect(() => Entity.parse({ id: 'person:x', type: 'person', name: 'x' })).toThrow();
    expect(Entity.parse({ id: 'person:x', type: 'person', name: 'x', src: 'point' }).ext).toEqual({});
  });
  it('정의 밖 rel은 거부', () => {
    expect(() => Link.parse({ from: 'a:b', to: 'c:d', rel: 'loves', src: 'point' })).toThrow();
  });
});

describe('린트 (F11)', () => {
  const ok = { nodes: [{ id: 'event:e', type: 'event', src: 'point' }, { id: 'place:p', type: 'place', src: 'point', lonlat: [12, 41] }], edges: [{ from: 'event:e', to: 'place:p', rel: 'occurred_at', src: 'point', from_year: -50, to_year: -49 }] };
  it('정상 그래프는 오류 0', () => expect(lint(ok).errors).toEqual([]));
  it('기원전 양수(연도 역순)·끊어진 링크·occurred_at 주어 오류를 잡는다', () => {
    const bad = { ...ok, edges: [
      { from: 'event:e', to: 'place:p', rel: 'occurred_at', src: 'point', from_year: 50, to_year: -49 },
      { from: 'event:e', to: 'place:ghost', rel: 'occurred_at', src: 'point' },
      { from: 'place:p', to: 'place:p', rel: 'occurred_at', src: 'point' },
    ] };
    const r = lint(bad);
    expect(r.errors.some(e => e.includes('연도 역순'))).toBe(true);
    expect(r.errors.some(e => e.includes('끊어진 링크'))).toBe(true);
    expect(r.errors.some(e => e.includes('occurred_at 주어'))).toBe(true);
  });
  it('held_office 수기 링크는 경고', () => {
    const r = lint({ nodes: [{ id: 'person:a', type: 'person', src: 'point' }, { id: 'institution:i', type: 'institution', src: 'point' }], edges: [{ from: 'person:a', to: 'institution:i', rel: 'held_office', src: 'point' }] });
    expect(r.warnings.some(w => w.includes('held_office'))).toBe(true);
  });
  it('실제 산출물은 baseline 밖 새 오류 0', () => {
    const baseline = new Set(JSON.parse(readFileSync(join(ROOT, 'scripts/lint.baseline.json'), 'utf8')));
    expect(lint(graph).errors.filter(e => !baseline.has(e))).toEqual([]);
  });
});
