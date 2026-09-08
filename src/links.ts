// 자료실 ↔ 크로노아틀라스 주소 레지스트리 (D7, TASKS 2.5). 양쪽 다 한 곳에서만 만든다 — 자료실은 site/lib/links.ts.
export const LIBRARY = 'https://roma-library.pages.dev';
export const ATLAS = 'https://snas-lifebook.github.io/chronoatlas/';

export const libraryObject = (id: string, name: string) => `${LIBRARY}/objects/${id.split(':')[0]}/${encodeURIComponent(name)}`;
export const libraryPoint = (n: number, slug?: string) => `${LIBRARY}/read/point/${n}${slug ? `#${encodeURIComponent(slug)}` : ''}`;
// 자료실 객체 페이지 → 지도. 연도가 없으면 첫 장면이 대신 뜬다.
export const atlasUrl = (o: { ds?: string; sel?: string | null; year?: number | null; scene?: string | null }) => {
  const q = new URLSearchParams();
  if (o.ds && o.ds !== 'rome') q.set('ds', o.ds);
  if (o.sel) q.set('sel', o.sel);
  if (o.year != null) q.set('y', String(o.year));
  if (o.scene) q.set('scene', o.scene);
  const s = q.toString();
  return s ? `${ATLAS}?${s}` : ATLAS;
};
