import { describe, it, expect } from 'vitest';
import { decodeElev, tileOf, resample } from '../src/map/elevation.ts';

describe('terrarium 디코딩', () => {
  it('기준점 0m는 (128, 0, 0)', () => expect(decodeElev(128, 0, 0)).toBe(0));
  it('실제 타일 픽셀(129,255,0) = 511m', () => expect(decodeElev(129, 255, 0)).toBe(511));
  it('해수면 아래는 음수', () => expect(decodeElev(127, 0, 0)).toBe(-256));
  it('mapbox 인코딩은 식이 다르다', () => expect(decodeElev(1, 219, 236, 'mapbox')).toBeCloseTo(2183.6, 1));
});

describe('타일 좌표', () => {
  it('z0은 통째로 한 장', () => expect(tileOf(0, 0, 0)).toMatchObject({ x: 0, y: 0 }));
  it('본초자오선·적도는 z1 타일 경계', () => {
    const t = tileOf(0, 0, 1);
    expect([t.x, t.y]).toEqual([1, 1]);
    expect(t.fx).toBeCloseTo(0, 6);
  });
  it('몽블랑은 z7에서 66/45', () => {
    const t = tileOf(6.865, 45.833, 7);
    expect([t.x, t.y]).toEqual([66, 45]);
  });
  it('타일 안 소수부는 0~1', () => {
    const t = tileOf(12.4964, 41.9028, 7);
    expect(t.fx).toBeGreaterThanOrEqual(0); expect(t.fx).toBeLessThan(1);
    expect(t.fy).toBeGreaterThanOrEqual(0); expect(t.fy).toBeLessThan(1);
  });
});

describe('경로 리샘플', () => {
  const path: [number, number][] = [[0, 45], [1, 45], [2, 45]];
  it('요청한 점 수만큼 나온다', () => expect(resample(path, 5)).toHaveLength(5));
  it('양 끝은 원래 끝점', () => {
    const r = resample(path, 5);
    expect([r[0].lon, r[0].lat]).toEqual([0, 45]);
    expect(r[4].lon).toBeCloseTo(2, 6);
  });
  it('km는 단조증가하고 0에서 시작', () => {
    const r = resample(path, 9);
    expect(r[0].km).toBe(0);
    for (let i = 1; i < r.length; i++) expect(r[i].km).toBeGreaterThan(r[i - 1].km);
  });
  it('위도 45에서 경도 2도는 약 157km', () => {
    const r = resample(path, 2);
    expect(r[1].km).toBeGreaterThan(150); expect(r[1].km).toBeLessThan(165);
  });
  it('점이 하나뿐이면 그대로', () => expect(resample([[1, 2]], 5)).toHaveLength(1));
});
