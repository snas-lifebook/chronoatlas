import { describe, it, expect } from 'vitest';
import { shouldShowPromo } from '../src/promo';

describe('홍보 영상 팝업은 처음 온 사람에게만', () => {
  it('첫 방문 맨 주소는 띄운다', () => expect(shouldShowPromo('', null)).toBe(true));
  it('한 번 본 사람은 안 띄운다', () => expect(shouldShowPromo('', '2026-09-27')).toBe(false));
  it('발표·장면·선택 주소로 오면 안 띄운다(발표 도중 금지)', () => {
    for (const q of ['?present=1&scene=p345-alps-218', '?scene=zama-202', '?sel=person%3A카이사르', '?board=cannae'])
      expect(shouldShowPromo(q, null)).toBe(false);
  });
  it('연도만 있는 주소는 첫 방문이면 띄운다', () => expect(shouldShowPromo('?y=-44', null)).toBe(true));
  it('?promo=1은 본 사람에게도, ?promo=0은 누구에게도', () => {
    expect(shouldShowPromo('?promo=1', 'x')).toBe(true); expect(shouldShowPromo('?promo=0', null)).toBe(false);
  });
});
