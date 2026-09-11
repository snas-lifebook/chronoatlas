import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { indexGraph } from '../src/graph/data';
import { yearBrief, edgeActive } from '../src/year';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const B = join(ROOT, 'public/datasets/rome');
const rd = (p: string) => JSON.parse(readFileSync(join(B, p), 'utf8'));
const graph = indexGraph(rd('graph.json'));
const events = rd('entities/events.json').events;
const battles = rd('layers/battles.geojson').features;
// 영토는 100년 버킷이라 해당 버킷만 읽는다(앱도 그렇게 한 덩어리만 들고 있다).
const bucket = (y: number) => {
  const b = Math.max(-800, Math.min(1400, Math.floor((y + 800) / 100) * 100 - 800));
  const p = `layers/territory/${b}.geojson`;
  return existsSync(join(B, p)) ? rd(p).features : [];
};
const brief = (y: number, limit = 4) => yearBrief(y, { graph, territory: bucket(y), events, battles }, limit);

describe('edgeActive — 그 해에 관계가 살아 있나 (R36 규칙 1)', () => {
  it('시작·끝이 모두 있으면 닫힌 구간', () => {
    const l = { from_year: -49, to_year: -45 };
    expect(edgeActive(l, -49)).toBe(true); expect(edgeActive(l, -47)).toBe(true); expect(edgeActive(l, -45)).toBe(true);
    expect(edgeActive(l, -50)).toBe(false); expect(edgeActive(l, -44)).toBe(false);
  });
  it('끝이 없으면 시작한 해에만 잡는다 — 언제까지 이어졌는지 모르는 것을 안다고 하지 않는다', () => {
    expect(edgeActive({ from_year: -58, to_year: null }, -58)).toBe(true);
    expect(edgeActive({ from_year: -58, to_year: null }, -57)).toBe(false);
  });
  it('연도가 아예 없는 관계는 어느 해에도 안 잡힌다', () => {
    expect(edgeActive({}, -49)).toBe(false);
  });
});

describe('yearBrief — BACKLOG §F 완료 조건', () => {
  // 완료 조건: "BC 49로 옮기면 카이사르·폼페이우스, 로마 공화정, 루비콘 도하가 뜬다"
  const b49 = brief(-49);
  it('BC 49 인물: 카이사르·폼페이우스가 1·2위', () => {
    expect(b49.people.map(p => p.name).slice(0, 2)).toEqual(['카이사르', '폼페이우스']);
    expect(b49.people[0].n).toBeGreaterThan(b49.people[1].n);
  });
  it('BC 49 국가: 로마 공화정이 들어 있다', () => {
    expect(b49.nations.map(n => n.name)).toContain('로마 공화정');
  });
  // 루비콘 도하는 정본에 사건이 아니라 관계로 있다: 카이사르 -located_in-> 루비콘 강 (-49~-49).
  // 규칙 3의 "그 해에 시작하거나 끝난 관계"가 이걸 집는다.
  it('BC 49 그 해의 일: 루비콘이 잡힌다', () => {
    expect(b49.happenings.some(h => h.label.includes('루비콘'))).toBe(true);
  });

  it('BC 44는 암살의 해 — 브루투스·카시우스가 올라온다', () => {
    const names = brief(-44, 6).people.map(p => p.name);
    expect(names[0]).toBe('카이사르');
    expect(names).toEqual(expect.arrayContaining(['브루투스', '카시우스']));
    expect(brief(-44).happenings.some(h => h.label.includes('암살'))).toBe(true);
  });
  it('AD 117은 트라야누스 → 하드리아누스', () => {
    expect(brief(117).people.map(p => p.name).slice(0, 2)).toEqual(['트라야누스', '하드리아누스']);
  });

  it('같은 해는 언제나 같은 순서 (동점은 이름으로 끊는다)', () => {
    expect(JSON.stringify(brief(-49))).toBe(JSON.stringify(brief(-49)));
    expect(JSON.stringify(brief(260))).toBe(JSON.stringify(brief(260)));
  });
  it('limit을 넘지 않고 나머지는 개수로만 알린다', () => {
    const b = brief(-49, 2);
    expect(b.people.length).toBeLessThanOrEqual(2); expect(b.nations.length).toBeLessThanOrEqual(2);
    expect(b.happenings.length).toBeLessThanOrEqual(2); expect(b.nationsMore).toBeGreaterThan(0);
  });
  // 데이터가 없는 해는 비워 둔다. 억지로 채우면 그게 지어낸 중요도다.
  it('관계 연도가 없는 해는 인물이 비고, 그래도 국가는 나온다', () => {
    const b = brief(476);
    expect(b.people).toEqual([]);
    expect(b.nations.length).toBeGreaterThan(0);
  });
  it('graph가 아직 안 왔으면 인물·관계 없이 국가만 (지연 로드 중)', () => {
    const b = yearBrief(-49, { graph: null, territory: bucket(-49), events, battles });
    expect(b.people).toEqual([]);
    expect(b.nations.length).toBeGreaterThan(0);
  });
});
