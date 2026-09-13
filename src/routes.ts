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
  route?: string;
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

// ── 국면(여정)별 색과 순번 ────────────────────────────────────────────────
//
// River: **"이동경로에 순번과 함께 각 여정에 다른 색깔의 선을 칠해주면 좋겠다."**
// 레퍼런스로 준 지도(Caesar's Civil War Campaigns)가 정확히 그 문법이다 — 전 구간을
// 한 색으로 긋지 않고 **원정 단위로 색을 갈라** 범례에 연도를 적는다(49 B.C. / 49–47 /
// 46 / 45 + "Caesar's return from Gaul" 별색).
//
// 왜 한 색이 문제였나. 정본 카이사르 경로는 아홉 구간인데 전부 `actor: 로마`라 **같은
// 로마색 한 줄**로 깔렸다. 폼페이우스 교보재 네 구간도 같은 actor라 색이 겹쳤다 —
// 기원전 48년 판에서 쫓는 선과 쫓기는 선이 구별되지 않는다. 세력색은 「누구 편인가」를
// 말하고, 여정색은 「언제 어디로 갔나」를 말한다. 이 지도에 필요한 건 후자다.
//
// 국면은 **끝난 해로** 가른다. 첫 구간만 예외다 — 기원전 52년에 시작해 49년에 끝나는
// 세 해짜리 구간이라 「BC 49」에 묶으면 브린디시·일레르다와 한 색이 되어 갈리아에서
// 돌아오는 그 이동이 안 보인다. 레퍼런스도 이것만 별색으로 뺐다.
export interface RoutePhase { id: string; label: string; color: string }

/** 표시 순서가 곧 범례 순서다. */
export const ROUTE_PHASES: RoutePhase[] = [
  { id: 'return', label: '갈리아에서 귀환 · BC 52–49', color: '#7B3F3F' },
  { id: 'bc49', label: 'BC 49 이탈리아·에스파냐', color: '#2F7D5B' },
  { id: 'bc48', label: 'BC 48 그리스', color: '#2E6F9E' },
  { id: 'bc47', label: 'BC 47 이집트·동방', color: '#1E8A8A' },
  { id: 'bc46', label: 'BC 46 아프리카', color: '#C46A1B' },
  { id: 'bc45', label: 'BC 45 에스파냐', color: '#7A4FA0' },
  { id: 'pompey', label: '폼페이우스의 도피 · BC 49–48', color: '#5C6B7A' },
  { id: 'other', label: '그 밖의 이동', color: '#8A8F98' },
];
const PHASE_BY_ID = new Map(ROUTE_PHASES.map(p => [p.id, p]));

/** 구간 → 국면 id. 모르면 'other' — 없는 국면을 발명하지 않는다. */
export function legPhase(p: MoveProps): string {
  if (p.route === 'pompey') return 'pompey';
  const from = typeof p.from_year === 'number' ? p.from_year : null;
  const to = legYear(p);
  if (from != null && to != null && from <= -52 && to >= -50) return 'return';
  if (to == null) return 'other';
  return PHASE_BY_ID.has(`bc${-to}`) ? `bc${-to}` : 'other';
}

export function phaseColor(id: string): string {
  return PHASE_BY_ID.get(id)?.color ?? '#8A8F98';
}

export function phaseLabel(id: string): string {
  return PHASE_BY_ID.get(id)?.label ?? '그 밖의 이동';
}

/** 범례 순서. 렌더된 피처에서 국면을 모을 때 순서가 화면 그리기 순서대로 섞이므로
 *  (실측: BC48 → BC49 → 귀환 → 폼페이우스 → BC47로 뒤죽박죽 찍혔다) 정렬 키를 같이 싣는다. */
export function phaseRank(id: string): number {
  const i = ROUTE_PHASES.findIndex(p => p.id === id);
  return i < 0 ? ROUTE_PHASES.length : i;
}

/** 순번·국면·국면색을 properties에 접어 넣는다. **좌표는 안 건드린다** — 휘는 것은
 *  curveMovements의 몫이고, 말이 밟는 원본은 어느 쪽도 손대지 않는다.
 *
 *  순번은 route 안에서 1부터다. 정본 geojson이 이미 여정 순서대로 들어 있고(`caesar@0`…
 *  `caesar@8`) 폼페이우스 교보재도 그렇다. 배열 순서를 믿는 대신 `from_year`로 다시 세우면
 *  같은 해에 두 구간이 있는 자리(브린디시·일레르다 둘 다 BC 49)에서 순서가 흔들린다. */
export function annotateLegs(features: MoveFeature[]): MoveFeature[] {
  const seen = new Map<string, number>();
  return features.map(f => {
    const p = f.properties ?? {};
    const route = String(p.route ?? 'other');
    const seq = (seen.get(route) ?? 0) + 1;
    seen.set(route, seq);
    const phase = legPhase(p);
    return { ...f, properties: { ...p, seq, phase, phaseColor: phaseColor(phase), phaseLabel: phaseLabel(phase), phaseRank: phaseRank(phase) } };
  });
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
