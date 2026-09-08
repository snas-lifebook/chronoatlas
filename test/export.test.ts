import { describe, it, expect } from 'vitest';
import { frameSpec } from '../src/export/png';
describe('PNG 내보내기 (TASKS 3.1)', () => {
  it('크기 = 2×viewport, 띠·여백도 배율', () => {
    const s = frameSpec(1400, 900);
    expect([s.width, s.height]).toEqual([2800, 1800]); expect(s.band).toBe(144); expect(s.margin).toBe(48);
  });
  it('배율 1이면 원본 크기', () => expect(frameSpec(800, 600, 1).width).toBe(800));
});

// F9 데이터 내보내기 — 연도 단면·CSV 인용
import { readFileSync } from 'node:fs';
import { timeSlice, pointsCsv } from '../src/export/data';
describe('export/data (F9)', () => {
  const L = (f: string) => JSON.parse(readFileSync(`public/datasets/rome/layers/${f}.geojson`, 'utf8'));
  const d: any = { territory: L('territory'), admin_regions: L('admin_regions'), settlements: L('settlements'), battles: L('battles'), movements: L('movements') };
  it('BC 49 단면은 BC 300보다 전투가 많고, 전부 그 해에 유효', () => {
    const a = timeSlice(d, -49), b = timeSlice(d, -300);
    expect(a.features.length).toBeGreaterThan(0);
    expect(a.features.filter(f => f.properties.id?.startsWith('event:')).length).toBeGreaterThanOrEqual(b.features.filter(f => f.properties.id?.startsWith('event:')).length);
    for (const f of a.features) expect((f.properties.valid_from ?? -1e6) <= -49 && -49 < (f.properties.valid_to ?? 1e6)).toBe(true);
  });
  it('CSV: 헤더 7열, BOM, 쉼표 있는 값은 따옴표', () => {
    const csv = pointsCsv({ ...d, settlements: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: 'place:x', name_ko: 'a, b' }, geometry: { type: 'Point', coordinates: [1, 2] } }] }, battles: { type: 'FeatureCollection', features: [] } }, 0);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [h, r] = csv.slice(1).split('\n'); expect(h.split(',').length).toBe(7); expect(r).toContain('"a, b"');
  });
});
