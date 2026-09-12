// 말·인물 위치 색. 정본 팔레트 8세력에 파벌을 넣지 않는다 — 같은 로마를 갈라야 할 때만 여기 쓴다.
export const TOKEN_COLOR: Record<string, string> = {
  'person:카이사르': '#8C3B2E',
  'person:폼페이우스': '#5B6E8C',
};
export const FALLBACK_TOKEN = '#6B6F76';

export function tokenColor(owner: string | null | undefined, faction: string | null | undefined, palette: Record<string, string> = {}): string {
  if (owner && TOKEN_COLOR[owner]) return TOKEN_COLOR[owner];
  if (faction && palette[faction]) return palette[faction];
  return FALLBACK_TOKEN;
}
