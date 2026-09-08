import { describe, it, expect } from 'vitest';
import { openDataset, tools } from '../mcp/tools';

const d = openDataset(process.cwd());
describe('MCP 툴 (TASKS 3.4) — 패널과 같은 graph.json', () => {
  it('get_schema', () => { const s = tools.get_schema(d); expect(s.entity_types).toContain('faction'); expect(s.dataset.counts.entities).toBe(650); });
  it('find_entity 초성', () => expect(tools.find_entity(d, 'ㅋㅇㅅㄹ')[0].id).toBe('person:카이사르'));
  it('neighbors(카이사르, -60, -44) = 패널 목록과 같은 from_year 필터', () => {
    const r: any = tools.neighbors(d, 'person:카이사르', -60, -44);
    expect(r.count).toBeGreaterThan(0);
    for (const n of r.neighbors) { if (n.from_year != null) { expect(n.from_year).toBeGreaterThanOrEqual(-60); expect(n.from_year).toBeLessThanOrEqual(-44); } }
    expect(r.state).toBeTruthy();
  });
  it('path 카이사르→폼페이우스 1홉', () => { const r: any = tools.path(d, 'person:카이사르', 'person:폼페이우스'); expect(r.found).toBe(true); expect(r.hops).toBe(1); });
  it('없는 id는 error', () => expect((tools.neighbors(d, 'person:없음') as any).error).toBeTruthy());
});
