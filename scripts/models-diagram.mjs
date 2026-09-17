// scripts/models-diagram.mjs: zod 스키마(schema/*.ts)에서 Mermaid classDiagram을 생성해 docs/MODELS.md의
// <!-- generated:schema --> … <!-- /generated --> 블록을 갈아끼운다(OVERHAUL §3.6d P-Z). 손으로 그린 도식이 낡지 않게.
//   node --experimental-strip-types scripts/models-diagram.mjs          # 쓴다
//   node --experimental-strip-types scripts/models-diagram.mjs --check  # 문서가 최신인지만 (test/models.test.ts)
// zod 4의 내부 def(`schema._zod.def`)를 걷는다. 이름 있는 스키마(export)는 그 이름으로, 인라인 객체는 부모이름+필드로 클래스가 된다.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES = { 'schema/micromap.ts': ['MicroMap', 'MicroFeature', 'Callout', 'Basemap'], 'schema/board.ts': ['Board', 'Phase', 'Unit', 'Quote', 'Arrow', 'Clash'] };
const START = '<!-- generated:schema -->', END = '<!-- /generated -->';

const named = new Map();            // schema → 이름
const classes = new Map();          // 이름 → [{ field, type, opt }]
const edges = [];                   // [부모, 자식, 종류, 라벨]
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const def = s => s?._zod?.def ?? s?._def ?? {};

function unwrap(s) {                // optional·nullable·default를 벗기고 표시용 접미사를 모은다
  let opt = false, d = def(s);
  while (['optional', 'nullable', 'default', 'nonoptional', 'readonly'].includes(d.type)) { if (d.type !== 'readonly') opt = true; s = d.innerType; d = def(s); }
  return { s, d, opt };
}

function typeOf(s, owner, field) {
  const { s: inner, d, opt } = unwrap(s);
  const t = d.type;
  if (named.has(inner)) { edges.push([owner, named.get(inner), '*--', field, opt]); return { text: named.get(inner), opt }; }
  if (t === 'object') { const name = owner + cap(field); addClass(name, inner); edges.push([owner, name, '*--', field, opt]); return { text: name, opt }; }
  if (t === 'array') {
    const el = unwrap(d.element);
    if (named.has(el.s)) { edges.push([owner, named.get(el.s), 'o--', `${field} *`]); return { text: `${named.get(el.s)}[]`, opt }; }
    if (el.d.type === 'object') { const name = owner + cap(field); addClass(name, el.s); edges.push([owner, name, 'o--', `${field} *`]); return { text: `${name}[]`, opt }; }
    return { text: `${typeOf(d.element, owner, field).text}[]`, opt };
  }
  if (t === 'tuple') return { text: `[${(d.items ?? []).map(i => typeOf(i, owner, field).text).join(',')}]`, opt };
  if (t === 'enum') return { text: `enum(${Object.values(d.entries ?? {}).join('|')})`, opt };
  if (t === 'literal') return { text: `literal(${(d.values ?? []).join('|')})`, opt };
  if (t === 'union') {
    const parts = (d.options ?? []).map(o => { const u = unwrap(o); return u.d.type === 'object' ? Object.keys(u.d.shape ?? {}).map(k => `{${k}}`).join('') : typeOf(o, owner, field).text; });
    return { text: parts.join(' | '), opt };
  }
  if (t === 'record') return { text: `Record~${typeOf(d.keyType, owner, field).text},${typeOf(d.valueType, owner, field).text}~`, opt };
  return { text: t ?? 'unknown', opt };
}

function addClass(name, schema) {
  if (classes.has(name)) return;
  classes.set(name, []);
  const rows = classes.get(name);
  for (const [field, sub] of Object.entries(def(schema).shape ?? {})) { const { text, opt } = typeOf(sub, name, field); rows.push({ field, type: text, opt }); }
}

for (const [file, names] of Object.entries(MODULES)) {
  const mod = await import(join(ROOT, file));
  for (const n of names) { if (!mod[n]) throw new Error(`${file}: ${n} 없음`); named.set(mod[n], n); }
}
for (const names of Object.values(MODULES)) for (const n of names) addClass(n, [...named].find(([, v]) => v === n)[0]);

const lines = ['```mermaid', 'classDiagram'];
for (const [name, rows] of classes) {
  lines.push(`  class ${name} {`);
  for (const r of rows) lines.push(`    +${r.type.replace(/[<>]/g, '')} ${r.field}${r.opt ? '?' : ''}`);
  lines.push('  }');
}
const seen = new Set();
for (const [a, b, kind, label, opt] of edges) { const k = `${a}|${b}|${label}`; if (seen.has(k)) continue; seen.add(k); lines.push(`  ${a} "1" ${kind} "${label.endsWith('*') ? 'many' : opt ? '0..1' : '1'}" ${b} : ${label.replace(' *', '')}`); }
lines.push('```');
const block = `${START}\n_생성됨: \`node --experimental-strip-types scripts/models-diagram.mjs\` (zod ${Object.keys(MODULES).join(' · ')}). 손으로 고치지 않는다._\n\n${lines.join('\n')}\n${END}`;

const path = join(ROOT, 'docs', 'MODELS.md');
const doc = readFileSync(path, 'utf8');
const a = doc.indexOf(START), b = doc.indexOf(END);
if (a < 0 || b < 0) { console.error('MODELS.md에 generated:schema 블록 표식이 없다'); process.exit(1); }
const next = doc.slice(0, a) + block + doc.slice(b + END.length);
if (process.argv.includes('--check')) {
  if (next !== doc) { console.error('MODELS.md의 생성 블록이 스키마와 다르다. scripts/models-diagram.mjs를 다시 돌려라'); process.exit(1); }
  console.log('MODELS.md 생성 블록 최신'); process.exit(0);
}
writeFileSync(path, next);
console.log(`MODELS.md 생성 블록 갱신: 클래스 ${classes.size}, 관계 ${seen.size}`);
