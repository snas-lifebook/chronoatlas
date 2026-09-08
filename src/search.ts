// 검색 (TASKS 2.3): 이름·이명·초성, 인메모리. 자료실과 같은 방침(es-hangul, 초성 검색 공짜).
import { getChoseong } from 'es-hangul';

export interface SearchItem { id: string; name: string; aliases: string[]; type: string }
interface Indexed extends SearchItem { keys: string[]; cho: string[] }

export function buildIndex(items: SearchItem[]): Indexed[] {
  return items.map(it => {
    const keys = [it.name, ...it.aliases].map(k => k.toLowerCase());
    return { ...it, keys, cho: keys.map(k => getChoseong(k).replace(/\s+/g, '')) };
  });
}

// 점수: 앞부분 일치 > 포함 > 초성 앞부분 > 초성 포함. 동점은 이름 짧은 것.
export function search(idx: Indexed[], q: string, limit = 20): SearchItem[] {
  const query = q.trim().toLowerCase(); if (!query) return [];
  const qcho = query.replace(/\s+/g, '');
  const isCho = /^[ㄱ-ㅎ]+$/.test(qcho);
  const scored: [number, Indexed][] = [];
  for (const it of idx) {
    let best = 0;
    for (let i = 0; i < it.keys.length; i++) {
      const k = it.keys[i];
      if (!isCho) { if (k.startsWith(query)) best = Math.max(best, 4); else if (k.includes(query)) best = Math.max(best, 3); }
      const c = it.cho[i];
      if (c.startsWith(qcho)) best = Math.max(best, isCho ? 4 : 2); else if (c.includes(qcho)) best = Math.max(best, isCho ? 3 : 1);
    }
    if (best) scored.push([best, it]);
  }
  return scored.sort((a, b) => b[0] - a[0] || a[1].name.length - b[1].name.length).slice(0, limit).map(([, it]) => ({ id: it.id, name: it.name, aliases: it.aliases, type: it.type }));
}
