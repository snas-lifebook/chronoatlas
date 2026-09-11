// 말판(board) 데이터 계약 — R37·R38·R39, BACKLOG 라운드 G.
//
// ── 이건 정본이 아니다 ────────────────────────────────────────────────────────
// 말판 배치는 **사실 주장이 아니라 교보재**다. 어느 부대가 정확히 어느 좌표에 섰는지는
// 아무도 모른다. 그래서 정본 온톨로지와 파일도 스키마도 분리한다(`data/boards/*.json`).
// `src`·`confidence` 같은 정본 신뢰도 필드를 **쓰지 않는다** — 섞이면 교보재가 사실로 읽힌다.
// 대신 `teaching: true`를 강제하고 `source`에 무엇을 근거로 그렸는지 문장으로 적게 한다.
//
// 정본과 잇는 끈은 `event`·`entity` 두 개뿐이고 둘 다 선택이다. 있으면 클릭으로 오갈 수 있고,
// 없어도 말판은 혼자 선다.
//
// ── 왜 페이즈마다 전체 배치인가 ───────────────────────────────────────────────
// 델타(움직인 것만)가 아니라 각 페이즈가 **그 순간의 전체 배치**를 담는다.
// 손으로 찍는 파일이라 델타는 사람이 못 읽고, 렌더도 누적 상태를 들고 있어야 한다.
// 용량은 문제가 안 된다 — 한 전투가 유닛 스무 개 남짓이다.
//
// ── zod를 여기 두는 이유 ──────────────────────────────────────────────────────
// 브라우저 번들에 zod를 들이지 않는다. 예전에 `graph/data.ts`가 상수 하나 때문에
// `schema/ontology.ts`를 import해서 zod가 통째로 초기 번들에 실린 적이 있다(28 kB gz).
// 검증은 빌드·테스트에서만 하고, 런타임이 쓰는 순수 함수는 `src/board.ts`에 둔다.
import { z } from 'zod';

/** 병종. 목각 피규어(R39)의 모양을 가르는 최소 구분이다. 늘릴 때는 렌더도 같이 늘린다. */
export const ARMS = ['infantry', 'cavalry', 'light', 'elephant', 'command'] as const;
export const ARM_KO: Record<(typeof ARMS)[number], string> = {
  infantry: '중보병', cavalry: '기병', light: '경보병', elephant: '전투코끼리', command: '지휘',
};

export const Unit = z.object({
  id: z.string().min(1),                         // 말판 안에서만 유일하면 된다
  at: z.tuple([z.number(), z.number()]),         // [경도, 위도]
  actor: z.string().min(1),                      // 세력. 정본 팔레트 id면 색이 붙는다
  arm: z.enum(ARMS),
  label: z.string().min(1),
  strength: z.number().int().positive().optional(),
  facing: z.number().min(0).max(360).optional(), // 방위(도). 없으면 렌더가 알아서
  entity: z.string().optional(),                 // 정본 엔티티 id. 있으면 클릭으로 인스펙터
});

export const Phase = z.object({
  t: z.number().int().min(0),
  title: z.string().min(1),
  note: z.string().optional(),
  units: z.array(Unit).min(1),
});

export const Board = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  year: z.number().int(),
  event: z.string().optional(),                  // 정본 event id
  center: z.tuple([z.number(), z.number()]),
  zoom: z.number().optional(),
  bearing: z.number().optional(),
  teaching: z.literal(true),                     // 교보재다. 빼면 파싱이 실패한다
  source: z.string().min(10),                    // 무엇을 근거로 그렸나. 빈 문자열 금지
  phases: z.array(Phase).min(1),
});

export type TUnit = z.infer<typeof Unit>;
export type TPhase = z.infer<typeof Phase>;
export type TBoard = z.infer<typeof Board>;

/** 스키마만으로는 못 잡는 것들. 반환값이 빈 배열이면 통과. */
export function lintBoard(b: TBoard): string[] {
  const err: string[] = [];
  const ts = b.phases.map(p => p.t);
  if (new Set(ts).size !== ts.length) err.push('페이즈 t 중복');
  if (ts.some((t, i) => i && t <= ts[i - 1])) err.push('페이즈 t가 오름차순이 아니다');
  for (const p of b.phases) {
    const ids = p.units.map(u => u.id);
    if (new Set(ids).size !== ids.length) err.push(`t${p.t}: 유닛 id 중복`);
    for (const u of p.units) {
      const [lon, lat] = u.at;
      if (lon < -180 || lon > 180 || lat < -90 || lat > 90) err.push(`t${p.t} ${u.id}: 좌표 범위 밖 ${u.at}`);
    }
  }
  // 페이즈마다 전체 배치라, 유닛이 소리 없이 사라지면 대개 오타다. 진짜 전멸이면 note에 적게 한다.
  const first = new Set(b.phases[0].units.map(u => u.id));
  for (const p of b.phases.slice(1)) {
    const gone = [...first].filter(id => !p.units.some(u => u.id === id));
    if (gone.length && !p.note) err.push(`t${p.t}: 유닛 ${gone.length}개가 빠졌는데 note가 없다 (${gone.slice(0, 3).join(', ')})`);
  }
  return err;
}
