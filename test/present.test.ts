import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseState, serializeState, DEFAULTS } from '../src/state';
import { scenesInGroup, stepScene, PRESENT_GROUP } from '../src/present';

const pack = [
  { id: 'a', title: '1', year: -60, group: PRESENT_GROUP },
  { id: 'b', title: '2', year: -52, group: PRESENT_GROUP },
  { id: 'c', title: '3', year: -49, group: PRESENT_GROUP },
  { id: 'x', title: '다른', year: -216, group: '말판' },
];

describe('발표 장면 넘김', () => {
  it('그룹만 남기고 [ ] 로 순환한다', () => {
    const g = scenesInGroup(pack, PRESENT_GROUP);
    expect(g.map(s => s.id)).toEqual(['a', 'b', 'c']);
    expect(stepScene(g, 'a', 1)?.id).toBe('b');
    expect(stepScene(g, 'c', 1)?.id).toBe('a');
    expect(stepScene(g, 'a', -1)?.id).toBe('c');
  });
});

describe('갈리아 교보재 오버레이', () => {
  it('자유 갈리아 폴리곤 셋(나르보넨시스 제외)', () => {
    const raw = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../data/overlays/gallia-free.json'), 'utf8'));
    expect(raw.teaching).toBe(true);
    expect(raw.features).toHaveLength(3);
    const names = raw.features.map((f: { properties: { name: string } }) => f.properties.name).join(' ');
    expect(names).toMatch(/아퀴타니아/);
    expect(names).toMatch(/루그두넨시스/);
    expect(names).toMatch(/벨기카/);
    expect(names).not.toMatch(/나르보넨시스/);
  });
});

describe('present URL', () => {
  it('?present=1 이 켜지고 기본은 생략', () => {
    expect(parseState('?present=1').present).toBe(true);
    expect(serializeState({ ...DEFAULTS, present: true })).toBe('?present=1');
    expect(serializeState({ ...DEFAULTS })).toBe('');
  });
});
