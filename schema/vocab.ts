// 온톨로지 어휘 상수: 타입·rel 의미군·출처 열거. 볼트 SCHEMA.md v2.
// ontology.ts에서 떼어낸 이유: 브라우저(graph/data.ts)가 REL_GROUPS 하나를 쓰는데
// ontology.ts는 zod를 import해서 검증 라이브러리 전체가 초기 번들에 실려 갔다.
// 여기엔 의존성을 넣지 않는다. zod가 필요한 스키마는 ontology.ts에.

export const ENTITY_TYPES = ['person', 'place', 'event', 'group', 'institution', 'work', 'period', 'faction', 'office'] as const;

// 의미군 → rel. 선 스타일과 방향 규칙의 근원. 새 rel은 여기 먼저.
export const REL_GROUPS = {
  ally:    ['allied_with', 'protected'],
  hostile: ['opposed'],
  rule:    ['ruled', 'conquered', 'controls', 'claims', 'core'],
  lineage: ['succeeded', 'child_of', 'married'],
  member:  ['member_of', 'held_office', 'aligned_with'],
  locate:  ['located_in', 'occurred_at'],
  act:     ['participated_in', 'decided', 'triggers'],
  make:    ['created', 'applied_to', 'grants'],
} as const;
export const RELS = Object.values(REL_GROUPS).flat() as readonly string[];

export const SRC = ['point', 'gibbon', 'wikidata', 'dprr', 'manual'] as const;
export const CONFIDENCE = ['high', 'medium', 'low'] as const;
export const SOURCE = ['book', 'web', 'book+web'] as const;
