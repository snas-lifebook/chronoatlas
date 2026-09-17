import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { MicroMap, KINDS, GRADES, lintMicroMap } from '../schema/micromap';
import { microMapAt, INDEX } from '../src/micromaps';
import { KIND_PAINT } from '../src/map/micro';

// 미시지도 레지스트리 (OVERHAUL §3.2, R47). 파일마다 스키마·린트를 돌리고, 색인과 장면 참조가 실재하는지 본다.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'data', 'micromaps');
const rd = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const files = readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
const boards = () => readdirSync(join(ROOT, 'data', 'boards')).filter(b => b.endsWith('.json') && !b.startsWith('_')).map(b => b.replace(/\.json$/, ''));

const minimal = () => ({
  id: 'x', title: 'x', year: -1, teaching: true as const, source: '열 글자 넘는 근거 문장입니다.',
  home: { at: [0, 0] as [number, number], minZoom: 10, span: 0.3 }, view: { center: [0, 0] as [number, number], zoom: 12 },
  features: [{ type: 'Feature' as const, properties: { id: 'x:a', name_ko: '가', kind: 'river', grade: '확정', source: 'BG 1.1' }, geometry: { type: 'Point' as const, coordinates: [0, 0] } }],
});

describe('미시지도 스키마', () => {
  it('KIND_PAINT 가 KINDS 전부를 알고 그 밖은 모른다', () => { expect(Object.keys(KIND_PAINT).sort()).toEqual([...KINDS].sort()); });
  it('kind 어휘가 28종이고 grade가 넷이다', () => {
    expect(KINDS.length).toBe(28);
    expect([...GRADES]).toEqual(['확정', '근사', '복원', '논쟁']);
  });
  it('teaching·grade·kind를 강제한다', () => {
    const ok = minimal();
    expect(() => MicroMap.parse(ok)).not.toThrow();
    const { teaching, ...no } = ok; expect(() => MicroMap.parse(no)).toThrow();
    expect(() => MicroMap.parse({ ...ok, features: [{ ...ok.features[0], properties: { ...ok.features[0].properties, kind: 'castle' } }] })).toThrow();
    expect(() => MicroMap.parse({ ...ok, features: [{ ...ok.features[0], properties: { ...ok.features[0].properties, grade: '추정' } }] })).toThrow();
  });
  it('콜아웃 앵커가 피처를 못 찾으면 린트가 잡는다', () => {
    const def = MicroMap.parse({ ...minimal(), callouts: [{ id: 'x:c1', anchor: { feature: 'x:없음' }, side: 'left', num: 1, title: 't', body: 'b', cite: 'c' }] });
    expect(lintMicroMap(def, { boards: [] })).toContain('x:c1: 앵커 피처 없음 x:없음');
  });
  it('unit 앵커·topic은 board가 있어야 한다', () => {
    const def = MicroMap.parse({ ...minimal(), callouts: [{ id: 'x:c1', topic: 'unit', anchor: { unit: 'u1' }, side: 'left', num: 1, title: 't', body: 'b' }] });
    expect(lintMicroMap(def, { boards: [] }).length).toBe(2);
  });
  for (const f of files) {
    it(`${f} 가 스키마와 린트를 통과한다`, () => {
      const def = MicroMap.parse(rd(join(DIR, f)));
      expect(def.id).toBe(f.replace(/\.json$/, ''));
      expect(lintMicroMap(def, { boards: boards() })).toEqual([]);
    });
  }
  it('index.json 이 각 파일의 home·title과 같다', () => {
    const index = rd(join(DIR, 'index.json')) as { id: string; title: string; at: number[]; minZoom: number; span: number }[];
    expect(index.map(x => x.id).sort()).toEqual(files.map(f => f.replace(/\.json$/, '')).sort());
    for (const row of index) {
      const def = MicroMap.parse(rd(join(DIR, `${row.id}.json`)));
      expect(row).toEqual({ id: def.id, title: def.title, at: def.home.at, minZoom: def.home.minZoom, span: def.home.span });
    }
  });
  it('장면의 micro 가 레지스트리에 있다', () => {
    const scenes = rd(join(ROOT, 'data', 'scenes', 'rome.json')) as { id: string; micro?: string }[];
    const ids = new Set(files.map(f => f.replace(/\.json$/, '')));
    for (const s of scenes) if (s.micro) expect(ids.has(s.micro), `${s.id} → ${s.micro}`).toBe(true);
  });
});

describe('microMapAt', () => {
  it('줌 문턱을 넘고 그 지도 근처여야 켠다', () => {
    const alesia = INDEX.find(x => x.id === 'alesia')!;
    expect(microMapAt(alesia.minZoom - 0.1, alesia.at)).toBeNull();
    expect(microMapAt(alesia.minZoom, alesia.at)).toBe('alesia');
    expect(microMapAt(13, [alesia.at[0] + 5, alesia.at[1]])).toBeNull();
  });
  it('둘이 겹치면 가까운 쪽', () => {
    const roma = INDEX.find(x => x.id === 'roma')!;
    expect(microMapAt(13, roma.at)).toBe('roma');
  });
});
