// 온톨로지 정본 계약 (볼트 SCHEMA.md v2의 코드판). 프론트·어댑터·린트·MCP가 이 한 벌을 공유한다.
// 어휘 상수는 vocab.ts에 있다. 브라우저는 그쪽만 import한다(zod를 끌고 들어오지 않도록).
import { z } from 'zod';
import { ENTITY_TYPES, RELS, SRC, CONFIDENCE, SOURCE } from './vocab.ts';

export * from './vocab.ts';

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
