import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// 영역 마감 (OVERHAUL §3.6c, R57). 파이프라인 scripts/finish-territory.py가 돌았다는 증거와 규칙 상한을 검사한다.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAYERS = join(ROOT, 'public/datasets/rome/layers');
const DIR = join(LAYERS, 'territory');
const rd = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

describe('영역 마감', () => {
  it('모든 버킷의 폴리곤에 finish 표가 있다 (파이프라인이 돌았다)', () => {
    for (const f of readdirSync(DIR).filter(x => x.endsWith('.geojson'))) {
      const fc = rd(join(DIR, f));
      const polys = fc.features.filter((x: any) => /Polygon/.test(x.geometry.type));
      expect(polys.length, f).toBeGreaterThan(0);
      for (const p of polys) expect(String(p.properties.finish ?? ''), `${f} ${p.properties.id}`).toMatch(/^chaikin/);
    }
  });
  it('바다 마스크가 있고 육지 파일에 작은 섬이 덧붙어 있다', () => {
    expect(existsSync(join(LAYERS, 'ocean.geojson'))).toBe(true);
    const ocean = rd(join(LAYERS, 'ocean.geojson'));
    expect(ocean.features).toHaveLength(1);
    expect(/Polygon/.test(ocean.features[0].geometry.type)).toBe(true);
    const land = rd(join(LAYERS, 'land.geojson'));
    expect(land.features.some((f: any) => f.properties?.minor)).toBe(true);
  });
  it('섬 귀속 표가 있고 거리 상한 40 km를 지킨다', () => {
    const csv = join(ROOT, 'docs/verify/overhaul/islands.csv');
    expect(existsSync(csv)).toBe(true);
    const rows = readFileSync(csv, 'utf8').trim().split('\n').slice(1).map(l => l.split(','));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(Number(r[3])).toBeLessThanOrEqual(40);
  });
  it('버킷 파일이 하나도 6 MB를 넘지 않는다 (지연 로드 단위)', () => {
    for (const f of readdirSync(DIR).filter(x => x.endsWith('.geojson'))) expect(statSync(join(DIR, f)).size, f).toBeLessThanOrEqual(6_000_000);
  });
});
