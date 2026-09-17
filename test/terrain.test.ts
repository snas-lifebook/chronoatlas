import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// DEM 타일 (OVERHAUL §3.7, R48·R56). 대륙 ETOPO 2022 z0~8 + 미시지도 인셋 Copernicus GLO-30 z8~12. 전부 커밋한다.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DS = join(ROOT, 'public', 'datasets', 'rome');
const walk = (d: string): number => readdirSync(d).reduce((s, f) => { const p = join(d, f); const st = statSync(p); return s + (st.isDirectory() ? walk(p) : st.size); }, 0);

describe('DEM 타일', () => {
  it('대륙 meta.json 이 terrarium z0~8 이고 출처가 ETOPO다', () => {
    const m = JSON.parse(readFileSync(join(DS, 'terrain', 'meta.json'), 'utf8'));
    expect(m).toMatchObject({ encoding: 'terrarium', minzoom: 0, maxzoom: 8 });
    expect(m.credit).toContain('ETOPO 2022');
    expect(existsSync(join(DS, 'terrain', '8'))).toBe(true);
  });
  it('미시지도의 dem 블록마다 타일 폴더가 있고 minzoom 층이 존재한다', () => {
    const dir = join(ROOT, 'data', 'micromaps');
    for (const f of readdirSync(dir).filter(x => x.endsWith('.json') && x !== 'index.json')) {
      const mm = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      if (!mm.dem) continue;
      expect(existsSync(join(DS, mm.dem.dir, String(mm.dem.minzoom))), `${mm.id} ${mm.dem.dir}`).toBe(true);
    }
  });
  it('insets.json 인셋마다 terrain-<id>·landcover-<id> 폴더가 있고 미시지도 id와 겹치지 않는다', () => {
    const insets = JSON.parse(readFileSync(join(ROOT, 'data', 'insets.json'), 'utf8')) as { id: string; at: number[]; span: number; why: string }[];
    const micro = new Set(readdirSync(join(ROOT, 'data', 'micromaps')).map(f => f.replace(/\.json$/, '')));
    for (const ins of insets) {
      expect(micro.has(ins.id), `${ins.id}: 미시지도와 같은 id`).toBe(false);
      expect(ins.why.length, `${ins.id}: why`).toBeGreaterThan(0);
      for (const d of [`terrain-${ins.id}`, `landcover-${ins.id}`]) expect(existsSync(join(DS, d, '8')), `${ins.id} ${d}`).toBe(true);
    }
  });
  it('타일 총량이 200 MB 이하다', () => {
    const dirs = readdirSync(DS).filter(d => /^terrain(-|$)/.test(d));
    const total = dirs.reduce((s, d) => s + walk(join(DS, d)), 0);
    expect(total, `${(total / 1e6).toFixed(1)} MB`).toBeLessThanOrEqual(200e6);
  });
});
