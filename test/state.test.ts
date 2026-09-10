import { describe, it, expect } from 'vitest';
import { parseState, serializeState, createStore, DEFAULTS, applyScene, roundCam, bookmarkOf } from '../src/state';

describe('state ↔ URL (TASKS 1.1)', () => {
  it('URL→state→URL 왕복 동일', () => {
    const q = '?y=-52&sel=person%3A%EC%B9%B4%EC%9D%B4%EC%82%AC%EB%A5%B4&layers=territory%2Cbattles&view=2d&ds=rome';
    const s = parseState(q);
    expect(s).toEqual({ year: -52, sel: 'person:카이사르', layers: ['territory', 'battles'], view: '2d', ds: 'rome', scene: null,
      center: null, zoom: null, pitch: null, bearing: null, skin: 'light' });
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

// R35 북마크: 카메라·스킨·레이어까지 URL에 실어야 "새 탭에 붙이면 그대로"가 성립한다.
describe('북마크 — 카메라·스킨 왕복 (R35, F8)', () => {
  it('카메라·스킨이 URL에 실리고 그대로 돌아온다', () => {
    const s = { ...DEFAULTS, year: -49, center: [12.3, 44.1] as [number, number], zoom: 6, pitch: 55, bearing: -20, skin: 'oldmap' as const, layers: ['territory', 'labels'] };
    const url = serializeState(s);
    expect(url).toContain('c=12.3%2C44.1'); // 쉼표 하나로 붙는다
    expect(url).toContain('z=6'); expect(url).toContain('p=55'); expect(url).toContain('b=-20'); expect(url).toContain('skin=oldmap');
    expect(parseState(url)).toEqual(s);
  });
  it('카메라가 기본(null)이면 URL에 안 실린다', () => {
    expect(serializeState({ ...DEFAULTS })).toBe('');
  });
  it('bearing 0·pitch 0도 값으로 살아남는다 (0을 없는 값으로 읽지 않는다)', () => {
    const s = { ...DEFAULTS, pitch: 0, bearing: 0 };
    const back = parseState(serializeState(s));
    expect(back.pitch).toBe(0); expect(back.bearing).toBe(0);
  });
  it('깨진 카메라(?c=abc&z=)는 기본값으로 떨어진다', () => {
    const s = parseState('?c=abc&z=&p=nope');
    expect(s.center).toBe(null); expect(s.zoom).toBe(null); expect(s.pitch).toBe(null);
  });
  it('roundCam: 경위도 4자리·줌 1자리·pitch/bearing 정수로 깎는다', () => {
    expect(roundCam({ lng: 12.4862345, lat: 41.8917891 }, 6.043210, 54.6, -19.7))
      .toEqual({ center: [12.4862, 41.8918], zoom: 6, pitch: 55, bearing: -20 });
  });
  // 반올림이 없으면 지도가 미세하게 흔들릴 때마다 store가 "바뀌었다"고 판정해 앱 전체가 다시 그려진다.
  it('roundCam: 반올림 뒤 값이 같으면 store.set이 구독자를 안 부른다', () => {
    const st = createStore({ ...DEFAULTS });
    let calls = 0; st.subscribe(() => calls++);
    st.set(roundCam({ lng: 12.48621, lat: 41.89178 }, 6.01, 55.4, 0));
    st.set(roundCam({ lng: 12.48619, lat: 41.89183 }, 6.04, 55.2, 0)); // 같은 자리로 깎인다
    expect(calls).toBe(1);
  });

  const BOOKMARK = { id: 'rubicon-close', title: '루비콘 도하', year: -49, sel: 'person:카이사르',
    center: [12.3, 44.1] as [number, number], zoom: 6, pitch: 55, bearing: -20, skin: 'oldmap' as const, layers: ['territory', 'settlements'] };

  it('장면이 스킨·레이어·카메라까지 적용한다', () => {
    const st = createStore({ ...DEFAULTS });
    applyScene(st, BOOKMARK);
    expect(st.get()).toMatchObject({ year: -49, sel: 'person:카이사르', center: [12.3, 44.1], zoom: 6, pitch: 55, bearing: -20, skin: 'oldmap', layers: ['territory', 'settlements'] });
  });
  it('공유 링크: URL의 카메라·스킨이 장면값을 이긴다', () => {
    const search = '?c=25,39&z=7.5&skin=press&scene=rubicon-close';
    const st = createStore(parseState(search));
    applyScene(st, BOOKMARK, search);
    expect(st.get()).toMatchObject({ center: [25, 39], zoom: 7.5, skin: 'press', scene: 'rubicon-close' });
    expect(st.get().pitch).toBe(55); // URL에 없는 것은 장면값
  });
  it('bookmarkOf: 지금 상태를 scenes.json 조각으로 — 빈 값은 넣지 않는다', () => {
    const s = { ...DEFAULTS, year: -49, sel: 'person:카이사르', center: [12.3, 44.1] as [number, number], zoom: 6, pitch: 55, bearing: -20, skin: 'oldmap' as const };
    const b = bookmarkOf(s, { id: 'x', title: '제목', group: '김주용', layers: ['territory'] });
    expect(b).toEqual({ id: 'x', title: '제목', group: '김주용', year: -49, sel: 'person:카이사르',
      center: [12.3, 44.1], zoom: 6, pitch: 55, bearing: -20, skin: 'oldmap', layers: ['territory'] });
    // 카메라가 없는 상태면 그 키 자체가 빠진다(장면 파일이 지저분해지지 않게)
    const empty = bookmarkOf({ ...DEFAULTS }, { id: 'y', title: 'y', layers: [] });
    expect(Object.keys(empty)).toEqual(['id', 'title', 'year', 'sel', 'skin', 'layers']);
  });
  // 북마크를 적용했다가 다른 장면으로 갔다 돌아와도 같은 화면이어야 한다.
  it('왕복: 상태 → 북마크 조각 → applyScene → 같은 상태', () => {
    const s = { ...DEFAULTS, year: -49, sel: 'person:카이사르', center: [12.3, 44.1] as [number, number], zoom: 6, pitch: 55, bearing: -20, skin: 'oldmap' as const, layers: ['territory'] };
    const b = bookmarkOf(s, { id: 'rt', title: '왕복', layers: s.layers });
    const st = createStore({ ...DEFAULTS });
    applyScene(st, b);
    expect(st.get()).toMatchObject({ ...s, scene: 'rt' });
  });
});
