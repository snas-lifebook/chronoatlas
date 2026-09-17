import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseState, serializeState, DEFAULTS } from '../src/state';
import { scenesInGroup, stepScene, PRESENT_GROUP, showGalliaOverlay, showGalliaRoman, GALLIA_SCENE, GALLIA_ROMAN_SCENE, fitZoom, DETAIL_GROUP } from '../src/present';

const pack = [
  { id: 'a', title: '1', year: -60, group: PRESENT_GROUP },
  { id: 'b', title: '2', year: -52, group: PRESENT_GROUP },
  { id: 'c', title: '3', year: -49, group: PRESENT_GROUP },
  { id: 'x', title: '다른', year: -216, group: '말판' },
];

describe('발표 장면 넘김', () => {
  it('그룹만 남기고 [ ] 로 순환한다', () => {
    const g = scenesInGroup(pack, PRESENT_GROUP);
    expect(g.map(s => s.id)).toEqual(['a', 'b', 'c']);
    expect(stepScene(g, 'a', 1)?.id).toBe('b');
    expect(stepScene(g, 'c', 1)?.id).toBe('a');
    expect(stepScene(g, 'a', -1)?.id).toBe('c');
  });
});

describe('갈리아 교보재 오버레이', () => {
  // 장면이 아니라 **연도로** 가른다. 예전에는 전용 장면 한 장에만 켜서, 정작
  // 갈리아 원정 장면(BC52)에 갈리아가 없었다 — 카이사르와 베르킹게토릭스가 흰 땅 위에
  // 서 있었다. 자유 갈리아는 어느 장면에서 보든 BC51까지 자유 갈리아다.
  it('기원전 51년 전이면 팩 장면 어디서나 켠다', () => {
    expect(showGalliaOverlay(GALLIA_SCENE, -60)).toBe(true);
    expect(showGalliaOverlay('pack-intro-med', -60)).toBe(true);
    expect(showGalliaOverlay('pack-gaul-52', -52)).toBe(true);   // 원정 장면 — 여기가 비어 있었다
    expect(showGalliaOverlay('pack-extent-51', -51)).toBe(false); // 정복 후
    expect(showGalliaOverlay(null, -60)).toBe(false);
    expect(showGalliaOverlay('chuhan-1', -60)).toBe(false);       // 다른 데이터셋 장면엔 안 얹는다
  });
  it('자유 갈리아는 세 부분이고 나르보넨시스를 안 담는다', () => {
    const raw = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../data/overlays/gallia-free.json'), 'utf8'));
    expect(raw.teaching).toBe(true);
    expect(String(raw.source).length).toBeGreaterThan(40);  // 어디서 왔는지 적혀 있어야 한다
    expect(raw.features).toHaveLength(3);                   // 카이사르가 센 셋 (BG 1.1)
    // 나르보넨시스는 기원전 121년부터 정식 속주라 정본 로마 영토가 이미 그린다. 두 겹 금지.
    expect(raw.features.map((f: { properties: { name: string } }) => f.properties.name).join(' ')).not.toMatch(/나르보넨시스/);
    // 갈리아 전역을 덮나. 예전 손그림은 북동쪽만 덮어 아키텐·아르모리카가 통째로 비었다.
    const xs: number[] = [], ys: number[] = [];
    const walk = (c: unknown): void => {
      if (typeof (c as number[])[0] === 'number') { xs.push((c as number[])[0]); ys.push((c as number[])[1]); }
      else for (const x of c as unknown[]) walk(x);
    };
    for (const f of raw.features) walk(f.geometry.coordinates);
    expect(Math.min(...xs)).toBeLessThan(-2);    // 아르모리카(브르타뉴)까지 서쪽으로
    expect(Math.max(...xs)).toBeGreaterThan(6);  // 라인강까지 동쪽으로
    expect(Math.min(...ys)).toBeLessThan(44);    // 아키텐까지 남쪽으로
    expect(Math.max(...ys)).toBeGreaterThan(50); // 벨가이까지 북쪽으로
  });
});

describe('갈리아 로마색 오버레이 (기원전 51년)', () => {
  it('기원전 51년 한 해만 — 정본이 -50에 갈리아를 덮으므로 거기서 끊는다', () => {
    expect(showGalliaRoman(GALLIA_ROMAN_SCENE, -51)).toBe(true);
    expect(showGalliaRoman('pack-intro-med', -51)).toBe(true);
    expect(showGalliaRoman(GALLIA_SCENE, -60)).toBe(false);
    expect(showGalliaRoman('pack-gaul-52', -52)).toBe(false);
    expect(showGalliaRoman('pack-rubicon', -49)).toBe(false);   // 정본이 이미 칠한다 — 두 겹 금지
    expect(showGalliaRoman('pack-extent-44', -44)).toBe(false);
    expect(showGalliaRoman(null, -51)).toBe(false);
  });
  it('어느 해에도 두 색이 겹치지 않는다', () => {
    for (let y = -70; y <= -20; y++)
      expect(showGalliaOverlay('pack-intro-med', y) && showGalliaRoman('pack-intro-med', y), `BC ${-y}`).toBe(false);
  });
});

describe('present URL', () => {
  it('?present=1 이 켜지고 기본은 생략', () => {
    expect(parseState('?present=1').present).toBe(true);
    expect(serializeState({ ...DEFAULTS, present: true })).toBe('?present=1');
    expect(serializeState({ ...DEFAULTS })).toBe('');
  });
});

describe('카이사르 팩 교보재', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../data/overlays');
  it('폼페이우스 경로는 정본 정점이고 기원전 49부터다', () => {
    const raw = JSON.parse(readFileSync(join(dir, 'pack-pompey.json'), 'utf8'));
    expect(raw.teaching).toBe(true);
    expect(raw.features.every((f: { properties: { from_year: number } }) => f.properties.from_year >= -49)).toBe(true);
    expect(raw.features.at(-1).geometry.coordinates[1]).toEqual([29.9079, 31.1982]);
  });
  it('전투점은 정본 카이사르 경로 정점이다', () => {
    const raw = JSON.parse(readFileSync(join(dir, 'pack-battles.json'), 'utf8'));
    expect(raw.teaching).toBe(true);
    const names = raw.features.map((f: { properties: { name_ko: string } }) => f.properties.name_ko);
    expect(names).toContain('알레시아 포위전');
    expect(names).toContain('파르살루스');
  });
});

describe('카이사르 팩 장면 파일', () => {
  it('여덟 장면 모두 설명과 평면/입체를 가진다', () => {
    const raw = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../data/scenes/rome.json'), 'utf8')) as { id: string; year: number; group?: string; note?: string; view?: string; skin?: string }[];
    const pack = raw.filter(s => s.group === PRESENT_GROUP);
    expect(pack.map(s => s.id)).toEqual([
      'pack-intro-med', 'pack-gaul-52', 'pack-extent-51',
      'pack-rubicon', 'pack-greece-48', 'pack-egypt-47', 'pack-extent-44', 'pack-augustan-27',
    ]);
    // **연도가 되감기지 않는다.** `pack-extent-60`이 두 번째와 세 번째 사이에 BC 60으로
    // 끼어 있어 60→52→60→51로 흘렀다(River가 그걸 짚었다). 같은 사고가 재발하면 여기서 잡는다.
    const years = pack.map(s => s.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    for (const s of pack) {
      expect(s.note && s.note.length > 8, s.id).toBeTruthy();
      expect(s.view === '2d' || s.view === '3d', s.id).toBeTruthy();
      // 에셋 사양서 B절 「스킨은 campaign으로 고정한다. 전부」 —
      // 장마다 바꾸면 지도끼리 따로 논다. 라이브와 내보낸 이미지도 같은 톤이어야 한다.
      expect(s.skin, s.id).toBe('campaign');
    }
  });
});

describe('후대 이름 가리기 (정착지에 연도 필드가 없다)', () => {
  const pack = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../data/overlays/pack-anachronisms.json'), 'utf8'));
  const hide = (year: number) => (pack.hide_before as { id: string; valid_from: number }[])
    .filter(h => year < h.valid_from).map(h => h.id);

  it('BC 48 지도에서 콘스탄티노플(AD 330)을 가린다', () => {
    expect(hide(-48)).toContain('place:콘스탄티노플');
    expect(hide(400)).not.toContain('place:콘스탄티노플');
  });
  it('공화정 장면에서 「로마 제국」을 가리고, 제정(BC 27)부터 띄운다', () => {
    expect(hide(-48)).toContain('place:로마제국');
    expect(hide(-27)).not.toContain('place:로마제국');
  });
  it('가리는 근거를 항목마다 적어 둔다 — 연도를 지어내지 않는다', () => {
    expect(pack.teaching).toBe(true);
    for (const h of pack.hide_before) expect(String(h.source).length).toBeGreaterThan(20);
  });
});

describe('알레시아 세부 장면', () => {
  it('세부 축척이라 지중해 고정 시점의 예외다 — 그래서 따로 적어 둔다', () => {
    const raw = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../data/scenes/rome.json'), 'utf8')) as { id: string; zoom?: number; center?: [number, number] }[];
    const a = raw.find(s => s.id === 'pack-alesia-52')!;
    expect(a.zoom).toBeGreaterThan(11);              // 나머지 여덟은 4.2
    expect(raw.filter(x => (x as { group?: string }).group === '2회차 발표 · 카이사르 팩')).toHaveLength(8);
    expect(a.center![0]).toBeCloseTo(4.5, 1);        // 몽 옥수아
    expect(a.center![1]).toBeCloseTo(47.53, 1);
  });
  it('포위선이 두 겹이고 진영 8·보루 23이다 (BG 7.69)', () => {
    const raw = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../data/micromaps/alesia.json'), 'utf8'));
    expect(raw.teaching).toBe(true);
    const k = (n: string) => raw.features.filter((f: { properties: { kind: string } }) => f.properties.kind === n).length;
    expect(k('inner_line')).toBe(1);
    expect(k('outer_line')).toBe(1);
    expect(k('camp')).toBe(8);
    expect(k('redoubt')).toBe(23);
  });
});

describe('좁은 화면 줌 (모바일)', () => {
  it('데스크톱 폭에서는 장면 줌을 안 건드린다', () => {
    expect(fitZoom(4.2, 1600)).toBe(4.2);
    expect(fitZoom(4.2, 1920)).toBe(4.2);
  });
  it('폭이 절반이면 줌 1을 깎는다 — 담기는 경도 폭이 같아진다', () => {
    expect(fitZoom(6, 800)).toBe(5);
    expect(fitZoom(6, 400)).toBe(4);
  });
  it('minZoom에서 멈춘다 — 390px 폰에서 4.2는 2.17이 되지만 지도 하한이 3이다', () => {
    expect(fitZoom(4.2, 390)).toBe(3);
  });
  it('폭이 0이면(아직 붙기 전) 그대로 둔다', () => {
    expect(fitZoom(4.2, 0)).toBe(4.2);
  });
});

describe('세부 지도 그룹', () => {
  const raw = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../data/scenes/rome.json'), 'utf8')) as
    { id: string; year: number; group?: string; zoom?: number; center?: [number, number]; layers?: string[]; skin?: string }[];
  const detail = raw.filter(s => s.group === DETAIL_GROUP);

  it('세 장이고 각각 자기 미시 레이어를 켠다', () => {
    // River: "세부지도들도 깃허브 io에서 북마크 따라갈 수 있게 하라." 장면이 없으면
    // 줌으로만 도달하고 손가락으로는 못 간다 — 로마·알렉산드리아가 그 상태였다.
    // 2026-09-17: 미시지도는 레이어 이름이 아니라 장면의 micro 필드가 부른다(레지스트리, OVERHAUL §3.2). 셋에서 늘어난다.
    for (const id of ['pack-alesia-52', 'pack-roma-urbs', 'pack-alexandria-47']) expect(detail.map(s => s.id)).toContain(id);
    for (const s of detail) expect(typeof (s as any).micro, s.id).toBe('string');
  });

  it('문턱을 넘는 줌이라야 미시 지도가 실제로 켜진다', () => {
    for (const s of detail) {
      expect(s.zoom, s.id).toBeGreaterThanOrEqual(10);   // 루비콘은 z10.8 (강 유역이 넓다)
      expect(s.skin, s.id).toBe('campaign');
    }
  });

  it('본 발표 그룹과 겹치지 않는다 — 여덟 장 흐름을 끊지 않는 것이 분리 이유다', () => {
    const pack = raw.filter(s => s.group === PRESENT_GROUP).map(s => s.id);
    for (const s of detail) expect(pack).not.toContain(s.id);
    expect(pack).toHaveLength(8);
  });
});
