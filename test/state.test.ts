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
  const CAESAR = { id: 'caesar', title: '카이사르', year: -60, sel: 'person:카이사르', center: [12.5, 41.9] as [number, number], zoom: 5, pitch: 50 };

  it('장면 프리셋은 연도·선택·scene을 한 번에 세팅', () => {
    const st = createStore({ ...DEFAULTS });
    applyScene(st, CAESAR);
    expect(st.get()).toMatchObject({ year: -60, sel: 'person:카이사르', scene: 'caesar' });
  });
  // '링크 복사'가 내놓는 주소는 ?y=...&scene=... 꼴이다(scene은 한 번 박히면 안 지워진다).
  // 장면이 y를 덮어쓰면 공유된 링크가 늘 장면의 기본 연도로 열린다.
  it('공유 링크: URL의 y·sel이 장면값을 이긴다 (완료 판정 8)', () => {
    const search = '?y=117&sel=place%3A%EB%A1%9C%EB%A7%88&scene=caesar';
    const st = createStore(parseState(search));
    applyScene(st, CAESAR, search);
    expect(st.get()).toMatchObject({ year: 117, sel: 'place:로마', scene: 'caesar' });
  });
  it('공유 링크: y만 있으면 sel은 장면값을 쓴다', () => {
    const search = '?y=-49&scene=caesar';
    const st = createStore(parseState(search));
    applyScene(st, CAESAR, search);
    expect(st.get()).toMatchObject({ year: -49, sel: 'person:카이사르', scene: 'caesar' });
  });
  it('장면 탭 클릭(search 없음)은 장면값을 그대로 적용', () => {
    const st = createStore({ ...DEFAULTS, year: 117, sel: 'place:로마' });
    applyScene(st, CAESAR);
    expect(st.get()).toMatchObject({ year: -60, sel: 'person:카이사르', scene: 'caesar' });
  });
  it('깨진 y(?y=abc)는 장면값으로 떨어진다', () => {
    const search = '?y=abc&scene=caesar';
    const st = createStore(parseState(search));
    applyScene(st, CAESAR, search);
    expect(st.get().year).toBe(-60);
  });
});
