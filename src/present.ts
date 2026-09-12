// 발표 모드 — 같은 group의 장면을 [ ] 로 넘긴다. 연도 화살표와 키를 안 싸운다.
import type { Scene } from './state';

export const PRESENT_GROUP = '2회차 발표 · 카이사르 팩';

export function scenesInGroup(scenes: Scene[], group: string): Scene[] {
  return scenes.filter(s => (s.group ?? '장면') === group);
}

export function stepScene(scenes: Scene[], currentId: string | null, dir: -1 | 1): Scene | null {
  if (!scenes.length) return null;
  const i = Math.max(0, scenes.findIndex(s => s.id === currentId));
  const next = scenes[(i + dir + scenes.length) % scenes.length];
  return next ?? null;
}

export function presentGroupOf(scenes: Scene[], currentId: string | null): string {
  const cur = scenes.find(s => s.id === currentId);
  return cur?.group ?? PRESENT_GROUP;
}
