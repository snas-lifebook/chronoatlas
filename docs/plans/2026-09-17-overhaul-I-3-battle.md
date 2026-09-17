# 전면 개선 슬라이스 I · 계획 3/4: 전투 재생 (말판 v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 미시지도에서 재생을 누르면 말판이 페이즈 사이를 움직인다. 부대는 A_공간지도 전투전술 문법의 블록, 기동은 반투명 곡선 화살표, 교전은 교차 검, 아래에 캡션 띠, 페이즈에 인용이 있으면 카드. 부대를 누르면 세부 카드, 콜아웃은 지형·부대·사건 칩으로 거른다. 고증은 스키마와 린트가 강제한다.

**Architecture:** `schema/board.ts`에 선택 필드만 더한다(기존 둘 무수정 통과). `src/board.ts`의 순수 함수 `interpolate`·`unitPolygon`·`arrowLine`이 프레임을 만들고, 지연 로드되는 `src/map/battle.ts`가 소스 셋에 `setData`로 그린다. 재생은 rAF 보간이지 시뮬레이션이 아니다. `BattleBar.tsx`가 컨트롤·캡션·인용을 맡는다.

**Tech Stack:** TypeScript · React 19 · MapLibre GL 6.3(fill·line·symbol, `addImage` 캔버스 아이콘) · zod 4(`schema/`) · vitest · Python(생성기·검증)

**Spec:** `docs/OVERHAUL.md` §3.2(말판 v2) · §3.3(3·4) · §3.6. 요구 원장 R54. 선행: 계획 1/4·2/4(레지스트리, 파르살루스·칸나이·알레시아 미시지도).

> **2026-09-17 실행 기록.** Task 4.1~4.4 됨(스키마 v2 · 보간 · `map/battle.ts` · `BattleBar.tsx` · 부대 카드 · 칩). 계획과 다른 점: 블록 최소 크기는 미터가 아니라 **26 px**로 줌마다 다시 잰다(`unitPolygon(..., minPx, zoom)`, z11에서 4 px가 나왔다). `onBattle`은 콜백의 반환값을 버리므로 프레임 구독 해제는 컴포넌트가 배열로 쥔다. 발표 모드에서 재생 바를 숨기던 CSS는 출처·눈금만 숨기게 바꿨다. 소수 t는 상태(URL `bt`)에 안 적는다(정수 페이즈만). Task 4.5(내용)도 됨: 화살표·교전은 데이터에선 「그 페이즈로 들어가는 기동」이고 `interpolate`가 사이 구간에 다음 페이즈의 것을 보여 블록과 같이 움직인다. 궤멸 유닛은 지우지 않고 `status: destroyed`로 제자리에 남겨 흐려지며 사라지게 했다(칸나이 로마 시민 기병, 파르살루스 궁수). 로마 진영별 병력은 사료에 없어 알레시아 말판 유닛에서 뺐다(정원 곱하기 금지, LEGIONS.md §2). `_alesia-strength.json`이 `import.meta.glob`에 잡히지 않게 `_*.json`을 제외했다. 교전 표식은 `text-optional`(없으면 이름표와 겹칠 때 심볼째 사라졌다). 전투 미시지도 셋은 `hide`에 `people`을 더했다(초상 토큰이 블록을 가린다). Task 4.6(문서 마무리)은 다음.

## Global Constraints

- 초기 JS ≤ 400 kB gz. 전투 렌더러는 `import()` 청크(≤ 40 kB gz).
- zod는 `schema/`에만. 말판은 `teaching: true`·`source` 강제, `src`·`confidence` 금지(기존 규칙).
- 페이즈마다 `caption`+`cite`. 화살표·교전은 사료가 말하는 곳에만. 병력은 사료 수치, 논쟁은 `source`와 첫 캡션에.
- 좌표를 손으로 찍지 않는다. 알레시아 말판은 미시지도 피처에서 **생성기**로 파생한다.
- 재생 1.5초/페이즈, 속도 조절 없음, 인용 카드 1.5초 정지, 끝에서 멈춤. 단축키 `P` 재생·정지, `.`·`,` 한 페이즈. 스페이스는 건드리지 않는다.
- `git add` 경로 명시. push는 River가 말할 때만. 카피는 한국어, 작대기·이모지 금지.
- 렌더 확인은 `bash scripts/serve.sh` + `python3 scripts/battle-frame.py <scene> <t>`.

---

## 모델링 (이 계획이 정하는 모델)

| 모델 | 정의 | 요지 |
|---|---|---|
| 말판 v2 | `schema/board.ts` | `Phase += caption cite quote arrows clashes` · `Unit += status path` · `Quote{text who cite}` · `Arrow{from to via actor kind}` · `Clash{at label}` |
| 프레임 | `src/board.ts` `interpolate(board, t) → Frame` | `t`는 실수 페이즈 좌표(0 ≤ t ≤ n−1). `Frame{ i frac phase next units arrows clashes caption cite quote }`, `units[].opacity`로 사라짐·패주 |
| 부대 블록 | `src/board.ts` `unitPolygon(u, front)` | 중심·향·병종·병력 → 회전 사각형(미터 → 도). 앞띠는 전면 30% |
| 기동 화살표 | `src/board.ts` `arrowLine(a)` | 2차 베지어 24점. `via` 없으면 왼쪽으로 25% 휨 |
| 선택 id | `unit:<board>:<unit>` | 인스펙터가 부대 카드를 그린다 |
| 콜아웃 부대 앵커 | `anchor.unit` | 현재 프레임의 유닛 위치. 없으면 그 콜아웃은 안 뜬다 |

---

### Task 4.1: 스키마 v2 와 린트

**Files:**
- Modify: `schema/board.ts`
- Test: `test/board.test.ts`

**Interfaces:**
- Produces: `Quote` `Arrow` `Clash` zod · `Unit.status`(기본 `active`) · `Unit.path` · `Phase.caption/cite/quote/arrows/clashes` · `lintBoard` 규칙 추가. 타입 `TArrow` `TClash` `TQuote`.

- [ ] **Step 1: 실패하는 테스트**

`test/board.test.ts` 끝에 추가.
```ts
describe('말판 v2 (OVERHAUL §3.2)', () => {
  const base = Board.parse(rd('data/boards/cannae-216.json'));
  it('v2 필드는 전부 선택이라 옛 파일이 그대로 통과한다', () => {
    expect(base.phases[0].units[0].status).toBe('active');
    expect(base.phases[0].arrows).toEqual([]);
  });
  it('caption 이 있으면 cite 가 있어야 한다', () => {
    const b = { ...raw, phases: raw.phases.map((p: any, i: number) => i ? p : { ...p, caption: '배치' }) };
    expect(lintBoard(Board.parse(b))).toContain('t0: caption이 있는데 cite가 없다');
  });
  it('유닛이 사라질 때 status 나 note 가 있어야 한다', () => {
    const b = { ...raw, phases: raw.phases.map((p: any, i: number) => ({ ...p, note: undefined, units: i === 2 ? p.units.slice(1) : p.units })) };
    expect(lintBoard(Board.parse(b)).some(e => e.includes('빠졌는데'))).toBe(true);
    const ok = { ...b, phases: b.phases.map((p: any, i: number) => i === 1 ? { ...p, units: p.units.map((u: any, k: number) => k === 0 ? { ...u, status: 'destroyed' } : u) } : p) };
    expect(lintBoard(Board.parse(ok)).some(e => e.includes('빠졌는데'))).toBe(false);
  });
  it('path 는 자기 위치에서 시작해 다음 페이즈 위치에서 끝난다', () => {
    const u0 = raw.phases[0].units[0], u1 = raw.phases[1].units.find((u: any) => u.id === u0.id);
    const bad = { ...raw, phases: raw.phases.map((p: any, i: number) => i ? p : { ...p, units: p.units.map((u: any) => u.id === u0.id ? { ...u, path: [[0, 0], u1.at] } : u) }) };
    expect(lintBoard(Board.parse(bad))).toContain(`t0 ${u0.id}: path 시작점이 at과 다르다`);
  });
  it('화살표 kind 는 셋뿐이고 인용은 cite 가 있어야 한다', () => {
    expect(() => Board.parse({ ...raw, phases: [{ ...raw.phases[0], arrows: [{ from: [0, 0], to: [1, 1], actor: '로마', kind: 'charge' }] }] })).toThrow();
    expect(() => Board.parse({ ...raw, phases: [{ ...raw.phases[0], quote: { text: 'x', who: 'y' } }] })).toThrow();
  });
});
```
Run: `npx vitest run test/board.test.ts` → FAIL.

- [ ] **Step 2: 스키마**

`schema/board.ts`에서 `Unit`·`Phase` 정의를 아래로 바꾸고(기존 필드는 그대로), `lintBoard`를 확장한다.
```ts
const LonLat = z.tuple([z.number(), z.number()]);
export const STATUS = ['active', 'routed', 'destroyed'] as const;
export const Quote = z.object({ text: z.string().min(1).max(200), who: z.string().min(1), cite: z.string().min(1) });
export const Arrow = z.object({ from: LonLat, to: LonLat, via: LonLat.nullable().optional(), actor: z.string().min(1), kind: z.enum(['advance', 'retreat', 'flank']) });
export const Clash = z.object({ at: LonLat, label: z.string().optional() });

export const Unit = z.object({
  id: z.string().min(1), at: LonLat, actor: z.string().min(1), arm: z.enum(ARMS), label: z.string().min(1),
  strength: z.number().int().positive().optional(), facing: z.number().min(0).max(360).optional(), entity: z.string().optional(),
  status: z.enum(STATUS).default('active'),          // v2. routed = 패주(반투명) · destroyed = 궤멸(사라짐)
  path: z.array(LonLat).min(2).nullable().optional(), // v2. 다음 페이즈까지 가는 길. 사료가 우회를 말할 때만
});
export const Phase = z.object({
  t: z.number().int().min(0), title: z.string().min(1), note: z.string().optional(), units: z.array(Unit).min(1),
  caption: z.string().min(1).max(160).optional(),   // v2. 캡션 띠
  cite: z.string().min(1).optional(),                // v2. 캡션의 사료
  quote: Quote.nullable().optional(),                // v2. 인용 카드
  arrows: z.array(Arrow).default([]),                // v2. 큰 기동. 사료가 말하는 것만
  clashes: z.array(Clash).default([]),               // v2. 교전 표식
});
export type TArrow = z.infer<typeof Arrow>; export type TClash = z.infer<typeof Clash>; export type TQuote = z.infer<typeof Quote>;
```
`lintBoard`의 「유닛이 빠졌는데 note가 없다」 규칙을 이렇게 바꾼다.
```ts
  for (let i = 1; i < b.phases.length; i++) {
    const prev = b.phases[i - 1], p = b.phases[i];
    const gone = prev.units.filter(u => !p.units.some(v => v.id === u.id) && u.status === 'active');
    if (gone.length && !p.note) err.push(`t${p.t}: 유닛 ${gone.length}개가 빠졌는데 status도 note도 없다 (${gone.slice(0, 3).map(u => u.id).join(', ')})`);
    for (const u of prev.units) {
      if (!u.path) continue;
      const v = p.units.find(x => x.id === u.id);
      const near = (a: number[], c: number[]) => Math.hypot(a[0] - c[0], a[1] - c[1]) < 1e-4;
      if (!near(u.path[0], u.at)) err.push(`t${prev.t} ${u.id}: path 시작점이 at과 다르다`);
      if (v && !near(u.path[u.path.length - 1], v.at)) err.push(`t${prev.t} ${u.id}: path 끝점이 다음 at과 다르다`);
    }
  }
  for (const p of b.phases) if (p.caption && !p.cite) err.push(`t${p.t}: caption이 있는데 cite가 없다`);
```
기존 `first`·`gone` 블록(첫 페이즈 기준)은 지운다.

- [ ] **Step 3: 통과·커밋**

Run: `npx vitest run test/board.test.ts` → PASS (기존 케이스 포함).
```bash
git add schema/board.ts test/board.test.ts
git commit -m "feat(말판): 스키마 v2 (캡션·인용·화살표·교전·status·path), 옛 파일 무수정 통과 (R54)"
```

---

### Task 4.2: 프레임 보간과 블록 기하 (`src/board.ts`)

**Files:**
- Modify: `src/board.ts` (타입 확장 + 함수 넷)
- Test: `test/board.test.ts`

**Interfaces:**
- Produces: `interpolate(board, t): Frame` · `unitPolygon(u, front?): LonLat[]` · `arrowLine(a, steps?): LonLat[]` · `bearingDeg(a, b)` · `battleGeoJSON(frame, palette): { units, arrows, marks }` (세 FeatureCollection). 타입 `Frame` `FrameUnit` `BoardArrow` `BoardClash` `BoardQuote`.

- [ ] **Step 1: 테스트**

```ts
import { interpolate, unitPolygon, arrowLine, bearingDeg, battleGeoJSON } from '../src/board';
describe('프레임 보간', () => {
  const board = Board.parse(rd('data/boards/cannae-216.json')) as any;
  it('t=0·1 은 페이즈 그대로', () => {
    const f0 = interpolate(board, 0), f1 = interpolate(board, 1);
    expect(f0.units.map(u => u.id)).toEqual(board.phases[0].units.map((u: any) => u.id));
    expect(f1.units.find(u => u.id === board.phases[1].units[0].id)!.at).toEqual(board.phases[1].units[0].at);
  });
  it('중간은 선분 위에 있고 사라지는 유닛은 흐려진다', () => {
    const u = board.phases[0].units.find((x: any) => board.phases[1].units.some((y: any) => y.id === x.id));
    const v = board.phases[1].units.find((y: any) => y.id === u.id);
    const m = interpolate(board, 0.5).units.find(x => x.id === u.id)!;
    expect(m.at[0]).toBeCloseTo((u.at[0] + v.at[0]) / 2, 9); expect(m.at[1]).toBeCloseTo((u.at[1] + v.at[1]) / 2, 9);
    const gone = board.phases[0].units.find((x: any) => !board.phases[1].units.some((y: any) => y.id === x.id));
    if (gone) expect(interpolate(board, 0.5).units.find(x => x.id === gone.id)!.opacity).toBeCloseTo(0.5, 6);
  });
  it('path 가 있으면 그 위를 간다', () => {
    const b = { ...board, phases: board.phases.map((p: any, i: number) => i ? p : { ...p, units: p.units.map((x: any, k: number) => k ? x : { ...x, path: [x.at, [x.at[0] + 0.01, x.at[1]], board.phases[1].units.find((y: any) => y.id === x.id)?.at ?? x.at] }) }) };
    const id = b.phases[0].units[0].id;
    const q = interpolate(b, 0.25).units.find(x => x.id === id)!;
    expect(q.at[1]).toBeCloseTo(b.phases[0].units[0].at[1], 6);   // 첫 구간은 동쪽으로만 간다
  });
  it('결정론: 같은 t 는 같은 프레임', () => { expect(interpolate(board, 0.37)).toEqual(interpolate(board, 0.37)); });
});
describe('블록 기하', () => {
  it('보병 블록은 닫힌 사각형이고 향을 따라 돈다', () => {
    const a = unitPolygon({ at: [16, 41], arm: 'infantry', facing: 0, strength: 10000 });
    expect(a.length).toBe(5); expect(a[0]).toEqual(a[4]);
    const b = unitPolygon({ at: [16, 41], arm: 'infantry', facing: 90, strength: 10000 });
    expect(Math.abs(a[1][0] - a[0][0])).toBeGreaterThan(Math.abs(b[1][0] - b[0][0]));   // 북향은 동서로 넓고, 동향은 남북으로 넓다
  });
  it('앞띠는 전면 쪽에 있다', () => {
    const body = unitPolygon({ at: [16, 41], arm: 'infantry', facing: 0 }), front = unitPolygon({ at: [16, 41], arm: 'infantry', facing: 0 }, true);
    const cy = (p: number[][]) => p.slice(0, 4).reduce((s, q) => s + q[1], 0) / 4;
    expect(cy(front)).toBeGreaterThan(cy(body));
  });
  it('화살표는 from 에서 to 로 24점', () => {
    const l = arrowLine({ from: [0, 0], to: [1, 0], actor: '로마', kind: 'advance' });
    expect(l.length).toBe(25); expect(l[0]).toEqual([0, 0]); expect(l[24]).toEqual([1, 0]); expect(l[12][1]).not.toBe(0);
    expect(bearingDeg([0, 0], [0, 1])).toBeCloseTo(0, 6); expect(bearingDeg([0, 0], [1, 0])).toBeCloseTo(90, 6);
  });
});
```
Run → FAIL.

- [ ] **Step 2: 구현 (`src/board.ts` 끝에 추가, 타입은 기존 인터페이스 확장)**

```ts
// ── 말판 v2: 프레임 보간·블록 기하 (OVERHAUL §3.6). 순수 함수. 시뮬레이션이 아니라 보간이다. ──
export type UnitStatus = 'active' | 'routed' | 'destroyed';
export interface BoardArrow { from: LonLat; to: LonLat; via?: LonLat | null; actor: string; kind: 'advance' | 'retreat' | 'flank' }
export interface BoardClash { at: LonLat; label?: string }
export interface BoardQuote { text: string; who: string; cite: string }
export interface BoardUnit { id: string; at: LonLat; actor: string; arm: Arm; label: string; strength?: number; facing?: number; entity?: string; status?: UnitStatus; path?: LonLat[] | null }
export interface BoardPhase { t: number; title: string; note?: string; units: BoardUnit[]; caption?: string; cite?: string; quote?: BoardQuote | null; arrows?: BoardArrow[]; clashes?: BoardClash[] }
export interface FrameUnit extends BoardUnit { opacity: number }
export interface Frame { i: number; frac: number; phase: BoardPhase; next: BoardPhase | null; units: FrameUnit[]; arrows: BoardArrow[]; clashes: BoardClash[]; caption?: string; cite?: string; quote: BoardQuote | null }

const opacityOf = (s?: UnitStatus) => s === 'destroyed' ? 0 : s === 'routed' ? 0.45 : 1;
const lerpAngle = (a: number, b: number, f: number) => { let d = ((b - a + 540) % 360) - 180; return (a + d * f + 360) % 360; };
function alongPath(path: LonLat[], f: number): LonLat {
  const seg = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  const total = seg.reduce((s, x) => s + x, 0); if (!total) return path[path.length - 1];
  let want = f * total;
  for (let i = 0; i < seg.length; i++) {
    if (want <= seg[i] || i === seg.length - 1) { const k = seg[i] ? want / seg[i] : 1; return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k]; }
    want -= seg[i];
  }
  return path[path.length - 1];
}

/** t는 실수 페이즈 좌표. 0 ≤ t ≤ phases.length−1. 정수면 그 페이즈 그대로, 사이면 선형(또는 path) 보간. */
export function interpolate(board: BoardData, t: number): Frame {
  const n = board.phases.length, tt = Math.min(Math.max(t, 0), n - 1);
  const i = Math.min(Math.floor(tt), n - 1), frac = tt - i;
  const a = board.phases[i], b = board.phases[i + 1] ?? null;
  const units: FrameUnit[] = [];
  for (const u of a.units) {
    const v = b?.units.find(x => x.id === u.id);
    if (!b || frac === 0) { units.push({ ...u, opacity: opacityOf(u.status) }); continue; }
    if (!v) { units.push({ ...u, opacity: opacityOf(u.status) * (1 - frac) }); continue; }
    const at: LonLat = u.path && u.path.length >= 2 ? alongPath(u.path, frac) : [u.at[0] + (v.at[0] - u.at[0]) * frac, u.at[1] + (v.at[1] - u.at[1]) * frac];
    const facing = u.facing != null && v.facing != null ? lerpAngle(u.facing, v.facing, frac) : (v.facing ?? u.facing);
    const o0 = opacityOf(u.status), o1 = opacityOf(v.status);
    units.push({ ...v, at, facing, opacity: o0 + (o1 - o0) * frac });
  }
  if (b && frac > 0) for (const v of b.units) if (!a.units.some(x => x.id === v.id)) units.push({ ...v, opacity: opacityOf(v.status) * frac });
  return { i, frac, phase: a, next: b, units, arrows: a.arrows ?? [], clashes: a.clashes ?? [], caption: a.caption, cite: a.cite, quote: a.quote ?? null };
}

/** 병종별 블록 크기(m). 보병은 넓고 얕게, 기병은 좁고 깊게 (Epic History 전투전술 문법). */
const SIZE_M: Record<Arm, [number, number]> = { infantry: [320, 90], cavalry: [200, 140], light: [220, 70], elephant: [160, 110], command: [110, 110] };
/** 병력은 로그 스케일로 폭만 키운다(1,000 → 0.7배, 10,000 → 1.05배, 45,000 → 1.27배). 수치 논쟁이 그림을 크게 안 바꾼다. */
const sizeK = (strength?: number) => Math.min(1.4, Math.max(0.7, 0.7 + 0.35 * Math.log10(Math.max(1, (strength ?? 1000) / 1000))));
/** 중심·향(도, 북 = 0, 시계방향)·병종 → 닫힌 사각형. front면 전면 30%의 앞띠. */
export function unitPolygon(u: { at: LonLat; arm: Arm; facing?: number; strength?: number }, front = false): LonLat[] {
  const [w0, d0] = SIZE_M[u.arm], k = sizeK(u.strength);
  const w = w0 * k, d = front ? d0 * k * 0.3 : d0 * k, off = front ? d0 * k * 0.35 : 0;
  const th = ((u.facing ?? 0) * Math.PI) / 180, mLat = 1 / 111320, mLon = 1 / (111320 * Math.cos((u.at[1] * Math.PI) / 180));
  const local: [number, number][] = [[-w / 2, -d / 2 + off], [w / 2, -d / 2 + off], [w / 2, d / 2 + off], [-w / 2, d / 2 + off]];
  const ring = local.map(([x, y]) => [u.at[0] + (x * Math.cos(th) + y * Math.sin(th)) * mLon, u.at[1] + (-x * Math.sin(th) + y * Math.cos(th)) * mLat] as LonLat);
  return [...ring, ring[0]];
}
export function bearingDeg(a: LonLat, b: LonLat): number {
  const dx = (b[0] - a[0]) * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180), dy = b[1] - a[1];
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}
/** 2차 베지어. via가 없으면 진행 방향 왼쪽으로 25% 휜다(직선은 시야를 가른다, PACK-CAESAR §10.5). */
export function arrowLine(a: BoardArrow, steps = 24): LonLat[] {
  const [x0, y0] = a.from, [x2, y2] = a.to;
  const [cx, cy] = a.via ?? [(x0 + x2) / 2 - (y2 - y0) * 0.25, (y0 + y2) / 2 + (x2 - x0) * 0.25];
  const out: LonLat[] = [];
  for (let i = 0; i <= steps; i++) { const t = i / steps, s = 1 - t; out.push([s * s * x0 + 2 * s * t * cx + t * t * x2, s * s * y0 + 2 * s * t * cy + t * t * y2]); }
  return out;
}
type FC = { type: 'FeatureCollection'; features: { type: 'Feature'; id?: string; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[] };
/** 프레임 → 소스 셋. units: 몸통·앞띠(면)+이름표(점) · arrows: 선+화살촉(점) · marks: 교전(점). */
export function battleGeoJSON(frame: Frame, palette: Record<string, string>, boardId: string): { units: FC; arrows: FC; marks: FC } {
  const color = (actor: string) => palette[actor] ?? FALLBACK_COLOR;
  const units: FC = { type: 'FeatureCollection', features: [] };
  for (const u of frame.units) {
    if (u.opacity <= 0.01) continue;
    const base = { id: u.id, board: boardId, actor: u.actor, color: color(u.actor), label: u.label, arm: u.arm, armKo: ARM_KO[u.arm], strength: u.strength ?? null, entity: u.entity ?? null, opacity: +u.opacity.toFixed(3), status: u.status ?? 'active' };
    units.features.push({ type: 'Feature', id: `${u.id}#body`, properties: { ...base, kind: 'body' }, geometry: { type: 'Polygon', coordinates: [unitPolygon(u)] } });
    units.features.push({ type: 'Feature', id: `${u.id}#front`, properties: { ...base, kind: 'front' }, geometry: { type: 'Polygon', coordinates: [unitPolygon(u, true)] } });
    units.features.push({ type: 'Feature', id: `${u.id}#label`, properties: { ...base, kind: 'label' }, geometry: { type: 'Point', coordinates: u.at } });
  }
  const arrows: FC = { type: 'FeatureCollection', features: [] };
  for (const [k, a] of frame.arrows.entries()) {
    const line = arrowLine(a), end = line[line.length - 1], prev = line[line.length - 2];
    arrows.features.push({ type: 'Feature', properties: { kind: 'arrow', color: color(a.actor), move: a.kind }, geometry: { type: 'LineString', coordinates: line } });
    arrows.features.push({ type: 'Feature', properties: { kind: 'head', color: color(a.actor), bearing: bearingDeg(prev, end), n: k }, geometry: { type: 'Point', coordinates: end } });
  }
  const marks: FC = { type: 'FeatureCollection', features: frame.clashes.map(c => ({ type: 'Feature' as const, properties: { kind: 'clash', label: c.label ?? '' }, geometry: { type: 'Point', coordinates: c.at } })) };
  return { units, arrows, marks };
}
```
`unitsGeoJSON`·`UnitProps`는 그대로 둔다(계획 4/4 이전까지 옛 심볼 층이 참조하지 않게 되면 지운다).

- [ ] **Step 3: 통과·커밋**

Run: `npx vitest run test/board.test.ts` → PASS.
```bash
git add src/board.ts test/board.test.ts
git commit -m "feat(말판): 프레임 보간·블록 기하·화살표 (순수 함수)"
```

---

### Task 4.3: 렌더러 `src/map/battle.ts` 와 엔진 교체

**Files:**
- Create: `src/map/battle.ts`
- Modify: `src/map/engine.ts` (`board-unit`·`board-label` 층과 941~1040행의 아이콘 생성, 1144~1148행 클릭, 1303~1312행 페이즈 동기를 `battle`로 교체 · `LAYER_GROUPS.board` 갱신 · 반환 객체에 `battle()` · `window.__ca.battle`)
- Test: 기존 `test/board.test.ts`의 렌더 5건 중 `board-unit`을 전제한 것은 `battle-body`로 바꾼다

**Interfaces:**
- Produces: `createBattle(map, opts) → BattleCtl` : `{ setBoard(b: BoardData | null, phase?: number): void; seek(t: number): void; play(): void; pause(): void; playing(): boolean; t(): number; frame(): Frame | null; unitAt(id: string): LonLat | null; onFrame(fn): () => void; onPhase(fn: (i: number, phase: BoardPhase) => void): () => void; onQuote(fn: (q: BoardQuote | null) => void): () => void; destroy(): void }`. 엔진 반환에 `battle(): BattleCtl | null`.
- 선택: 클릭 → `opts.onSelect('unit:<board>:<unit>')`.

- [ ] **Step 1: battle.ts**

```ts
// src/map/battle.ts: 말판 v2 렌더 + 재생. 지연 로드 청크(초기 번들에 안 실린다).
// 그리는 것: 부대 블록(몸통·앞띠·이름표) · 기동 화살표(선·화살촉) · 교전 표식. 움직이는 것: rAF로 t를 올리며 setData.
// 시뮬레이션이 아니다: River 08-13 「보여지기만 하면 된다」. 페이즈 사이 보간이 전부다.
import type maplibregl from 'maplibre-gl';
import { interpolate, battleGeoJSON, type BoardData, type BoardPhase, type BoardQuote, type Frame, type LonLat } from '../board';

export const BATTLE_LAYERS = ['battle-arrow', 'battle-head', 'battle-body', 'battle-body-line', 'battle-front', 'battle-clash', 'battle-label'] as const;
const PHASE_MS = 1500, QUOTE_MS = 1500, INK = '#2B2419', PAPER = '#F3ECDD';
const EMPTY = { type: 'FeatureCollection', features: [] } as const;

/** 캔버스로 그린 아이콘. 파일도 글리프도 안 쓴다(교차 검은 Pretendard에 없다). */
function icon(kind: 'head' | 'clash', px = 32): ImageData {
  const c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d')!;
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'head') { g.fillStyle = INK; g.beginPath(); g.moveTo(px / 2, 2); g.lineTo(px - 4, px - 4); g.lineTo(px / 2, px * 0.7); g.lineTo(4, px - 4); g.closePath(); g.fill(); }
  else { g.strokeStyle = PAPER; g.lineWidth = 7; g.beginPath(); g.moveTo(6, 6); g.lineTo(px - 6, px - 6); g.moveTo(px - 6, 6); g.lineTo(6, px - 6); g.stroke();
         g.strokeStyle = INK; g.lineWidth = 3.5; g.beginPath(); g.moveTo(6, 6); g.lineTo(px - 6, px - 6); g.moveTo(px - 6, 6); g.lineTo(6, px - 6); g.stroke(); }
  return g.getImageData(0, 0, px, px);
}

export function createBattle(map: maplibregl.Map, opts: { palette: Record<string, string>; before?: () => string | undefined; onSelect: (sel: string) => void }) {
  let board: BoardData | null = null, t = 0, frame: Frame | null = null;
  let raf = 0, last = 0, holdUntil = 0, isPlaying = false;
  const frameFns = new Set<(t: number, f: Frame) => void>(), phaseFns = new Set<(i: number, p: BoardPhase) => void>(), quoteFns = new Set<(q: BoardQuote | null) => void>();

  function ensure() {
    if (map.getSource('battle-units')) return;
    const before = opts.before?.();
    for (const id of ['battle-units', 'battle-arrows', 'battle-marks']) map.addSource(id, { type: 'geojson', data: EMPTY as any, promoteId: 'id' });
    if (!map.hasImage('battle-head')) map.addImage('battle-head', icon('head'), { pixelRatio: 2 });
    if (!map.hasImage('battle-clash')) map.addImage('battle-clash', icon('clash'), { pixelRatio: 2 });
    map.addLayer({ id: 'battle-arrow', type: 'line', source: 'battle-arrows', filter: ['==', ['get', 'kind'], 'arrow'], layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 13, 10], 'line-opacity': 0.5 } }, before);
    map.addLayer({ id: 'battle-head', type: 'symbol', source: 'battle-arrows', filter: ['==', ['get', 'kind'], 'head'],
      layout: { 'icon-image': 'battle-head', 'icon-rotate': ['get', 'bearing'], 'icon-rotation-alignment': 'map', 'icon-size': 0.9, 'icon-allow-overlap': true }, paint: { 'icon-opacity': 0.75 } }, before);
    map.addLayer({ id: 'battle-body', type: 'fill', source: 'battle-units', filter: ['==', ['get', 'kind'], 'body'], paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['*', 0.85, ['get', 'opacity']] } }, before);
    map.addLayer({ id: 'battle-body-line', type: 'line', source: 'battle-units', filter: ['==', ['get', 'kind'], 'body'], paint: { 'line-color': INK, 'line-width': 1.2, 'line-opacity': ['get', 'opacity'] } }, before);
    map.addLayer({ id: 'battle-front', type: 'fill', source: 'battle-units', filter: ['==', ['get', 'kind'], 'front'], paint: { 'fill-color': INK, 'fill-opacity': ['*', 0.55, ['get', 'opacity']] } }, before);
    map.addLayer({ id: 'battle-clash', type: 'symbol', source: 'battle-marks', layout: { 'icon-image': 'battle-clash', 'icon-size': 0.8, 'icon-allow-overlap': true, 'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [0, 1.4], 'text-anchor': 'top' },
      paint: { 'text-color': INK, 'text-halo-color': PAPER, 'text-halo-width': 1.4 } }, before);
    map.addLayer({ id: 'battle-label', type: 'symbol', source: 'battle-units', filter: ['==', ['get', 'kind'], 'label'], minzoom: 10,
      layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-allow-overlap': true, 'text-ignore-placement': false },
      paint: { 'text-color': INK, 'text-halo-color': PAPER, 'text-halo-width': 1.4, 'text-opacity': ['get', 'opacity'] } }, before);
    map.on('click', 'battle-body', e => { const f = e.features?.[0]; if (f && board) opts.onSelect(`unit:${board.id}:${f.properties?.id}`); });
    map.on('mouseenter', 'battle-body', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'battle-body', () => (map.getCanvas().style.cursor = ''));
  }
  function render() {
    if (!board) { for (const id of ['battle-units', 'battle-arrows', 'battle-marks']) (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY as any); frame = null; return; }
    ensure();
    frame = interpolate(board, t);
    const g = battleGeoJSON(frame, opts.palette, board.id);
    (map.getSource('battle-units') as maplibregl.GeoJSONSource).setData(g.units as any);
    (map.getSource('battle-arrows') as maplibregl.GeoJSONSource).setData(g.arrows as any);
    (map.getSource('battle-marks') as maplibregl.GeoJSONSource).setData(g.marks as any);
    frameFns.forEach(fn => fn(t, frame!));
  }
  function step(now: number) {
    if (!isPlaying || !board) return;
    if (now < holdUntil) { last = now; raf = requestAnimationFrame(step); return; }
    const end = board.phases.length - 1, before = Math.floor(t);
    t = Math.min(end, t + (now - last) / PHASE_MS); last = now;
    const after = Math.floor(t);
    if (after > before) {                        // 페이즈 경계를 넘었다
      t = after;                                 // 경계에 정확히 세운다(캡션·URL이 정수 페이즈를 본다)
      const p = board.phases[after]; phaseFns.forEach(fn => fn(after, p));
      if (p.quote) { holdUntil = now + QUOTE_MS; quoteFns.forEach(fn => fn(p.quote!)); setTimeout(() => quoteFns.forEach(fn => fn(null)), QUOTE_MS); }
    }
    render();
    if (t >= end) { isPlaying = false; return; }
    raf = requestAnimationFrame(step);
  }
  const ctl = {
    setBoard(b: BoardData | null, phase = 0) { ctl.pause(); board = b; t = b ? Math.min(Math.max(phase, 0), b.phases.length - 1) : 0; render(); },
    seek(x: number) { if (!board) return; ctl.pause(); t = Math.min(Math.max(x, 0), board.phases.length - 1); render(); },
    play() { if (!board || isPlaying) return; if (t >= board.phases.length - 1) t = 0; isPlaying = true; last = performance.now(); holdUntil = 0; raf = requestAnimationFrame(step); },
    pause() { isPlaying = false; cancelAnimationFrame(raf); },
    playing: () => isPlaying, t: () => t, frame: () => frame,
    unitAt: (id: string): LonLat | null => frame?.units.find(u => u.id === id)?.at ?? null,
    onFrame(fn: (t: number, f: Frame) => void) { frameFns.add(fn); return () => frameFns.delete(fn); },
    onPhase(fn: (i: number, p: BoardPhase) => void) { phaseFns.add(fn); return () => phaseFns.delete(fn); },
    onQuote(fn: (q: BoardQuote | null) => void) { quoteFns.add(fn); return () => quoteFns.delete(fn); },
    destroy() { ctl.pause(); board = null; render(); },
  };
  return ctl;
}
export type BattleCtl = ReturnType<typeof createBattle>;
```

- [ ] **Step 2: 엔진 교체**

`src/map/engine.ts`에서
1. 941~1040행 근처의 말판 아이콘 생성(`board-${arm}-${a.id}`)과 `board-unit`·`board-label` 층 추가를 지운다. `LAYER_GROUPS.board = [...BATTLE_LAYERS]`(`import { BATTLE_LAYERS } from './battle'`는 상수뿐이라 청크를 안 끌어온다. 확인: `battle.ts`가 `../board`만 import하고 `board.ts`는 런타임 의존이 없다. 그래도 `check-bundle`이 잰다).
2. 1144~1148행 `if (layerId === 'board-unit') {…}` 블록과 클릭 층 목록의 `'board-unit'`, `SRC_OF`의 `'board-unit': 'board'`, 1225~1230행의 `board` 소스 hover 처리를 지운다.
3. 1303~1312행 페이즈 동기를 이렇게 바꾼다.
```ts
    if (s.board !== lastBoard || s.phase !== lastPhase) {
      lastBoard = s.board; lastPhase = s.phase;
      const b = boards.find(x => x.id === s.board) ?? null;
      map.setMaxZoom(b ? BOARD_MAX_ZOOM : MAP_MAX_ZOOM);
      if (!b) { battle?.setBoard(null); }
      else {
        const apply = () => { if (Math.floor(battle!.t()) !== s.phase || !battle!.playing()) battle!.setBoard(b, s.phase); };
        if (battle) apply();
        else import('./battle').then(m => {
          battle = m.createBattle(map, { palette: Object.fromEntries(d.actors.map(a => [a.id, a.color])), before: () => map.getLayer('label-marine') ? 'label-marine' : undefined, onSelect: sel => store.set({ sel }) });
          battle.onPhase(i => { if (store.get().phase !== i) store.set({ phase: i }); });
          onBattleReady.forEach(fn => fn(battle!)); apply();
        });
      }
    }
```
함수 위에 `let battle: import('./battle').BattleCtl | null = null; const onBattleReady = new Set<(b: import('./battle').BattleCtl) => void>();`. 반환 객체에 `battle: () => battle, onBattle(fn) { onBattleReady.add(fn); if (battle) fn(battle); return () => onBattleReady.delete(fn); }`. `window.__ca`를 설정하는 곳(검색: `__ca`)에 `battle: () => battle`을 더한다.
4. `setSkin`·`setDark`(setStyle) 뒤 `addData`에서 활성 말판이 있으면 `battle?.setBoard(b, store.get().phase)`를 다시 부른다(소스가 지워졌으므로 `ensure`가 다시 만든다. `ensure`는 `map.getSource` 검사로 멱등).

- [ ] **Step 3: 빌드·테스트·렌더**

```bash
npm run validate && npm run build
grep -c "createBattle" dist/assets/index-*.js      # 0 이어야 한다(청크로 갔다)
bash scripts/serve.sh && python3 scripts/look.py pharsalus-48
```
Expected: 파르살루스 장면에 블록이 서고 클릭하면 `store.sel`이 `unit:pharsalus-48:<id>`. 초기 번들 게이트 통과.

- [ ] **Step 4: 커밋**

```bash
git add src/map/battle.ts src/map/engine.ts test/board.test.ts
git commit -m "feat(말판): 블록·화살표·교전 렌더러 battle.ts (지연 청크) · 옛 심볼 층 제거"
```

---

### Task 4.4: 재생 UI · 부대 카드 · 콜아웃 칩

**Files:**
- Create: `src/app/BattleBar.tsx`
- Modify: `src/app/App.tsx` (526~536행의 `.shell-board` 카드를 `BattleBar`로 · 단축키 `P` `.` `,`)
- Modify: `src/app/Inspector.tsx` (`unit:` 분기) · `src/app/Callouts.tsx` (칩·유닛 앵커) · `src/app/shell.css`
- Test: `test/state.test.ts`에 `unit:` 선택이 URL 왕복을 통과하는 케이스 1건

**Interfaces:**
- Consumes: `engine.onBattle(fn)` · `BattleCtl` · `resolveCallouts(def, unitAt)`(계획 1/4).
- Produces: `BattleBar({ engine, board })` · Inspector가 `sel.startsWith('unit:')`이면 `UnitCard`.

- [ ] **Step 1: BattleBar**

```tsx
// src/app/BattleBar.tsx: 재생·페이즈·캡션·인용. 말판이 있을 때만 App이 띄운다.
import { useEffect, useState } from 'react';
import { Button, Card } from '@astryxdesign/core';
import type { Engine } from '../map/engine';
import type { BoardData, BoardQuote, Frame } from '../board';

export function BattleBar({ engine, board, shift }: { engine: Engine; board: BoardData; shift: boolean }) {
  const [t, setT] = useState(0); const [frame, setFrame] = useState<Frame | null>(null);
  const [playing, setPlaying] = useState(false); const [quote, setQuote] = useState<BoardQuote | null>(null);
  useEffect(() => engine.onBattle(b => {
    const offF = b.onFrame((tt, f) => { setT(tt); setFrame(f); setPlaying(b.playing()); });
    const offQ = b.onQuote(setQuote);
    setFrame(b.frame()); setT(b.t());
    return () => { offF(); offQ(); };
  }), [engine, board.id]);
  const b = engine.battle(); if (!b) return null;
  const n = board.phases.length, i = Math.floor(t);
  return (
    <>
      {quote && <div className="bt-quote" role="status"><p>{quote.text}</p><footer>{quote.who} · {quote.cite}</footer></div>}
      <Card padding={3} elevation="low" className={`shell-board${shift ? ' is-shift' : ''}`}>
        <div className="bd-title">{board.title}</div>
        <div className="bt-controls">
          <Button label={playing ? '정지' : (t >= n - 1 ? '처음부터' : '재생')} size="sm" onClick={() => (playing ? b.pause() : b.play())} />
          <Button label="이전" size="sm" variant="ghost" onClick={() => b.seek(Math.max(0, Math.ceil(t) - 1))} isDisabled={t <= 0} />
          <Button label="다음" size="sm" variant="ghost" onClick={() => b.seek(Math.min(n - 1, Math.floor(t) + 1))} isDisabled={t >= n - 1} />
          <span className="bt-count">{i + 1} / {n}</span>
        </div>
        <input type="range" className="bd-slider" min={0} max={n - 1} step={0.01} value={t} onChange={e => b.seek(Number(e.currentTarget.value))} aria-label="페이즈" />
        <div className="bd-ticks">{board.phases.map(p => <span key={p.t}>{p.title}</span>)}</div>
        <div className="bd-phase">{frame?.caption ?? board.phases[i].title}</div>
        {frame?.cite && <div className="bd-cite">{frame.cite}</div>}
        {!frame?.caption && board.phases[i].note && <div className="bd-note">{board.phases[i].note}</div>}
        <div className="bd-source">{board.source}</div>
      </Card>
    </>
  );
}
```
CSS(`shell.css` 끝):
```css
.bt-controls { display: flex; gap: 6px; align-items: center; }
.bt-count { margin-left: auto; font-size: 12px; color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
.bd-cite { font-size: 11px; color: var(--color-text-secondary); }
.bt-quote { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); z-index: 5; max-width: min(640px, 80vw); padding: 20px 28px; text-align: center;
  background: color-mix(in srgb, var(--color-background-surface) 88%, transparent); border: 1px solid var(--color-border); border-radius: var(--radius-element, 8px); box-shadow: var(--shadow-med, 0 4px 16px rgba(0,0,0,.12)); }
.bt-quote p { margin: 0 0 8px; font-size: 20px; line-height: 1.5; font-weight: 600; color: var(--color-text-primary); word-break: keep-all; }
.bt-quote footer { font-size: 12px; color: var(--color-text-secondary); }
```
(`--color-background-surface`·`--color-border`는 실재 토큰이다. PACK-CAESAR §11.8이 잡은 없는 토큰 함정을 반복하지 않는다.)

- [ ] **Step 2: App 배선과 단축키**

App.tsx 526~536행의 `liveBoard && <Card …>` 블록을 `{liveBoard && engRef.current && <BattleBar engine={engRef.current} board={liveBoard.board} shift={explorerOpen} />}`로. `onKey`에 추가:
```ts
      else if ((e.key === 'p' || e.key === 'P') && st.board) { const b = engRef.current?.battle(); if (b) (b.playing() ? b.pause() : b.play()); }
      else if ((e.key === '.' || e.key === ',') && st.board) { const b = engRef.current?.battle(); if (b) b.seek(e.key === '.' ? Math.floor(b.t()) + 1 : Math.ceil(b.t()) - 1); }
```

- [ ] **Step 3: 부대 카드 (Inspector)**

`Inspector`에 `boards: BoardData[]` prop을 더하고(App에서 넘긴다) 분기 맨 앞에:
```tsx
  if (sel.startsWith('unit:')) {
    const [, boardId, unitId] = sel.split(':');
    const b = boards.find(x => x.id === boardId); const phase = b ? phaseOf(b, store.get().phase) : null;
    const u = phase?.units.find(x => x.id === unitId) ?? b?.phases.flatMap(p => p.units).find(x => x.id === unitId);
    if (!b || !u) return null;
    return (
      <Card padding={4} className="shell-right">
        <Heading level={2}>{u.label}</Heading>
        <Text size="sm" color="secondary">{ARM_KO[u.arm]} · {u.actor}{u.strength != null ? ` · ${u.strength.toLocaleString()}명` : ''}{u.status && u.status !== 'active' ? ` · ${u.status === 'routed' ? '패주' : '궤멸'}` : ''}</Text>
        {u.entity && <Button label="지휘관 보기" size="sm" variant="secondary" onClick={() => store.set({ sel: u.entity! })} />}
        <Text size="sm">{b.source}</Text>
        <Text size="sm" color="secondary">이 배치는 도식이지 측량이 아니다. 좌표는 사료의 서술을 통설대로 옮긴 것이다.</Text>
        <Button label="닫기" size="sm" variant="ghost" onClick={close} />
      </Card>
    );
  }
```
(`ARM_KO`·`phaseOf`는 `../board`에서 import.) `test/state.test.ts`에 `expect(parseState(serializeState({ ...DEFAULTS, sel: 'unit:pharsalus-48:x' })).sel).toBe('unit:pharsalus-48:x')` 한 줄.

- [ ] **Step 4: 콜아웃 칩과 유닛 앵커**

`Callouts.tsx`에 `const [topics, setTopics] = useState<Set<'terrain' | 'unit' | 'event'>>(new Set(['terrain', 'unit', 'event']));`, 핀·카드는 `resolved.filter(c => topics.has(c.topic))`. 앵커 풀이는 `resolveCallouts(def, id => engine.battle()?.unitAt(id) ?? null)`을 프레임마다 다시(`engine.onBattle(b => b.onFrame(() => sync()))`). 칩 UI는 카드 칸 맨 위에 세 개의 `Button variant={on ? 'secondary' : 'ghost'} size="sm"`(라벨 「지형」「부대」「사건」). `C` 키(전체 켜고 끄기)는 그대로.

- [ ] **Step 5: 검증·커밋**

```bash
npm run validate && npm run build && bash scripts/serve.sh && python3 scripts/look.py pharsalus-48
```
검증 창에서 `P`를 눌러 재생되고 캡션 띠가 바뀌는지, 블록 클릭에 부대 카드가 뜨는지, 칩으로 「부대」만 켜면 지형 핀이 사라지는지 본다.
```bash
git add src/app/BattleBar.tsx src/app/App.tsx src/app/Inspector.tsx src/app/Callouts.tsx src/app/shell.css test/state.test.ts
git commit -m "feat(말판): 재생 바·캡션·인용 카드 · 부대 카드 · 콜아웃 칩 (R54)"
```

---

### Task 4.5: 내용: 파르살루스·칸나이 v2, 알레시아 말판 생성기

**Files:**
- Modify: `data/boards/pharsalus-48.json` · `data/boards/cannae-216.json` (캡션·cite·화살표·교전·인용·status)
- Create: `scripts/build-alesia-board.py` · `data/boards/alesia-52.json`
- Modify: `data/micromaps/alesia.json` (`board: "alesia-52"`) · `data/micromaps/pharsalus.json`(부대 콜아웃 `anchor.unit`) · `data/scenes/rome.json` (`pack-alesia-52`에 `board`·`phase`) · `docs/ALESIA.md` (말판 절) · `docs/LEGIONS.md`(수치 참조)

**Interfaces:**
- Consumes: 기존 두 말판의 유닛 id(파일에서 읽는다. 여기서 지어내지 않는다) · `data/micromaps/alesia.json` 피처(oppidum · inner_line · outer_line · camp 8 · gaul_camp 2).
- Produces: 세 말판 전부 v2(페이즈마다 caption·cite).

- [ ] **Step 1: 파르살루스 v2**

`data/boards/pharsalus-48.json`의 세 페이즈에 다음을 더한다(유닛 id는 파일의 실제 id를 쓴다. 카이사르 우익 기병·넷째 줄·폼페이우스 기병 id를 먼저 `python3 -c "import json;print([u['id'] for u in json.load(open('data/boards/pharsalus-48.json'))['phases'][0]['units']])"`로 읽는다).
- t0: `caption` 「양군이 대치한다. 폼페이우스는 기병 7,000으로 카이사르의 우익을 감쌀 셈이다」 · `cite` 「카이사르 『내전기』 3.86~88」 · `quote` null.
- t1: `caption` 「폼페이우스 기병이 카이사르 우익 기병을 밀어낸다. 그 뒤에 넷째 줄이 기다린다」 · `cite` 「『내전기』 3.93」 · `arrows` 하나: 폼페이우스 기병 유닛의 t0 `at` → t1 `at`, `actor` 폼페이우스 쪽 actor 값 그대로, `kind: "advance"` · `clashes` 하나: 카이사르 우익 기병 t1 `at`, `label` 「기병 충돌」.
- t2: `caption` 「넷째 줄이 기병의 얼굴을 노린다. 흩어진 기병 뒤로 폼페이우스 좌익이 감싸인다」 · `cite` 「『내전기』 3.93~94」 · `quote` `{ "text": "얼굴을 쳐라", "who": "카이사르가 넷째 줄에 내린 명령(전승)", "cite": "플루타르코스 『카이사르』 45" }` · `arrows` 둘: 넷째 줄 유닛 t1 `at` → t2 `at` `flank`, 폼페이우스 기병 t1 `at` → t2 `at` `retreat` · 폼페이우스 기병 유닛 `status: "routed"`.
`source`에 「인용문은 플루타르코스의 전승이고 『내전기』에는 없다」 한 문장을 더한다.

- [ ] **Step 2: 칸나이 v2**

같은 방식. 폴리비오스 3.113~117. t0 「배치. 한니발은 중앙을 앞으로 내밀어 초승달을 만든다」 3.113 · t1 「로마 보병이 중앙을 밀어 넣는다. 초승달이 뒤집힌다」 3.115, `arrows` 로마 보병 중앙 유닛 advance, `clashes` 중앙 · t2 「아프리카 보병이 양옆을 닫고 하스드루발의 기병이 뒤를 막는다」 3.116~117, `arrows` 좌우 아프리카 보병 flank 둘 + 하스드루발 기병 flank, 로마 기병 유닛 `status: "routed"`(이미 t1에서 사라진 유닛은 t0에 `status: "routed"`를 달아 린트를 만족시킨다). 인용은 넣지 않는다(3.117의 사상자 수치는 논쟁이라 캡션이 아니라 `source`에).

- [ ] **Step 3: 알레시아 생성기**

```python
#!/usr/bin/env python3
"""build-alesia-board.py: 알레시아 말판(alesia-52)을 미시지도 피처에서 파생한다. 손으로 찍는 좌표 0.

세 페이즈는 『갈리아 전기』 7.79~88: ① 구원군 도착 ② 밤의 총공격과 북쪽 언덕 진영 급습 ③ 카이사르 기병의 우회와 붕괴.
유닛 위치 = 피처 대푯점(진영 점·오피둠 중심·구원군 진영 중심·포위선의 가까운 정점). 병력은 docs/LEGIONS.md·docs/ALESIA.md의 사료 수치.
"""
import json, math
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
mm = json.loads((ROOT / 'data/micromaps/alesia.json').read_text())
F = {f['properties']['id']: f for f in mm['features']}
def rep(f):
    g = f['geometry']; c = g['coordinates']
    if g['type'] == 'Point': return c
    pts = c if g['type'] == 'LineString' else c[0]
    return [sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)]
def nearest_vertex(f, to):
    g = f['geometry']; pts = g['coordinates'] if g['type'] == 'LineString' else g['coordinates'][0]
    return min(pts, key=lambda p: math.hypot(p[0] - to[0], p[1] - to[1]))
def bearing(a, b): return (math.degrees(math.atan2((b[0] - a[0]) * math.cos(math.radians(a[1])), b[1] - a[1])) + 360) % 360

opp = rep(F['alesia:oppidum']); camps = sorted([f for f in mm['features'] if f['properties']['kind'] == 'camp'], key=lambda f: f['properties'].get('camp_letter', ''))
gaul = [f for f in mm['features'] if f['properties']['kind'] == 'gaul_camp']; relief = rep(gaul[0]) if gaul else None
inner, outer = F['alesia:inner'], F['alesia:outer']
assert relief, '구원군 진영 피처가 없다'
STR = json.loads((ROOT / 'data/boards/_alesia-strength.json').read_text())   # {"relief_inf":250000,"relief_cav":8000,"oppidum":80000,"legion":4800,"note":"..."}: docs/LEGIONS.md·ALESIA.md에서 옮겨 적는다

def roman_units():
    return [{'id': f'rom-camp-{f["properties"].get("camp_letter", i)}', 'at': rep(f), 'actor': '로마', 'arm': 'infantry', 'label': f'로마 진영 {f["properties"].get("camp_letter", i)}', 'strength': STR['legion'], 'facing': bearing(rep(f), opp)} for i, f in enumerate(camps)]
def gaul_in(status='active'):
    return [{'id': 'gaul-oppidum', 'at': opp, 'actor': '갈리아', 'arm': 'infantry', 'label': '베르킹게토릭스 · 오피둠', 'strength': STR['oppidum'], 'facing': bearing(opp, nearest_vertex(inner, relief)), 'entity': 'person:베르킹게토릭스', 'status': status}]
p0_relief = [{'id': 'gaul-relief-inf', 'at': relief, 'actor': '갈리아', 'arm': 'infantry', 'label': '구원군 보병', 'strength': STR['relief_inf'], 'facing': bearing(relief, opp)},
             {'id': 'gaul-relief-cav', 'at': relief, 'actor': '갈리아', 'arm': 'cavalry', 'label': '구원군 기병', 'strength': STR['relief_cav'], 'facing': bearing(relief, opp)}]
hit_outer = nearest_vertex(outer, relief); hit_inner = nearest_vertex(inner, opp)
p1_relief = [dict(p0_relief[0], at=hit_outer), dict(p0_relief[1], at=hit_outer)]
p1_opp = [dict(gaul_in()[0], at=hit_inner)]
behind = [relief[0] + (relief[0] - hit_outer[0]), relief[1] + (relief[1] - hit_outer[1])]   # 구원군 뒤: 진영에서 접점 반대편으로 같은 거리
rom_cav = {'id': 'rom-cav-german', 'at': rep(camps[0]), 'actor': '로마', 'arm': 'cavalry', 'label': '게르만 기병(카이사르)', 'strength': STR.get('german_cav', 0) or None, 'facing': bearing(rep(camps[0]), behind)}
board = {
  'id': 'alesia-52', 'title': '알레시아 · 구원군의 사흘', 'year': -52, 'event': 'event:알레시아전투', 'center': mm['view']['center'], 'zoom': mm['view']['zoom'], 'bearing': 0, 'teaching': True,
  'source': '『갈리아 전기』 7.79~88을 통설대로 도식화. 유닛 위치는 미시지도 피처(진영 점·오피둠·구원군 진영·포위선 정점)에서 파생한 상대 배치이고 측량이 아니다. 구원군 규모는 카이사르 25만 대 현대 8만~13만으로 갈린다(docs/ALESIA.md). 병력 수치는 ' + STR['note'],
  'phases': [
    {'t': 0, 'title': '구원군 도착', 'caption': '구원군이 서쪽 평원 너머 언덕에 진을 친다. 안팎 두 겹 사이에 로마군이 갇힌 꼴이다', 'cite': '『갈리아 전기』 7.79', 'units': roman_units() + gaul_in() + p0_relief, 'arrows': [], 'clashes': []},
    {'t': 1, 'title': '밤의 총공격', 'caption': '구원군은 바깥선을, 오피둠은 안쪽선을 동시에 친다. 함정 세 겹이 첫 파도를 삼킨다', 'cite': '『갈리아 전기』 7.81~85',
     'units': roman_units() + p1_opp + p1_relief, 'arrows': [{'from': relief, 'to': hit_outer, 'actor': '갈리아', 'kind': 'advance'}, {'from': opp, 'to': hit_inner, 'actor': '갈리아', 'kind': 'advance'}], 'clashes': [{'at': hit_outer, 'label': '바깥선'}, {'at': hit_inner, 'label': '안쪽선'}]},
    {'t': 2, 'title': '기병의 우회', 'caption': '카이사르가 기병을 바깥으로 돌려 구원군의 등을 친다. 구원군이 무너지고 이튿날 베르킹게토릭스가 항복한다', 'cite': '『갈리아 전기』 7.87~89',
     'quote': {'text': '카이사르는 붉은 외투로 자신이 오는 것을 알렸다', 'who': '『갈리아 전기』의 서술', 'cite': '『갈리아 전기』 7.88'},
     'units': roman_units() + [dict(gaul_in('routed')[0], at=opp)] + [dict(p1_relief[0], status='routed'), dict(p1_relief[1], status='routed')] + [dict(rom_cav, at=behind)],
     'arrows': [{'from': rep(camps[0]), 'to': behind, 'via': [relief[0], rep(camps[0])[1]], 'actor': '로마', 'kind': 'flank'}], 'clashes': [{'at': behind, 'label': '구원군의 등'}]},
  ],
}
board['phases'][1]['units'][len(roman_units())]  # 존재 확인
(ROOT / 'data/boards/alesia-52.json').write_text(json.dumps(board, ensure_ascii=False, indent=1) + '\n')
print('alesia-52: 유닛', [len(p['units']) for p in board['phases']])
```
`data/boards/_alesia-strength.json`은 `docs/LEGIONS.md`·`docs/ALESIA.md`에서 **읽은 수치만** 적는다. 문서에 없는 값(게르만 기병 수)은 `null`로 두고 `note`에 「BG에 수가 없다」고 적는다. 유닛 `strength: null`이면 스키마가 거부하므로 그 키를 빼도록 생성기가 `None`을 걷어낸다(`{k: v for k, v in u.items() if v is not None}`를 저장 직전에 적용).

- [ ] **Step 4: 실행·연결·검증**

```bash
python3 scripts/build-alesia-board.py && npx vitest run test/board.test.ts test/micromap.test.ts
```
`data/micromaps/alesia.json`에 `"board": "alesia-52"`, `data/scenes/rome.json`의 `pack-alesia-52`에 `"board": "alesia-52", "phase": 0`. 파르살루스 미시지도 콜아웃 「병력」의 앵커를 `{ "unit": "<카이사르 우익 유닛 id>" }`, `topic: "unit"`으로.
```bash
npm run validate && npm run build && bash scripts/serve.sh
python3 scripts/look.py pack-alesia-52
```
Expected: 알레시아에 로마 진영 8 + 갈리아 3 블록. `P`로 재생하면 화살표가 바깥선·안쪽선으로 나가고 셋째 페이즈에 인용 카드가 뜬다.

- [ ] **Step 5: 문서·커밋**

`docs/ALESIA.md` 끝에 「## 말판 alesia-52」 절: 생성 규칙(피처 → 유닛), 세 페이즈의 사료, 규모 논쟁, 「손으로 찍은 좌표 0」.
```bash
git add data/boards/pharsalus-48.json data/boards/cannae-216.json data/boards/alesia-52.json data/boards/_alesia-strength.json scripts/build-alesia-board.py data/micromaps/alesia.json data/micromaps/pharsalus.json data/scenes/rome.json docs/ALESIA.md
git commit -m "feat(말판): 파르살루스·칸나이 캡션·화살표·교전 · 알레시아 말판 생성 (BG 7.79~88) (R54)"
```

---

### Task 4.6: 재생 프레임 계측과 완료 판정

**Files:**
- Create: `scripts/battle-frame.py`
- Modify: `docs/BACKLOG.md` (R54 근거) · `docs/verify/overhaul/battle-*.png`

- [ ] **Step 1: 계측 스크립트**

```python
#!/usr/bin/env python3
"""battle-frame.py: 재생 중간 프레임을 숫자로 잰다. serve.sh의 디버그 Chrome(9222)에 CDP로 붙는다.
    python3 scripts/battle-frame.py pharsalus-48 0.5
유닛 좌표가 양 끝 페이즈 사이에 있는지 단언하고 /tmp/battle-<scene>-<t>.png 를 뜬다."""
import json, sys
from playwright.sync_api import sync_playwright
scene, t = sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
JS = """(t) => {
  const b = window.__ca.battle && window.__ca.battle(); if (!b) return { error: '말판 없음' };
  const st = window.__ca.store.get(); const board = window.__ca.boards.find(x => x.id === st.board);
  b.seek(t); const f = b.frame();
  const i = Math.floor(t), a = board.phases[i], c = board.phases[i + 1];
  const rows = f.units.map(u => { const ua = a.units.find(x => x.id === u.id), uc = c && c.units.find(x => x.id === u.id);
    const between = ua && uc ? (Math.min(ua.at[0], uc.at[0]) - 1e-9 <= u.at[0] && u.at[0] <= Math.max(ua.at[0], uc.at[0]) + 1e-9) : null;
    return { id: u.id, at: u.at, opacity: u.opacity, between }; });
  return { t, caption: f.caption, cite: f.cite, arrows: f.arrows.length, clashes: f.clashes.length, units: rows,
           rendered: window.__ca.map.queryRenderedFeatures({ layers: ['battle-body'] }).length };
}"""
with sync_playwright() as p:
    br = p.chromium.connect_over_cdp('http://127.0.0.1:9222'); ctx = br.contexts[0]; page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto(f'http://127.0.0.1:4180/chronoatlas/?present=1&scene={scene}'); page.wait_for_function('window.__ca && window.__ca.map && window.__ca.map.loaded()'); page.wait_for_timeout(3000)
    out = page.evaluate(JS, t); print(json.dumps(out, ensure_ascii=False, indent=1))
    page.wait_for_timeout(500); page.screenshot(path=f'/tmp/battle-{scene}-{t}.png')
    bad = [u for u in out.get('units', []) if u['between'] is False]
    sys.exit(f'양 끝 사이가 아닌 유닛 {len(bad)}' if bad else 0)
```
엔진의 `window.__ca`에 `boards`도 노출한다(`boards` 배열).

- [ ] **Step 2: 세 말판 계측**

```bash
bash scripts/serve.sh
for s in pharsalus-48 cannae-board pack-alesia-52; do python3 scripts/battle-frame.py $s 0.5 && cp /tmp/battle-$s-0.5.png docs/verify/overhaul/; done
```
Expected: 셋 다 exit 0, `caption`·`cite`가 비지 않고 `rendered > 0`. 캡션 없는 말판이 있으면 Task 4.5로 돌아간다.

- [ ] **Step 3: 근거와 커밋**

`docs/BACKLOG.md` R54를 `●`로, 근거에 세 장면의 `rendered`·`arrows`·`clashes` 수와 스크린샷 경로. `docs/MICROMAP-UX.md` §2 키 표에 `P` `.` `,` 추가.
```bash
git add scripts/battle-frame.py docs/verify/overhaul docs/BACKLOG.md docs/MICROMAP-UX.md src/map/engine.ts
git commit -m "test(말판): 재생 중간 프레임 계측 · R54 닫힘 근거"
```

---

## Self-review

- 스펙 §3.6 네 문법: 블록·화살표·교전·캡션(Task 4.3·4.4), 도시공성은 미시 kind(계획 1/4)로, 인용 카드(4.3·4.4), 강 후광은 `KIND_PAINT.river`에 `line-blur`가 아니라 폭 한 겹(계획 1/4 표의 값 유지, 이 계획에서 안 건드린다).
- 고증 규칙 ①~⑤: 스키마·린트(4.1), 내용(4.5), 부대 카드 상시 문구(4.4).
- 재생 규칙: PHASE_MS 1500 · QUOTE_MS 1500 · 끝에서 멈춤 · `P` `.` `,` (4.3·4.4).
- 타입 일관성: `Frame`·`FrameUnit`·`BoardArrow`·`BoardClash`·`BoardQuote`(board.ts) ↔ `battleGeoJSON` ↔ `battle.ts` ↔ `BattleBar`. 선택 id `unit:<board>:<unit>`는 battle.ts·Inspector·state 테스트가 같은 꼴.
- 좌표를 손으로 적은 곳: 없음. 알레시아는 생성기, 파르살루스·칸나이 화살표는 유닛 `at`에서.
