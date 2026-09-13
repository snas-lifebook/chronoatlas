import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { arc, legAge, legYear, curveMovements, type MoveFeature } from '../src/routes';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

describe('경로를 활로 (River: "그냥 쭉 이어진 직선이라 시야에 방해된다")', () => {
  it('끝점은 그대로 두고 가운데만 민다 — 도착지가 움직이면 지리가 틀려진다', () => {
    const a: [number, number] = [0, 0], b: [number, number] = [10, 0];
    const c = arc(a, b, 0.12, 24);
    expect(c[0]).toEqual(a);
    expect(c.at(-1)).toEqual(b);
    const mid = c[12];
    expect(mid[0]).toBeCloseTo(5, 6);          // 현의 중점 위
    expect(Math.abs(mid[1])).toBeGreaterThan(0.5); // 실제로 휘었다
  });

  it('부푸는 폭이 현 길이에 비례한다 — 짧은 구간이 과장되지 않는다', () => {
    const bow = (len: number) =>
      Math.abs(arc([0, 0], [len, 0], 0.12, 12)[6][1]);
    expect(bow(20) / bow(2)).toBeCloseTo(10, 1);
  });

  it('부호가 id에 매인다 — 다시 그려도 경로가 같은 쪽으로 휜다', () => {
    const f = (): MoveFeature[] => [{ type: 'Feature', properties: { id: 'caesar@3' },
      geometry: { type: 'LineString', coordinates: [[-1, 41], [19, 41]] } }];
    expect(curveMovements(f())[0].geometry.coordinates)
      .toEqual(curveMovements(f())[0].geometry.coordinates);
  });

  it('정점이 셋 이상이면 안 건드린다 — 실제 행군로를 왜곡하지 않는다', () => {
    const path: [number, number][] = [[0, 0], [3, 2], [7, 1]];
    const out = curveMovements([{ type: 'Feature', properties: { id: 'x' },
      geometry: { type: 'LineString', coordinates: path } }]);
    expect(out[0].geometry.coordinates).toEqual(path);
  });

  it('정본 카이사르 아홉 구간이 전부 두 점짜리라 전부 휜다', () => {
    const src = rd('public/datasets/rome/layers/movements.geojson').features as MoveFeature[];
    expect(src.length).toBeGreaterThan(0);
    expect(src.every(f => f.geometry.coordinates.length === 2)).toBe(true);
    const out = curveMovements(src);
    expect(out.every(f => f.geometry.coordinates.length > 2)).toBe(true);
    // 끝점은 한 점도 안 움직였다 — 말이 밟는 정점과 어긋나면 walkRoute가 구간을 못 찾는다
    for (let i = 0; i < src.length; i++) {
      expect(out[i].geometry.coordinates[0]).toEqual(src[i].geometry.coordinates[0]);
      expect(out[i].geometry.coordinates.at(-1)).toEqual(src[i].geometry.coordinates[1]);
    }
  });
});

describe('지난 구간일수록 옅게', () => {
  it('올해가 0, 여덟 해 전이 1, 그 너머도 1에서 멈춘다', () => {
    expect(legAge({ to_year: -48 }, -48)).toBe(0);
    expect(legAge({ to_year: -52 }, -48)).toBeCloseTo(0.5, 6);
    expect(legAge({ to_year: -56 }, -48)).toBe(1);
    expect(legAge({ to_year: -90 }, -48)).toBe(1);
  });
  it('아직 안 간 구간은 음수가 아니라 0이다 — 필터가 이미 걸러내지만 값이 새면 두꺼워진다', () => {
    expect(legAge({ to_year: -40 }, -48)).toBe(0);
  });
  it('연도를 모르면 1 — 모르는 것은 조용히 둔다', () => {
    expect(legYear({})).toBe(null);
    expect(legAge({}, -48)).toBe(1);
    expect(legAge({ valid_from: -50 }, -48)).toBeCloseTo(0.25, 6);
  });
});
