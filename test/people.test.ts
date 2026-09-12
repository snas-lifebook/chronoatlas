import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { indexGraph } from '../src/graph/data';
import { peopleAtYear, peopleGeoJSON } from '../src/people';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const B = join(ROOT, 'public/datasets/rome');
const rd = (p: string) => JSON.parse(readFileSync(join(B, p), 'utf8'));
const graph = indexGraph(rd('graph.json'));
const movements = rd('layers/movements.geojson').features;
const at = (y: number) => peopleAtYear(y, { graph, movements });

describe('인물 위치 (R38)', () => {
  it('BC 49: 카이사르는 루비콘에 있다 — located_in이 이동 경로의 그 해 마지막 정점(일레르다)을 이긴다', () => {
    const c = at(-49).find(p => p.id === 'person:카이사르');
    expect(c).toMatchObject({ via: 'located_in', place: 'place:루비콘강' });
    expect(c!.at).toEqual([12.4431, 44.1681]);
  });

  it('BC 48: 카이사르 located_in이 없으면 이동 경로 위치(파르살루스)', () => {
    const c = at(-48).find(p => p.id === 'person:카이사르');
    expect(c).toMatchObject({ via: 'movement', at: [22.3833, 39.3] });
  });

  it('BC 60: 위치 근거가 없으면 비운다 — 있는 척하지 않는다', () => {
    expect(at(-60)).toEqual([]);
  });

  it('연도 없는 located_in은 안 그린다 (한니발→이탈리아반도)', () => {
    expect(at(-60).some(p => p.id === 'person:한니발')).toBe(false);
    expect(at(-216).some(p => p.id === 'person:한니발' && p.place === 'place:이탈리아반도')).toBe(false);
  });

  it('BC 218: 한니발은 알프스(그 해 점), 스키피오는 에스파냐(구간)', () => {
    const h = at(-218).find(p => p.id === 'person:한니발');
    const s = at(-218).find(p => p.id === 'person:푸블리우스스키피오');
    expect(h).toMatchObject({ place: 'place:알프스', via: 'located_in' });
    expect(s).toMatchObject({ place: 'place:에스파냐', via: 'located_in' });
  });

  it('한 사람에 장소가 겹치면 그 해의 점(단==끝)이 구간을 이긴다 — 하드리아누스 AD 122는 브리타니아', () => {
    const h = at(122).find(p => p.id === 'person:하드리아누스');
    expect(h?.place).toBe('place:브리타니아');
    expect(at(125).find(p => p.id === 'person:하드리아누스')?.place).toBe('place:게르마니아');
  });

  it('군단 수를 지어내지 않는다 — 스키마에 숫자가 없다', () => {
    const fc = peopleGeoJSON(at(-49), { 로마: '#A4243B' });
    expect(fc.features.length).toBeGreaterThan(0);
    for (const f of fc.features) {
      expect(f.properties).not.toHaveProperty('legions');
      expect(f.properties).not.toHaveProperty('strength');
    }
  });

  it('peopleGeoJSON: id는 사람, 색은 세력 팔레트, 정본 신뢰도 필드 없음', () => {
    const fc = peopleGeoJSON(at(-49), { 로마: '#A4243B' });
    const c = fc.features.find(f => f.properties.id === 'person:카이사르')!;
    expect(c.geometry).toEqual({ type: 'Point', coordinates: [12.4431, 44.1681] });
    expect(c.properties.color).toBe('#A4243B');
    expect(c.properties.name).toBe('카이사르');
    const flat = JSON.stringify(fc);
    expect(flat).not.toContain('"src"');
    expect(flat).not.toContain('"confidence"');
  });
});
