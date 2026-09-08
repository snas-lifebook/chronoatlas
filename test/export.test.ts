import { describe, it, expect } from 'vitest';
import { frameSpec } from '../src/export/png';
describe('PNG 내보내기 (TASKS 3.1)', () => {
  it('크기 = 2×viewport, 띠·여백도 배율', () => {
    const s = frameSpec(1400, 900);
    expect([s.width, s.height]).toEqual([2800, 1800]); expect(s.band).toBe(144); expect(s.margin).toBe(48);
  });
  it('배율 1이면 원본 크기', () => expect(frameSpec(800, 600, 1).width).toBe(800));
});
