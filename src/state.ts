// 단일 연도 상태 + URL 동기화 (F2·F8, TASKS 1.1). 뷰는 이 store만 구독한다 — 뷰끼리 직접 부르지 않는다(PLAN "한 상태, 네 뷰").
export type View = '2d' | '3d';
export interface State {
  year: number;
  sel: string | null;        // 선택 객체 id (type:슬러그)
  layers: string[] | null;   // null = 데이터셋 manifest 기본 레이어
  view: View;
  ds: string;
  scene: string | null;      // 장면 프리셋 id
}
export interface Scene { id: string; title: string; year: number; to?: number /* 재생·MP4 구간 끝 */; sel?: string | null; center?: [number, number]; zoom?: number; pitch?: number; bearing?: number }

export const DEFAULTS: State = { year: -60, sel: null, layers: null, view: '3d', ds: 'rome', scene: null };

const KEYS: Record<string, keyof State> = { y: 'year', sel: 'sel', layers: 'layers', view: 'view', ds: 'ds', scene: 'scene' };

export function parseState(search: string, defaults: State = DEFAULTS): State {
  const q = new URLSearchParams(search);
  const year = Number(q.get('y'));
  const view = q.get('view');
  return {
    year: q.has('y') && Number.isInteger(year) ? year : defaults.year,
    sel: q.get('sel') || defaults.sel,
    layers: q.get('layers') ? q.get('layers')!.split(',').filter(Boolean) : defaults.layers,
    view: view === '2d' || view === '3d' ? view : defaults.view,
    ds: q.get('ds') || defaults.ds,
    scene: q.get('scene') || defaults.scene,
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

export function applyScene(store: Store, scene: Scene) {
  store.set({ year: scene.year, sel: scene.sel ?? null, scene: scene.id });
}

// URL ↔ store. 뒤로가기(popstate)는 store로, store 변경은 replaceState로(히스토리 오염 0).
export function bindUrl(store: Store) {
  let syncing = false;
  store.subscribe(s => { if (!syncing) history.replaceState(null, '', serializeState(s) || location.pathname); });
  addEventListener('popstate', () => {
    // ds는 main.tsx가 부팅 때 한 번 읽어 데이터셋을 통째로 받는다. 뒤로가기로 ds가 바뀌면
    // 상태만 갈아끼울 수 없다 — 안 그러면 주소는 초한지인데 화면은 로마인 채로 남는다.
    if (parseState(location.search).ds !== store.get().ds) { location.reload(); return; }
    syncing = true; store.set(parseState(location.search)); syncing = false;
  });
}
