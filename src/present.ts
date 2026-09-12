// 발표 모드 — 같은 group의 장면을 [ ] 로 넘긴다. 연도 화살표와 키를 안 싸운다.
import type { Scene } from './state';

export const PRESENT_GROUP = '2회차 발표 · 카이사르 팩';
export const GALLIA_SCENE = 'pack-extent-60';
export const GALLIA_ROMAN_SCENE = 'pack-extent-51';

/** 갈리아 교보재는 판도 BC60 장면에만. 다른 해에 얹으면 Cliopatria 위를 덮어 영역이 깨진다. */
export function showGalliaOverlay(scene: string | null, year: number): boolean {
  return scene === GALLIA_SCENE && year < -51;
}

/** 같은 폴리곤을 로마색으로. 판도 BC51 장면에만.
 *
 * Cliopatria 영토 스냅샷이 100년 버킷이라 기원전 60년과 51년이 같은 칸에 떨어진다 —
 * 실측으로 두 판이 **바이트까지 같았다**(md5 f88797a9…). 3·4번은 겹쳐 보여 주는 비교
 * 두 컷이 존재 이유라 같은 그림이면 장이 둘 다 죽는다. 그래서 BC60은 갈리아를 초록
 * 점선(로마 밖)으로, BC51은 **같은 폴리곤**을 로마색으로 칠해 원정의 결과를 보인다.
 *
 * 폴리곤을 새로 만들지 않고 `gallia-free` 소스를 그대로 쓰는 것이 요점이다. 두 장이
 * 기하학적으로 동일함이 보장되므로 색 말고는 아무것도 안 달라진다. */
export function showGalliaRoman(scene: string | null, year: number): boolean {
  return scene === GALLIA_ROMAN_SCENE && year >= -51;
}

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
