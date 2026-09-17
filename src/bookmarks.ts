// src/bookmarks.ts: 커밋 없는 즉석 북마크(R44, OVERHAUL §3.2). localStorage ↔ Scene[]. 서버도 zod도 없다.
// 저장 형식 { v: 1, items: Scene[] }. 가져오기는 화이트리스트 밖 키를 버리고(붙여넣은 JSON에 뭐가 들었을지 모른다) 형식 밖 항목을 센다.
import type { Scene } from './state';

export const BOOKMARK_GROUP = '내 북마크';
const KEYS = ['id', 'title', 'year', 'to', 'sel', 'center', 'zoom', 'pitch', 'bearing', 'view', 'skin', 'layers', 'note', 'board', 'phase'] as const;

function clean(x: unknown): Scene | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id || typeof o.title !== 'string' || !o.title || !Number.isInteger(o.year)) return null;
  const out: Record<string, unknown> = {};
  for (const k of KEYS) if (o[k] !== undefined) out[k] = o[k];
  out.group = BOOKMARK_GROUP;
  return out as unknown as Scene;
}

export function createBookmarks(ds: string, storage: Storage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage) {
  const key = `chronoatlas:bookmarks:${ds}`;
  let available = !!storage;
  try { storage?.setItem(`${key}:probe`, '1'); storage?.removeItem(`${key}:probe`); } catch { available = false; }   // 사파리 프라이빗 창은 setItem에서 던진다
  const read = (): Scene[] => {
    if (!available) return [];
    try { const j = JSON.parse(storage!.getItem(key) ?? '{"v":1,"items":[]}'); return Array.isArray(j.items) ? j.items.flatMap((i: unknown) => clean(i) ?? []) : []; } catch { return []; }
  };
  const write = (items: Scene[]): Scene[] => {
    if (!available) return [];
    try { storage!.setItem(key, JSON.stringify({ v: 1, items })); return items; } catch { available = false; return []; }
  };
  return {
    get available() { return available; },
    list: read,
    save(s: Scene) { const c = clean(s); if (!c) return read(); return write([...read().filter(x => x.id !== c.id), c]); },
    remove(id: string) { return write(read().filter(x => x.id !== id)); },
    exportJson() { return JSON.stringify({ v: 1, items: read() }, null, 2); },
    importJson(text: string) {
      let j: unknown; try { j = JSON.parse(text); } catch { return { added: 0, dropped: 0 }; }
      const items = (j as { items?: unknown[] } | null)?.items; if (!Array.isArray(items)) return { added: 0, dropped: 0 };
      const ok = items.map(clean); const good = ok.filter((x): x is Scene => !!x);
      write([...read().filter(x => !good.some(g => g.id === x.id)), ...good]);
      return { added: good.length, dropped: ok.length - good.length };
    },
  };
}
export type Bookmarks = ReturnType<typeof createBookmarks>;
