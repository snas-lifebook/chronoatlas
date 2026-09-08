// 관계 그래프 패널(P1, 옵시디언 로컬 그래프식): 선택 객체의 1/2홉을 force 레이아웃으로. 지도 오버레이(엔진)는 좌표 있는 이웃 선만 그린다 — 하이브리드.
// ponytail: d3-force 대신 60줄 시뮬레이션(반발·스프링·중심 인력). 노드 ≤ ~60이라 O(n²) 충분. 라이브러리는 200 노드 넘을 때.
import { useEffect, useRef, useState } from 'react';
import { Card, Text, SegmentedControl, SegmentedControlItem } from '@astryxdesign/core';
import { neighborsOf, type Graph } from '../graph/data';
import { GROUP_COLOR } from '../map/engine';

interface N { id: string; name: string; hop: 0 | 1 | 2; x: number; y: number; vx: number; vy: number; fixed?: boolean }
interface E { a: number; b: number; color: string; low: boolean }

// 선택 + 1홉 + (2홉: 이웃의 이웃, 부모당 상한 → 총 ~48). 같은 노드는 한 번만.
export function localGraph(g: Graph, sel: string, year: number, hops: 1 | 2): { nodes: Omit<N, 'x' | 'y' | 'vx' | 'vy'>[]; edges: { a: string; b: string; group: string; low: boolean }[] } {
  const nodes = new Map<string, 0 | 1 | 2>([[sel, 0]]);
  const edges: { a: string; b: string; group: string; low: boolean }[] = [];
  const n1 = neighborsOf(g, sel, year);
  for (const n of n1) { if (!nodes.has(n.node.id)) nodes.set(n.node.id, 1); edges.push({ a: sel, b: n.node.id, group: n.group, low: n.link.confidence === 'low' }); }
  if (hops === 2) {
    const cap = Math.max(2, Math.ceil(48 / Math.max(n1.length, 1)));
    for (const n of n1) {
      let k = 0;
      for (const m of neighborsOf(g, n.node.id, year)) {
        if (m.node.id === sel) continue;
        if (!nodes.has(m.node.id)) { if (k >= cap) continue; nodes.set(m.node.id, 2); k++; }
        edges.push({ a: n.node.id, b: m.node.id, group: m.group, low: m.link.confidence === 'low' });
      }
    }
  }
  return { nodes: [...nodes].map(([id, hop]) => ({ id, name: g.nodes.get(id)?.name ?? id, hop })), edges };
}

export function GraphPanel({ graph, sel, year, onSelect, onHover }: { graph: Graph; sel: string; year: number; onSelect: (id: string) => void; onHover: (id: string | null) => void }) {
  const [hops, setHops] = useState<1 | 2>(1);
  const ref = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const canvas = ref.current; if (!canvas || !open) return;
    const ctx = canvas.getContext('2d')!;
    const { nodes: ns, edges: es } = localGraph(graph, sel, year, hops);
    setCount(ns.length - 1);
    // 숨긴 채 마운트되면 clientWidth가 0 — 크기가 생기면 다시 잡는다(setSize)
    let W = canvas.clientWidth || 328, H = canvas.clientHeight || 200; const dpr = devicePixelRatio || 1;
    const setSize = () => { W = canvas.clientWidth || W; H = canvas.clientHeight || H; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); alpha = Math.max(alpha, 0.3); };
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.scale(dpr, dpr);
    // 초기 배치: 선택은 중심 고정, 1홉은 안쪽 링, 2홉은 바깥 링(각도 흩뿌림) — force가 다듬는다
    const nodes: N[] = ns.map((n, i) => { const t = (i * 2.399) % (2 * Math.PI), r = n.hop === 0 ? 0 : n.hop === 1 ? 60 : 110; return { ...n, x: W / 2 + r * Math.cos(t), y: H / 2 + r * Math.sin(t), vx: 0, vy: 0, fixed: n.hop === 0 }; });
    const idx = new Map(nodes.map((n, i) => [n.id, i]));
    const edges: E[] = es.map(e => ({ a: idx.get(e.a)!, b: idx.get(e.b)!, color: GROUP_COLOR[e.group] ?? GROUP_COLOR.other, low: e.low }));
    const css = getComputedStyle(canvas);
    const col = { text: css.getPropertyValue('--color-text-primary').trim() || '#111', muted: css.getPropertyValue('--color-text-secondary').trim() || '#777', bg: css.getPropertyValue('--color-bg-primary').trim() || '#fff' };
    let alpha = 1, hover = -1, drag = -1, raf = 0;

    const tick = () => {
      for (const n of nodes) { if (n.fixed) continue; n.vx += (W / 2 - n.x) * 0.004; n.vy += (H / 2 - n.y) * 0.004; } // 중심 인력
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { // 반발
        const a = nodes[i], b = nodes[j]; let dx = b.x - a.x, dy = b.y - a.y; const d2 = Math.max(dx * dx + dy * dy, 25); const f = 900 / d2; dx *= f / Math.sqrt(d2); dy *= f / Math.sqrt(d2);
        if (!a.fixed) { a.vx -= dx; a.vy -= dy; } if (!b.fixed) { b.vx += dx; b.vy += dy; }
      }
      for (const e of edges) { // 스프링(2홉은 짧게)
        const a = nodes[e.a], b = nodes[e.b]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, rest = b.hop === 2 || a.hop === 2 ? 46 : Math.min(110, 50 + nodes.length * 1.2), f = (d - rest) * 0.02;
        if (!a.fixed) { a.vx += dx / d * f; a.vy += dy / d * f; } if (!b.fixed) { b.vx -= dx / d * f; b.vy -= dy / d * f; }
      }
      for (const n of nodes) { if (n.fixed) continue; n.vx *= 0.6; n.vy *= 0.6; n.x = Math.min(W - 8, Math.max(8, n.x + n.vx * alpha)); n.y = Math.min(H - 8, Math.max(8, n.y + n.vy * alpha)); }
      alpha *= 0.97;
    };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const near = new Set<number>(); if (hover >= 0) { near.add(hover); for (const e of edges) { if (e.a === hover) near.add(e.b); if (e.b === hover) near.add(e.a); } }
      for (const e of edges) {
        const a = nodes[e.a], b = nodes[e.b]; const dim = hover >= 0 && !(e.a === hover || e.b === hover);
        ctx.strokeStyle = e.color; ctx.globalAlpha = dim ? 0.12 : (b.hop === 2 || a.hop === 2 ? 0.5 : 0.85); ctx.lineWidth = b.hop === 2 || a.hop === 2 ? 1 : 1.5; ctx.setLineDash(e.low ? [3, 3] : []);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.font = '11px ' + (css.fontFamily || 'sans-serif'); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]; const r = n.hop === 0 ? 7 : n.hop === 1 ? 4.5 : 3; const dim = hover >= 0 && !near.has(i);
        ctx.globalAlpha = dim ? 0.25 : 1;
        ctx.fillStyle = n.hop === 2 ? col.muted : col.text; ctx.beginPath(); ctx.arc(n.x, n.y, r + (i === hover ? 1.5 : 0), 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = col.bg; ctx.lineWidth = 1.5; ctx.stroke();
        if (n.hop < 2 || i === hover || near.has(i) || nodes.length <= 24) {
          ctx.fillStyle = col.bg; ctx.globalAlpha = dim ? 0.2 : 0.75; const w = ctx.measureText(n.name).width; ctx.fillRect(n.x - w / 2 - 2, n.y + r + 2, w + 4, 13);
          ctx.globalAlpha = dim ? 0.25 : 1; ctx.fillStyle = n.hop === 2 ? col.muted : col.text; ctx.fillText(n.name, n.x, n.y + r + 3);
        }
      }
      ctx.globalAlpha = 1;
    };
    const loop = () => { if (alpha > 0.02 || drag >= 0) tick(); draw(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => { if (canvas.clientWidth && canvas.clientWidth * dpr !== canvas.width) setSize(); }); ro.observe(canvas);

    const at = (ev: PointerEvent) => { const r = canvas.getBoundingClientRect(); const x = ev.clientX - r.left, y = ev.clientY - r.top; let best = -1, bd = 12 * 12; nodes.forEach((n, i) => { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = i; } }); return { x, y, i: best }; };
    let moved = false;
    const onMove = (ev: PointerEvent) => { const p = at(ev); if (drag >= 0) { nodes[drag].x = p.x; nodes[drag].y = p.y; moved = true; alpha = Math.max(alpha, 0.3); return; } if (p.i !== hover) { hover = p.i; canvas.style.cursor = hover >= 0 ? 'pointer' : ''; onHover(hover >= 0 ? nodes[hover].id : null); } };
    const onDown = (ev: PointerEvent) => { const p = at(ev); if (p.i >= 0) { drag = p.i; moved = false; nodes[p.i].fixed = true; canvas.setPointerCapture(ev.pointerId); } };
    const onUp = () => { if (drag >= 0) { const n = nodes[drag]; if (!moved && n.hop > 0) onSelect(n.id); n.fixed = n.hop === 0; drag = -1; } };
    const onLeave = () => { if (hover >= 0) { hover = -1; onHover(null); } };
    canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointerleave', onLeave);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointerleave', onLeave); };
  }, [graph, sel, year, hops, open]);

  return (
    <Card padding={4} elevation="low" className="shell-graph">
      <div className="ins-head">
        <button type="button" className="shell-graph-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}><Text size="sm" color="secondary">{open ? '▾' : '▸'} 관계 그래프 · {count}</Text></button>
        {open && <SegmentedControl label="깊이" value={String(hops)} onChange={v => setHops(Number(v) as 1 | 2)} size="sm">
          <SegmentedControlItem value="1" label="1홉" />
          <SegmentedControlItem value="2" label="2홉" />
        </SegmentedControl>}
      </div>
      {open && <canvas ref={ref} className="shell-graph-canvas" aria-label="관계 그래프" />}
    </Card>
  );
}
