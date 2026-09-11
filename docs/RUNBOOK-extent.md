# RUNBOOK — 지도 범위 바꾸기 (BACKLOG 라운드 A · R31)

「지도를 더 넓게」를 실행하는 절차. **egress가 필요한 부분이 있어 River 터미널에서 돌린다.**
에이전트가 준비할 수 있는 것은 2026-09-11에 끝냈다(아래 「이미 해 둔 것」).

---

## 0. 먼저 정할 것 — 범위 숫자

지금: `[-15, 20, 65, 60]` (가로 80° × 세로 40°)
BACKLOG 제안: `[-25, 12, 75, 62]` (가로 100° × 세로 50°)

**종횡비 2:1을 지키면 relief 크롭이 소스 비율 그대로 떨어진다.** 제안값은 2.00이라 그대로 돈다
(`test/extent.test.ts`가 이 비율을 검사한다). 실측 크롭 크기:

| 범위 | relief.jpg | DEM z0~7 | DEM z0~8 |
|---|---|---|---|
| 지금 `[-15,20,65,60]` | 4800 × 2400 | 840장 (약 24MB) | 3,160장 (약 88MB) |
| 제안 `[-25,12,75,62]` | 6000 × 3000 | 1,252장 (약 35MB) | 4,780장 (약 134MB) |

**최종 숫자는 River가 정한다.** 완료 조건(콘스탄티노플·안티오키아·크테시폰·알렉산드리아가 한 화면)에
크테시폰(동경 44.6)·알렉산드리아(동경 29.9)가 들어가려면 동쪽은 지금 65로도 되지만,
사산조 페르시아 전체를 담으려면 더 넓혀야 한다.

---

## 1. 상수 한 줄

`scripts/extent.ts`의 `BBOX` 한 줄만 고친다. **다른 데는 없다** — 2026-09-11에 한 곳으로 모았다.

```
export const BBOX = [-25, 12, 75, 62] as const;
```

---

## 2. 다시 굽기

캐시(`data/external/`)가 **지금 비어 있다.** 재크롭이 아니라 **전체 재다운로드**다.
Natural Earth 벡터 7종 + Gray Earth 10m GeoTIFF + 수심 7단 + 고도점 + Cliopatria + Pleiades를 받는다.
(HANDOFF는 이 캐시를 149MB로 적어 놨다. 그게 다시 채워진다.)

```
cd ~/Projects/chronoatlas
npm run fetch-external
```

지형 타일은 따로다. 위 표의 장수를 보고 정한다.

```
TERRAIN=1 npm run fetch-external
```

더 촘촘히 하려면.

```
TERRAIN=1 TERRAIN_MAX=8 npm run fetch-external
```

---

## 3. 어댑터

`manifest.json`의 `bbox`는 어댑터가 쓴다. **2번만 돌리고 말면 지도는 옛 범위에 갇힌다.**

```
ONTOLOGY_DIR=<볼트 ontology 폴더> npm run adapt
```

> **지금 이 명령이 죽는다.** 정본에 `src` 필드가 없어 ZodError가 난다.
> 먼저 아래를 돌려야 한다(볼트 TASKS 0.1, 멱등이고 백업을 자동으로 뜬다).
>
> ```
> python3 <볼트>/Books/로마제국쇠망사/ontology/_scripts/migrate_v2.py <같은 ontology 폴더> --write
> ```
>
> 그리고 `팔레트.json`·`_registry.csv`가 `ONTOLOGY_DIR` 밖(`Works/관계분석_방법론/components/`)에 있다.
> 그대로 두면 어댑터가 조용히 열화된다 — `actors.json`이 비고 138개 노드의 세력·티어, 80개 노드의 초상이 null이 된다.
> 두 파일을 `ontology/` 안으로 옮기든, `adapt.ts`가 옆 폴더를 보게 하든 **경로를 먼저 정해야 한다.**

---

## 4. 확인

```
npm run validate
```

`test/extent.test.ts`가 다음을 검사한다.

- `manifest.bbox`가 `BBOX`와 같은가 — 2·3번을 빠뜨리면 여기서 걸린다
- `manifest.territory`가 영토 버킷 상수와 같은가
- 서 < 동 · 남 < 북 · 종횡비 2:1
- 기본 카메라와 장면 프리셋 카메라가 새 bbox 안인가

카메라가 밖으로 나가면 `maxBounds`가 조용히 끌어당긴다. 걸리면 5번으로.

---

## 5. 카메라 다시 잡기

넓힌 범위에 맞춰 다시 겨눈다. `test/extent.test.ts`는 「안에 있는가」만 본다 — **잘 보이는가는 사람이 정한다.**

- `scripts/adapt.ts`의 `center`·`zoom` (지금 `[14, 40]` · `4`)
- `data/scenes/rome.json`의 장면별 `center`·`zoom`·`pitch`·`bearing`
- 앱에서 원하는 화면을 만든 뒤 **장면 탭 → 「북마크 조각 복사」**로 JSON을 받아 붙여넣는 게 제일 빠르다(R35)
- `src/map/engine.ts`의 `minZoom: 3`이 새 범위를 한 화면에 담는지 확인. 못 담으면 낮춘다

---

## 6. 완료 판정

BACKLOG §A: **콘스탄티노플·안티오키아·크테시폰·알렉산드리아가 한 화면에 들어오고, z3~9 캡처 10장에서 빈 여백이 없다.**

캡처는 에이전트가 할 수 있다(`docs/HANDOFF.md` §5의 디버깅 창). 「완성된 지도로 보이는가」 판정만 River 몫이다.

---

## 이미 해 둔 것 (2026-09-11)

- **`BBOX`를 한 곳으로 모았다.** `scripts/extent.ts` 신설. 예전엔 `fetch-external.ts`와 `adapt.ts`가
  같은 숫자를 따로 박고 있었고, adapt 쪽 주석이 "fetch-external.ts BBOX와 같아야 한다"였다 —
  그 문장 자체가 두 군데라는 뜻이었다. `fetch-external.ts`는 최상위에서 다운로드를 시작해서
  adapt이 거기서 import할 수가 없었다(import = 실행). 그래서 부수효과 없는 파일로 뺐다.
- 영토 버킷(`100`·`-800`·`1500`)도 같은 이유로 두 군데였다. 같이 모았다.
- **어긋남을 막는 테스트**를 붙였다(`test/extent.test.ts` 5건). `BBOX`만 바꾸고 재베이크를 안 하면 빨개진다.
  실제로 제안값으로 바꿔 빨개지는 것을 확인했다.
- `fetch-external.ts`의 나머지는 전부 `BBOX`를 따라간다는 것을 확인했다 — relief 크롭 좌표,
  Cliopatria 공간 필터, 고도점 필터, DEM 타일 x/y 범위. **손봐야 할 하드코딩은 adapt 쪽 둘뿐이었다.**
