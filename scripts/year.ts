// 정본 attrs의 연도 문자열 한 개를 정수로. **읽을 수 없으면 null이다 — 지어내지 않는다(CONSTITUTION 0-2).**
//
// 왜 따로 떼어 놨나: adapt.ts 안에 있을 때 이 함수는 문자열 어디든 **첫 숫자를 그냥 집었다.**
// 그래서 정본이 멀쩡한데도 산출물에 없는 연도가 생겼다(2026-09-11 실측 14건):
//   "제2차 포에니 전쟁" → 서기 2년 · "기원전 4세기" → 기원전 4년 · "1세기~4세기 초" → 서기 1년
// 자마 전투가 지도와 타임라인에서 서기 2년에 찍히고 있었다. 정본 오류가 아니라 파서가 만든 사실이다.
//
// 규칙은 셋뿐이다.
//   1. 세기는 연도가 아니다. "기원전 4세기"는 기원전 400~301이지 기원전 4년이 아니다 → null.
//   2. 서수는 연도가 아니다. "제2차"의 2는 회차다 → null.
//   3. 연도 표지가 있어야 한다. '년'이 붙어 있거나 앞에 기원전·BC·서기·AD가 오거나, 문자열 전체가 수여야 한다.
// 범위("96~180년")는 시작 연도를 쓴다.
export function parseYear(s: unknown): number | null {
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (/^-?\d{1,4}$/.test(t)) return Number(t);
  if (/세기|century/i.test(t)) return null;
  if (/\d\s*차/.test(t)) return null;
  const m = t.match(/(기원전|BC|서기|AD)?\s*(\d{1,4})/);
  if (!m) return null;
  if (!t.includes('년') && !m[1]) return null;
  return /기원전|BC/.test(m[1] ?? '') ? -Number(m[2]) : Number(m[2]);
}
