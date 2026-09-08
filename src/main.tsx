// 배선만: 데이터셋 로드 → store → React 셸. 지도는 engine.ts, 크롬은 app/App.tsx.
import 'maplibre-gl/dist/maplibre-gl.css';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral';
import { createRoot } from 'react-dom/client';
import type { Dataset } from './schema';
import { createStore, parseState, bindUrl, applyScene, DEFAULTS, type Scene } from './state';
import { App } from './app/App';

// ?ds= 가 정식, ?dataset= 은 옛 링크 호환.
const store = createStore(parseState(location.search, { ...DEFAULTS, ds: new URLSearchParams(location.search).get('dataset') || DEFAULTS.ds }));
const DS = store.get().ds;
const ROOT = import.meta.env.BASE_URL; // dev '/', 빌드 '/chronoatlas/'
const BASE = `${ROOT}datasets/${DS}`;
async function j(p: string) { const r = await fetch(`${BASE}/${p}`); if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json(); }

async function load(): Promise<Dataset> {
  const [manifest, actorsW, eventsW, territory, admin_regions, settlements, battles, movements, landmarks] = await Promise.all([
    j('manifest.json'), j('entities/actors.json'), j('entities/events.json'),
    j('layers/territory.geojson'), j('layers/admin_regions.geojson'), j('layers/settlements.geojson'), j('layers/battles.geojson'), j('layers/movements.geojson'),
    j('layers/landmarks.geojson').catch(() => undefined)]);
  return { manifest, actors: actorsW.actors, events: eventsW.events, territory, admin_regions, settlements, battles, movements, landmarks };
}

load().then(d => {
  // 첫 진입 = 장면 프리셋(DESIGN §4). URL에 연도가 있으면 존중.
  const scenes: Scene[] = d.manifest.scenes ?? [];
  const q = new URLSearchParams(location.search);
  // 자료실 딥링크(?sel=, ?y=)가 있으면 장면을 덮어쓰지 않는다
  const wanted = scenes.find(sc => sc.id === store.get().scene) ?? (q.has('y') || q.has('sel') ? null : scenes[0]);
  if (wanted) applyScene(store, wanted); else if (!q.has('y') && !q.has('sel')) store.set({ year: d.manifest.time.to });
  bindUrl(store);
  document.title = `${d.manifest.title} — 크로노아틀라스`;
  createRoot(document.getElementById('app')!).render(<App d={d} store={store} root={ROOT} ds={DS} />);
}).catch(err => { document.body.innerHTML = `<pre style="padding:20px">로드 실패: ${err.message}</pre>`; });
