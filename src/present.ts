// 발표 모드 — 같은 group의 장면을 [ ] 로 넘긴다. 연도 화살표와 키를 안 싸운다.
import type { Scene } from './state';

export const PRESENT_GROUP = '2회차 발표 · 카이사르 팩';
/** 자유 갈리아 교보재를 켜는 대표 장면. 예전에는 전용 장면(`pack-extent-60`)이 있었는데
 *  `pack-intro-med`와 같은 그림이라 뺐다 — 이제 첫 장이 그 역할을 겸한다. */
export const GALLIA_SCENE = 'pack-intro-med';
export const GALLIA_ROMAN_SCENE = 'pack-extent-51';
export const ALESIA_SCENE = 'pack-alesia-52';

/** 알레시아 세부는 **줌으로** 켠다 — 장면 수는 아홉으로 묶여 있고(River), 세부는
 *  「거기로 들어가면 보인다」가 맞는 동작이다. 지중해 축척(z4.2)에서 켜면 점 하나로 뭉친다.
 *  z11이면 포위선 두 겹이 화면을 채운다. 장면으로 직접 점프해도 그 장면이 z12.4라 켜진다. */
export const ALESIA_MIN_ZOOM = 11;
export function showAlesia(scene: string | null, zoom = 0): boolean {
  return scene === ALESIA_SCENE || zoom >= ALESIA_MIN_ZOOM;
}

/** 로마 시내 미시 지도도 같은 규칙 — 「로마로 들어가면 보여지겠지」(River).
 *  포메리움·폼페이우스 회랑·일곱 언덕은 지중해 축척에서 점 하나다. */
export const ROMA_MIN_ZOOM = 12;
export function showRomaUrbs(zoom = 0): boolean {
  return zoom >= ROMA_MIN_ZOOM;
}

/** 알렉산드리아 미시 지도도 같은 규칙 — 줌으로 켠다. 파로스·헵타스타디온·왕궁 구역은
 *  지중해 축척에서 점 하나다. 로마와 같은 문턱을 쓴다. */
export const ALEXANDRIA_MIN_ZOOM = 12;
export function showAlexandria(zoom = 0): boolean {
  return zoom >= ALEXANDRIA_MIN_ZOOM;
}

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
