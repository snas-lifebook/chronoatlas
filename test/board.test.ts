import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { Board, lintBoard, ARMS } from '../schema/board';
import { inPolygon, nearestSettlement, containingPolity, distanceKm, snap } from '../src/board';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const raw = rd('data/boards/cannae-216.json');
const graph = rd('public/datasets/rome/graph.json');
const settlements = rd('public/datasets/rome/layers/settlements.geojson').features;
const territory = rd('public/datasets/rome/layers/territory/-300.geojson').features;

describe('말판 계약 (R37, BACKLOG 라운드 G)', () => {
  const board = Board.parse(raw);

  it('칸나이 말판이 스키마를 통과하고 린트 오류가 없다', () => {
    expect(lintBoard(board)).toEqual([]);
  });
  it('교보재 표시가 강제된다 — teaching을 빼면 파싱이 실패한다', () => {
    const { teaching, ...noFlag } = raw;
    expect(() => Board.parse(noFlag)).toThrow();
    expect(() => Board.parse({ ...raw, teaching: false })).toThrow();
  });
  it('근거 문장이 비면 파싱이 실패한다 — 어디서 온 배치인지 적게 한다', () => {
    expect(() => Board.parse({ ...raw, source: '' })).toThrow();
  });
  it('정본 신뢰도 필드를 쓰지 않는다 — 교보재가 사실로 읽히면 안 된다', () => {
    const flat = JSON.stringify(board);
    for (const k of ['"src"', '"confidence"']) expect(flat).not.toContain(k);
  });

  it('페이즈가 셋이고 t가 오름차순, 각 페이즈는 그 순간의 전체 배치다', () => {
    expect(board.phases.map(p => p.t)).toEqual([0, 1, 2]);
    for (const p of board.phases) expect(p.units.length).toBeGreaterThan(8);
  });
  it('유닛이 빠진 페이즈는 note로 설명한다 (린트가 강제)', () => {
    const t0 = new Set(board.phases[0].units.map(u => u.id));
    const t2 = new Set(board.phases[2].units.map(u => u.id));
    expect([...t0].filter(id => !t2.has(id))).toEqual(['rom-cav-r', 'rom-cav-l']); // 양익 기병이 궤멸된다
    expect(board.phases[2].note).toBeTruthy();
    // 설명이 없으면 린트가 잡는다
    const broken = { ...board, phases: board.phases.map((p, i) => (i === 2 ? { ...p, note: undefined } : p)) };
    expect(lintBoard(broken as any).some(e => e.includes('note가 없다'))).toBe(true);
  });
  it('병종은 정해진 것만 쓴다', () => {
    for (const p of board.phases) for (const u of p.units) expect(ARMS).toContain(u.arm);
  });

  // 말판은 정본 밖이지만 끈은 정본 id다. 오타면 클릭이 죽는다.
  it('정본을 가리키는 id가 전부 실재한다', () => {
    const ids = new Set(graph.nodes.map((n: any) => n.id));
    expect(ids.has(board.event!)).toBe(true);
    const refs = [...new Set(board.phases.flatMap(p => p.units.map(u => u.entity).filter(Boolean)))] as string[];
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.filter(r => !ids.has(r))).toEqual([]);
  });
  it('말판 중심이 정본 발생지 좌표와 같다 — 지도 위 엉뚱한 데 놓이지 않게', () => {
    const place = graph.nodes.find((n: any) => n.id === 'place:칸나이평원');
    expect(board.center).toEqual(place.lonlat);
  });
  it('모든 유닛이 중심에서 5km 안이다 — 전장 규모를 벗어나면 배치가 아니라 오타다', () => {
    for (const p of board.phases) for (const u of p.units) expect(distanceKm(board.center, u.at)).toBeLessThan(5);
  });
});

describe('자석 — 두 단계 (R39)', () => {
  const sq = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] };
  const donut = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]] };

  it('point-in-polygon: 안·밖·구멍', () => {
    expect(inPolygon([5, 5], sq)).toBe(true);
    expect(inPolygon([11, 5], sq)).toBe(false);
    expect(inPolygon([5, 5], donut)).toBe(false); // 구멍에 빠졌다
    expect(inPolygon([2, 2], donut)).toBe(true);
  });
  it('MultiPolygon도 본다', () => {
    const multi = { type: 'MultiPolygon', coordinates: [sq.coordinates, [[[20, 20], [22, 20], [22, 22], [20, 22], [20, 20]]]] };
    expect(inPolygon([21, 21], multi)).toBe(true);
    expect(inPolygon([15, 15], multi)).toBe(false);
  });
  it('distanceKm: 위도 1도는 약 111km', () => {
    expect(distanceKm([0, 0], [0, 1])).toBeCloseTo(111.19, 1);
  });

  it('세부 자석: 칸나이 배치는 칸나이 평원에 붙는다', () => {
    const near = nearestSettlement(raw.center, settlements, 30);
    expect(near?.id).toBe('place:칸나이평원');
    expect(near!.km).toBeLessThan(0.01);
  });
  it('세부 자석: maxKm 밖이면 안 붙는다 — 엉뚱한 도시로 끌려가지 않게', () => {
    expect(nearestSettlement([0, 0], settlements, 30)).toBe(null); // 대서양 한가운데
    // 칸나이 평원에서 동쪽으로 약 5.6km. 상한 1km면 안 붙고 10km면 붙는다.
    const off: [number, number] = [raw.center[0] + 0.067, raw.center[1]];
    expect(nearestSettlement(off, settlements, 1)).toBe(null);
    expect(nearestSettlement(off, settlements, 10)?.id).toBe('place:칸나이평원');
  });
  it('큰 자석: BC 216의 칸나이는 어느 정치체 안인가', () => {
    const pol = containingPolity(raw.center, territory, -216);
    expect(pol).not.toBe(null);
    expect(typeof pol!.name).toBe('string');
  });
  it('큰 자석: 연도가 맞아야 잡힌다', () => {
    const far = containingPolity(raw.center, territory, 99999);
    expect(far).toBe(null);
  });
  it('두 단계를 한 번에', () => {
    const s = snap(raw.center, { settlements, territory, year: -216 });
    expect(s.settlement?.id).toBe('place:칸나이평원');
    expect(s.polity).not.toBe(null);
  });
});
