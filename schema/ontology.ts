// 온톨로지 정본 계약 (볼트 SCHEMA.md v2의 코드판). 프론트·어댑터·린트·MCP가 이 한 벌을 공유한다.
import { z } from 'zod';

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

const Year = z.number().int().min(-3000).max(2100);

export const Entity = z.object({
  id: z.string().regex(/^[a-z]+:[^\s/]+$/, 'id는 type:슬러그'),
  type: z.enum(ENTITY_TYPES),
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  attrs: z.record(z.string(), z.unknown()).default({}),
  points: z.array(z.number().int()).default([]),
  chapters: z.array(z.number().int()).optional(),
  desc: z.string().optional(),
  descs: z.array(z.object({ point: z.number().int().optional(), desc: z.string(), src: z.enum(SRC).optional() })).default([]),
  history: z.array(z.object({ year: Year, patch: z.record(z.string(), z.unknown()) })).optional(),
  ext: z.record(z.string(), z.string().nullable()).default({}),
  location: z.tuple([z.number(), z.number()]).nullable().optional(), // [lon, lat]
  source: z.enum(SOURCE).optional(),
  confidence: z.enum(CONFIDENCE).optional(),
  src: z.enum(SRC),
  note: z.string().optional(),
}).strict();
export type Entity = z.infer<typeof Entity>;

export const Link = z.object({
  from: z.string(),
  to: z.string(),
  rel: z.string().refine((r: string) => RELS.includes(r), { message: 'rel이 정의되지 않음(REL_GROUPS 참조)' }),
  point: z.number().int().optional(),
  from_year: Year.nullable().optional(),
  to_year: Year.nullable().optional(),
  year_basis: z.string().nullable().optional(),
  src: z.enum(SRC),
  confidence: z.enum(CONFIDENCE).optional(),
  note: z.string().optional(),
}).strict();
export type Link = z.infer<typeof Link>;

export const idType = (id: string) => id.split(':')[0];
