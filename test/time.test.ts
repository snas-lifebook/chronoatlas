import { describe, it, expect } from 'vitest';
import { stateAt } from '../src/time';

const caesar = { id: 'person:카이사르', name: '카이사르', attrs: { office: null, faction: '민중파' },
  history: [{ year: -59, patch: { office: '집정관' } }, { year: -49, patch: { office: null, faction: '카이사르파' } }, { year: -44, patch: { office: '종신 독재관' } }] };

describe('history fold (TASKS 1.2, SCHEMA v2 base+patch)', () => {
  it('-50: -59 patch만 반영', () => expect(stateAt(caesar, -50)).toEqual({ office: '집정관', faction: '민중파' }));
  it('-49: 같은 해 patch는 포함(연초 기준)', () => expect(stateAt(caesar, -49)).toEqual({ office: null, faction: '카이사르파' }));
  it('-44 이후: 전부', () => expect(stateAt(caesar, 100).office).toBe('종신 독재관'));
  it('history 이전·없음: base 그대로', () => { expect(stateAt(caesar, -100)).toEqual(caesar.attrs); expect(stateAt({ attrs: { a: 1 } }, 0)).toEqual({ a: 1 }); });
  it('정렬 안 된 history도 연도순으로 접는다', () => {
    const e = { attrs: {}, history: [{ year: -44, patch: { x: 3 } }, { year: -59, patch: { x: 1 } }, { year: -49, patch: { x: 2 } }] };
    expect(stateAt(e, -48).x).toBe(2);
  });
});
