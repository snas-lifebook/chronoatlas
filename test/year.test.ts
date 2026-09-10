import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseYear } from '../scripts/year';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const graph = JSON.parse(readFileSync(join(ROOT, 'public/datasets/rome/graph.json'), 'utf8'));

// 아래 문자열은 전부 정본 entities.jsonl에 **실제로 들어 있는 값**이다(2026-09-11 전수 조사).
// 지어낸 예시가 아니라 파서를 무너뜨린 실물이라 그대로 박아 둔다.
describe('parseYear — 정본이 멀쩡한데 파서가 연도를 지어내고 있었다', () => {
  it('세기는 연도가 아니다', () => {
    for (const s of ['기원전 4세기', '기원전 6세기', '기원전 7세기', '기원 1세기', '기원전 1세기', '1세기~2세기', '1세기~4세기 초', '4세기-1453년'])
      expect(parseYear(s), s).toBe(null);
  });
  it('서수(제N차)는 연도가 아니다', () => {
    for (const s of ['제2차 포에니 전쟁', '제3차 포에니 전쟁', '제3차 포에니 전쟁 시대'])
      expect(parseYear(s), s).toBe(null);
  });
  it('연도 표지가 없으면 읽지 않는다', () => {
    expect(parseYear('750-1258')).toBe(null);   // 왕조 존속 구간. 연도 같지만 표지가 없다
    expect(parseYear('로마 황제들')).toBe(null);
    expect(parseYear(undefined)).toBe(null); expect(parseYear(null)).toBe(null); expect(parseYear({})).toBe(null);
  });
  it('제대로 된 연도는 그대로 읽는다', () => {
    expect(parseYear('기원전 31년 9월 2일')).toBe(-31); // 날짜가 뒤에 붙어도 연도를 집는다
    expect(parseYear('96~180년')).toBe(96);            // 범위는 시작 연도
    expect(parseYear('기원전 202년')).toBe(-202);
    expect(parseYear('AD 117')).toBe(117); expect(parseYear('BC 49')).toBe(-49);
    expect(parseYear('-44')).toBe(-44); expect(parseYear('117')).toBe(117); expect(parseYear(-753)).toBe(-753);
  });
});

// 파서가 지어낸 연도는 화면에서 이렇게 보였다: 자마 전투가 서기 2년, 삼니움 전쟁이 기원전 4년.
// 역사 지도에서 이건 틀린 사실을 보여주는 것이다.
//
// 위 parseYear는 고쳤지만 **산출물은 아직 그대로다.** 다시 구우려면 npm run adapt이 필요한데
// 정본 마이그레이션(볼트 TASKS 0.1, migrate_v2.py --write)이 밀려 ZodError로 죽는다.
// public/datasets/는 손으로 안 고친다(AGENTS.md). 그래서 지뢰를 심는다 —
// 정본이 풀려 adapt이 성공하면 아래가 빨개진다. 그때 이 블록을 지우고 `toEqual([])`로 바꿔라.
describe('산출물의 지어낸 연도 3건 — 정본 마이그레이션 대기 표시', () => {
  const suspicious = () => graph.nodes
    .filter((n: any) => n.type === 'event' && n.year != null && Math.abs(n.year) <= 20)
    .map((n: any) => `${n.id}=${n.year}`).sort();

  it('adapt을 못 돌려 세기·서수를 연도로 읽은 값이 아직 남아 있다', () => {
    expect(suspicious()).toEqual(['event:기독교박해=1', 'event:삼니움전쟁=-4', 'event:자마전투=2']);
  });
  it('고쳐 놓은 파서로 다시 읽으면 셋 다 사라진다 (adapt만 돌면 된다)', () => {
    const byId = new Map(graph.nodes.map((n: any) => [n.id, n]));
    for (const id of ['event:기독교박해', 'event:삼니움전쟁', 'event:자마전투']) {
      const a: any = (byId.get(id) as any).attrs;
      expect(parseYear(a.year ?? a.date ?? a.period), id).toBe(null);
    }
  });
});
