import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { arc, legAge, legYear, curveMovements, annotateLegs, legPhase, phaseColor, ROUTE_PHASES, type MoveFeature } from '../src/routes';

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
    // 2026-09-17 adapt 뒤 산출물에 정본 경로 16종(102구간)이 다 들어왔다. 이 검사는 카이사르만 본다.
    const src = (rd('public/datasets/rome/layers/movements.geojson').features as MoveFeature[]).filter(f => f.properties.route === 'caesar');
    expect(src.length).toBe(9);
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

describe('여정 국면과 순번', () => {
  // 2026-09-17: 정본에 폼페이우스 경로(6구간, BC 67~48)가 들어왔다. 교보재 pack-pompey(4구간)는 엔진이
  // 같은 route가 정본에 있으면 안 싣는다(중복 선). 여기서는 정본 쪽을 검사한다.
  const all = rd('public/datasets/rome/layers/movements.geojson').features as MoveFeature[];
  const caesar = all.filter(f => f.properties.route === 'caesar');
  const pompey = all.filter(f => f.properties.route === 'pompey');

  it('정본 카이사르 아홉 구간이 레퍼런스와 같은 국면으로 갈린다', () => {
    // Caesar's Civil War Campaigns 지도의 범례: 귀환 / 49 / 48 / 47 / 46 / 45.
    expect(caesar.map(f => legPhase(f.properties))).toEqual([
      'return', 'bc49', 'bc49', 'bc48', 'bc48', 'bc47', 'bc47', 'bc46', 'bc45',
    ]);
  });

  it('첫 구간만 귀환이다 — BC 49에 묶으면 브린디시·일레르다와 한 색이 된다', () => {
    expect(legPhase(caesar[0].properties)).toBe('return');
    expect(legPhase(caesar[1].properties)).toBe('bc49');
    expect(phaseColor('return')).not.toBe(phaseColor('bc49'));
  });

  it('폼페이우스 경로는 카이사르와 다른 색이다 — 둘 다 actor가 로마다. 동방 원정(BC 67~63)과 도피(BC 49~48)는 국면이 갈린다(R59)', () => {
    for (const f of pompey) expect(legPhase(f.properties)).toBe((f.properties.to_year ?? 0) <= -63 ? 'pompey-east' : 'pompey');
    expect(pompey.map(f => legPhase(f.properties))).toContain('pompey-east');
    expect(new Set(caesar.map(f => phaseColor(legPhase(f.properties)))).has(phaseColor('pompey'))).toBe(false);
  });

  it('정본 경로 넷(한니발·스키피오·클레오파트라/안토니우스)이 회색 「그 밖의 이동」으로 떨어지지 않는다(R59)', () => {
    for (const route of ['hannibal', 'scipio_africanus', 'cleopatra_antony']) {
      const legs = all.filter(f => f.properties.route === route);
      expect(legs.length, route).toBeGreaterThan(0);
      for (const f of legs) expect(legPhase(f.properties), `${route} ${f.properties.id}`).not.toBe('other');
    }
    // 한니발은 사료가 가르는 대목으로 넷: 알프스(-218) → 이탈리아(-217~-212) → 귀환(-204) → 자마(-202)
    const han = all.filter(f => f.properties.route === 'hannibal').map(f => legPhase(f.properties));
    expect(new Set(han)).toEqual(new Set(['han-alps', 'han-italy', 'han-return', 'han-zama']));
    // 표에 route를 적은 국면은 그 route에만 붙는다 — 카이사르 구간이 한니발 색을 입지 않는다
    for (const f of caesar) expect(legPhase(f.properties)).not.toMatch(/^han-|^scipio-|^cleo-/);
  });

  it('순번은 route 안에서 1부터, 좌표는 안 건드린다', () => {
    const out = annotateLegs([...caesar, ...pompey]);
    expect(out.filter(f => f.properties.route === 'caesar').map(f => f.properties.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(out.filter(f => f.properties.route === 'pompey').map(f => f.properties.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    for (let i = 0; i < caesar.length; i++) expect(out[i].geometry.coordinates).toEqual(caesar[i].geometry.coordinates);
  });

  it('국면 색이 서로 다르다 — 같은 색이 둘이면 갈라 놓은 뜻이 없다', () => {
    expect(new Set(ROUTE_PHASES.map(p => p.color)).size).toBe(ROUTE_PHASES.length);
  });

  it('모르는 구간은 other로 떨어진다 — 없는 국면을 발명하지 않는다', () => {
    expect(legPhase({})).toBe('other');
    expect(legPhase({ to_year: -300 })).toBe('other');
  });
});

describe('체류 구간 (MARCH_MAX_YEARS, 2026-09-17 정본 경로 유입)', () => {
  it('3년 넘는 구간은 위치 근거가 아니다: 기원전 60년 폼페이우스는 경로로 잡히지 않는다', async () => {
    const { positionByRoute } = await import('../src/schema');
    const all = rd('public/datasets/rome/layers/movements.geojson').features as any[];
    expect(positionByRoute(all, 'pompey', -60)).toBeNull();          // -63..-49 예루살렘→브룬디시움은 체류
    expect(positionByRoute(all, 'pompey', -49)).toEqual([20.4, 39.4]); // BC 49 에페이로스 (정본 pompey@2 끝점)
    expect(positionByRoute(all, 'caesar', -49)).not.toBeNull();       // caesar@0(-52..-49, 3년)은 행군: 도착 해부터 끝점
    expect(positionByRoute(all, 'caesar', -52)).not.toBeNull();       // 출발 해에는 출발점(알레시아)
  });
});
