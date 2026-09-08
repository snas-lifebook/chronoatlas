// 온톨로지 린트 (F11). 대상은 어댑터 산출물 graph.json — 정본 행이 그대로 들어 있어 정본 검사와 같다.
// 실행: node --experimental-strip-types scripts/lint.ts [graph.json]. 오류 있으면 exit 1 (빌드 게이트).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { RELS, idType } from '../schema/ontology.ts';

export interface Report { errors: string[]; warnings: string[] }

export function lint(graph: { nodes: any[]; edges: any[] }): Report {
  const E: string[] = [], W: string[] = [];
  const ids = new Set<string>();
  for (const n of graph.nodes) {
    if (ids.has(n.id)) E.push(`중복 id ${n.id}`); ids.add(n.id);
    if (!n.src) E.push(`src 없음 ${n.id}`);
    if (n.type === 'place' && !n.lonlat) W.push(`좌표 없는 place ${n.id}`);
    if (n.lonlat && (Math.abs(n.lonlat[0]) > 180 || Math.abs(n.lonlat[1]) > 90)) E.push(`좌표 범위 밖 ${n.id} ${n.lonlat}`);
    if (n.lonlat && n.lonlat[0] > 30 && n.lonlat[1] < 30 && n.lonlat[0] < 60) W.push(`좌표 뒤집힘 의심(lat,lon?) ${n.id} ${n.lonlat}`);
    if (n.born != null && n.died != null && n.born > n.died) E.push(`생몰 역전 ${n.id} ${n.born}>${n.died}`);
  }
  const degree = new Map<string, number>();
  for (const l of graph.edges) {
    const tag = `${l.from} -${l.rel}-> ${l.to}`;
    if (!ids.has(l.from) || !ids.has(l.to)) E.push(`끊어진 링크 ${tag}`);
    if (!RELS.includes(l.rel)) E.push(`정의 밖 rel ${tag}`);
    if (!l.src) E.push(`src 없음 ${tag}`);
    if (l.rel === 'occurred_at' && idType(l.from) !== 'event') E.push(`occurred_at 주어가 event 아님 ${tag}`);
    if (l.rel === 'participated_in' && idType(l.to) !== 'event') E.push(`participated_in 목적어가 event 아님 ${tag}`);
    if (l.rel === 'held_office' && idType(l.to) !== 'office') W.push(`held_office 목적어가 office 아님(수기 링크 — office.history로 옮길 것) ${tag}`);
    if (l.from_year != null && l.to_year != null && l.from_year > l.to_year) E.push(`연도 역순 ${tag} ${l.from_year}>${l.to_year}`);
    for (const y of [l.from_year, l.to_year]) if (y != null && (y < -3000 || y > 2100)) E.push(`연도 범위 밖 ${tag} ${y}`);
    degree.set(l.from, (degree.get(l.from) ?? 0) + 1); degree.set(l.to, (degree.get(l.to) ?? 0) + 1);
  }
  const orphans = graph.nodes.filter(n => !degree.has(n.id) && n.type !== 'period');
  if (orphans.length) W.push(`고아 노드 ${orphans.length}건: ${orphans.slice(0, 5).map(n => n.id).join(', ')}…`);
  const noYear = graph.edges.filter(l => l.from_year == null).length;
  W.push(`연도 미상 링크 ${noYear}/${graph.edges.length}`);
  return { errors: E, warnings: W };
}

if (process.argv[1]?.endsWith('lint.ts')) {
  const p = process.argv[2] ?? join(import.meta.dirname, '..', 'public', 'datasets', 'rome', 'graph.json');
  const r = lint(JSON.parse(readFileSync(p, 'utf8')));
  // 래칫: baseline(정본에 이미 있던 결함, proposals/에 수정안 있음)은 경고로 강등. 새 오류만 게이트.
  const basePath = join(import.meta.dirname, 'lint.baseline.json');
  const baseline = new Set<string>(existsSync(basePath) ? JSON.parse(readFileSync(basePath, 'utf8')) : []);
  const fresh = r.errors.filter(e => !baseline.has(e));
  for (const w of r.warnings) console.log('warn ', w);
  for (const e of r.errors) console.log(baseline.has(e) ? 'base ' : 'ERROR', e);
  console.log(`lint: ${fresh.length} new errors, ${r.errors.length - fresh.length} baseline, ${r.warnings.length} warnings`);
  if (fresh.length) process.exit(1);
}
