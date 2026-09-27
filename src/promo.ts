// 첫 방문 홍보 영상 팝업을 띄울지(River 2026-09-27 「처음 보는 사람이나 익숙하지 않은 사람들이 볼 수 있게」).
// 발표·장면·선택·말판 주소로 들어오면 띄우지 않는다. 발표 도중에 영상이 튀어나오면 안 된다. ?promo=1은 강제로 띄운다.
export const PROMO_KEY = 'promo-seen-v1';
const BLOCK = ['present', 'scene', 'sel', 'board', 'bt'];

export function shouldShowPromo(search: string, seen: string | null): boolean {
  const q = new URLSearchParams(search);
  if (q.get('promo') === '1') return true;
  if (q.get('promo') === '0' || BLOCK.some(k => q.has(k))) return false;
  return !seen;
}
