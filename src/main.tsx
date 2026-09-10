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

// 여기 담긴 것은 전부 첫 페인트를 막는다(P17 초기 1MB). 큰 레이어는 넣지 말 것.
// 지도는 style.ts가 URL 소스로 알아서 받고, 패널만 쓰는 사본은 engine이 필요할 때 받는다.
// landmarks.geojson(1.2MB)이 여기 있어서 첫 화면이 그만큼 늦었다. 예산은 test/payload.test.ts가 지킨다.
async function load(): Promise<Dataset> {
  const [manifest, actorsW, eventsW, territory, admin_regions, settlements, battles, movements] = await Promise.all([
    j('manifest.json'), j('entities/actors.json'), j('entities/events.json'),
    j('layers/territory.geojson'), j('layers/admin_regions.geojson'), j('layers/settlements.geojson'), j('layers/battles.geojson'), j('layers/movements.geojson')]);
  return { manifest, actors: actorsW.actors, events: eventsW.events, territory, admin_regions, settlements, battles, movements };
}

// 장면 프리셋·북마크는 **사람이 쓰는 파일**이다(`data/scenes/<ds>.json`). 어댑터를 태우지 않는다.
// manifest는 정본 온톨로지에서 굽는 산출물이라, 북마크 한 줄 넣자고 정본 파이프라인을 돌릴 이유가 없다
// (그 파이프라인은 지금 정본 마이그레이션 대기로 멈춰 있기도 하다 — docs/HANDOFF.md §1).
// 빌드타임에 접어 넣는다: 파일 하나가 1KB 남짓이라 따로 받아 올 가치가 없다.
// `manifest.scenes`는 이 파일이 없는 옛 데이터셋을 위한 폴백으로만 남긴다.
const SCENE_FILES = import.meta.glob<Scene[]>('../data/scenes/*.json', { eager: true, import: 'default' });
const scenesFor = (ds: string, manifest: { scenes?: Scene[] }): Scene[] =>
  SCENE_FILES[`../data/scenes/${ds}.json`] ?? manifest.scenes ?? [];

load().then(d => {
  // 첫 진입 = 장면 프리셋(DESIGN §4). URL에 연도가 있으면 존중.
  const scenes = scenesFor(DS, d.manifest);
  const q = new URLSearchParams(location.search);
  // 자료실 딥링크(?sel=, ?y=)가 있으면 장면을 덮어쓰지 않는다
  const wanted = scenes.find(sc => sc.id === store.get().scene) ?? (q.has('y') || q.has('sel') ? null : scenes[0]);
  if (wanted) applyScene(store, wanted, location.search); else if (!q.has('y') && !q.has('sel')) store.set({ year: d.manifest.time.to });
  bindUrl(store);
  document.title = `${d.manifest.title} — 크로노아틀라스`;
  createRoot(document.getElementById('app')!).render(<App d={d} store={store} root={ROOT} ds={DS} scenes={scenes} />);
}).catch(err => { document.body.innerHTML = `<pre style="padding:20px">로드 실패: ${err.message}</pre>`; });
