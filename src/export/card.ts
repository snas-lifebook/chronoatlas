// 카드 내보내기(TASKS 3.3): 1080×1350 인물·사건 카드. Canvas 2D만 — 의존성 0. 스킨은 P1(export/skins).
import type { GNode, Neighbor } from '../graph/data';
import { REL_LABEL } from '../graph/data';

export const CARD = { w: 1080, h: 1350, pad: 72 } as const;
const fmt = (y: number) => (y < 0 ? `BC ${-y}` : `AD ${y}`);
const loadImg = (src: string) => new Promise<HTMLImageElement | null>(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const out: string[] = []; let line = '';
  for (const ch of text) { if (g.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; if (out.length === maxLines) return out; } else line += ch; }
  if (line && out.length < maxLines) out.push(line);
  return out;
}

export async function renderCard(node: GNode, opt: { year: number; state: Record<string, unknown>; stateLabels: Record<string, string>; neighbors: Neighbor[]; ringColor: string; root: string; dark?: boolean; mapCanvas?: HTMLCanvasElement | null }): Promise<Blob> {
  const { w, h, pad } = CARD;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  const bg = opt.dark ? '#1B2129' : '#F1F4F7', surface = opt.dark ? '#2A2E33' : '#FFFFFF', ink = opt.dark ? '#E6E8EB' : '#111418', ink2 = opt.dark ? '#9AA3AE' : '#7C8794', line = opt.dark ? '#3A3F45' : '#E3E7EB';
  const font = (wgt: number, px: number) => `${wgt} ${px}px Pretendard, system-ui, sans-serif`;
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // 지도 썸네일(있으면) 상단 밴드
  let y = pad;
  if (opt.mapCanvas) { const th = 420; g.save(); g.beginPath(); g.roundRect(pad, y, w - pad * 2, th, 24); g.clip();
    const sw = opt.mapCanvas.width, sh = opt.mapCanvas.height, r = Math.max((w - pad * 2) / sw, th / sh);
    g.drawImage(opt.mapCanvas, pad + ((w - pad * 2) - sw * r) / 2, y + (th - sh * r) / 2, sw * r, sh * r); g.restore(); y += th + 40; }
  // 초상 + 이름
  const R = 84, cx = pad + R, cy = y + R;
  g.beginPath(); g.arc(cx, cy, R + 6, 0, Math.PI * 2); g.fillStyle = opt.ringColor; g.fill();
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = surface; g.fill();
  const img = node.asset ? await loadImg(`${opt.root}${node.asset}`) : null;
  if (img) { g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip(); g.drawImage(img, cx - R, cy - R, R * 2, R * 2); g.restore(); }
  else { g.fillStyle = ink2; g.font = font(600, 56); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(node.name.slice(0, 1), cx, cy); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; }
  const tx = cx + R + 36;
  g.fillStyle = ink2; g.font = font(500, 22); g.fillText(({ person: '인물', place: '장소', event: '사건', group: '집단', institution: '제도' } as any)[node.type] ?? node.type, tx, cy - 48);
  g.fillStyle = ink; g.font = font(700, 60); g.fillText(node.name, tx, cy + 18);
  const yr = node.type === 'person' && node.born != null ? `${fmt(node.born)} – ${node.died != null ? fmt(node.died) : '?'}` : node.year != null ? fmt(node.year) : '';
  if (yr) { g.fillStyle = ink2; g.font = font(500, 26); g.fillText(yr, tx, cy + 62); }
  y = cy + R + 48;
  g.strokeStyle = line; g.lineWidth = 2; g.beginPath(); g.moveTo(pad, y); g.lineTo(w - pad, y); g.stroke(); y += 44;
  // 그 해의 상태
  const rows = Object.entries(opt.state).filter(([k, v]) => v != null && v !== '' && opt.stateLabels[k]).slice(0, 4);
  if (rows.length) { g.fillStyle = ink2; g.font = font(600, 20); g.fillText(`${fmt(opt.year)}의 상태`.toUpperCase(), pad, y); y += 36;
    for (const [k, v] of rows) { g.fillStyle = ink2; g.font = font(500, 26); g.fillText(opt.stateLabels[k], pad, y); g.fillStyle = ink; g.fillText(String(v), pad + 220, y); y += 42; } y += 20; }
  // 설명
  if (node.desc) { g.fillStyle = ink; g.font = font(400, 28); for (const l of wrap(g, node.desc, w - pad * 2, 4)) { g.fillText(l, pad, y); y += 42; } y += 24; }
  // 관계 상위 6
  const rel = opt.neighbors.slice(0, 6);
  if (rel.length) { g.fillStyle = ink2; g.font = font(600, 20); g.fillText(`관계 ${opt.neighbors.length}`, pad, y); y += 36;
    for (const n of rel) { if (y > h - pad - 56) break; g.fillStyle = ink; g.font = font(500, 26); g.fillText(n.node.name, pad, y); g.fillStyle = ink2; g.font = font(400, 24); g.textAlign = 'right';
      g.fillText(`${REL_LABEL[n.rel] ?? n.rel}${n.link.from_year != null ? ` · ${fmt(n.link.from_year)}` : ''}`, w - pad, y); g.textAlign = 'left'; y += 40; } }
  // 하단 크레딧
  g.fillStyle = ink2; g.font = font(400, 20); g.fillText('크로노아틀라스 · 산스 인생책 로마쇠망사 · 정본 온톨로지', pad, h - pad + 8);
  g.textAlign = 'right'; g.fillText(fmt(opt.year), w - pad, h - pad + 8); g.textAlign = 'left';
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/png'));
}
