import { describe, it, expect } from 'vitest';
import { createBookmarks, BOOKMARK_GROUP } from '../src/bookmarks';
import { bookmarkOf, DEFAULTS } from '../src/state';

function fakeStorage(): Storage { const m = new Map<string, string>(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage; }

describe('즉석 북마크 (R44)', () => {
  it('저장 → 목록 → 삭제 왕복', () => {
    const b = createBookmarks('rome', fakeStorage());
    const sc = bookmarkOf({ ...DEFAULTS, year: -49, center: [12.4, 44.1], zoom: 10.8, board: 'pharsalus-48', phase: 2 }, { id: 'x1', title: '루비콘', layers: ['territory'] });
    expect(b.save(sc)).toHaveLength(1);
    expect(b.list()[0]).toMatchObject({ id: 'x1', title: '루비콘', year: -49, group: BOOKMARK_GROUP, board: 'pharsalus-48', phase: 2 });
    expect(b.remove('x1')).toHaveLength(0);
  });
  it('같은 id 는 덮어쓴다', () => {
    const b = createBookmarks('rome', fakeStorage());
    b.save({ id: 'a', title: '1', year: -1 }); b.save({ id: 'a', title: '2', year: -2 });
    expect(b.list()).toHaveLength(1); expect(b.list()[0].title).toBe('2');
  });
  it('가져오기는 화이트리스트 밖 키를 버리고 형식 밖 항목을 센다', () => {
    const b = createBookmarks('rome', fakeStorage());
    const r = b.importJson(JSON.stringify({ v: 1, items: [{ id: 'ok', title: '좋음', year: -44, evil: '<script>' }, { title: '없음' }, 'x'] }));
    expect(r).toEqual({ added: 1, dropped: 2 });
    expect(Object.keys(b.list()[0])).not.toContain('evil');
    expect(b.importJson('not json')).toEqual({ added: 0, dropped: 0 });
  });
  it('내보내기는 다시 가져올 수 있다', () => {
    const a = createBookmarks('rome', fakeStorage()), c = createBookmarks('rome', fakeStorage());
    a.save({ id: 'k', title: 't', year: 117, skin: 'oldmap', layers: ['territory'] });
    expect(c.importJson(a.exportJson())).toEqual({ added: 1, dropped: 0 });
    expect(c.list()).toEqual(a.list());
  });
  it('묶음(프로젝트)을 지키고 묶음 단위로 내보낸다 (R53)', () => {
    const b = createBookmarks('rome', fakeStorage());
    b.save({ id: 'p1', title: '1팀 장면', year: -52, group: '1팀 · 갈리아' }); b.save({ id: 'p2', title: '내 것', year: -44 }); b.save({ id: 'p3', title: '공백 묶음', year: -44, group: '   ' });
    expect(b.list().map(x => x.group)).toEqual(['1팀 · 갈리아', BOOKMARK_GROUP, BOOKMARK_GROUP]);
    expect(b.groups()).toEqual(['1팀 · 갈리아', BOOKMARK_GROUP]);
    expect(JSON.parse(b.exportJson('1팀 · 갈리아')).items.map((x: { id: string }) => x.id)).toEqual(['p1']);
    expect(JSON.parse(b.exportJson()).items).toHaveLength(3);
  });
  it('storage 가 없으면 available=false 이고 저장은 조용히 실패한다', () => {
    const b = createBookmarks('rome', undefined as unknown as Storage);
    expect(b.available).toBe(false); expect(b.save({ id: 'x', title: 'x', year: 0 })).toEqual([]);
  });
});
