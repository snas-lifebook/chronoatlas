// src/micromaps.ts: 미시지도 색인(가볍다, 초기 번들) + 지도별 지연 로더 + 어느 지도인가 판정 (OVERHAUL §3.1, R47).
// 지도 본문(피처·콜아웃·도판 정보)은 import()로만 온다. 초기 번들에 안 실린다(R46).
import type { MicroMapDef } from '../schema/micromap';
import index from '../data/micromaps/index.json';

export interface MicroHome { id: string; title: string; at: [number, number]; minZoom: number; span: number }
export const INDEX: MicroHome[] = index as MicroHome[];

const LOADERS = import.meta.glob<MicroMapDef>(['../data/micromaps/*.json', '!../data/micromaps/index.json'], { import: 'default' });
const cache = new Map<string, Promise<MicroMapDef>>();
export function loadMicro(id: string): Promise<MicroMapDef> {
  const f = LOADERS[`../data/micromaps/${id}.json`];
  if (!f) return Promise.reject(new Error(`미시지도 없음: ${id}`));
  if (!cache.has(id)) cache.set(id, f());
  return cache.get(id)!;
}

/** 지금 화면이 어느 미시지도인가. 줌이 문턱을 넘고 **그 지도 근처**여야 한다.
 *  줌만 보면 로마에서 z13으로 당겼을 때 알레시아 콜아웃이 같이 뜬다(MICROMAP-UX §3). */
export function microMapAt(zoom: number, center: [number, number]): string | null {
  let best: { id: string; d: number } | null = null;
  for (const h of INDEX) {
    if (zoom < h.minZoom) continue;
    const d = Math.hypot(center[0] - h.at[0], center[1] - h.at[1]);
    if (d > h.span) continue;
    if (!best || d < best.d) best = { id: h.id, d };
  }
  return best?.id ?? null;
}
