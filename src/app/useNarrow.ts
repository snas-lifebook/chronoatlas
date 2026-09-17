// src/app/useNarrow.ts: 620px 이하(DESIGN §4 「모바일은 읽기 전용」, OVERHAUL §3.8). 참이면 App이 MobileSheet를 띄우고 편집 크롬을 숨긴다.
import { useEffect, useState } from 'react';
const Q = '(max-width: 620px)';
export function useNarrow(): boolean {
  const [n, setN] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(Q).matches);
  useEffect(() => { const m = matchMedia(Q); const fn = () => setN(m.matches); m.addEventListener('change', fn); return () => m.removeEventListener('change', fn); }, []);
  return n;
}
