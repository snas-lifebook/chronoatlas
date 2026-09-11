// 지도가 덮는 공간·시간 범위. **두 스크립트가 같이 보는 단 하나의 자리다.**
//
// 왜 떼어 놨나: `fetch-external.ts`가 BBOX를, `adapt.ts`가 같은 숫자를 따로 박고 있었다.
// adapt 쪽 주석은 "fetch-external.ts BBOX와 같아야 한다"였는데, 그 문장 자체가 두 군데라는 뜻이다.
// BBOX만 고치면 재베이크는 새 범위로 도는데 `manifest.bbox`는 옛 값이 남고,
// 그 값이 지도의 `maxBounds`(engine.ts)와 relief 이미지 모서리(style.ts)를 정한다 —
// **지도는 옛 범위에 갇히고 음영 그림은 어긋난 자리에 늘어난다. 둘 다 조용히.**
// `fetch-external.ts`는 최상위에서 다운로드를 시작하므로 adapt이 거기서 가져다 쓸 수가 없었다(import = 실행).
// 그래서 부수효과 없는 이 파일로 뺀다. 어긋남은 `test/extent.test.ts`가 막는다.
//
// 범위를 바꿀 때 할 일은 `docs/RUNBOOK-extent.md`에 적어 놨다. 여기만 고치고 끝나지 않는다.

/** [서, 남, 동, 북]. DESIGN v3 §1. 종횡비를 2:1로 유지하면 relief 크롭이 소스 비율 그대로 떨어진다. */
export const BBOX = [-15, 20, 65, 60] as const;

/** 영토(Cliopatria) 100년 버킷과 그 시간 범위. manifest.territory가 이걸 그대로 싣고 엔진이 지연 로드에 쓴다. */
export const TERRITORY_BUCKET = 100;
export const TERRITORY_FROM = -800;
export const TERRITORY_TO = 1500;

export const bboxContains = (lon: number, lat: number, b: readonly number[] = BBOX) =>
  b[0] <= lon && lon <= b[2] && b[1] <= lat && lat <= b[3];
