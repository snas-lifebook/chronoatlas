// 앱 셸 (DESIGN v3 §2, TASKS 1.8): 풀블리드 지도 위에 떠 있는 astryx 카드 5 + 타임라인 띠 + 각주 줄. 상태는 store 하나.
import { useEffect, useRef, useSyncExternalStore, useState, useMemo } from 'react';
import { Card, SegmentedControl, SegmentedControlItem, Switch, Text, Badge, Button, IconButton, Tooltip, Kbd } from '@astryxdesign/core';
import type { Dataset } from '../schema';
import { type Store, type Scene, applyScene, bookmarkOf } from '../state';
import { createEngine, allLayers, GROUP_COLOR, type Engine } from '../map/engine';
import { SKINS, type Skin } from '../map/style';
import { GROUP_LABEL } from '../graph/data';
import { Inspector } from './Inspector';
import { Search } from './Search';
import { renderPng, download } from '../export/png';
import { timeSlice, pointsCsv } from '../export/data';
import { renderMp4 } from '../export/mp4';
import { loadGraph, neighborsOf, type Graph } from '../graph/data';
import { GraphPanel } from './GraphPanel';
import { Qc } from './Qc';
import './shell.css';

const fmt = (y: number) => (y < 0 ? `BC ${-y}` : `AD ${y}`);
const fmtKo = (y: number) => (y < 0 ? `기원전 ${-y}년` : `서기 ${y}년`);

// 레이어 카탈로그(P6): manifest.layers + 베이스맵 토글 + 데이터 없는 P1 레이어(흐리게).
const CATALOG: { id: string; label: string; p1?: boolean }[] = [
  { id: 'territory', label: '영토' }, { id: 'admin_regions', label: '속주' }, { id: 'settlements', label: '도시' },
  { id: 'battles', label: '전투' }, { id: 'movements', label: '이동 경로' },
  { id: 'relief', label: '지형 음영' }, { id: 'bathy', label: '수심' }, { id: 'rivers', label: '강·호수' }, { id: 'labels', label: '지명' },
  { id: 'wind', label: '바람', p1: true }, { id: 'current', label: '해류', p1: true }, { id: 'climate', label: '기후', p1: true }, { id: 'landmarks', label: '지형지물' }, { id: 'graph', label: '관계 그래프' },
];

type Theme = 'system' | 'light' | 'dark';
const readTheme = (): Theme => { try { return (localStorage.getItem('theme') as Theme) || 'system'; } catch { return 'system'; } };
const isDark = (t: Theme) => t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);

export function App({ d, store, root, ds, scenes }: { d: Dataset; store: Store; root: string; ds: string; scenes: Scene[] }) {
  const s = useSyncExternalStore(store.subscribe, store.get);
  const mapRef = useRef<HTMLDivElement>(null);
  const engRef = useRef<Engine | null>(null);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [tab, setTab] = useState('objects');
  const [explorerOpen, setExplorerOpen] = useState(() => matchMedia('(min-width: 1024px)').matches); // 좁은 화면은 접힌 채 시작(P14b)
  const [playing, setPlaying] = useState(false);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [searching, setSearching] = useState<false | 'find' | 'path'>(false);
  const [pathTo, setPathTo] = useState<string | null>(null); // F14: 선택 → 이 객체까지 최단 관계 경로
  const [exporting, setExporting] = useState<number | null>(null);
  const [dataTick, setDataTick] = useState(0); // 영토 버킷이 바뀌면 범례 다시
  // 지도 스킨(P1 Azgaar식). 웹 UI 크롬은 안 바뀐다(P12).
  // 북마크가 스킨까지 담아야 해서 store에 있다 — URL로 나가고 URL에서 돌아온다(R35).
  const skin = s.skin, setSkin = (k: Skin) => store.set({ skin: k });
  // 스킨은 지도에 바로 입힌다(Azgaar식 미리보기). 크롬(카드·툴바)은 astryx 그대로 — P12는 'UI 토큰 불변'이지 '지도 불변'이 아니다. 내보내기는 보이는 그대로.
  const firstSkin = useRef(true);
  useEffect(() => { if (firstSkin.current) { firstSkin.current = false; return; } const eng = engRef.current; if (!eng) return; const cur = isDark(theme) ? 'dark' : 'light'; eng.setSkin(skin === cur ? null : skin); }, [skin]);
  const withSkin = <T,>(fn: () => Promise<T>): Promise<T> => fn();

  // 관계 그래프(2.1): 선택되면 graph.json 지연 로드 → 그 해의 1홉을 지도 위에 얹는다
  useEffect(() => { if (s.sel && !graph && !/^(landmark|territory):/.test(s.sel)) loadGraph(`${root}datasets/${ds}`).then(setGraph).catch(() => {}); }, [s.sel]);
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

  useEffect(() => { engRef.current = createEngine(mapRef.current!, d, store, root, ds, isDark(readTheme())); engRef.current.onData(() => setDataTick(t => t + 1)); (window as any).__ca = { map: engRef.current.map, store }; /* 검수 스크립트(P13·P14)용 훅 */ return () => engRef.current?.map.remove(); }, []);
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
      else if (/^[1-9]$/.test(e.key)) { const l = CATALOG.filter(c => !c.p1)[Number(e.key) - 1]; if (l) toggleLayer(l.id); }
    };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, []);

  const on = new Set(s.layers ?? allLayers(d));
  const toggleLayer = (id: string) => { const st = store.get(); const cur = new Set(st.layers ?? allLayers(d)); cur.has(id) ? cur.delete(id) : cur.add(id); store.set({ layers: [...cur] }); };
  const goScene = (sc: Scene) => { applyScene(store, sc); engRef.current?.flyTo(sc); };
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
    for (const sc of scenes) (m.get(sc.group ?? '장면') ?? m.set(sc.group ?? '장면', []).get(sc.group ?? '장면')!).push(sc);
    return [...m];
  }, [scenes]);

  // 객체 목록(1.8 최소판): 도시 rank≤2 + 전투. 2.3 검색에서 people·전체로.
  const objects = useMemo(() => [
    ...d.settlements.features.filter(f => f.properties.rank <= 2).map(f => ({ id: f.properties.id as string, name: f.properties.name_ko as string, sub: f.properties.name_ancient as string | null, kind: '도시' })),
    ...d.battles.features.map(f => ({ id: f.properties.id as string, name: f.properties.name_ko as string, sub: fmt(f.properties.year), kind: '전투' })),
  ], [d]);
  const locate = (id: string) => {
    const f = [...d.settlements.features, ...d.battles.features].find(f => f.properties.id === id);
    const ll = f?.geometry.coordinates ?? graph?.nodes.get(id)?.lonlat ?? null;
    store.set({ sel: id });
    if (ll) engRef.current?.map.easeTo({ center: ll, duration: 600, padding: { right: 380 } });
  };
  const span = d.manifest.time.to - d.manifest.time.from;
  // 범례(2.4, P7): 지금 연도·켜진 레이어에 있는 것만. 없으면 항목도 없다.
  const legend = useMemo(() => {
    const items: { swatch: React.CSSProperties; label: string }[] = [];
    if (on.has('territory')) {
      const present = new Set(d.territory.features.filter(f => (f.properties.valid_from ?? -1e6) <= s.year && s.year < (f.properties.valid_to ?? 1e6)).map(f => f.properties.actor));
      for (const a of d.actors) if (present.has(a.id)) items.push({ swatch: { background: a.color, opacity: 0.7 }, label: a.label });
    }
    if (on.has('settlements')) items.push({ swatch: { background: '#b8860b', borderRadius: '50%', border: '1px solid #3a2f22' }, label: '도시' });
    if (on.has('battles') && d.battles.features.some(f => (f.properties.valid_from ?? -1e6) <= s.year)) items.push({ swatch: { background: '#333', borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px #999' }, label: '전투·사건' });
    if (on.has('graph') && s.sel && graph) {
      const groups = new Set(neighborsOf(graph, s.sel, s.year).map(n => n.group));
      for (const g of ['hostile', 'ally', 'rule', 'lineage', 'member', 'act', 'locate', 'make']) if (groups.has(g)) items.push({ swatch: { background: GROUP_COLOR[g], height: 2, alignSelf: 'center' }, label: GROUP_LABEL[g] });
    }
    return items;
  }, [d, s.year, s.sel, s.layers, graph, dataTick]);

  return (
    <div className="shell">
      <div ref={mapRef} className="shell-map" />

      {searching && <Search base={`${root}datasets/${ds}`} placeholder={searching === 'path' ? '어디까지? 이름 · 이명 · 초성' : undefined} onPick={id => { if (searching === 'path') setPathTo(id); else locate(id); setSearching(false); }} onClose={() => setSearching(false)} />}

      <header className="shell-title">
        <Text size="sm" color="secondary">크로노아틀라스 · 온톨로지 지도</Text>
        <div className="shell-year">{fmt(s.year)}</div>
        <Text size="sm" color="secondary">{d.manifest.title}</Text>
      </header>

      {!explorerOpen && <button className="shell-explorer-pill" onClick={() => setExplorerOpen(true)}>탐색 ▸</button>}
      {explorerOpen && <Card padding={3} elevation="low" className="shell-explorer">
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
                <Switch label={c.label} value={!c.p1 && on.has(c.id)} onChange={() => toggleLayer(c.id)} size="sm" isDisabled={!!c.p1} />
                {c.p1 ? <Badge label="P1" /> : i < 9 && <Kbd keys={String(i + 1)} />}
              </div>
            ))}
            <div className="row layers-empty"><Text size="sm" color="secondary">바람·해류·기후는 데이터(ERA5·CMEMS·CHELSA)가 붙으면 켜진다.</Text><Button label="로드맵" size="sm" variant="ghost" onClick={() => open('https://github.com/snas-lifebook/chronoatlas/blob/main/docs/roadmap.md', '_blank')} /></div>
          </div>
        )}
        {tab === 'qc' && <Qc base={`${root}datasets/${ds}`} onLocate={locate} />}
        {tab === 'scenes' && (
          <div className="shell-scenes">
            {sceneGroups.map(([group, list]) => (
              <div key={group} className="scene-group">
                <Text size="sm" color="secondary">{group}</Text>
                <ol className="shell-list">
                  {list.map((sc, i) => (
                    <li key={sc.id} className={sc.id === s.scene ? 'is-sel' : ''} onClick={() => goScene(sc)}>
                      <span className="num">{String(i + 1).padStart(2, '0')}</span>
                      <span className="name">{sc.title}<small>{fmtKo(sc.year)}</small></span>
                      <span className="arrow">↗</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            {/* 서버가 없으니 북마크 저장은 URL과 파일뿐이다(R35). 주소는 그대로 공유하고, 파일에 남길 것은 조각으로 복사한다. */}
            <div className="scene-new">
              <Button label={copied === 'url' ? '복사됨' : '이 화면 링크 복사'} size="sm" variant="secondary" onClick={() => copy('url', location.href)} />
              <Button label={copied === 'json' ? '복사됨' : '북마크 조각 복사'} size="sm" variant="ghost" onClick={() => copy('json', JSON.stringify(bookmarkOf(store.get(), { id: bookmarkId(), title: bookmarkTitle(), layers: [...on] }), null, 2))} />
              <Text size="sm" color="secondary">연도·카메라·스킨·레이어가 함께 담긴다. 조각은 <code>data/scenes/{ds}.json</code>에 붙여넣고 <code>title</code>·<code>group</code>을 고쳐 커밋한다.</Text>
            </div>
          </div>
        )}
      </Card>}

      {s.sel && <div className="shell-right">
        <Inspector d={d} store={store} sel={s.sel} year={s.year} base={`${root}datasets/${ds}`} root={root} dark={isDark(theme)} getMapCanvas={() => engRef.current?.map.getCanvas() ?? null}
          onHoverNeighbor={id => engRef.current?.pulse(id)} onLocate={locate} pathTo={pathTo} onAskPath={() => setSearching('path')} onClearPath={() => setPathTo(null)} />
        {graph?.nodes.has(s.sel) && on.has('graph') && <GraphPanel graph={graph} sel={s.sel} year={s.year} onSelect={locate} onHover={id => engRef.current?.pulse(id)} />}
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
          const blob = await withSkin(() => renderPng(eng.map.getCanvas(), { year: fmt(s.year), subtitle: nearest(d, s.year)?.label, dark: skin === 'dark',
            legend: legend.map(l => ({ color: String(l.swatch.background ?? '#888'), label: l.label })), credit: '크로노아틀라스 · Natural Earth(PD) · Pleiades(CC BY) · Cliopatria/Seshat(CC BY) · 정본 온톨로지' }));
          download(blob, `chronoatlas_${fmt(s.year).replace(' ', '')}${s.sel ? '_' + s.sel.split(':')[1] : ''}.png`);
        }}>⤓</Tool>
        <Tool label="데이터" sub="geojson·csv" onClick={() => {
          const tag = fmt(s.year).replace(' ', '');
          download(new Blob([JSON.stringify(timeSlice(d, s.year))], { type: 'application/geo+json' }), `chronoatlas_${ds}_${tag}.geojson`);
          setTimeout(() => download(new Blob([pointsCsv(d, s.year)], { type: 'text/csv;charset=utf-8' }), `chronoatlas_${ds}_${tag}_points.csv`), 300);
        }}>⛁</Tool>
        <Tool label={exporting != null ? `${Math.round(exporting * 100)}%` : 'MP4'} sub="scene" onClick={async () => {
          const eng = engRef.current; if (!eng || exporting != null) return;
          // 현재 장면 구간(없으면 현재 연도 ±20) 을 1년/프레임 12fps로. 끝나면 원래 연도로.
          const sc = scenes.find(x => x.id === s.scene); const from = sc ? sc.year : s.year - 20, to = sc ? (sc.to ?? Math.min(d.manifest.time.to, sc.year + 20)) : Math.min(d.manifest.time.to, s.year + 20);
          const y0 = s.year; setExporting(0);
          try {
            const blob = await withSkin(() => renderMp4({ from, to, mapCanvas: eng.map.getCanvas(), setYear: y => store.set({ year: y }), onProgress: setExporting,
              overlay: y => ({ year: fmt(y), subtitle: nearest(d, y)?.label, dark: skin === 'dark', legend: legend.map(l => ({ color: String(l.swatch.background ?? '#888'), label: l.label })), credit: '크로노아틀라스 · Natural Earth(PD) · Pleiades(CC BY) · Cliopatria/Seshat(CC BY) · 정본 온톨로지' }) }));
            download(blob, `chronoatlas_${fmt(from).replace(' ', '')}-${fmt(to).replace(' ', '')}.mp4`);
          } catch (e: any) { console.error(e); } finally { store.set({ year: y0 }); setExporting(null); }
        }}>▣</Tool>
        <Tool label="전체 화면" sub="fullscreen" onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()}>⛶</Tool>
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

      <div className="shell-footnote">
        <Text size="sm" color="secondary">{d.manifest.basemap?.length ? '실제 지리 기반 · Natural Earth 10m(PD) · Pleiades(CC BY) · 영토 Cliopatria(CC BY) · ' : ''}정본 온톨로지 {d.manifest.counts?.entities ?? ''}객체 · <Kbd keys="left" /><Kbd keys="right" /> 연도 <Kbd keys="space" /> 재생 <Kbd keys="v" /> 평면/입체</Text>
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
