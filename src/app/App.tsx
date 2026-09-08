// 앱 셸 (DESIGN v3 §2, TASKS 1.8): 풀블리드 지도 위에 떠 있는 astryx 카드 5 + 타임라인 띠 + 각주 줄. 상태는 store 하나.
import { useEffect, useRef, useSyncExternalStore, useState, useMemo } from 'react';
import { Card, SegmentedControl, SegmentedControlItem, Switch, Text, Badge, IconButton, Tooltip, Kbd } from '@astryxdesign/core';
import type { Dataset } from '../schema';
import { type Store, type Scene, applyScene } from '../state';
import { createEngine, allLayers, type Engine } from '../map/engine';
import { Inspector } from './Inspector';
import './shell.css';

const fmt = (y: number) => (y < 0 ? `BC ${-y}` : `AD ${y}`);
const fmtKo = (y: number) => (y < 0 ? `기원전 ${-y}년` : `서기 ${y}년`);

// 레이어 카탈로그(P6): manifest.layers + 베이스맵 토글 + 데이터 없는 P1 레이어(흐리게).
const CATALOG: { id: string; label: string; p1?: boolean }[] = [
  { id: 'territory', label: '영토' }, { id: 'admin_regions', label: '속주' }, { id: 'settlements', label: '도시' },
  { id: 'battles', label: '전투' }, { id: 'movements', label: '이동 경로' },
  { id: 'relief', label: '지형 음영' }, { id: 'bathy', label: '수심' }, { id: 'rivers', label: '강·호수' }, { id: 'labels', label: '지명' },
  { id: 'wind', label: '바람', p1: true }, { id: 'current', label: '해류', p1: true }, { id: 'climate', label: '기후', p1: true }, { id: 'landmarks', label: '지형지물' },
];

type Theme = 'system' | 'light' | 'dark';
const readTheme = (): Theme => { try { return (localStorage.getItem('theme') as Theme) || 'system'; } catch { return 'system'; } };
const isDark = (t: Theme) => t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);

export function App({ d, store, root, ds }: { d: Dataset; store: Store; root: string; ds: string }) {
  const s = useSyncExternalStore(store.subscribe, store.get);
  const mapRef = useRef<HTMLDivElement>(null);
  const engRef = useRef<Engine | null>(null);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [tab, setTab] = useState('objects');
  const [playing, setPlaying] = useState(false);

  useEffect(() => { engRef.current = createEngine(mapRef.current!, d, store, root, ds, isDark(readTheme())); return () => engRef.current?.map.remove(); }, []);
  const firstTheme = useRef(true);
  useEffect(() => {
    document.documentElement.dataset.theme = isDark(theme) ? 'dark' : 'light';
    try { localStorage.setItem('theme', theme); } catch {}
    if (firstTheme.current) { firstTheme.current = false; return; } // 첫 스타일은 엔진 생성 때 이미 맞췄다
    engRef.current?.setDark(isDark(theme));
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
      else if (e.key === '3') store.set({ view: st.view === '2d' ? '3d' : '2d' });
      else if (/^[1-9]$/.test(e.key)) { const l = CATALOG.filter(c => !c.p1)[Number(e.key) - 1]; if (l) toggleLayer(l.id); }
    };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, []);

  const on = new Set(s.layers ?? allLayers(d));
  const toggleLayer = (id: string) => { const st = store.get(); const cur = new Set(st.layers ?? allLayers(d)); cur.has(id) ? cur.delete(id) : cur.add(id); store.set({ layers: [...cur] }); };
  const scenes: Scene[] = d.manifest.scenes ?? [];
  const goScene = (sc: Scene) => { applyScene(store, sc); engRef.current?.flyTo(sc); };

  // 객체 목록(1.8 최소판): 도시 rank≤2 + 전투. 2.3 검색에서 people·전체로.
  const objects = useMemo(() => [
    ...d.settlements.features.filter(f => f.properties.rank <= 2).map(f => ({ id: f.properties.id as string, name: f.properties.name_ko as string, sub: f.properties.name_ancient as string | null, kind: '도시' })),
    ...d.battles.features.map(f => ({ id: f.properties.id as string, name: f.properties.name_ko as string, sub: fmt(f.properties.year), kind: '전투' })),
  ], [d]);
  const locate = (id: string) => { const f = [...d.settlements.features, ...d.battles.features].find(f => f.properties.id === id); store.set({ sel: id }); if (f) engRef.current?.map.easeTo({ center: f.geometry.coordinates, duration: 600, padding: { right: 380 } }); };
  const span = d.manifest.time.to - d.manifest.time.from;

  return (
    <div className="shell">
      <div ref={mapRef} className="shell-map" />

      <header className="shell-title">
        <Text size="sm" color="secondary">로마제국쇠망사 · 온톨로지 지도</Text>
        <div className="shell-year">{fmt(s.year)}</div>
        <Text size="sm" color="secondary">{d.manifest.title}</Text>
      </header>

      <Card padding={3} elevation="low" className="shell-explorer">
        <SegmentedControl label="탐색" value={tab} onChange={setTab} size="sm">
          <SegmentedControlItem value="objects" label="객체" />
          <SegmentedControlItem value="layers" label="레이어" />
          <SegmentedControlItem value="scenes" label="장면" />
        </SegmentedControl>
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
            {CATALOG.map((c, i) => (
              <div key={c.id} className={`row${c.p1 ? ' is-p1' : ''}`}>
                <Switch label={c.label} value={!c.p1 && on.has(c.id)} onChange={() => toggleLayer(c.id)} size="sm" isDisabled={!!c.p1} />
                {c.p1 ? <Badge label="P1" /> : i < 9 && <Kbd keys={String(i + 1)} />}
              </div>
            ))}
          </div>
        )}
        {tab === 'scenes' && (
          <ol className="shell-list">
            {scenes.map((sc, i) => (
              <li key={sc.id} className={sc.id === s.scene ? 'is-sel' : ''} onClick={() => goScene(sc)}>
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                <span className="name">{sc.title}<small>{fmtKo(sc.year)}</small></span>
                <span className="arrow">↗</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {s.sel && <Inspector d={d} store={store} sel={s.sel} year={s.year} base={`${root}datasets/${ds}`}
        onHoverNeighbor={id => engRef.current?.pulse(id)} onLocate={locate} />}

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
          <div className="shell-legend">{d.actors.map(a => <span key={a.id}><i style={{ background: a.color }} />{a.label}</span>)}</div>
        </div>
      </footer>

      <div className="shell-footnote">
        <Text size="sm" color="secondary">실제 지리 기반 · Natural Earth 10m(PD) · 정본 온톨로지 {d.manifest.counts?.entities ?? ''}객체 · <Kbd keys="left" /><Kbd keys="right" /> 연도 <Kbd keys="space" /> 재생 <Kbd keys="3" /> 평면/입체</Text>
      </div>
    </div>
  );
}

function Tool({ label, sub, active, onClick, children }: { label: string; sub: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip content={label}>
      <button className={`shell-tool${active ? ' is-active' : ''}`} onClick={onClick} aria-label={label} aria-pressed={active}>
        <span className="ico">{children}</span><span className="lbl">{label}</span><span className="sub">{sub}</span>
      </button>
    </Tooltip>
  );
}
const nearest = (d: Dataset, y: number) => d.events.reduce<Dataset['events'][number] | null>((b, e) => (!b || Math.abs(e.year - y) < Math.abs(b.year - y)) ? e : b, null);
