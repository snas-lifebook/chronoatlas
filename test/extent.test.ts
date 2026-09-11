import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { BBOX, TERRITORY_BUCKET, TERRITORY_FROM, TERRITORY_TO, bboxContains } from '../scripts/extent';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'public/datasets/rome/manifest.json'), 'utf8'));
const scenes = JSON.parse(readFileSync(join(ROOT, 'data/scenes/rome.json'), 'utf8'));

// manifest.bbox는 지도의 maxBounds(engine.ts)와 relief 이미지 모서리(style.ts)를 정한다.
// 상수와 어긋나면 지도가 옛 범위에 갇히고 음영 그림이 어긋난 자리에 늘어난다 — 둘 다 조용히 일어난다.
// 범위를 바꾸는 절차는 docs/RUNBOOK-extent.md.
describe('지도 범위 — 상수와 산출물이 어긋나면 안 된다 (라운드 A 준비)', () => {
  it('manifest.bbox == scripts/extent.ts의 BBOX', () => {
    expect(manifest.bbox).toEqual([...BBOX]);
  });
  it('manifest.territory == 영토 버킷 상수', () => {
    expect(manifest.territory).toEqual({ bucket: TERRITORY_BUCKET, from: TERRITORY_FROM, to: TERRITORY_TO });
  });
  it('bbox는 서<동·남<북이고 relief 크롭이 소스 비율로 떨어지게 2:1이다', () => {
    const [w, s, e, n] = BBOX;
    expect(w).toBeLessThan(e); expect(s).toBeLessThan(n);
    expect((e - w) / (n - s)).toBeCloseTo(2, 2);
  });

  // 범위를 바꾸면 카메라도 다시 잡아야 한다(BACKLOG §A). 밖으로 나가면 maxBounds가 조용히 끌어당긴다.
  it('기본 카메라가 bbox 안에 있다', () => {
    expect(bboxContains(manifest.center[0], manifest.center[1])).toBe(true);
  });
  it('장면 프리셋 카메라가 전부 bbox 안에 있다', () => {
    const out = scenes.filter((sc: any) => sc.center && !bboxContains(sc.center[0], sc.center[1]))
      .map((sc: any) => `${sc.id}=${sc.center}`);
    expect(out).toEqual([]);
  });
});
