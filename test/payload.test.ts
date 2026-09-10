// 첫 페인트 예산 (SPEC 비기능 · DESIGN P17 "초기 1MB").
// main.tsx의 load()는 await Promise.all이라, 여기 담긴 파일이 다 와야 첫 픽셀이 나온다.
// 실제로 landmarks.geojson(1.2MB raw · 213kB gz)이 여기 있어서 첫 화면이 그만큼 늦었고,
// 지도는 style.ts가 같은 파일을 URL 소스로 따로 받고 있어 사실상 두 번 받고 있었다.
// 번들(JS) 쪽 예산은 dist가 있어야 재므로 여기서 못 잰다. Lighthouse CI(4.5) 몫.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { describe, it, expect } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET_GZ = 60_000; // 현재 15.4kB. 레이어 하나 더 붙는 것은 통과, landmarks급(213kB)은 실패.

// load() 본문의 j('...') 인자 = 첫 페인트를 막는 파일 목록
function blockingFiles(): string[] {
  const src = readFileSync(join(ROOT, 'src/main.tsx'), 'utf8');
  const body = src.slice(src.indexOf('async function load()'), src.indexOf('load().then'));
  return [...body.matchAll(/j\('([^']+)'\)/g)].map(m => m[1]);
}

describe('첫 페인트 데이터 예산', () => {
  const files = blockingFiles();

  it('load()가 파일 목록을 실제로 잡아냈다', () => {
    expect(files.length).toBeGreaterThan(4);
    expect(files).toContain('manifest.json');
  });

  it(`차단 payload ≤ ${BUDGET_GZ / 1000}kB gz`, () => {
    const sizes = files.map(f => [f, gzipSync(readFileSync(join(ROOT, 'public/datasets/rome', f))).length] as const);
    const total = sizes.reduce((s, [, n]) => s + n, 0);
    // 넘으면 어느 파일이 범인인지 바로 보이게
    expect(Object.fromEntries(sizes.filter(([, n]) => n > BUDGET_GZ / 2))).toEqual({});
    expect(total).toBeLessThanOrEqual(BUDGET_GZ);
  });

  it('패널 전용 사본은 첫 페인트를 막지 않는다. landmarks는 engine이 선택 시에만 받는다', () => {
    expect(files.some(f => f.includes('landmarks'))).toBe(false);
    expect(readFileSync(join(ROOT, 'src/map/engine.ts'), 'utf8')).toContain('needLandmarks');
  });
});
