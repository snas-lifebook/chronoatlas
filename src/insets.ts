// src/insets.ts: 미시지도 없는 인셋(OVERHAUL §3.6b ③, R56). data/insets.json 한 줄 = 그 범위에서 인셋 DEM(Copernicus)·토지피복(WorldCover)이 켜진다.
// 굽기는 scripts/bake-dem.py inset <id> · bake-landcover.py <id>(같은 파일을 읽는다). 미시지도의 home은 이 목록에 없어도 자동으로 인셋이다(map/engine.ts createMicro onEnter).
import insets from '../data/insets.json';

export interface Inset { id: string; at: [number, number]; span: number; why: string; minzoom?: number; maxzoom?: number }
export const INSETS: Inset[] = insets as Inset[];

/** 지금 화면이 어느 인셋 안인가. 줌이 minzoom(기본 8) 이상이고 중심이 at ± span 안이면. 여럿이면 가장 가까운 것. */
export function insetAt(zoom: number, center: [number, number]): Inset | null {
  let best: { ins: Inset; d: number } | null = null;
  for (const ins of INSETS) {
    if (zoom < (ins.minzoom ?? 8)) continue;
    const dx = Math.abs(center[0] - ins.at[0]), dy = Math.abs(center[1] - ins.at[1]);
    if (dx > ins.span || dy > ins.span) continue;
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { ins, d };
  }
  return best?.ins ?? null;
}
