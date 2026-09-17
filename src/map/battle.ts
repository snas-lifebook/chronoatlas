// src/map/battle.ts: 말판 v2 렌더 + 재생 (OVERHAUL §3.6, R54). 지연 로드 청크. 초기 번들에 안 실린다.
//
// 그리는 것: 부대 블록(몸통·앞띠·이름표) · 기동 화살표(선·화살촉) · 교전 표식. 움직이는 것: rAF로 t를 올리며 setData.
// 시뮬레이션이 아니다. River 08-13 「보여지기만 하면 된다」. 페이즈 사이 보간이 전부다(board.ts interpolate).
// 문법은 볼트 A_공간지도의 전투전술 캡처(Epic History · Kings and Generals)에서: 양피지 위 길쭉한 블록, 앞띠가 향을 말하고,
// 큰 기동은 반투명 곡선 화살표, 교전은 교차 검, 아래에 캡션 띠, 페이즈에 인용이 있으면 카드.
import type * as maplibregl from 'maplibre-gl';
import { interpolate, battleGeoJSON, type BoardData, type BoardPhase, type BoardQuote, type Frame, type LonLat } from '../board';

export const BATTLE_LAYERS = ['battle-arrow', 'battle-head', 'battle-body', 'battle-body-line', 'battle-front', 'battle-clash', 'battle-label'] as const;
const PHASE_MS = 1500, QUOTE_MS = 1500, INK = '#2B2419', PAPER = '#F3ECDD';
const EMPTY = { type: 'FeatureCollection', features: [] } as const;

/** 캔버스로 그린 아이콘. 파일도 글리프도 안 쓴다(교차 검은 Pretendard에 없다). */
function icon(kind: 'head' | 'clash', px = 32): ImageData {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d')!;
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'head') {
    g.fillStyle = INK; g.beginPath(); g.moveTo(px / 2, 2); g.lineTo(px - 4, px - 4); g.lineTo(px / 2, px * 0.7); g.lineTo(4, px - 4); g.closePath(); g.fill();
  } else {
    g.strokeStyle = PAPER; g.lineWidth = 7; g.beginPath(); g.moveTo(6, 6); g.lineTo(px - 6, px - 6); g.moveTo(px - 6, 6); g.lineTo(6, px - 6); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 3.5; g.beginPath(); g.moveTo(6, 6); g.lineTo(px - 6, px - 6); g.moveTo(px - 6, 6); g.lineTo(6, px - 6); g.stroke();
  }
  return g.getImageData(0, 0, px, px);
}

export function createBattle(map: maplibregl.Map, opts: { palette: Record<string, string>; before?: () => string | undefined; onSelect: (sel: string) => void }) {
  let board: BoardData | null = null, t = 0, frame: Frame | null = null;
  let raf = 0, last = 0, holdUntil = 0, isPlaying = false;
  const frameFns = new Set<(t: number, f: Frame) => void>();
  const phaseFns = new Set<(i: number, p: BoardPhase) => void>();
  const quoteFns = new Set<(q: BoardQuote | null) => void>();

  function ensure() {
    if (map.getSource('battle-units')) return;
    const before = opts.before?.();
    for (const id of ['battle-units', 'battle-arrows', 'battle-marks']) map.addSource(id, { type: 'geojson', data: EMPTY as any, promoteId: 'id' });
    if (!map.hasImage('battle-head')) map.addImage('battle-head', icon('head'), { pixelRatio: 2 });
    if (!map.hasImage('battle-clash')) map.addImage('battle-clash', icon('clash'), { pixelRatio: 2 });
    map.addLayer({ id: 'battle-arrow', type: 'line', source: 'battle-arrows', filter: ['==', ['get', 'kind'], 'arrow'], layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 13, 10], 'line-opacity': 0.5 } }, before);
    map.addLayer({ id: 'battle-head', type: 'symbol', source: 'battle-arrows', filter: ['==', ['get', 'kind'], 'head'],
      layout: { 'icon-image': 'battle-head', 'icon-rotate': ['get', 'bearing'], 'icon-rotation-alignment': 'map', 'icon-size': 0.9, 'icon-allow-overlap': true }, paint: { 'icon-opacity': 0.75 } }, before);
    map.addLayer({ id: 'battle-body', type: 'fill', source: 'battle-units', filter: ['==', ['get', 'kind'], 'body'], paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['*', 0.85, ['get', 'opacity']] } }, before);
    map.addLayer({ id: 'battle-body-line', type: 'line', source: 'battle-units', filter: ['==', ['get', 'kind'], 'body'], paint: { 'line-color': INK, 'line-width': 1.2, 'line-opacity': ['get', 'opacity'] } }, before);
    map.addLayer({ id: 'battle-front', type: 'fill', source: 'battle-units', filter: ['==', ['get', 'kind'], 'front'], paint: { 'fill-color': INK, 'fill-opacity': ['*', 0.55, ['get', 'opacity']] } }, before);
    map.addLayer({ id: 'battle-clash', type: 'symbol', source: 'battle-marks', layout: { 'icon-image': 'battle-clash', 'icon-size': 0.8, 'icon-allow-overlap': true, 'text-field': ['get', 'label'], 'text-font': ['KlokanTech Noto Sans CJK Regular'], 'text-size': 11, 'text-offset': [0, 1.4], 'text-anchor': 'top' },
      paint: { 'text-color': INK, 'text-halo-color': PAPER, 'text-halo-width': 1.4 } }, before);
    map.addLayer({ id: 'battle-label', type: 'symbol', source: 'battle-units', filter: ['==', ['get', 'kind'], 'label'], minzoom: 10,
      layout: { 'text-field': ['get', 'label'], 'text-font': ['KlokanTech Noto Sans CJK Regular'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-allow-overlap': true, 'text-ignore-placement': false },
      paint: { 'text-color': INK, 'text-halo-color': PAPER, 'text-halo-width': 1.4, 'text-opacity': ['get', 'opacity'] } }, before);
    map.on('zoomend', () => { if (board && !isPlaying) render(); });   // 블록 최소 픽셀 크기는 줌에 따라 미터가 달라진다
    map.on('click', 'battle-body', e => { const f = e.features?.[0]; if (f && board) opts.onSelect(`unit:${board.id}:${f.properties?.id}`); });
    map.on('mouseenter', 'battle-body', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'battle-body', () => (map.getCanvas().style.cursor = ''));
  }
  function render() {
    if (!board) {
      for (const id of ['battle-units', 'battle-arrows', 'battle-marks']) (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY as any);
      frame = null; return;
    }
    ensure();
    frame = interpolate(board, t);
    const g = battleGeoJSON(frame, opts.palette, board.id, map.getZoom());
    (map.getSource('battle-units') as maplibregl.GeoJSONSource).setData(g.units as any);
    (map.getSource('battle-arrows') as maplibregl.GeoJSONSource).setData(g.arrows as any);
    (map.getSource('battle-marks') as maplibregl.GeoJSONSource).setData(g.marks as any);
    frameFns.forEach(fn => fn(t, frame!));
  }
  function step(now: number) {
    if (!isPlaying || !board) return;
    if (now < holdUntil) { last = now; raf = requestAnimationFrame(step); return; }
    const end = board.phases.length - 1, before = Math.floor(t);
    t = Math.min(end, t + (now - last) / PHASE_MS); last = now;
    const after = Math.floor(t);
    if (after > before) {                        // 페이즈 경계를 넘었다
      t = after;                                 // 경계에 정확히 세운다(캡션·URL이 정수 페이즈를 본다)
      const p = board.phases[after];
      phaseFns.forEach(fn => fn(after, p));
      if (p.quote) { holdUntil = now + QUOTE_MS; quoteFns.forEach(fn => fn(p.quote!)); setTimeout(() => quoteFns.forEach(fn => fn(null)), QUOTE_MS); }
    }
    render();
    if (t >= end) { isPlaying = false; frameFns.forEach(fn => fn(t, frame!)); return; }
    raf = requestAnimationFrame(step);
  }
  const ctl = {
    setBoard(b: BoardData | null, phase = 0) { ctl.pause(); board = b; t = b ? Math.min(Math.max(phase, 0), b.phases.length - 1) : 0; render(); },
    seek(x: number) { if (!board) return; ctl.pause(); t = Math.min(Math.max(x, 0), board.phases.length - 1); render(); },
    play() { if (!board || isPlaying) return; if (t >= board.phases.length - 1) t = 0; isPlaying = true; last = performance.now(); holdUntil = 0; raf = requestAnimationFrame(step); frameFns.forEach(fn => frame && fn(t, frame)); },
    pause() { const was = isPlaying; isPlaying = false; cancelAnimationFrame(raf); if (was && frame) frameFns.forEach(fn => fn(t, frame!)); },
    playing: () => isPlaying, t: () => t, frame: () => frame, board: () => board,
    unitAt: (id: string): LonLat | null => frame?.units.find(u => u.id === id)?.at ?? null,
    onFrame(fn: (t: number, f: Frame) => void) { frameFns.add(fn); return () => frameFns.delete(fn); },
    onPhase(fn: (i: number, p: BoardPhase) => void) { phaseFns.add(fn); return () => phaseFns.delete(fn); },
    onQuote(fn: (q: BoardQuote | null) => void) { quoteFns.add(fn); return () => quoteFns.delete(fn); },
    /** setStyle이 소스를 지운 뒤: 같은 말판을 다시 얹는다. */
    refresh() { if (board) { const b = board, tt = t; board = null; render(); board = b; t = tt; render(); } },
    destroy() { ctl.pause(); board = null; render(); },
  };
  return ctl;
}
export type BattleCtl = ReturnType<typeof createBattle>;
