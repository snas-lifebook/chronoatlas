import { describe, it, expect } from 'vitest';
import { parseState, serializeState, createStore, DEFAULTS, applyScene } from '../src/state';

describe('state ↔ URL (TASKS 1.1)', () => {
  it('URL→state→URL 왕복 동일', () => {
    const q = '?y=-52&sel=person%3A%EC%B9%B4%EC%9D%B4%EC%82%AC%EB%A5%B4&layers=territory%2Cbattles&view=2d&ds=rome';
    const s = parseState(q);
    expect(s).toEqual({ year: -52, sel: 'person:카이사르', layers: ['territory', 'battles'], view: '2d', ds: 'rome', scene: null });
    expect(parseState(serializeState(s))).toEqual(s);
  });
  it('기본값은 URL에서 생략', () => {
    expect(serializeState({ ...DEFAULTS })).toBe('');
    expect(serializeState({ ...DEFAULTS, year: -49 })).toBe('?y=-49');
  });
  it('잘못된 값은 기본값으로', () => {
    const s = parseState('?y=abc&view=4d&ds=');
    expect(s.year).toBe(DEFAULTS.year); expect(s.view).toBe(DEFAULTS.view); expect(s.ds).toBe(DEFAULTS.ds);
  });
  it('store: set은 patch만 갱신하고 구독자에 알린다', () => {
    const st = createStore({ ...DEFAULTS });
    const seen: number[] = [];
    st.subscribe(s => seen.push(s.year));
    st.set({ year: -49 }); st.set({ sel: 'event:루비콘' });
    expect(st.get().year).toBe(-49); expect(st.get().sel).toBe('event:루비콘');
    expect(seen).toEqual([-49, -49]);
    st.set({ year: -49 }); // 변화 없음 → 알리지 않음
    expect(seen.length).toBe(2);
  });
  it('장면 프리셋은 연도·선택·scene을 한 번에 세팅', () => {
    const st = createStore({ ...DEFAULTS });
    applyScene(st, { id: 'caesar', title: '카이사르', year: -60, sel: 'person:카이사르', center: [12.5, 41.9], zoom: 5, pitch: 50 });
    expect(st.get()).toMatchObject({ year: -60, sel: 'person:카이사르', scene: 'caesar' });
  });
});
