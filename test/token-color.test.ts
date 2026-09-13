import { describe, it, expect } from 'vitest';
import { tokenColor, TOKEN_COLOR } from '../src/tokenColor';
import { tokenMeters } from '../src/token3d';

describe('말 색 (발표 — 같은 로마를 갈라야 한다)', () => {
  const palette = { 로마: '#A4243B', 카르타고: '#5B2A86' };

  it('카이사르·폼페이우스는 세력색이 아니라 인물색', () => {
    expect(tokenColor('person:카이사르', '로마', palette)).toBe(TOKEN_COLOR['person:카이사르']);
    expect(tokenColor('person:폼페이우스', '로마', palette)).toBe(TOKEN_COLOR['person:폼페이우스']);
    expect(tokenColor('person:카이사르', '로마', palette)).not.toBe(tokenColor('person:폼페이우스', '로마', palette));
  });

  it('목록에 없는 사람은 세력 팔레트, 그것도 없으면 회색', () => {
    expect(tokenColor('person:한니발', '카르타고', palette)).toBe('#5B2A86');
    expect(tokenColor('person:무명', null, palette)).toBe('#6B6F76');
  });
});

describe('장기말 화면 크기', () => {
  it('줌이 낮을수록 미터 크기가 커져 지중해에서도 읽힌다', () => {
    expect(tokenMeters(4.2)).toBeGreaterThan(tokenMeters(6));
    expect(tokenMeters(4.2)).toBeGreaterThan(80000);
    // 진짜 의도는 「미터가 크다」가 아니라 **화면 크기가 거의 일정하다**는 것이다.
    // 옛 테스트는 하한 14000m을 박아 뒀는데, 그 하한이 줌 천장을 15로 올린 뒤
    // z12.4에서 말을 972px로 부풀려 알레시아 포위선을 덮었다. 화면 px로 본다.
    const px = (z: number) => tokenMeters(z) / (40075016.686 / 512 / Math.pow(2, z));
    for (const z of [5, 7, 9, 12.4, 15]) {
      expect(px(z), `z${z}`).toBeGreaterThan(40);
      expect(px(z), `z${z}`).toBeLessThan(110);
    }
  });
});
