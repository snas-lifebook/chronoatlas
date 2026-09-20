// 발표 모드 — 같은 group의 장면을 [ ] 로 넘긴다. 연도 화살표와 키를 안 싸운다.
import type { Scene } from './state';

export const PRESENT_GROUP = '2회차 발표 · 카이사르 팩';
/** 세부(미시) 지도 장면들이 모여 있는 그룹.
 *
 *  본 발표 여덟 장과 **따로 둔다** — 여덟 장은 지중해 축척의 이야기 흐름이고 세부 지도는
 *  「거기로 들어가면 보이는」 것이라 같은 줄에 끼우면 흐름이 끊긴다. 대신 **넘어갈 수는
 *  있어야 한다**(River: "세부지도들도 깃허브 io에서 북마크 따라갈 수 있게 하라") —
 *  장면 단추가 두 그룹을 오가는 고리를 준다. */
export const DETAIL_GROUP = '세부 지도';
/** 자유 갈리아 교보재를 켜는 대표 장면. 예전에는 전용 장면(`pack-extent-60`)이 있었는데
 *  `pack-intro-med`와 같은 그림이라 뺐다 — 이제 첫 장이 그 역할을 겸한다. */
export const GALLIA_SCENE = 'pack-intro-med';
export const GALLIA_ROMAN_SCENE = 'pack-extent-51';
// 미시지도 문턱·표시 함수(showAlesia 등)는 2026-09-17에 레지스트리(src/micromaps.ts microMapAt)로 옮겼다.

/** 자유 갈리아 교보재를 켤 해.
 *
 *  예전에는 `pack-extent-60` 장면에만 켰다. 그래서 **갈리아 원정 장면(기원전 52년)에
 *  갈리아가 없었다** — 카이사르와 베르킹게토릭스가 흰 땅 위에 서 있고 화면 어디에도
 *  갈리아라는 면이 없다. River: "갈리아 영역이 제대로 되어 있지 않다."
 *
 *  진짜 원인은 정본에 있다. Cliopatria 영토(`layers/territory/-100.geojson`, 기원전
 *  100~1년을 한 칸에 담는 100년 버킷)에 **유럽 갈리아 폴리티가 아예 없다.** actor가
 *  '갈리아'인 것은 아나톨리아의 갈라티아 넷뿐이다 — 국가 단위 데이터셋이라 부족 연합인
 *  갈리아가 안 들어 있다. 그러다 기원전 50년 무렵부터 로마 피처 하나가 그 자리를 덮어
 *  분홍이 된다. 그래서 화면에서 갈리아는 「없다가 갑자기 로마」가 된다.
 *
 *  장면이 아니라 **연도로** 가른다. 자유 갈리아는 어느 장면에서 보든 기원전 51년까지
 *  자유 갈리아다. 정복 완료를 기원전 51년으로 잡는 것은 `showGalliaRoman`과 같은 기준이다. */
export function showGalliaOverlay(scene: string | null, year: number): boolean {
  return year < -51 && scene != null && scene.startsWith('pack-');
}

/** 같은 폴리곤을 로마색으로. 판도 BC51 장면에만.
 *
 * Cliopatria 영토 스냅샷이 100년 버킷이라 기원전 60년과 51년이 같은 칸에 떨어진다 —
 * 실측으로 두 판이 **바이트까지 같았다**(md5 f88797a9…). 3·4번은 겹쳐 보여 주는 비교
 * 두 컷이 존재 이유라 같은 그림이면 장이 둘 다 죽는다. 그래서 BC60은 갈리아를 초록
 * 점선(로마 밖)으로, BC51은 **같은 폴리곤**을 로마색으로 칠해 원정의 결과를 보인다.
 *
 * 폴리곤을 새로 만들지 않고 `gallia-free` 소스를 그대로 쓰는 것이 요점이다. 두 장이
 * 기하학적으로 동일함이 보장되므로 색 말고는 아무것도 안 달라진다.
 *
 * **기원전 50년에서 끊는다.** 정본을 재어 보면 `로마 공화정` 폴리곤이 그 해에 북쪽
 * 경계를 위도 46.2에서 52.1로 올리고 면적이 161만에서 222만 km²로 뛴다 — Cliopatria가
 * 갈리아 병합을 -50으로 찍은 것이다. 그 뒤로도 교보재를 얹으면 같은 땅이 두 겹이 된다.
 * 기원전 51년 한 해만 교보재가 메운다(정복 완료를 51년으로 보는 통설과 -50 스냅의 차). */
export function showGalliaRoman(scene: string | null, year: number): boolean {
  return year >= -51 && year < -50 && scene != null && scene.startsWith('pack-');
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

/** 발표 그룹인가. 카이사르 팩 하나뿐이던 것이 2026-09-21(R59)부터 포인트 묶음 그룹
 *  (「포인트 01·02 · …」·「포인트 03·04·05 · …」·「포인트 09·10·11 · …」)으로 늘었다.
 *  세부 지도·말판·내 북마크는 발표 흐름이 아니다 — 「↩ 발표」가 돌아갈 자리를 고를 때 쓴다. */
export function isPresentGroup(group: string): boolean {
  return group === PRESENT_GROUP || group.startsWith('포인트 ');
}

/** 장면 파일 순서대로의 발표 그룹 이름. 테스트가 그룹마다 연도 단조·설명·스킨을 검사한다. */
export function presentGroups(scenes: Scene[]): string[] {
  const out: string[] = [];
  for (const s of scenes) { const g = s.group ?? '장면'; if (isPresentGroup(g) && !out.includes(g)) out.push(g); }
  return out;
}

/** 좁은 화면에서 장면 줌을 내린다.
 *
 *  장면 카메라는 16:9 데스크톱 프레임(가로 1600px 기준)으로 잡혀 있다. 390px 폰에서
 *  같은 줌 4.2를 쓰면 **「지중해 판도」가 이탈리아만 보여 준다** — 실측으로 그랬다.
 *  가로 비율만큼 줌을 깎으면 담기는 경도 폭이 데스크톱과 같아진다(줌 1 = 폭 2배).
 *  지도 minZoom이 3이라 거기서 멈춘다. 넓은 화면에서는 아무것도 안 바꾼다. */
export function fitZoom(sceneZoom: number, width: number, minZoom = 3, ref = 1600): number {
  if (!(width > 0) || width >= ref) return sceneZoom;
  return Math.max(minZoom, Math.round((sceneZoom - Math.log2(ref / width)) * 100) / 100);
}
