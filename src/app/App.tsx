// 앱 셸 (DESIGN v3 §2, TASKS 1.8): 풀블리드 지도 위에 떠 있는 astryx 카드 5 + 타임라인 띠 + 각주 줄. 상태는 store 하나.
import { useEffect, useRef, useSyncExternalStore, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { Card, SegmentedControl, SegmentedControlItem, Switch, Text, Badge, Button, IconButton, Tooltip, Kbd } from '@astryxdesign/core';
import type { Dataset } from '../schema';
import { type Store, type Scene, applyScene, bookmarkOf } from '../state';
import { createEngine, allLayers, GROUP_COLOR, type Engine } from '../map/engine';
import { SKINS, chromeTone, type Skin } from '../map/style';
import { GROUP_LABEL } from '../graph/data';
// 검색·내보내기·콜아웃·그래프·QC·인스펙터·재생 바는 첫 화면에 필요 없다. 동적 청크로 뗀다(OVERHAUL §3.4 P0, R46).
const Search = lazy(() => import('./Search').then(m => ({ default: m.Search })));
const Inspector = lazy(() => import('./Inspector').then(m => ({ default: m.Inspector })));
const BattleBar = lazy(() => import('./BattleBar').then(m => ({ default: m.BattleBar })));
import { loadGraph, neighborsOf, type Graph } from '../graph/data';
import { yearBrief } from '../year';
import { phaseOf, pickBoard, type BoardData } from '../board';
import { peopleAtYear, peopleGeoJSON } from '../people';
import { PACK_BATTLES, PACK_CAST, PACK_EMBLEMS, PACK_MOVEMENTS, PACK_POLITY_COLORS, clientsAt, legionsAt, sceneBrief, loadSceneText, loadLegions, loadPack, packsFor } from '../packData';
import { scenesInGroup, stepScene, presentGroupOf, isPresentGroup, PRESENT_GROUP, DETAIL_GROUP } from '../present';
import { legPhase, ROUTE_PHASES } from '../routes';
import { createBookmarks, BOOKMARK_GROUP } from '../bookmarks';
import { LIBRARY, libraryObject } from '../links';
import { useNarrow } from './useNarrow';
import type { ResolvedCallout } from '../map/micro';
const Callouts = lazy(() => import('./Callouts').then(m => ({ default: m.Callouts })));
const MobileSheet = lazy(() => import('./MobileSheet').then(m => ({ default: m.MobileSheet })));
const BannerCard = lazy(() => import('./BannerCard').then(m => ({ default: m.BannerCard })));
const GraphPanel = lazy(() => import('./GraphPanel').then(m => ({ default: m.GraphPanel })));
const Qc = lazy(() => import('./Qc').then(m => ({ default: m.Qc })));
import './shell.css';

const fmt = (y: number) => (y < 0 ? `BC ${-y}` : `AD ${y}`);
const fmtKo = (y: number) => (y < 0 ? `기원전 ${-y}년` : `서기 ${y}년`);

// 레이어 카탈로그(P6): manifest.layers + 베이스맵 토글 + 데이터 없는 P1 레이어(흐리게).
const CATALOG: { id: string; label: string; p1?: boolean }[] = [
  { id: 'territory', label: '영토' }, { id: 'admin_regions', label: '속주' }, { id: 'settlements', label: '도시' },
  { id: 'battles', label: '전투' }, { id: 'movements', label: '이동 경로' },
  { id: 'relief', label: '지형 음영' }, { id: 'bathy', label: '수심' }, { id: 'rivers', label: '강·호수' }, { id: 'labels', label: '지명' },
  { id: 'wind', label: '바람', p1: true }, { id: 'current', label: '해류', p1: true }, { id: 'climate', label: '기후', p1: true }, { id: 'landmarks', label: '지형지물' }, { id: 'graph', label: '관계 그래프' },
  { id: 'people', label: '인물 위치' },
  { id: 'plains', label: '평야·곡창' },
  { id: 'board', label: '말판' },
];

type Theme = 'system' | 'light' | 'dark';
const readTheme = (): Theme => { try { return (localStorage.getItem('theme') as Theme) || 'system'; } catch { return 'system'; } };
const isDark = (t: Theme) => t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);

export function App({ d, store, root, ds, scenes, boards }: { d: Dataset; store: Store; root: string; ds: string; scenes: Scene[]; boards: BoardData[] }) {
  const s = useSyncExternalStore(store.subscribe, store.get);
  const mapRef = useRef<HTMLDivElement>(null);
  const engRef = useRef<Engine | null>(null);
  // 즉석 북마크(R44): localStorage의 장면이 「내 북마크」 그룹으로 파일 장면에 합쳐진다. 엔진(syncDetailMaps)에는 파일 장면만 준다(micro는 파일 장면에만 있다).
  const bm = useMemo(() => createBookmarks(ds), [ds]);
  const [marks, setMarks] = useState<Scene[]>(() => bm.list());
  const allScenes = useMemo(() => [...scenes, ...marks], [scenes, marks]);
  const allRef = useRef(allScenes); allRef.current = allScenes;   // 키 핸들러는 한 번만 붙는다. 최신 목록은 ref로
  const [newTitle, setNewTitle] = useState(''); const [newGroup, setNewGroup] = useState(''); const [importNote, setImportNote] = useState('');
  // 장면 의미체계(R53, OVERHAUL-IV): 객체 → 그 객체를 다루는 장면. 사건은 scene.events, 인물·장소는 scene.sel(장면의 주인공)로 잇는다.
  const scenesOf = useCallback((id: string) => allRef.current.filter(sc => sc.sel === id || sc.events?.includes(id)), []);
  // 좁은 화면 읽기 모드(R50): 시트 하나가 설명·콜아웃·객체·재생을 맡는다
  const narrow = useNarrow();
  const [microCallouts, setMicroCallouts] = useState<ResolvedCallout[]>([]);
  const [focusCallout, setFocusCallout] = useState<string | null>(null);
  const [, setTextTick] = useState(0);
  useEffect(() => { loadSceneText().then(() => setTextTick(t => t + 1)); }, []);   // 발표 설명문이 오면 HUD를 다시 그린다
  useEffect(() => { loadLegions().then(() => setDataTick(t => t + 1)); }, []);     // 군단 표가 오면 말의 병력 줄을 다시 세운다(자산 URL, R46)
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [tab, setTab] = useState('objects');
  const [explorerOpen, setExplorerOpen] = useState(() => matchMedia('(min-width: 1024px)').matches); // 좁은 화면은 접힌 채 시작(P14b)
  // 발표 설명창. **지도를 가린다는 지적**(River)에 세 단계와 좌우 전환을 붙였다.
  // slim에서도 연도와 말 이름은 남는다 — 「가려도 년도나 핵심 인물 정도는 뜨게」.
  // 좁은 화면에서는 **간략으로 시작한다.** 전체 설명창은 실측 620px이라 390px 폰에서
  // 화면을 통째로 덮어 지도가 한 픽셀도 안 보였다. H로 언제든 전체로 펼친다.
  const [hud, setHud] = useState<'full' | 'slim' | 'off'>(
    () => (matchMedia('(max-width: 620px)').matches ? 'slim' : 'full'));
  const [hudSide, setHudSide] = useState<'left' | 'right'>('left');
  const [playing, setPlaying] = useState(false);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [searching, setSearching] = useState<false | 'find' | 'path'>(false);
  const [pathTo, setPathTo] = useState<string | null>(null); // F14: 선택 → 이 객체까지 최단 관계 경로
  const [exporting, setExporting] = useState<number | null>(null);
  const [dataTick, setDataTick] = useState(0); // 영토 버킷이 바뀌면 범례 다시
  // 지금 어느 미시 지도인가. Callouts가 `documentElement.dataset.micro`에 적는 값을 읽는다 —
  // 판정 로직을 두 군데 두면 갈린다(콜아웃은 줌 + 거리를 같이 본다).
  const [micro, setMicro] = useState<string | null>(null);
  // 범례는 **화면에 실제로 그려진 것**만 세는데(아래 legend), 그 판정은 지도가 한 번
  // 그려진 뒤에만 참이다. 첫 계산 때는 아직 아무것도 안 그려져 있어 전부 보여 주는
  // 쪽으로 떨어졌다 — 실측 23줄. idle에서 한 번 흔들어 다시 세게 한다.
  const [drawTick, setDrawTick] = useState(0);
  // 지도 스킨(P1 Azgaar식). 웹 UI 크롬은 안 바뀐다(P12).
  // 북마크가 스킨까지 담아야 해서 store에 있다 — URL로 나가고 URL에서 돌아온다(R35).
  const skin = s.skin, setSkin = (k: Skin) => store.set({ skin: k });
  // 스킨은 지도에 바로 입힌다(Azgaar식 미리보기). 크롬(카드·툴바)은 astryx 그대로 — P12는 'UI 토큰 불변'이지 '지도 불변'이 아니다. 내보내기는 보이는 그대로.
  useEffect(() => { document.documentElement.dataset.skin = skin; }, [skin]);   // 리본·카드 CSS가 스킨을 본다(OVERHAUL-II §3.2)
  const firstSkin = useRef(true);
  useEffect(() => { if (firstSkin.current) { firstSkin.current = false; return; } const eng = engRef.current; if (!eng) return; const cur = isDark(theme) ? 'dark' : 'light'; eng.setSkin(skin === cur ? null : skin); }, [skin]);
  const withSkin = <T,>(fn: () => Promise<T>): Promise<T> => fn();

  // 관계 그래프(2.1) + 「그 해」(R36): graph.json 지연 로드. 첫 페인트는 안 막는다(main.tsx의 Promise.all 밖이다).
  // 선택 없이도 받는다 — 「그 해의 인물·일」이 연도만 바뀌어도 필요하기 때문이다.
  // 어차피 첫 진입 장면이 카이사르를 고르고 있어 예전에도 늘 받아 왔다.
  useEffect(() => { loadGraph(`${root}datasets/${ds}`).then(setGraph).catch(() => {}); }, []);
  // 자료실에서 ?sel=로 들어온 첫 진입(장면 없음): 그래프가 오면 그 객체로 카메라
  const centeredOnce = useRef(false);
  useEffect(() => {
    if (centeredOnce.current || !graph || !s.sel || s.scene) return; centeredOnce.current = true;
    const ll = graph.nodes.get(s.sel)?.lonlat; if (ll) engRef.current?.map.easeTo({ center: ll, zoom: Math.max(engRef.current!.map.getZoom(), 5.5), duration: 900, padding: { right: 380 } });
  }, [graph]);
  useEffect(() => {
    const eng = engRef.current; if (!eng) return;
    if (!s.sel || !graph || /^(landmark|territory):/.test(s.sel)) { eng.setEgo(null, '', []); return; }
    eng.setEgo(s.sel, graph.nodes.get(s.sel)?.name ?? '', neighborsOf(graph, s.sel, s.year));
  }, [s.sel, s.year, graph]);
  // zoom을 넘기는 이유: 같은 칸의 말을 벌리는 폭이 화면 기준이어야 한다(people.spreadDeg).
  const people = useMemo(() => peopleAtYear(s.year, { graph, movements: [...d.movements.features, ...PACK_MOVEMENTS], territory: d.territory.features, teaching: PACK_CAST, zoom: s.zoom ?? undefined }), [s.year, s.zoom, graph, d, dataTick]);
  // 설명창은 **말을 가리지 않는 쪽**에 선다(QA 2026-09-17: 갈리아·최대 판도 51 장면에서 카이사르가 설명창 밑에 있었다). 장면이 바뀌어 카메라가 선 뒤 양쪽에 말이 몇 개 깔리는지 세어 적은 쪽으로. M으로 언제든 바꾼다
  useEffect(() => {
    if (!s.present || hud !== 'full') return;
    // 말은 그래프·교보재가 온 뒤에 서므로 1.5초에 없을 수 있다. 4초에 한 번 더 본다(2026-09-18 갈리아 장면에서 첫 판정이 빈 손이었다)
    const check = () => {
      const el = document.querySelector('.shell-present-hud') as HTMLElement | null; const map = engRef.current?.map; if (!el || !map) return;
      const r = el.getBoundingClientRect(); const W = map.getCanvas().clientWidth;
      // 말의 실제 자리는 그려진 people-dot(같은 칸의 말을 벌린 좌표)이다. people[].at은 벌리기 전 자리라 알레시아의 둘이 같은 점에 있다
      let dots: { x: number; y: number }[] = [];
      try { dots = map.queryRenderedFeatures({ layers: ['people-dot'] }).map(f => map.project((f.geometry as { coordinates: [number, number] }).coordinates)); } catch { return; }
      const pts = dots.filter(p => p.y >= r.top - 40 && p.y <= r.bottom + 40);
      const inL = pts.filter(p => p.x <= r.width + 24 + 40).length, inR = pts.filter(p => p.x >= W - r.width - 24 - 40).length;
      if (inL > inR) setHudSide('right'); else if (inR > inL) setHudSide('left');
    };
    const t1 = setTimeout(check, 1500), t2 = setTimeout(check, 4000);   // flyTo(1.2초)가 끝난 뒤, 그리고 말이 선 뒤
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [s.scene, s.present, people]);
  useEffect(() => {
    const palette = Object.fromEntries(d.actors.map(a => [a.id, a.color]));
    engRef.current?.setPeople(peopleGeoJSON(people, palette, id => legionsAt(id, s.year)));
  }, [people, d, s.year]);

  useEffect(() => { engRef.current = createEngine(mapRef.current!, d, store, root, ds, isDark(readTheme()), boards, scenes); engRef.current.onData(() => setDataTick(t => t + 1));
    engRef.current.map.on('idle', () => setDrawTick(t => t + 1)); (window as any).__ca = { map: engRef.current.map, store, clientsAt, boards, micro: () => engRef.current?.micro() ?? null, battle: () => engRef.current?.battle() ?? null }; /* 검수 스크립트(P13·P14)용 훅 */ return () => engRef.current?.map.remove(); }, []);
  const firstTheme = useRef(true);
  useEffect(() => {
    document.documentElement.dataset.theme = isDark(theme) ? 'dark' : 'light';
    try { localStorage.setItem('theme', theme); } catch {}
    if (firstTheme.current) { firstTheme.current = false; return; } // 첫 스타일은 엔진 생성 때 이미 맞췄다
    const cur = isDark(theme) ? 'dark' : 'light';
    if (skin === 'light' || skin === 'dark') { setSkin(cur as Skin); engRef.current?.setDark(isDark(theme)); } // 테마 따라가는 스킨
    else { engRef.current?.setDark(isDark(theme)); engRef.current?.setSkin(skin); } // 고지도·신문톤·작전은 테마와 무관 — 다시 입힌다(재빌드 2회, 드문 일)
  }, [theme]);

  // 재생: 5년/350ms. 끝에 닿으면 멈춘다.
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => { const y = store.get().year + 5; if (y >= d.manifest.time.to) { store.set({ year: d.manifest.time.to }); setPlaying(false); } else store.set({ year: y }); }, 350);
    return () => clearInterval(t);
  }, [playing]);

  // 키보드 전부(DESIGN §2)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const st = store.get(), step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') store.set({ year: Math.max(d.manifest.time.from, st.year - step) });
      else if (e.key === 'ArrowRight') store.set({ year: Math.min(d.manifest.time.to, st.year + step) });
      else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
      else if (e.key === 'Escape') store.set({ sel: null });
      else if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); setSearching('find'); }
      else if (e.key === 'v' || e.key === 'V') store.set({ view: st.view === '2d' ? '3d' : '2d' }); // '3'은 레이어 3(도시)와 충돌해 V로
      else if (e.key === 'l' || e.key === 'L') store.set({ lines: !st.lines });   // 선 토글(2026-09-18)
      else if (e.key === 'f' || e.key === 'F') store.set({ present: !st.present });
      // H 설명창 접기(전체 → 간략 → 숨김 → 전체) · M 좌우 옮기기. 발표 중에 손이 가는 키다.
      else if (e.key === 'h' || e.key === 'H') setHud(x => (x === 'full' ? 'slim' : x === 'slim' ? 'off' : 'full'));
      else if (e.key === 'm' || e.key === 'M') setHudSide(x => (x === 'left' ? 'right' : 'left'));
      else if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        const group = presentGroupOf(allRef.current, st.scene);
        const next = stepScene(scenesInGroup(allRef.current, group), st.scene, e.key === ']' ? 1 : -1);
        if (next) goScene(next);
      }
      else if (/^[1-9]$/.test(e.key)) { const l = CATALOG.filter(c => !c.p1)[Number(e.key) - 1]; if (l) toggleLayer(l.id); }
      else if ((e.key === 'p' || e.key === 'P') && st.board) { const b = engRef.current?.battle(); if (b) (b.playing() ? b.pause() : b.play()); }   // 전투 재생(R54)
      else if ((e.key === '.' || e.key === ',') && st.board) { const b = engRef.current?.battle(); if (b) { const v = e.key === '.' ? Math.floor(b.t()) + 1 : Math.ceil(b.t()) - 1; b.seek(v); store.set({ phase: Math.max(0, Math.min(v, b.board()!.phases.length - 1)) }); } }
    };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, []);

  const on = new Set(s.layers ?? allLayers(d));
  const toggleLayer = (id: string) => {
    const st = store.get();
    if (id === 'board') {
      if (st.board) { store.set({ board: null, phase: 0 }); return; }
      const b = pickBoard(boards, st.year); if (!b) return;
      store.set({ board: b.id, phase: 0, year: b.year, center: b.center, zoom: b.zoom ?? 11, bearing: b.bearing ?? 0, pitch: 0 });
      return;
    }
    const cur = new Set(st.layers ?? allLayers(d)); cur.has(id) ? cur.delete(id) : cur.add(id); store.set({ layers: [...cur] });
  };
  const goScene = (sc: Scene) => { applyScene(store, sc); engRef.current?.flyTo(sc); };
  // 세부 지도에서 「↩ 발표」가 돌아갈 그룹. 발표 그룹이 하나(카이사르 팩)일 때는 상수였는데 포인트 묶음이 생겨 **왔던 그룹**을 기억한다(R59).
  const lastPresentRef = useRef(PRESENT_GROUP);
  useEffect(() => { const g = presentGroupOf(allScenes, s.scene); if (isPresentGroup(g)) lastPresentRef.current = g; }, [s.scene, allScenes]);
  // 포인트 묶음 교보재(p12·p345·p911)는 그 해나 그 장면에 들어설 때 받는다(R59). 처음 받은 묶음만 엔진을 다시 싣고 말·범례를 다시 센다.
  useEffect(() => {
    for (const id of packsFor(s.year, s.scene)) loadPack(id).then(fresh => { if (fresh) { engRef.current?.refreshPack(); setDataTick(t => t + 1); } });
  }, [s.year, s.scene]);
  // dataTick: 영토 버킷이 바뀌면 d.territory.features가 통째로 갈린다 — 그때 다시 센다.
  const brief = useMemo(() => yearBrief(s.year, { graph, territory: d.territory.features, events: d.events, battles: [...d.battles.features, ...PACK_BATTLES] }),
    [s.year, graph, dataTick]);
  // 북마크 복사(R35). 제목·그룹은 사람이 파일에서 고치는 자리라 여기선 기본값만 채운다 — 지어내지 않는다.
  const [copied, setCopied] = useState<'url' | 'json' | null>(null);
  const copy = async (kind: 'url' | 'json', text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(kind); setTimeout(() => setCopied(null), 2400); } catch { /* 권한 없으면 조용히 */ }
  };
  const bookmarkId = () => {
    const st = store.get();
    return `${st.sel ? st.sel.split(':').slice(1).join(':') : 'view'}-${st.year < 0 ? `bc${-st.year}` : `ad${st.year}`}`;
  };
  const bookmarkTitle = () => `${fmtKo(store.get().year)}${nearest(d, store.get().year)?.label ? ` · ${nearest(d, store.get().year)!.label}` : ''}`;
  // 장면 탭은 프로젝트(발표자)별로 묶는다. group이 없으면 「장면」 한 덩어리(R35).
  const sceneGroups = useMemo(() => {
    const m = new Map<string, Scene[]>();
    for (const sc of allScenes) (m.get(sc.group ?? '장면') ?? m.set(sc.group ?? '장면', []).get(sc.group ?? '장면')!).push(sc);
    return [...m];
  }, [allScenes]);
  const curScene = useMemo(() => allScenes.find(sc => sc.id === s.scene) ?? null, [allScenes, s.scene]);

  // 객체 목록(1.8 최소판): 도시 rank≤2 + 전투. 2.3 검색에서 people·전체로.
  const objects = useMemo(() => [
    ...d.settlements.features.filter(f => f.properties.rank <= 2).map(f => ({ id: f.properties.id as string, name: f.properties.name_ko as string, sub: f.properties.name_ancient as string | null, kind: '도시' })),
    ...d.battles.features.map(f => ({ id: f.properties.id as string, name: f.properties.name_ko as string, sub: fmt(f.properties.year), kind: '전투' })),
  ], [d]);
  const locate = (id: string) => {
    const f = [...d.settlements.features, ...d.battles.features, ...PACK_BATTLES].find(f => f.properties.id === id);
    const person = people.find(p => p.id === id);
    const ll = f?.geometry.coordinates ?? person?.at ?? graph?.nodes.get(id)?.lonlat ?? null;
    store.set({ sel: id });
    if (ll) engRef.current?.map.easeTo({ center: ll, duration: 600, padding: { right: 380 } });
  };
  const span = d.manifest.time.to - d.manifest.time.from;
  // 범례(2.4, P7): 지금 연도·켜진 레이어에 있는 것만. 없으면 항목도 없다.
  const legend = useMemo(() => {
    const items: { swatch: React.CSSProperties; label: string }[] = [];
    if (on.has('territory')) {
      // **폴리티 단위로** 센다. 예전엔 actor 단위라 「기타중립」 한 줄이 파르티아·아르메니아·
      // 트라키아·나바테아·유대를 통째로 대표했다 — 지도에서 색이 갈렸으니 범례도 갈려야 한다.
      //
      // 다만 **그 해에 살아 있는 것**이 아니라 **지금 화면에 그려진 것**만 센다. 연도만
      // 보면 인도스키타이·월지·쿠시·Himyarite처럼 프레임 밖 폴리티까지 들어와 실측 23줄이
      // 됐다(River의 알렉산드리아 화면). 지도에 없는 색을 범례가 설명할 이유가 없다.
      const drawn = new Set<string>();
      try {
        const mp = engRef.current?.map;
        if (mp?.getLayer('territory-fill')) for (const f of mp.queryRenderedFeatures({ layers: ['territory-fill'] })) {
          const n = (f.properties as { name?: string })?.name; if (n) drawn.add(String(n));
        }
      } catch { /* 스타일 전환 중이면 조용히 */ }
      const live = d.territory.features.filter(f => (f.properties.valid_from ?? -1e6) <= s.year && s.year < (f.properties.valid_to ?? 1e6)
        && (drawn.size === 0 || drawn.has(String((f.properties as { name?: string }).name ?? ''))));
      // 면적 순(버킷이 그 순서다) 12개까지, 나머지는 「그 외 n개」(OVERHAUL-III III-2, R32). 알렉산드리아 화면 실측 19줄이 범례를 먹었다.
      // 팔레트 밖 색은 fetch-external이 구운 `color`(이름 해시)와 같은 값 — 지도와 범례가 다른 색이면 범례가 거짓말이다.
      const byName = new Map<string, string>();
      for (const f of live) {
        const p = f.properties as { name?: string; actor?: string; color?: string };
        const n = String(p.name ?? '');
        if (!n || byName.has(n)) continue;
        const actor = d.actors.find(a => a.id === p.actor);
        byName.set(n, PACK_POLITY_COLORS[n] ?? (p.actor === '기타중립' ? p.color : undefined) ?? actor?.color ?? '#8A8F98');
      }
      const LEGEND_MAX = 12; let i = 0;
      for (const [n, c] of byName) { if (i++ < LEGEND_MAX) items.push({ swatch: { background: c, opacity: 0.7 }, label: n }); }
      if (byName.size > LEGEND_MAX) items.push({ swatch: { background: 'transparent', border: '1px dashed var(--color-border)' }, label: `그 외 ${byName.size - LEGEND_MAX}개` });
    }
    // 속국·동맹 사선. 지금 해에 실제로 칠해진 것이 있을 때만 — 없는 범례는 안 띄운다.
    if (on.has('territory')) {
      const cl = clientsAt(s.year);
      const rome = d.actors.find(a => a.id === '로마')?.color ?? '#A4243B';
      const hatch = (o: number): React.CSSProperties => ({
        backgroundImage: `repeating-linear-gradient(45deg, ${rome} 0 2px, transparent 2px 5px)`,
        opacity: o, border: '1px solid var(--color-border)' });
      if (cl.client.length) items.push({ swatch: hatch(0.85), label: '로마의 속국' });
      if (cl.ally.length) items.push({ swatch: hatch(0.5), label: '로마의 동맹' });
    }
    if (on.has('settlements')) items.push({ swatch: { background: '#b8860b', borderRadius: '50%', border: '1px solid #3a2f22' }, label: '도시' });
    if (on.has('battles') && d.battles.features.some(f => (f.properties.valid_from ?? -1e6) <= s.year)) items.push({ swatch: { background: '#333', borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px #999' }, label: '전투·사건' });
    if (on.has('graph') && s.sel && graph) {
      const groups = new Set(neighborsOf(graph, s.sel, s.year).map(n => n.group));
      for (const g of ['hostile', 'ally', 'rule', 'lineage', 'member', 'act', 'locate', 'make']) if (groups.has(g)) items.push({ swatch: { background: GROUP_COLOR[g], height: 2, alignSelf: 'center' }, label: GROUP_LABEL[g] });
    }
    // 경로 국면(여정) 색. **지금 화면에 있는 국면만** — 일곱을 다 늘어놓으면 범례가 화면을 먹는다.
    // 색만 갈라 놓고 범례를 안 주면 무슨 색이 무슨 원정인지 알 길이 없다(레퍼런스 지도도 범례를 단다).
    if (on.has('movements')) {
      const seen = new Set([...d.movements.features, ...PACK_MOVEMENTS]
        .filter(f => (((f.properties as any).to_year ?? (f.properties as any).valid_from ?? -1e6)) <= s.year)
        .map(f => legPhase(f.properties as any)));
      for (const ph of ROUTE_PHASES) if (seen.has(ph.id)) items.push({ swatch: { background: ph.color, height: 3, alignSelf: 'center' }, label: ph.label });
    }
    if (on.has('people')) items.push({ swatch: { background: '#A4243B', borderRadius: '50%', border: '1.5px solid #fff' }, label: '인물 위치' });
    if (s.board) items.push({ swatch: { background: 'transparent', border: '1.5px solid var(--color-text-secondary)', borderRadius: 2 }, label: '말판 · 교보재' });
    return items;
  }, [d, s.year, s.sel, s.layers, s.board, graph, dataTick, drawTick, micro]);
  // dataset.micro는 Callouts가 effect로 쓴다 — 같은 tick에 읽으면 한 프레임 늦으므로 관찰한다.
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setMicro(el.dataset.micro ?? null);
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ['data-micro'] });
    return () => mo.disconnect();
  }, []);
  const liveBoard = useMemo(() => {
    const b = boards.find(x => x.id === s.board);
    if (!b) return null;
    const phase = phaseOf(b, s.phase);
    return { board: b, phase, idx: Math.max(0, b.phases.findIndex(p => p.t === phase.t)) };
  }, [boards, s.board, s.phase]);

  // 판 없이 지도 위에 얹는 글자(연도·제목·각주·「그 해」)의 색은 **스킨**에서 온다.
  // OS 테마를 따라가면 밝은 스킨 위에 흰 글씨가 얹혀 1.2:1이 된다 — style.ts chromeTone.
  return (
    <div className={`shell${s.present ? ' is-present' : ''}`} style={chromeTone(s.skin) as React.CSSProperties}>
      <div ref={mapRef} className="shell-map" />
      {/* 미시 지도 콜아웃. 줌으로 켜진다 — 「로마로 들어가면 보여지겠지」(River). C로 토글. */}
      <Suspense fallback={null}><Callouts map={engRef.current?.map ?? null} engine={engRef.current} root={root} ds={ds} narrow={narrow} year={s.year} onResolved={setMicroCallouts} onPin={setFocusCallout} /></Suspense>
      {/* 장군 배너 카드(OVERHAUL-II §3.4): 고른 인물이 그 해 지도에 말로 서 있을 때만. 「선택했을 때만」(River). 좁은 화면은 시트가 맡는다 */}
      {!narrow && s.sel?.startsWith('person:') && (() => {
        const p = people.find(x => x.id === s.sel); if (!p || !engRef.current) return null;
        const node = graph?.nodes.get(p.id);
        const latin = node?.aliases?.find(a => /^[A-Za-z][A-Za-z .'-]+$/.test(a)) ?? null;
        const line = brief.happenings.find(h => h.id === p.id)?.label ?? null;
        return <Suspense fallback={null}><BannerCard map={engRef.current.map} at={p.at} name={p.name} latin={latin} color={d.actors.find(a => a.id === p.faction)?.color ?? '#6B6F76'}
          portrait={p.asset ? `${root}${p.asset}` : null} emblem={p.faction && PACK_EMBLEMS.has(p.faction) ? `${root}assets/emblems/${p.faction}.png` : null}
          legion={legionsAt(p.id, s.year)} line={line} onClose={() => store.set({ sel: null })} /></Suspense>;
      })()}
      {narrow && <Suspense fallback={null}><MobileSheet scene={curScene} brief={sceneBrief(s.scene)} callouts={microCallouts} board={liveBoard?.board ?? null} engine={engRef.current} focus={focusCallout}
        onPick={id => { const c = microCallouts.find(x => x.id === id); if (c) engRef.current?.map.easeTo({ center: c.at, duration: 400 }); }}
        selNode={s.sel ? <Suspense fallback={null}><Inspector d={d} store={store} sel={s.sel} year={s.year} base={`${root}datasets/${ds}`} root={root} dark={isDark(theme)} boards={boards} scenesOf={scenesOf} onScene={goScene} onHoverNeighbor={() => {}} onLocate={locate} /></Suspense> : null} /></Suspense>}

      {searching && <Suspense fallback={null}><Search base={`${root}datasets/${ds}`} placeholder={searching === 'path' ? '어디까지? 이름 · 이명 · 초성' : undefined} onPick={id => { if (searching === 'path') setPathTo(id); else locate(id); setSearching(false); }} onClose={() => setSearching(false)} /></Suspense>}

      {/* 「그 해에 누가·어디가·무엇이」(R36). 규칙은 src/year.ts 머리에 적어 놨다 — 중요도를 지어내지 않는다.
          자리는 타이틀 옆이다. 탐색 카드(top 116)·툴바(bottom 120 중앙)·인스펙터(right 360)를 피하면 여기뿐이다. */}
      {(brief.people.length > 0 || brief.nations.length > 0 || brief.happenings.length > 0) && (
        <div className="shell-year-brief">
          {brief.people.length > 0 && (
            <div className="yb-row"><span className="yb-k">인물</span>
              <span className="yb-v">{brief.people.map(p => (
                <button key={p.id} onClick={() => locate(p.id)} title={`그 해에 활성인 관계 ${p.n}건`}>{p.name}<i>{p.n}</i></button>
              ))}</span></div>
          )}
          {brief.nations.length > 0 && (
            <div className="yb-row"><span className="yb-k">국가</span>
              <span className="yb-v">{brief.nations.map(n => <em key={n.name}>{n.name}</em>)}
                {brief.nationsMore > 0 && <em className="more">그 외 {brief.nationsMore}</em>}</span></div>
          )}
          {brief.happenings.length > 0 && (
            <div className="yb-row"><span className="yb-k">그 해</span>
              <span className="yb-v">{brief.happenings.map(h => (
                h.id ? <button key={h.label} onClick={() => locate(h.id!)}>{h.label}</button> : <em key={h.label}>{h.label}</em>
              ))}</span></div>
          )}
        </div>
      )}

      {s.present && (() => {
        const group = presentGroupOf(allScenes, s.scene);
        const list = scenesInGroup(allScenes, group);
        const i = Math.max(0, list.findIndex(sc => sc.id === s.scene));
        const cur = list[i] ?? curScene ?? undefined;
        // 설명창이 지도를 가린다(River). H로 **전체 → 간략 → 숨김**을 돌고 M으로 좌우를 바꾼다.
        // 간략에서도 **연도와 말 이름은 남긴다** — River가 「토글로 가려도 년도나 핵심 인물
        // 정도는 뜨게 해야 한다」고 했다. 숨김에서는 되돌릴 단추 하나만 남는다.
        if (hud === 'off') {
          return <button className={`shell-hud-peek is-${hudSide}`} onClick={() => setHud('full')}
                         title="설명 보이기 (H)">{fmt(s.year)} ▸</button>;
        }
        const brief_ = sceneBrief(cur?.id ?? null);
        return <div className={`shell-present-hud is-${hudSide}${hud === 'slim' ? ' is-slim' : ''}`}>
          <div className="ph-head">
            <div className="ph-k">{i + 1} / {list.length}</div>
            <div className="ph-ctl">
              <button onClick={() => setHudSide(x => (x === 'left' ? 'right' : 'left'))}
                      title="좌우 옮기기 (M)">{hudSide === 'left' ? '▸' : '◂'}</button>
              <button onClick={() => setHud(x => (x === 'full' ? 'slim' : 'off'))}
                      title="접기 (H)">{hud === 'full' ? '－' : '×'}</button>
            </div>
          </div>
          <div className="ph-t">{cur?.title ?? ''}</div>
          <div className="ph-y">{fmt(s.year)}</div>
          {/* 장면 의미체계(R53): 시대 + 이 장면이 다루는 정본 사건. 사건을 누르면 인스펙터가 열린다(거기서 다른 장면으로 건너간다) */}
          {hud === 'full' && (() => {
            const era = (d.manifest.eras ?? []).find(e => !e.sub && e.from <= s.year && s.year < e.to)?.label;
            const evs = (cur?.events ?? []).map(id => ({ id, name: graph?.nodes.get(id)?.name ?? id.slice(id.indexOf(':') + 1) }));
            return (era || evs.length) ? <div className="chip-row ph-chips">
              {era && <span className="chip is-era">{era}</span>}
              {evs.map(e => <button key={e.id} type="button" className="chip" onClick={() => store.set({ sel: e.id })}>{e.name}</button>)}
            </div> : null;
          })()}
          {hud === 'full' && cur?.note && <div className="ph-n">{cur.note}</div>}
          {hud === 'full' && brief_ && <>
            {brief_.stat && <div className="ph-stat"><b>{brief_.stat.value}</b><span>{brief_.stat.label}</span></div>}
            {brief_.event_ko && <div className="ph-ev">{brief_.event_ko}</div>}
            {brief_.look_for && <div className="ph-look">볼 것 · {brief_.look_for}</div>}
          </>}
          {people.length > 0 && (
            <div className="ph-row"><span className="ph-rk">말</span>
              <span className="ph-rv">{people.map(p => (
                <button key={p.id} onClick={() => locate(p.id)}>{p.name}</button>
              ))}</span></div>
          )}
          {hud === 'full' && brief.people.length > 0 && (
            <div className="ph-row"><span className="ph-rk">인물</span>
              <span className="ph-rv">{brief.people.map(p => (
                <button key={p.id} onClick={() => locate(p.id)} title={`그 해에 활성인 관계 ${p.n}건`}>{p.name}</button>
              ))}</span></div>
          )}
          {hud === 'full' && brief.happenings.length > 0 && (
            <div className="ph-row"><span className="ph-rk">그 해</span>
              <span className="ph-rv">{brief.happenings.map(h => (
                h.id ? <button key={h.label} onClick={() => locate(h.id!)}>{h.label}</button> : <em key={h.label}>{h.label}</em>
              ))}</span></div>
          )}
        </div>;
      })()}

      {/* 바탕 도판 고지 · 시대 불일치 한 줄.
          **JSON에만 적어 두면 발표자가 모른다.** 로마 도판은 아우렐리아누스 성벽(서기 271년)과
          아우구스투스 14구역(기원전 7년)을, 알렉산드리아 도판은 1866년 당시 도시를 함께 그린다.
          화면에서 무대에 서는 사람이 그 한마디를 할 수 있어야 한다. 전문은 title 속성에. */}
      {s.present && (() => {
        const bm = micro ? engRef.current?.micro()?.basemap : null;
        if (!bm) return null;
        return <div className="shell-scan-note" title={bm.caveat ?? ''}>{bm.short_caveat ?? bm.title}</div>;
      })()}

      {/* 장면 넘기기 — 손가락용. `[` `]`는 키보드가 없으면 못 쓴다(River: 모바일).
          발표 모드에서만 띄운다. 일반 모드는 툴바·타임라인이 이미 아래를 채운다. */}
      {s.present && (() => {
        const group = presentGroupOf(allScenes, s.scene);
        const list = scenesInGroup(allScenes, group);
        if (list.length < 2) return null;
        const i = Math.max(0, list.findIndex(sc => sc.id === s.scene));
        const go = (dir: -1 | 1) => { const n = stepScene(list, s.scene, dir); if (n) goScene(n); };
        // 두 그룹을 오간다. 세부 지도는 본 발표 여덟 장과 따로 걸어야 흐름이 안 끊기는데,
        // 그렇다고 손가락으로 갈 길이 없으면 github.io에서 도달 자체가 안 된다(River).
        const inDetail = group === DETAIL_GROUP;
        const other = inDetail ? lastPresentRef.current : DETAIL_GROUP;
        const otherList = scenesInGroup(allScenes, other);
        return (
          <nav className="shell-scene-nav" aria-label="장면 넘기기">
            <button onClick={() => go(-1)} title="앞 장면 ([)" aria-label="앞 장면">◀</button>
            <span className="sn-n">{i + 1} / {list.length}</span>
            <button onClick={() => go(1)} title="다음 장면 (])" aria-label="다음 장면">▶</button>
            <span className="sn-t">{list[i]?.title ?? ''}</span>
            {otherList.length > 0 && (
              <button className="sn-jump" onClick={() => goScene(otherList[0])}
                      title={inDetail ? '발표 장면으로 돌아간다' : `세부 지도 ${otherList.length}장`}>
                {inDetail ? '↩ 발표' : `세부 ${otherList.length} ▸`}
              </button>
            )}
          </nav>
        );
      })()}

      <header className="shell-title">
        <Text size="sm" color="secondary">크로노아틀라스 · 온톨로지 지도</Text>
        <div className="shell-year">{fmt(s.year)}</div>
        <Text size="sm" color="secondary">{d.manifest.title}</Text>
      </header>

      {!explorerOpen && !narrow && <button className="shell-explorer-pill" onClick={() => setExplorerOpen(true)}>탐색 ▸</button>}
      {explorerOpen && !narrow && <Card padding={3} elevation="low" className="shell-explorer">
        <div className="shell-explorer-head">
        <SegmentedControl label="탐색" value={tab} onChange={setTab} size="sm">
          <SegmentedControlItem value="objects" label="객체" />
          <SegmentedControlItem value="layers" label="레이어" />
          <SegmentedControlItem value="scenes" label="장면" />
          <SegmentedControlItem value="qc" label="QC" />
        </SegmentedControl>
        <IconButton label="접기" size="sm" variant="ghost" icon={<span>◂</span>} onClick={() => setExplorerOpen(false)} />
        </div>
        {tab === 'objects' && (
          <ol className="shell-list">
            {objects.slice(0, 40).map((o, i) => (
              <li key={o.id} className={o.id === s.sel ? 'is-sel' : ''} onClick={() => locate(o.id)}>
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                <span className="name">{o.name}<small>{o.sub ?? o.kind}</small></span>
                <span className="arrow">↗</span>
              </li>
            ))}
          </ol>
        )}
        {tab === 'layers' && (
          <div className="shell-layers">
            <div className="skin-block">
              <Text size="sm" color="secondary">지도 스킨</Text>
              <SegmentedControl label="지도 스킨" value={skin} onChange={v => setSkin(v as Skin)} size="sm">
                {SKINS.map(k => <SegmentedControlItem key={k.id} value={k.id} label={k.label} />)}
              </SegmentedControl>
            </div>
            {CATALOG.map((c, i) => (
              <div key={c.id} className={`row${c.p1 ? ' is-p1' : ''}`}>
                <Switch label={c.label} value={c.id === 'board' ? !!s.board : !c.p1 && on.has(c.id)} onChange={() => toggleLayer(c.id)} size="sm" isDisabled={!!c.p1} />
                {c.p1 ? <Badge label="P1" /> : i < 9 && <Kbd keys={String(i + 1)} />}
              </div>
            ))}
            {/* 선 토글(River 2026-09-18): 국경 테·성벽·도로·전투 화살표·평야 점선. 강·경로·속주·그래프는 위의 제 토글 */}
            <div className="row"><Switch label="선 (국경·성벽·도로·화살표)" value={s.lines} onChange={() => store.set({ lines: !s.lines })} size="sm" /><Kbd keys="l" /></div>
            <div className="row layers-empty"><Text size="sm" color="secondary">바람·해류·기후는 데이터(ERA5·CMEMS·CHELSA)가 붙으면 켜진다.</Text><Button label="로드맵" size="sm" variant="ghost" onClick={() => open('https://github.com/snas-lifebook/chronoatlas/blob/main/docs/roadmap.md', '_blank')} /></div>
          </div>
        )}
        {tab === 'qc' && <Suspense fallback={null}><Qc base={`${root}datasets/${ds}`} onLocate={locate} /></Suspense>}
        {tab === 'scenes' && (
          <div className="shell-scenes">
            {sceneGroups.map(([group, list]) => (
              <div key={group} className="scene-group">
                <div className="bm-row"><Text size="sm" color="secondary">{group}</Text>
                  {/* 프로젝트(발표자)별 내보내기(R53): 이 묶음에 내 북마크가 있으면 그것만 파일로 */}
                  {marks.some(m => (m.group ?? BOOKMARK_GROUP) === group) && <button className="bm-del" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bm.exportJson(group)], { type: 'application/json' })); a.download = `chronoatlas-${ds}-${group.replace(/[\\/:*?"<>|\s]+/g, '_')}.json`; a.click(); URL.revokeObjectURL(a.href); }}>이 묶음 내보내기</button>}
                </div>
                <ol className="shell-list">
                  {list.map((sc, i) => (
                    <li key={sc.id} className={sc.id === s.scene ? 'is-sel' : ''} onClick={() => goScene(sc)}>
                      <span className="num">{String(i + 1).padStart(2, '0')}</span>
                      <span className="name">{sc.title}<small>{fmtKo(sc.year)}</small></span>
                      {marks.some(m => m.id === sc.id) && <button className="bm-del" aria-label="삭제" onClick={e => { e.stopPropagation(); setMarks(bm.remove(sc.id)); }}>지우기</button>}
                      <span className="arrow">↗</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            {/* 즉석 북마크(R44): 서버 없이 localStorage에 저장한다. 다이얼로그 없음(CDP 검증이 막힌다). 파일에 남길 것은 내보내기·조각 복사로. */}
            <div className="scene-new">
              <div className="bm-row">
                <input className="bm-title" value={newTitle} onChange={e => setNewTitle(e.currentTarget.value)} placeholder={bookmarkTitle()} aria-label="북마크 제목" />
                <input className="bm-title bm-group" value={newGroup} onChange={e => setNewGroup(e.currentTarget.value)} placeholder={BOOKMARK_GROUP} aria-label="묶음(발표자·프로젝트)" list="bm-groups" />
                <datalist id="bm-groups">{bm.groups().map(g => <option key={g} value={g} />)}</datalist>
                <Button label="지금 화면 저장" size="sm" variant="secondary" isDisabled={!bm.available}
                  onClick={() => { setMarks(bm.save(bookmarkOf(store.get(), { id: bookmarkId(), title: newTitle.trim() || bookmarkTitle(), group: newGroup.trim() || BOOKMARK_GROUP, layers: [...on] }))); setNewTitle(''); }} />
              </div>
              {!bm.available && <Text size="sm" color="secondary">이 브라우저는 저장 공간을 막아 두었다. 링크 복사만 된다.</Text>}
              <div className="bm-row">
                <Button label={copied === 'url' ? '복사됨' : '이 화면 링크 복사'} size="sm" variant="ghost" onClick={() => copy('url', location.href)} />
                <Button label={copied === 'json' ? '복사됨' : '북마크 조각 복사'} size="sm" variant="ghost" onClick={() => copy('json', JSON.stringify(bookmarkOf(store.get(), { id: bookmarkId(), title: bookmarkTitle(), layers: [...on] }), null, 2))} />
                <Button label="내보내기" size="sm" variant="ghost" isDisabled={!marks.length} onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bm.exportJson()], { type: 'application/json' })); a.download = `chronoatlas-bookmarks-${ds}.json`; a.click(); URL.revokeObjectURL(a.href); }} />
                <label className="bm-import"><input type="file" accept="application/json" onChange={async e => { const f = e.currentTarget.files?.[0]; if (!f) return; const r = bm.importJson(await f.text()); setMarks(bm.list()); setImportNote(`${r.added}개 가져옴${r.dropped ? `, ${r.dropped}개 버림` : ''}`); e.currentTarget.value = ''; }} />가져오기</label>
              </div>
              {importNote && <Text size="sm" color="secondary">{importNote}</Text>}
            </div>
          </div>
        )}
      </Card>}

      {s.sel && !narrow && <div className="shell-right">
        <Suspense fallback={null}><Inspector d={d} store={store} sel={s.sel} year={s.year} base={`${root}datasets/${ds}`} root={root} dark={isDark(theme)} boards={boards} scenesOf={scenesOf} onScene={goScene} getMapCanvas={() => engRef.current?.map.getCanvas() ?? null}
          onHoverNeighbor={id => engRef.current?.pulse(id)} onLocate={locate} pathTo={pathTo} onAskPath={() => setSearching('path')} onClearPath={() => setPathTo(null)} /></Suspense>
        {graph?.nodes.has(s.sel) && on.has('graph') && <Suspense fallback={null}><GraphPanel graph={graph} sel={s.sel} year={s.year} onSelect={locate} onHover={id => engRef.current?.pulse(id)} /></Suspense>}
      </div>}

      <div className="shell-env">
        <SegmentedControl label="테마" value={theme} onChange={v => setTheme(v as Theme)} size="sm">
          <SegmentedControlItem value="light" label="밝게" />
          <SegmentedControlItem value="dark" label="어둡게" />
          <SegmentedControlItem value="system" label="시스템" />
        </SegmentedControl>
        <div className="shell-zoom">
          <IconButton label="확대" size="sm" variant="secondary" icon={<span>+</span>} onClick={() => engRef.current?.zoom(1)} />
          <IconButton label="축소" size="sm" variant="secondary" icon={<span>−</span>} onClick={() => engRef.current?.zoom(-1)} />
        </div>
      </div>

      <nav className="shell-toolbar">
        <Tool label="전체 보기" sub="overview" onClick={() => engRef.current?.home()}>⌂</Tool>
        <Tool label={playing ? '정지' : '재생'} sub="play" active={playing} onClick={() => setPlaying(p => !p)}>{playing ? '❚❚' : '▶'}</Tool>
        <Tool label={s.view === '2d' ? '입체 보기' : '평면 보기'} sub={s.view === '2d' ? '3d' : '2d'} onClick={() => store.set({ view: s.view === '2d' ? '3d' : '2d' })}>◈</Tool>
        <Tool label="지명" sub="labels" active={on.has('labels')} onClick={() => toggleLayer('labels')}>⌖</Tool>
        <Tool label="검색" sub="⌘K" onClick={() => setSearching('find')}>⌕</Tool>
        <Tool label="PNG" sub="export" onClick={async () => {
          const eng = engRef.current; if (!eng) return;
          const { renderPng, download } = await import('../export/png');
          const blob = await withSkin(() => renderPng(eng.map.getCanvas(), { year: fmt(s.year), subtitle: nearest(d, s.year)?.label, dark: skin === 'dark',
            legend: legend.map(l => ({ color: String(l.swatch.background ?? '#888'), label: l.label })), credit: `크로노아틀라스 · Natural Earth(PD) · Pleiades(CC BY) · Cliopatria/Seshat(CC BY)${skin === 'satellite' ? ' · NASA Blue Marble(PD)' : ''} · 정본 온톨로지` }));
          download(blob, `chronoatlas_${fmt(s.year).replace(' ', '')}${s.sel ? '_' + s.sel.split(':')[1] : ''}.png`);
        }}>⤓</Tool>
        <Tool label="데이터" sub="geojson·csv" onClick={async () => {
          const [{ download }, { timeSlice, pointsCsv }] = await Promise.all([import('../export/png'), import('../export/data')]);
          const tag = fmt(s.year).replace(' ', '');
          download(new Blob([JSON.stringify(timeSlice(d, s.year))], { type: 'application/geo+json' }), `chronoatlas_${ds}_${tag}.geojson`);
          setTimeout(() => download(new Blob([pointsCsv(d, s.year)], { type: 'text/csv;charset=utf-8' }), `chronoatlas_${ds}_${tag}_points.csv`), 300);
        }}>⛁</Tool>
        <Tool label={exporting != null ? `${Math.round(exporting * 100)}%` : 'MP4'} sub="scene" onClick={async () => {
          const eng = engRef.current; if (!eng || exporting != null) return;
          // 현재 장면 구간(없으면 현재 연도 ±20) 을 1년/프레임 12fps로. 끝나면 원래 연도로.
          const sc = curScene; const from = sc ? sc.year : s.year - 20, to = sc ? (sc.to ?? Math.min(d.manifest.time.to, sc.year + 20)) : Math.min(d.manifest.time.to, s.year + 20);
          const y0 = s.year; setExporting(0);
          try {
            const [{ renderMp4 }, { download }] = await Promise.all([import('../export/mp4'), import('../export/png')]);
            const blob = await withSkin(() => renderMp4({ from, to, mapCanvas: eng.map.getCanvas(), setYear: y => store.set({ year: y }), onProgress: setExporting,
              overlay: y => ({ year: fmt(y), subtitle: nearest(d, y)?.label, dark: skin === 'dark', legend: legend.map(l => ({ color: String(l.swatch.background ?? '#888'), label: l.label })), credit: `크로노아틀라스 · Natural Earth(PD) · Pleiades(CC BY) · Cliopatria/Seshat(CC BY)${skin === 'satellite' ? ' · NASA Blue Marble(PD)' : ''} · 정본 온톨로지` }) }));
            download(blob, `chronoatlas_${fmt(from).replace(' ', '')}-${fmt(to).replace(' ', '')}.mp4`);
          } catch (e: any) { console.error(e); } finally { store.set({ year: y0 }); setExporting(null); }
        }}>▣</Tool>
        <Tool label="전체 화면" sub="fullscreen" onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()}>⛶</Tool>
        {/* 자료실로(River 2026-09-18 「크로노아틀라스에서도 로마쇠망사 자료실로 갈 수 있어야」): 객체가 골라져 있으면 그 객체 화면, 아니면 첫 화면. 새 탭 */}
        <Tool label="자료실" sub="library" onClick={() => { const n = s.sel ? graph?.nodes.get(s.sel) : null; open(n ? libraryObject(s.sel!, n.name) : LIBRARY, '_blank', 'noopener'); }}>▤</Tool>
      </nav>

      <footer className="shell-timeline">
        <div className="shell-eras" aria-hidden>
          {(d.manifest.eras ?? []).map(e => {
            const l = Math.max(0, (e.from - d.manifest.time.from) / span) * 100, r = Math.min(1, (e.to - d.manifest.time.from) / span) * 100;
            return <span key={e.id} className={`era${e.sub ? ' sub' : ''}${s.year >= e.from && s.year < e.to ? ' is-now' : ''}`} style={{ left: `${l}%`, width: `${r - l}%` }} onClick={() => store.set({ year: e.from })}>{e.label}</span>;
          })}
        </div>
        <div className="shell-ticks">
          {d.events.map(e => <i key={e.year + e.label} style={{ left: `${((e.year - d.manifest.time.from) / span) * 100}%` }} title={`${fmtKo(e.year)} ${e.label}`} onClick={() => store.set({ year: e.year })} />)}
        </div>
        <input type="range" className="shell-slider" min={d.manifest.time.from} max={d.manifest.time.to} value={s.year} onChange={e => store.set({ year: Number(e.currentTarget.value) })} aria-label="연도" />
        <div className="shell-tl-meta">
          <Text size="sm" color="secondary">{fmtKo(s.year)} · {nearest(d, s.year)?.label ?? ''}</Text>
          <div className="shell-legend">{legend.map(l => <span key={l.label}><i style={l.swatch} />{l.label}</span>)}</div>
        </div>
      </footer>

      {liveBoard && engRef.current && !narrow && <Suspense fallback={null}><BattleBar engine={engRef.current} store={store} board={liveBoard.board} shift={explorerOpen} /></Suspense>}

      <div className="shell-footnote">
        <Text size="sm" color="secondary">{d.manifest.basemap?.length ? '실제 지리 기반 · Natural Earth 10m(PD) · Pleiades(CC BY) · 영토 Cliopatria(CC BY) · ' : ''}정본 온톨로지 {d.manifest.counts?.entities ?? ''}객체 · <a className="lib-link" href={LIBRARY} target="_blank" rel="noreferrer">자료실 ↗</a> · <Kbd keys="left" /><Kbd keys="right" /> 연도 <Kbd keys="space" /> 재생 <Kbd keys="v" /> 평면/입체</Text>
      </div>
    </div>
  );
}

function Tool({ label, sub, active, onClick, children }: { label: string; sub: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip content={label}>
      {/* aria-label을 주면 접근명("전체 보기")이 보이는 글자("전체 보기 overview")를 다 담지 못해 WCAG 2.5.3 위반이 된다.
          내용이 곧 이름이 되게 두고, 장식인 아이콘만 숨긴다. */}
      <button className={`shell-tool${active ? ' is-active' : ''}`} onClick={onClick} aria-pressed={active}>
        <span className="ico" aria-hidden="true">{children}</span><span className="lbl">{label}</span><span className="sub">{sub}</span>
      </button>
    </Tooltip>
  );
}
const nearest = (d: Dataset, y: number) => d.events.reduce<Dataset['events'][number] | null>((b, e) => (!b || Math.abs(e.year - y) < Math.abs(b.year - y)) ? e : b, null);
