import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { indexGraph } from '../src/graph/data';
import { peopleAtYear, peopleGeoJSON, companionsOf, unstack, spreadDeg } from '../src/people';

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

  it('BC 60: 카이사르는 위치 근거가 없어 비우고, 폼페이우스·크라수스는 통치 관계로 로마에', () => {
    const at60 = at(-60);
    expect(at60.some(p => p.id === 'person:카이사르')).toBe(false);
    expect(at60.find(p => p.id === 'person:폼페이우스')).toMatchObject({ via: 'rel', place: 'place:로마' });
    expect(at60.find(p => p.id === 'person:크라수스')).toMatchObject({ via: 'rel', place: 'place:로마' });
  });

  it('BC 52: 카이사르는 알레시아 출발점(경로 from_year). 문다 이후(-44)는 경로가 끝난다', () => {
    const c = at(-52).find(p => p.id === 'person:카이사르');
    expect(c).toMatchObject({ via: 'movement', at: [4.5006, 47.5392] });
    expect(at(-44).find(p => p.id === 'person:카이사르')?.via).not.toBe('movement');
  });

  it('교보재: 베르킹게토릭스는 알레시아 포위전 해에만, 정본 좌표', () => {
    const cast = JSON.parse(readFileSync(join(ROOT, 'data/overlays/pack-cast.json'), 'utf8'));
    const withCast = (y: number) => peopleAtYear(y, { graph, movements, teaching: cast });
    const v = withCast(-52).find(p => p.id === 'person:베르킹게토릭스');
    // 좌표는 정본 알레시아에서 오지만 **그 자리에 카이사르도 서 있어** 고리로 벌어진다.
    // 그래서 정확히 같은 점이 아니라 '그 근처'를 본다(unstack 기본 반지름 0.32도).
    expect(v).toMatchObject({ via: 'teaching', place: 'place:알레시아' });
    expect(Math.hypot(v!.at[0] - 4.5006, v!.at[1] - 47.5392)).toBeLessThan(0.5);
    expect(withCast(-51).some(p => p.id === 'person:베르킹게토릭스')).toBe(false);
    expect(at(-52).some(p => p.id === 'person:베르킹게토릭스')).toBe(false);
  });

  it('교보재 gone: 크라수스는 BC 53까지만 — ruled 로마 -71..-49가 죽은 사람을 세워 두었다', () => {
    const cast = JSON.parse(readFileSync(join(ROOT, 'data/overlays/pack-cast.json'), 'utf8'));
    const withCast = (y: number) => peopleAtYear(y, { graph, movements, teaching: cast });
    // 연도의 근거가 정본에 있어야 한다 — 두 동맹 링크가 to_year -53으로 끝난다
    expect(cast.gone.find((g: { id: string }) => g.id === 'person:크라수스'))
      .toMatchObject({ after_year: -53 });
    expect(withCast(-60).some(p => p.id === 'person:크라수스')).toBe(true);
    expect(withCast(-53).some(p => p.id === 'person:크라수스')).toBe(true);
    expect(withCast(-52).some(p => p.id === 'person:크라수스')).toBe(false);
    expect(withCast(-49).some(p => p.id === 'person:크라수스')).toBe(false);
    // gone을 안 주면 정본 그대로 — 걷어내기는 교보재에만 있다
    expect(at(-49).some(p => p.id === 'person:크라수스')).toBe(true);
  });

  it('같은 좌표면 근거가 달라도 벌린다 — BC52 알레시아의 카이사르(경로)와 베르킹게토릭스(교보재)', () => {
    const cast = JSON.parse(readFileSync(join(ROOT, 'data/overlays/pack-cast.json'), 'utf8'));
    const r = spreadDeg(5.2);
    const at52 = peopleAtYear(-52, { graph, movements, teaching: cast, zoom: 5.2 });
    const c = at52.find(p => p.id === 'person:카이사르')!;
    const v = at52.find(p => p.id === 'person:베르킹게토릭스')!;
    expect(c).toBeTruthy(); expect(v).toBeTruthy();
    // 둘 다 알레시아 정본 좌표에서 출발했는데 한쪽은 place=null(경로)이다
    expect(v.place).toBe('place:알레시아');
    expect(c.place).toBeNull();
    const d = Math.hypot(c.at[0] - v.at[0], c.at[1] - v.at[1]);
    expect(d).toBeGreaterThan(r);        // 포개지지 않는다
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

  it('군단 수를 지어내지 않는다 — 출처 있는 교보재를 넘길 때만 숫자가 붙는다', () => {
    // 원래 이 테스트는 「스키마에 숫자가 없다」였다. 이제 군기를 그리느라 숫자를 싣는데,
    // **지어내지 않는다**는 원칙은 그대로다. 넘기는 쪽이 없으면 여전히 null이어야 하고,
    // 넘길 때는 pack-legions.json(사료·신뢰도 표기)에서만 와야 한다.
    const bare = peopleGeoJSON(at(-49), { 로마: '#A4243B' });
    expect(bare.features.length).toBeGreaterThan(0);
    for (const f of bare.features) {
      expect(f.properties.legions).toBeNull();
      expect(f.properties.force).toBeNull();
      expect(f.properties).not.toHaveProperty('strength');
    }
    // 교보재를 넘기면 그 값이 그대로 실린다 — BC49 카이사르는 13군단 하나
    const pack = JSON.parse(readFileSync(join(ROOT, 'data/overlays/pack-legions.json'), 'utf8'));
    const rowsOf = (id: string) => (pack.by_person[id] ?? []) as { year: number; legions: number | null }[];
    const at49 = (id: string) => rowsOf(id).filter(r => r.year <= -49).sort((a, b) => b.year - a.year)[0] ?? null;
    expect(at49('person:카이사르')?.legions).toBe(1);
    const withLg = peopleGeoJSON(at(-49), { 로마: '#A4243B' }, at49);
    const c = withLg.features.find(f => f.properties.id === 'person:카이사르')!;
    expect(c.properties.legions).toBe(1);
    expect(c.properties.force).toContain('1군단');
  });

  it('같은 장소의 다른 사람을 같이 있는 사람으로 센다', () => {
    const at218 = at(-218);
    const hannibal = at218.find(p => p.id === 'person:한니발');
    expect(hannibal).toBeTruthy();
    const withH = companionsOf(at218, 'person:한니발');
    expect(withH.every(p => p.id !== 'person:한니발')).toBe(true);
  });

  it('peopleGeoJSON: id는 사람, 색은 세력 팔레트, 정본 신뢰도 필드 없음', () => {
    const fc = peopleGeoJSON(at(-49), { 로마: '#A4243B' });
    const c = fc.features.find(f => f.properties.id === 'person:카이사르')!;
    expect(c.geometry).toEqual({ type: 'Point', coordinates: [12.4431, 44.1681] });
    expect(c.properties.color).toBe('#8C3B2E'); // 인물색. 세력 로마 #A4243B가 아님
    expect(c.properties.name).toBe('카이사르');
    const flat = JSON.stringify(fc);
    expect(flat).not.toContain('"src"');
    expect(flat).not.toContain('"confidence"');
  });
});

describe('말 벌림은 화면 기준이다 (spreadDeg)', () => {
  it('넓은 줌에서 말이 커지므로 벌림도 커진다', () => {
    // 말은 화면에서 거의 일정한 크기다 → 도(度) 벌림은 줌이 낮을수록 커야 한다
    expect(spreadDeg(4.2)).toBeGreaterThan(spreadDeg(7));
    // BC48 알렉산드리아가 겹쳤던 줌. 말 폭(≈1.36 × tokenMeters)의 절반보다 커야 떨어진다
    expect(spreadDeg(4.9)).toBeGreaterThan(0.9);
    // 바짝 당긴 줌에서는 도시에서 말이 멀리 튀지 않아야 한다
    expect(spreadDeg(8)).toBeLessThan(0.3);
    // 발표 시점(지중해 전역 z4.2)에서는 상한에 물려 일정하다 — 말이 서로 안 겹칠 만큼 크다
    expect(spreadDeg(4.2)).toBeCloseTo(spreadDeg(3.5), 5);
  });
  it('같은 장소 두 사람이 말 폭보다 멀리 떨어진다', () => {
    const two = [
      { id: 'a', name: '가', at: [30, 31] as [number, number], place: 'place:x', placeName: 'x', via: 'rel' as const, faction: null, polity: null, polityName: null, asset: null },
      { id: 'b', name: '나', at: [30, 31] as [number, number], place: 'place:x', placeName: 'x', via: 'rel' as const, faction: null, polity: null, polityName: null, asset: null },
    ];
    const r = spreadDeg(4.9);
    const [p, q] = unstack(two, r);
    // 동서로 벌린다(고리 시작이 동쪽) — 위아래로 세우면 이름표가 아래 말에 묻힌다
    expect(Math.abs(p.at[1] - q.at[1])).toBeLessThan(1e-9);
    const dLng = Math.abs(p.at[0] - q.at[0]) * Math.cos(31 * Math.PI / 180);
    expect(dLng).toBeCloseTo(2 * r, 2);   // 고리 지름만큼 벌어진다
  });
});

describe('권역 중심점보다 도시 (ruled 동점 처리)', () => {
  it('클레오파트라는 이집트 권역 한가운데가 아니라 알렉산드리아에 선다', () => {
    // 정본에 `ruled 알렉산드리아 -51..-30`(21년)과 `ruled 이집트 -51..-44`(7년)가 둘 다 있다.
    // 「짧은 구간이 이긴다」만 보면 권역이 이겨 여왕이 사막 한가운데 선다.
    const c = peopleAtYear(-47, { graph, movements }).find(p => p.id === 'person:클레오파트라7세');
    expect(c?.place).toBe('place:알렉산드리아');
    const alex = graph.nodes.get('place:알렉산드리아')!;
    expect(c!.at).toEqual(alex.lonlat);
  });
  it('도시 근거가 없으면 권역이라도 쓴다 — 위치를 버리지는 않는다', () => {
    const p = peopleAtYear(-47, { graph, movements }).find(x => x.id === 'person:프톨레마이오스13세');
    expect(p).toBeTruthy();   // ruled 이집트뿐이라 권역 중심점이라도 선다
  });
});
