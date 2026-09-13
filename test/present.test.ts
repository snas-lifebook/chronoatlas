import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseState, serializeState, DEFAULTS } from '../src/state';
import { scenesInGroup, stepScene, PRESENT_GROUP, showGalliaOverlay, showGalliaRoman, GALLIA_SCENE, GALLIA_ROMAN_SCENE } from '../src/present';

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
  it('판도 BC60 장면에만 켠다', () => {
    expect(showGalliaOverlay(GALLIA_SCENE, -60)).toBe(true);
    expect(showGalliaOverlay('pack-intro-med', -60)).toBe(false);
    expect(showGalliaOverlay('pack-gaul-52', -52)).toBe(false);
    expect(showGalliaOverlay('pack-extent-51', -51)).toBe(false);
    expect(showGalliaOverlay(null, -60)).toBe(false);
  });
  it('자유 갈리아 폴리곤 셋(나르보넨시스 제외)', () => {
    const raw = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../data/overlays/gallia-free.json'), 'utf8'));
    expect(raw.teaching).toBe(true);
    expect(raw.features).toHaveLength(3);
    const names = raw.features.map((f: { properties: { name: string } }) => f.properties.name).join(' ');
    expect(names).toMatch(/아퀴타니아/);
    expect(names).toMatch(/루그두넨시스/);
    expect(names).toMatch(/벨기카/);
    expect(names).not.toMatch(/나르보넨시스/);
  });
});

describe('갈리아 로마색 오버레이 (판도 BC51)', () => {
  it('판도 BC51 장면에만 켠다', () => {
    expect(showGalliaRoman(GALLIA_ROMAN_SCENE, -51)).toBe(true);
    expect(showGalliaRoman(GALLIA_SCENE, -60)).toBe(false);
    expect(showGalliaRoman('pack-gaul-52', -52)).toBe(false);
    expect(showGalliaRoman('pack-extent-44', -44)).toBe(false);
    expect(showGalliaRoman(null, -51)).toBe(false);
  });
  it('BC60과 BC51이 서로 배타적이다 — 한 장에 두 색이 겹치면 안 된다', () => {
    for (const [scene, year] of [[GALLIA_SCENE, -60], [GALLIA_ROMAN_SCENE, -51]] as const)
      expect(showGalliaOverlay(scene, year) && showGalliaRoman(scene, year)).toBe(false);
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
  it('아홉 장면 모두 설명과 평면/입체를 가진다', () => {
    const raw = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../data/scenes/rome.json'), 'utf8')) as { id: string; group?: string; note?: string; view?: string; skin?: string }[];
    const pack = raw.filter(s => s.group === PRESENT_GROUP);
    expect(pack.map(s => s.id)).toEqual([
      'pack-intro-med', 'pack-gaul-52', 'pack-extent-60', 'pack-extent-51',
      'pack-rubicon', 'pack-greece-48', 'pack-egypt-47', 'pack-extent-44', 'pack-augustan-27',
    ]);
    for (const s of pack) {
      expect(s.note && s.note.length > 8, s.id).toBeTruthy();
      expect(s.view === '2d' || s.view === '3d', s.id).toBeTruthy();
      // 에셋 사양서 B절 「스킨은 campaign으로 고정한다. 아홉 장 전부」 —
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
