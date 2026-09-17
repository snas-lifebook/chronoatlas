// 장면 의미체계(R53, OVERHAUL-IV): 장면이 가리키는 사건은 정본에 있어야 한다. 지어낸 사건 id가 장면에 들어오면 여기서 막는다.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Scene } from '../src/state';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const scenes: Scene[] = JSON.parse(readFileSync(join(ROOT, 'data/scenes/rome.json'), 'utf8'));
const graph = JSON.parse(readFileSync(join(ROOT, 'public/datasets/rome/graph.json'), 'utf8')) as { nodes: { id: string; type: string; year: number | null }[] };
const events = new Map(graph.nodes.filter(n => n.type === 'event').map(n => [n.id, n]));

describe('장면 ↔ 사건 링크 층', () => {
  it('장면의 events는 전부 정본 event 노드다', () => {
    for (const sc of scenes) for (const id of sc.events ?? []) expect(events.has(id), `${sc.id} → ${id}`).toBe(true);
  });
  it('연도가 있는 사건은 장면의 구간(year~to, 없으면 ±60년) 안에 든다 — 무관한 사건을 장면에 붙이지 않는다', () => {
    for (const sc of scenes) for (const id of sc.events ?? []) {
      const y = events.get(id)!.year; if (y == null) continue;
      const lo = Math.min(sc.year, sc.to ?? sc.year) - 60, hi = Math.max(sc.year, sc.to ?? sc.year) + 60;
      expect(y >= lo && y <= hi, `${sc.id}(${sc.year}) → ${id}(${y})`).toBe(true);
    }
  });
  it('사건이 달린 장면이 열 개 이상이다 — 링크 층이 비어 있으면 의미체계가 아니다', () => {
    expect(scenes.filter(sc => sc.events?.length).length).toBeGreaterThanOrEqual(10);
  });
});
