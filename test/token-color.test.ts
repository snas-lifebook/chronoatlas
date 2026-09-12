import { describe, it, expect } from 'vitest';
import { tokenColor, TOKEN_COLOR } from '../src/tokenColor';

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
