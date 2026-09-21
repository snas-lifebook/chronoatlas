# 아이가테스 해전 미시지도 (BC 241)

작성 2026-09-21. 산출물은 `data/micromaps/aegates.json`·`data/boards/aegates-241.json` 두 파일이다. `src/`·`schema/`·`scripts/`·`data/micromaps/index.json`은 건드리지 않았다.

## 전제 오류

지시문 자체에는 없다. 다만 확인 결과를 밝힌다, 정본 `graph.json`에 `event:아이가테스해전`은 **없다**(지시문이 이미 "있는지 확인"이라고 조건부로 적어 둔 대로, 없는 쪽으로 확인됐다). 참전 인물도 갈린다: `person:한노`는 있고, `person:루타티우스카툴루스`(집정관 가이우스 루타티우스 카툴루스)는 **없다**. 그래서 말판에서 카르타고 쪽 한노 유닛에만 `entity`를 달았고, 로마 쪽 카툴루스·발레리우스 팔토 유닛에는 달지 않았다.

## 0. 30초

- 7개 feature, 6개 콜아웃. 권장 화면: center `[12.3, 37.95]`, zoom `11`. `board: "aegates-241"`.
- 아이가테스 3섬(파비냐나·레반초·마레티모)은 전부 **Point**다, 정본 `land.geojson`·`coast.geojson`, NE 10m 캐시(`minor_islands` 포함) 어디에도 이 규모 섬을 낱개 폴리곤으로 자른 데이터가 없다(§2 NE 캐시 확인 기록).
- 가장 논쟁적인 것은 정확한 교전 지점이다. 종래는 드레파나 근해로 짐작했지만, 2004년 이후 레반초 섬 북서 해역 해저 조사(청동 충각 19개·투구·암포라 인양)가 전장을 그쪽으로 좁혔다.

## 1. 무엇이 들어 있나

| kind | feature | 개수 |
|---|---|---|
| `island` | 파비냐나 · 레반초 · 마레티모 | 3 |
| `hill` | 에릭스 산 | 1 |
| `building` | 드레파나 · 릴리바이움 | 2 |
| `plain` | 교전 해역(근사) | 1 |

**kind 대체**: 에릭스는 Pleiades에서 `kind: mountain`이지만 `schema/micromap.ts` KINDS 28종에 mountain이 없어 가장 가까운 `hill`로 근사했다. 교전 해역은 '해역'이라는 kind가 없어 `plain`으로 근사했다(POINTS-01-11.md §1-2 규칙 그대로).

## 2. 확정 · 근사 · 복원 · 논쟁

**확정** (6개): 파비냐나(`aegates:favignana`, Pleiades pid 462084 Aigousa)·레반초(`aegates:levanzo`, pid 462428 Phorbantia)·마레티모(`aegates:marettimo`, pid 462243 Hiera/Maritima)·에릭스 산(`aegates:eryx`, pid 462202)·드레파나(`aegates:drepana`, 정본 `place:드레파나`)·릴리바이움(`aegates:lilybaeum`, 정본 `place:마르살라만`, name_ancient Lilybaeum). 좌표는 전부 정본이거나 번들 Pleiades 점을 그대로 썼다.

**논쟁** (1개): 교전 해역(`aegates:battle-zone`). 말판 `aegates-241`의 전 페이즈 유닛 좌표 범위를 약 0.05도 여백으로 감싼 사각형이며 실측 경계가 아니다. 정확한 위치 자체가 학계에서 갈린다, 종래 통설(드레파나 근해)과 2012년 해저 고고학 논문(레반초 북서 해역)이 다른 곳을 가리킨다.

**NE/정본 캐시 확인 기록**, `data/external/ne_10m_minor_islands.geojson`(2795 피처)·`ne_10m_land.geojson`·정본 `layers/land.geojson`·`layers/coast.geojson` 넷 다 확인했다. `shapely`로 세 섬의 Pleiades 점 반경 0.05도 안에 어떤 폴리곤 링이 있는지 point-in-polygon으로 찾았지만, 걸리는 것은 지중해 전체를 아우르는 거대 다각형(수천~만 개 정점)뿐이고 섬 하나만 떼어낸 작은 링은 없었다. `ne_10m_minor_islands.geojson`은 시칠리아 서쪽 넓은 범위(10.5~14E, 36.5~39N)를 훑어도 튀니지 앞바다 섬 하나만 걸렸다, 이 데이터셋 자체가 이 세 섬을 담고 있지 않다. 그래서 규칙대로(§NOTES) 섬은 전부 Point로 남겼다.

## 3. 안 넣은 것

- **섬 폴리곤.** §2 확인 기록대로 캐시에 없어서 못 넣었다. 지어내지 않는다는 원칙을 섬 윤곽보다 우선했다.
- **로마·카르타고 편대별 세부 척수.** 폴리비오스는 로마 함대 총원(200척, 1.59)과 카르타고 손실(50척 격침·70척 나포, 1.61)만 준다. 발레리우스 팔토가 지휘한 편대가 몇 척이었는지, 한노의 함대 총원이 얼마였는지는 사료에 없다. `schema/board.ts`의 `strength`는 `z.number().int().positive().optional()`이라 `null`을 받지 않는다(POINTS-01-11.md §1 규칙은 "없으면 null"이라 적지만 이 스키마는 그 값을 아예 허용하지 않으므로, 모르는 수치는 필드 자체를 생략했다(board `source`에 명시)).
- **카툴루스·발레리우스 팔토의 `entity`.** 정본 graph.json에 이 두 인물 노드가 없다. 지어내지 않았다.

## 4. 말판과의 관계

이 지도는 지형(섬·산·도시·해역)만 갖고, **부대 배치와 이동은 전적으로 `data/boards/aegates-241.json`이 정본이다.** 유닛 좌표·전황 전개는 그 파일에서만 갱신한다. `aegates:battle-zone`의 사각형은 말판 t=0~2 전 유닛 좌표의 최소/최대 범위이므로, 말판이 바뀌면 이 사각형도 다시 계산해야 한다.

3페이즈: **배치**(카툴루스가 릴리바이움에서 나와 해협을 막고, 한노는 짐을 실은 채 접근) → **짐을 실은 채 붙잡히다**(순풍을 거슬러 노 저어 접근, 카르타고는 무거워 굼뜸) → **50척 격침, 70척 나포**(카르타고 함대 궤멸, 잔여는 히에라로 패주). 유닛 4개(로마 2·카르타고 2), 전부 `arm: fleet`.

## 5. 출처

**정본/Pleiades 조회**:

```
S place:드레파나   드레파나   Drepana    트라파니, 이탈리아   [12.5125, 38.015]
S place:마르살라만  마르살라 만  Lilybaeum  마르살라, 이탈리아   [12.4342, 37.7981]
L pid 462075  Aegates      archipelago  rough    [12.1939, 37.9509]  (군도 전체, 개별 섬 대신 개별 pid 사용)
L pid 462084  Aigousa      island       precise  [12.3286, 37.9311]  (파비냐나)
L pid 462428  Phorbantia   island       precise  [12.3391, 37.9872]  (레반초)
L pid 462243  Hiera/Maritima island     precise  [12.0586, 37.9695]  (마레티모)
L pid 462202  Eryx         mountain     precise  [12.5921, 38.0353]
```

**사료**

- 폴리비오스, 『역사』 1.59(로마 함대 재건: 시민 사비 출연, 200척)·1.60(한노의 접근, 히에라 경유 계획)·1.61(교전, 손실 수치, 순풍 도주)·1.62~63(카르타고의 강화 청원)·1.55~58(에릭스 봉쇄 배경)
- Sebastiano Tusa & Jeffrey Royal, "The Landscape of the Naval Battle at the Egadi Islands (241 B.C.)", *Journal of Roman Archaeology* 25 (2012), 레반초 북서 해역 청동 충각(rostra) 인양 조사

**주의.** 카르타고 함대의 총원 수치는 폴리비오스에 명시되지 않는다(손실 120척 안팎만 나온다). 근대 통계·통설이 종종 인용하는 총원 추정치는 폴리비오스 원문 수치가 아니므로 이 판에는 싣지 않았다.
