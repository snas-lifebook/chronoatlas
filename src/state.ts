// 단일 연도 상태 + URL 동기화 (F2·F8, TASKS 1.1). 뷰는 이 store만 구독한다 — 뷰끼리 직접 부르지 않는다(PLAN "한 상태, 네 뷰").
import type { Skin } from './map/style'; // 타입만 — 빌드에서 지워진다(state.ts는 런타임 의존이 없다)

export type View = '2d' | '3d';
export interface State {
  year: number;
  sel: string | null;        // 선택 객체 id (type:슬러그)
  layers: string[] | null;   // null = 데이터셋 manifest 기본 레이어
  view: View;
  ds: string;
  scene: string | null;      // 장면 프리셋 id
  // 카메라(R35). 지도가 moveend에서 써 넣고 URL로 나간다 — '링크 복사'가 지금 화면을 담는다.
  // null = 아직 정해진 적 없음(장면·manifest 기본값을 쓴다).
  center: [number, number] | null;
  zoom: number | null;
  pitch: number | null;
  bearing: number | null;
  skin: Skin;                // 지도 스킨. 테마(밝게/어둡게)와 별개 축이다(DESIGN P12)
}
export interface Scene {
  id: string; title: string; year: number;
  to?: number /* 재생·MP4 구간 끝 */; sel?: string | null;
  center?: [number, number]; zoom?: number; pitch?: number; bearing?: number;
  skin?: Skin; layers?: string[];  // R35 북마크: 스킨·켜진 레이어까지 담는다
  group?: string;                  // 프로젝트(발표자) 묶음. 장면 탭에서 머리글이 된다
  note?: string;
}

export const DEFAULTS: State = { year: -60, sel: null, layers: null, view: '3d', ds: 'rome', scene: null, center: null, zoom: null, pitch: null, bearing: null, skin: 'light' };

const KEYS: Record<string, keyof State> = { y: 'year', sel: 'sel', layers: 'layers', view: 'view', ds: 'ds', scene: 'scene', c: 'center', z: 'zoom', p: 'pitch', b: 'bearing', skin: 'skin' };

// 카메라 반올림. 상태에 들어가기 전에 깎는다 — URL을 짧게 하고, 부동소수 잡음으로
// store.set이 매번 "바뀌었다"고 판정해 리렌더가 도는 것을 막는다.
export const roundCam = (c: { lng: number; lat: number }, zoom: number, pitch: number, bearing: number) => ({
  center: [Math.round(c.lng * 1e4) / 1e4, Math.round(c.lat * 1e4) / 1e4] as [number, number],
  zoom: Math.round(zoom * 10) / 10,
  pitch: Math.round(pitch),
  bearing: Math.round(bearing),
});

export function parseState(search: string, defaults: State = DEFAULTS): State {
  const q = new URLSearchParams(search);
  const year = Number(q.get('y'));
  const view = q.get('view');
  // 빈 문자열을 거른다 — Number('')는 0이라 ?z= 가 줌 0으로 통과한다
  const num = (k: string) => { const v = q.get(k); return v ? (Number.isFinite(Number(v)) ? Number(v) : null) : null; };
  const c = q.get('c')?.split(',').map(Number);
  return {
    year: q.has('y') && Number.isInteger(year) ? year : defaults.year,
    sel: q.get('sel') || defaults.sel,
    layers: q.get('layers') ? q.get('layers')!.split(',').filter(Boolean) : defaults.layers,
    view: view === '2d' || view === '3d' ? view : defaults.view,
    ds: q.get('ds') || defaults.ds,
    scene: q.get('scene') || defaults.scene,
    center: c?.length === 2 && c.every(Number.isFinite) ? [c[0], c[1]] : defaults.center,
    zoom: num('z') ?? defaults.zoom,
    pitch: num('p') ?? defaults.pitch,
    bearing: num('b') ?? defaults.bearing,
    skin: (q.get('skin') as Skin) || defaults.skin,
  };
}

export function serializeState(s: State, defaults: State = DEFAULTS): string {
  const q = new URLSearchParams();
  for (const [k, f] of Object.entries(KEYS)) {
    const v = s[f], d = defaults[f];
    if (v == null || JSON.stringify(v) === JSON.stringify(d)) continue;
    q.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const str = q.toString();
  return str ? `?${str}` : '';
}

export function createStore(initial: State) {
  let state = initial;
  const subs = new Set<(s: State) => void>();
  return {
    get: () => state,
    set(patch: Partial<State>) {
      const next = { ...state, ...patch };
      if (JSON.stringify(next) === JSON.stringify(state)) return;
      state = next;
      subs.forEach(fn => fn(state));
    },
    subscribe(fn: (s: State) => void) { subs.add(fn); return () => subs.delete(fn); },
  };
}
export type Store = ReturnType<typeof createStore>;

// 장면 프리셋 적용. 우선순위는 **URL에 명시된 값 > 장면값 > 지금 값**이다.
// '링크 복사'는 location.href를 그대로 복사하는데 scene은 한 번 박히면 지워지지 않아
// 공유 링크가 늘 ?y=...&scene=... 꼴이 된다. 이 우선순위가 없으면 받는 사람 화면이
// 언제나 장면의 기본값으로 되돌아간다(완료 판정 8).
// search를 안 주면(장면 탭 클릭) 장면값을 그대로 전부 적용한다.
export function applyScene(store: Store, scene: Scene, search = '') {
  const q = new URLSearchParams(search), cur = store.get();
  const hasYear = q.has('y') && Number.isInteger(Number(q.get('y'))); // parseState와 같은 판정
  store.set({
    year: hasYear ? cur.year : scene.year,
    sel: q.has('sel') ? cur.sel : scene.sel ?? null,
    scene: scene.id,
    center: q.has('c') ? cur.center : scene.center ?? cur.center,
    zoom: q.has('z') ? cur.zoom : scene.zoom ?? cur.zoom,
    pitch: q.has('p') ? cur.pitch : scene.pitch ?? cur.pitch,
    bearing: q.has('b') ? cur.bearing : scene.bearing ?? cur.bearing,
    skin: q.has('skin') ? cur.skin : scene.skin ?? cur.skin,
    layers: q.has('layers') ? cur.layers : scene.layers ?? cur.layers,
  });
}

// 지금 화면을 장면 프리셋 한 조각으로. data/scenes/<ds>.json 에 붙여넣는다(R35).
// 서버가 없으니 저장은 URL과 파일뿐이다 — 이 함수는 '파일' 쪽 산출물을 만든다.
export function bookmarkOf(s: State, opts: { id: string; title: string; group?: string; layers: string[] }): Scene {
  return {
    id: opts.id, title: opts.title, ...(opts.group ? { group: opts.group } : {}),
    year: s.year, sel: s.sel,
    ...(s.center ? { center: s.center } : {}), ...(s.zoom != null ? { zoom: s.zoom } : {}),
    ...(s.pitch != null ? { pitch: s.pitch } : {}), ...(s.bearing != null ? { bearing: s.bearing } : {}),
    skin: s.skin, layers: opts.layers,
  };
}

// URL ↔ store. 뒤로가기(popstate)는 store로, store 변경은 replaceState로(히스토리 오염 0).
export function bindUrl(store: Store) {
  let syncing = false;
  store.subscribe(s => { if (!syncing) history.replaceState(null, '', serializeState(s) || location.pathname); });
  addEventListener('popstate', () => {
    // ds는 main.tsx가 부팅 때 한 번 읽어 데이터셋을 통째로 받는다. 뒤로가기로 ds가 바뀌면
    // 상태만 갈아끼울 수 없다. 안 그러면 주소는 초한지인데 화면은 로마인 채로 남는다.
    if (parseState(location.search).ds !== store.get().ds) { location.reload(); return; }
    syncing = true; store.set(parseState(location.search)); syncing = false;
  });
}
