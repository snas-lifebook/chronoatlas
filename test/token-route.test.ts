import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { routeGeometry, positionByRoute, type Feature } from '../src/schema';

const BASE = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'datasets', 'rome-753-218');
const movements: Feature[] = JSON.parse(readFileSync(join(BASE, 'layers', 'movements.geojson'), 'utf8')).features;

describe('routeGeometry / positionByRoute (다중 route 배선)', () => {
  it('hannibal 경로: 첫 정점 신카르타고, 끝 정점 자마, 연도순 stops', () => {
    const { path, stops } = routeGeometry(movements, 'hannibal');
    expect(path[0]).toEqual([-0.98, 37.60]);
    expect(path[path.length - 1]).toEqual([9.0, 36.3]);
    expect(stops[0].year).toBe(-218);
    expect(stops[stops.length - 1].year).toBe(-202);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].distAlong).toBeGreaterThanOrEqual(stops[i - 1].distAlong);
      expect(stops[i].year).toBeGreaterThanOrEqual(stops[i - 1].year);
    }
  });

  it('scipio 경로: 첫 정점 타라코, 끝 정점 자마, 연도순 stops', () => {
    const { path, stops } = routeGeometry(movements, 'scipio');
    expect(path[0]).toEqual([1.25, 41.12]);
    expect(path[path.length - 1]).toEqual([9.0, 36.3]);
    expect(stops[0].year).toBe(-218);
    expect(stops[stops.length - 1].year).toBe(-202);
  });

  it('카이사르 경로: valid_from이 도착 해여도 from_year면 출발점(알레시아), 원정 끝나면 없음', () => {
    const rome: Feature[] = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'datasets', 'rome', 'layers', 'movements.geojson'), 'utf8')).features;
    expect(positionByRoute(rome, 'caesar', -52)).toEqual([4.5006, 47.5392]);
    expect(positionByRoute(rome, 'caesar', -50)).toBeNull();
    expect(positionByRoute(rome, 'caesar', -44)).toBeNull();
  });

  it('positionByRoute: hannibal·scipio 상호 오염 없음', () => {
    expect(positionByRoute(movements, 'hannibal', -216)).toEqual([16.13, 41.31]);
    expect(positionByRoute(movements, 'hannibal', -202)).toEqual([9.0, 36.3]);
    expect(positionByRoute(movements, 'scipio', -202)).toEqual([9.0, 36.3]);
    expect(positionByRoute(movements, 'scipio', -240)).toBeNull();
    // -216: scipio는 아직 카르타고노바 함락(-209) 전이라 없음, hannibal은 칸나이 도착
    expect(positionByRoute(movements, 'scipio', -216)).toBeNull();
  });
});
