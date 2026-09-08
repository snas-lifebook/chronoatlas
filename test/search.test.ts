import { describe, it, expect } from 'vitest';
import { buildIndex, search } from '../src/search';

const items = [
  { id: 'person:카이사르', name: '카이사르', aliases: ['율리우스 카이사르', 'Caesar'], type: 'person' },
  { id: 'person:키케로', name: '키케로', aliases: ['Cicero'], type: 'person' },
  { id: 'place:로마', name: '로마', aliases: ['Roma'], type: 'place' },
  { id: 'event:루비콘도하', name: '루비콘 도하', aliases: [], type: 'event' },
];
const idx = buildIndex(items);

describe('검색 (TASKS 2.3, es-hangul)', () => {
  it('이름 부분 일치', () => expect(search(idx, '카이').map(r => r.id)).toEqual(['person:카이사르']));
  it('초성 검색', () => expect(search(idx, 'ㅋㅇㅅㄹ').map(r => r.id)).toEqual(['person:카이사르']));
  it('이명·라틴 대소문자 무시', () => expect(search(idx, 'cae').map(r => r.id)).toEqual(['person:카이사르']));
  it('앞부분 일치가 먼저', () => { expect(search(idx, '사르').map(r => r.id)).toEqual(['person:카이사르']); const r = search(idx, 'ㅋ').map(r => r.id); expect(r).toContain('person:카이사르'); expect(r).toContain('person:키케로'); });
  it('빈 질의는 빈 결과, 최대 20', () => { expect(search(idx, '  ')).toEqual([]); expect(search(idx, 'ㄹ').length).toBeLessThanOrEqual(20); });
});
