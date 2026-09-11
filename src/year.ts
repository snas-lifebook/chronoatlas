// 「그 해에 누가·어디가·무엇이」 (R36, BACKLOG 라운드 F). 순수 함수 — 뷰는 이걸 그리기만 한다.
//
// ── 규칙을 먼저 적는다. 중요도를 지어내지 않는다(BACKLOG §F). ───────────────────────────
//
// 1. 인물 — 그 해에 **관계가 활성인** 사람. 순위는 그런 관계의 개수다.
//    활성 = 엣지의 from_year ≤ Y ≤ to_year(둘 다 있을 때) · 또는 from_year == Y(그 해에 시작)
//           · 또는 to_year == Y(그 해에 끝).
//    **왜 born/died를 안 쓰나**: 정본 262명 중 born·died를 가진 사람이 2명뿐이다(2026-09-11 실측).
//    "그 해에 살아 있던 사람"은 이 데이터로 계산이 안 된다. 있는 척하지 않는다.
//    한계: 이 규칙이 답을 내는 해는 -753~1481 중 820년(37%)이다. 나머지 해는 빈 상태로 둔다.
//
// 2. 국가 — 그 해에 유효한 territory 정치체를 **면적 순**으로. 유효 = valid_from ≤ Y < valid_to.
//    같은 이름은 면적을 합치고, ':label' 피처는 뺀다(같은 정치체의 이름표 점이라 두 번 세어진다).
//    Cliopatria가 직접 주는 값이라 여기엔 판정이 없다.
//
// 3. 그 해의 일 — 셋을 합친다. 사건 노드 year == Y · 전투 year == Y ·
//    **그 해에 시작하거나 끝난 관계**(from_year == Y 또는 to_year == Y).
//    마지막 항이 중요하다: 루비콘 도하는 정본에 사건이 아니라
//    `카이사르 -located_in-> 루비콘 강`(-49~-49) 관계로 들어 있다.
//    **순서**: 사건·전투 → 그 해에 시작해서 그 해에 끝난 관계(단년) → 시작한 관계 → 끝난 관계.
//    단년을 앞에 두는 근거: 한 해에 시작하고 끝난 관계는 그 자체가 그 해의 사건이고,
//    시작·끝만 걸린 것은 여러 해에 걸친 상태의 경계다. BC 49에서 이 순서가 루비콘을 맨 앞에 올린다
//    (안 그러면 그해 해체된 삼두정치 관계 여섯이 앞을 채워 루비콘이 8번째로 밀린다 — 실측).
//
// 동점은 이름 오름차순으로 끊는다 — 같은 해는 언제나 같은 순서여야 한다(내보내기·스크린샷 재현).
// ────────────────────────────────────────────────────────────────────────────────
import { REL_LABEL, type Graph } from './graph/data';

export interface YearPerson { id: string; name: string; n: number }
export interface YearNation { name: string; area: number }
export interface YearHappening { id: string | null; label: string; kind: 'event' | 'battle' | 'rel'; phase?: 'point' | 'start' | 'end' }
export interface YearBrief { people: YearPerson[]; nations: YearNation[]; nationsMore: number; happenings: YearHappening[]; }

type Feat = { properties: Record<string, any> };

/** 엣지가 그 해에 활성인가. 위 규칙 1. */
export function edgeActive(l: { from_year?: number | null; to_year?: number | null }, year: number): boolean {
  const f = l.from_year ?? null, t = l.to_year ?? null;
  if (f === year || t === year) return true;
  return f != null && t != null && f <= year && year <= t;
}

export function yearBrief(
  year: number,
  src: { graph: Graph | null; territory: Feat[]; events: { year: number; label: string }[]; battles: Feat[] },
  limit = 4,
): YearBrief {
  const { graph, territory, events, battles } = src;

  // 1. 인물
  const count = new Map<string, number>();
  const happenings: YearHappening[] = [];
  if (graph) {
    for (const l of graph.edges) {
      if (!edgeActive(l, year)) continue;
      for (const side of [l.from, l.to]) {
        if (graph.nodes.get(side)?.type === 'person') count.set(side, (count.get(side) ?? 0) + 1);
      }
      // 그 해에 시작하거나 끝난 관계만 '그 해의 일'이다. 이어지고 있는 관계는 그 해의 사건이 아니다.
      if (l.from_year === year || l.to_year === year) {
        const a = graph.nodes.get(l.from)?.name, b = graph.nodes.get(l.to)?.name;
        const phase = l.from_year === year && l.to_year === year ? 'point' : l.from_year === year ? 'start' : 'end';
        if (a && b) happenings.push({ id: l.from, label: `${a} · ${b} ${REL_LABEL[l.rel] ?? l.rel}`, kind: 'rel', phase });
      }
    }
  }
  const people = [...count]
    .map(([id, n]) => ({ id, name: graph!.nodes.get(id)!.name, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'ko'))
    .slice(0, limit);

  // 2. 국가
  const area = new Map<string, number>();
  for (const f of territory) {
    const p = f.properties;
    if (String(p.id ?? '').endsWith(':label')) continue;
    if (!((p.valid_from ?? -Infinity) <= year && year < (p.valid_to ?? Infinity))) continue;
    const name = p.name ?? p.name_en;
    if (name) area.set(name, (area.get(name) ?? 0) + (Number(p.area) || 0));
  }
  const ranked = [...area].map(([name, a]) => ({ name, area: a })).sort((x, y) => y.area - x.area || x.name.localeCompare(y.name, 'ko'));

  // 3. 그 해의 일 — 사건·전투를 앞에, 관계를 뒤에
  const head: YearHappening[] = [];
  for (const e of events) if (e.year === year) head.push({ id: null, label: e.label, kind: 'event' });
  for (const f of battles) {
    const p = f.properties;
    if (p.year === year) head.push({ id: p.entity ?? p.id, label: p.name_ko ?? p.id, kind: 'battle' });
  }
  const PHASE = { point: 1, start: 2, end: 3 } as const;
  happenings.sort((a, b) => PHASE[a.phase!] - PHASE[b.phase!] || a.label.localeCompare(b.label, 'ko'));
  const seen = new Set<string>();
  const all = [...head, ...happenings].filter(h => !seen.has(h.label) && seen.add(h.label));

  return { people, nations: ranked.slice(0, limit), nationsMore: Math.max(0, ranked.length - limit), happenings: all.slice(0, limit) };
}
