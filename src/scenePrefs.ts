// 장면 설정(레이어 패널 「장면」, River 2026-10-15). 발표자 취향이라 URL이 아니라 이 기기에 남긴다.
//   motion: 장면을 넘길 때 카메라가 날아가는 애니메이션. 끄면 슬라이드처럼 바로 바뀐다.
//   focus:  장면이 지목한 것을 강조한다(주인공 선택과 나머지 디밍, 강조면·강 강조). 끄면 장면이 아무것도 집지 않는다.
export type ScenePref = 'motion' | 'focus';
const read = (k: ScenePref) => { try { return localStorage.getItem(`ca.scene.${k}`) !== '0'; } catch { return true; } };
export const scenePrefs: Record<ScenePref, boolean> = { motion: read('motion'), focus: read('focus') };
export function setScenePref(k: ScenePref, v: boolean) {
  scenePrefs[k] = v;
  try { localStorage.setItem(`ca.scene.${k}`, v ? '1' : '0'); } catch { /* 사파리 사생활 모드 */ }
}
