// 이동 경로를 읽히게 만든다. 순수 함수만 — 지도는 이 산출물을 그리기만 한다.
//
// 무엇이 문제였나. River: **"이동 경로가 그냥 쭉 이어진 직선이라 뭔가 시야에 방해되기도
// 한다. 조금 연할 필요가 있고 이 이동경로 UX설계를 다시 해야 할 것 같다."**
//
// 실물을 재어 보면 그 말이 정확하다. 정본 movements는 카이사르 9구간 + 교보재 폼페이우스
// 4구간, 전부 **정점 두 개짜리 직선**이다. 그걸 `line-opacity: 0.92`에 세력색으로 깔면
// 기원전 48년 판에서 알레시아→루비콘→브린디시→일레르다→디르하키움→파르살루스가 한꺼번에
// 지중해를 가로지른다. 색과 굵기가 territory-outline과 같아서 **국경으로 읽히기까지 한다.**
//
// 고치는 축은 셋이다.
//
// 1. **휜다.** 직선은 지도에서 「경계」로 읽히고 곡선은 「자취」로 읽힌다. 두 점 사이를
//    수직으로 밀어 2차 베지에로 샘플링한다. 미는 방향은 id 해시로 정해 **매 렌더 같다** —
//    난수면 스타일을 다시 얹을 때마다 경로가 춤춘다.
// 2. **연해진다.** 지난 구간일수록 옅게. 지금 해의 구간이 제일 진하다. 그래서 선이
//    「어디를 지나왔나」가 아니라 「지금 어디로 가고 있나」를 먼저 말한다.
// 3. **방향이 생긴다.** 화살표는 engine이 심볼로 얹는다. 여기서는 좌표만 만든다 —
//    MapLibre의 symbol-placement: 'line'이 선의 진행 방향을 그대로 따르므로,
//    좌표 순서가 곧 화살표 방향이다. **출발점 → 도착점 순서를 뒤집지 않는다.**

export interface MoveProps {
  id?: string;
  from_year?: number | null;
  to_year?: number | null;
  valid_from?: number | null;
  [k: string]: unknown;
}
export interface MoveFeature {
  type: 'Feature';
  properties: MoveProps;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
}

/** 문자열 → 작은 정수. 부호를 정하는 데만 쓴다(djb2). */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h;
}

/** 두 점을 잇는 활. `bow`는 현 길이 대비 부푸는 비율이다.
 *
 *  0.12는 눈대중이 아니라 제약에서 나왔다 — 지중해 판(z4.2)에서 제일 긴 구간이
 *  일레르다→디르하키움 약 20°이고, 0.12면 중간이 2.4° ≈ 260km 밀린다. 그 정도면
 *  직선으로 안 읽히면서 육지를 크게 침범하지도 않는다. 더 부풀리면 이탈리아를 관통한다. */
export function arc(a: [number, number], b: [number, number], bow = 0.12, steps = 24): [number, number][] {
  const [ax, ay] = a, [bx, by] = b;
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9 || steps < 2) return [a, b];
  // 중점에서 수직으로 민 제어점. 위도 압축은 무시한다 — 이건 지리가 아니라 표현이다.
  const cx = (ax + bx) / 2 - dy * bow;
  const cy = (ay + by) / 2 + dx * bow;
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push([u * u * ax + 2 * u * t * cx + t * t * bx,
              u * u * ay + 2 * u * t * cy + t * t * by]);
  }
  return out;
}

/** 그 구간이 끝난 해. 없으면 valid_from, 그것도 없으면 null. */
export function legYear(p: MoveProps): number | null {
  const v = p.to_year ?? p.valid_from;
  return typeof v === 'number' ? v : null;
}

/** 0(지금) ~ 1(아주 오래전). 연도를 모르면 1 — 모르는 것은 조용히 둔다. */
export function legAge(p: MoveProps, year: number, span = 8): number {
  const y = legYear(p);
  if (y == null) return 1;
  return Math.max(0, Math.min(1, (year - y) / span));
}

/** 직선 구간을 활로 바꾼다. 정점이 셋 이상이면 이미 경로 모양이라 그대로 둔다 —
 *  휘어 놓으면 실제 행군로(있는 경우)를 왜곡한다. */
export function curveMovements(features: MoveFeature[], bow = 0.12): MoveFeature[] {
  return features.map(f => {
    const c = f.geometry?.coordinates;
    if (!Array.isArray(c) || c.length !== 2) return f;
    const sign = hash(String(f.properties?.id ?? '')) % 2 === 0 ? 1 : -1;
    return { ...f, geometry: { ...f.geometry, coordinates: arc(c[0], c[1], bow * sign) } };
  });
}
