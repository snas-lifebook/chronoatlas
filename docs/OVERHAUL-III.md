# 전면 개선 슬라이스 III · 데이터 기반 (R32 · R34 · R52)

> 상위: [OVERHAUL.md](OVERHAUL.md) §2·§4. 원장: [BACKLOG.md](BACKLOG.md) R32·R34·R52 (+R19 위성뷰). 이 문서는 스펙과 작업 목록을 한 장에 둔다(II처럼 둘로 나누지 않는다. 셋 다 기존 파이프라인에 속성·스킨을 더하는 일이라 계획서가 스펙과 같은 말을 두 번 하게 된다).

## 0. 30초

- **위성 스킨(R52·R19).** NASA Blue Marble Next Generation 2004년 7월 「지형 음영 + 수심」 판(PD)을 `relief.jpg`와 같은 방식(bbox 크롭 → 메르카토르 재투영 → 이미지 소스 한 장)으로 굽는다. 바다 마스크는 색 한 장이 아니라 **같은 이미지의 바다 부분**(알파 PNG)으로 덮어 수심 음영이 살아 있게 한다.
- **수심 색(R52).** 이미 있다. NE 수심 벡터 7단이 스킨마다 「깊을수록 짙게」 램프로 칠해진다(R14). `color-relief`로 바꾸지 않는다: DEM 타일은 바다를 0으로 눌러 구웠고(179 MB 예산, OVERHAUL §3.7), 수심을 살리면 4배다. 위성 스킨은 이미지 자체가 수심을 낸다.
- **세력 실명 + 존속연도(R32).** 이름은 이미 폴리티 단위다(TERRITORY_KO 147 + `pack-polity-colors`). 남은 셋: ① 존속연도 `span_from/span_to`(버킷 구간이 아니라 Cliopatria 전 구간의 min/max)를 굽고 이름표 아랫줄에 `BC 250~BC 50`으로, ② 팔레트 밖(`기타중립`) 폴리티는 이름 해시로 **안정적인 채도 낮은 색**, ③ 범례는 면적 순 12개 + 「그 외 n」.
- **LOD 재설계(R34).** 정착지 `rank`를 3단에서 5단으로. 기준은 **등장 포인트 수 + 그래프 차수 + 종류**(지어낸 인구 없음). 바다·강·산·섬은 도시 점을 찍지 않고 이름만, 바다는 자간 벌린 흐린 글자. 줌별 라벨 수를 표로 남긴다.

> **2026-09-17 밤 실행 기록.** 전부 됨. 계획과 다른 점: ① 존속연도 줄 문턱은 4.5가 아니라 **5**다. 심볼 layout은 타일 정수 줌에서 평가되어 4.5는 z4.8에서도 안 켜졌다(실측). ② `region-name`(지역 이름)을 도시 이름표 **밑**으로 옮겼다. 위에 있으면 「아프리카」(카르타고와 같은 좌표)·「시리아」가 카르타고·안티오키아 이름표를 지운다(`text-optional`은 층 사이 우선권이 아니다). ③ 이야기 장소 이름표가 전투 이름표와 겹칠 때 빼는 규칙을 **그 해에 전투가 떠 있을 때만**으로 고쳤다. 늘 빼면 AD 400에 알렉산드리아가 어느 층에도 없었다. ④ `fetch-external`이 `LICENSES.md`를 덮어써 손글 줄 넷이 지워졌다. 템플릿에 넣었다.
>
> **계측.** 위성 `satellite.jpg` 2,077 KB + `satellite-sea.png` 1,791 KB(바다 비율 0.32). `look-skins.py` 명암비: 위성 18.26(먹색 판), 나머지 10.2~13.2. 초기 JS 398.2 kB(게이트 400). vitest 267. `lod-count.py`(1600×900, 중심 18,40):
>
> | 줌 | 정착지 BC 60 | 정착지 AD 400 | 바다 | 지역 | 폴리티 |
> |---|---|---|---|---|---|
> | 3 | 12 | 4 | 3 | 18 | 9 |
> | 4 | 12 | 6 | 3 | 18 | 8 |
> | 5 | 20 | 17 | 7 | 15 | 5 |
> | 6 | 13 | 12 | 6 | 8 | 1 |
> | 7 | 5 | 6 | 3 | 1 | 1 |
> | 8 | 3 | 3 | 0 | 0 | 0 |
> | 9 | 0 | 0 | 0 | 0 | 0 |
>
> (바다·지역·폴리티는 BC 60 열.) BC 60 z3에 로마·카르타고·알렉산드리아·안티오키아가 서고 콘스탄티노플은 교보재가 가린다(AD 330 봉헌, 맞는 동작). AD 400은 z3에서 「로마 제국」 이름표에 밀려 넷이 빠지고 **z4부터 다섯이 다 선다**(`docs/verify/overhaul/lod-ad400-z4.png`). 줌 한 단 증가는 BC 60 최대 1.7배, AD 400 z4→5가 2.8배(rank 2가 4.5에서 들어온다). 고줌에서 수가 주는 것은 뷰포트가 좁아져서다(밀도가 아니라 개수). 캡처 `territory-bc100-names.png`(z5.2 작전: 폰토스 왕국 BC 281~AD 67 · 셀레우코스 제국 BC 318~BC 64 · 카파도키아 왕국 BC 239~AD 22, 범례 Cyrenaica·Greek City-States 해시색) · `skin-satellite-intro.png`.

## 1. 결정 (기본값, 2026-09-17. River가 뒤집으면 값만 바뀐다)

| 물음 | 기본값 | 왜 |
|---|---|---|
| 위성 원본 | Blue Marble NG 2004-07 `world.topo.bathy` 21600×10800 (PD, NASA) | 구름 없음·수심 음영 포함·한 파일. Natural Earth II는 「자연색 채색」이지 위성이 아니다 |
| 해상도 | bbox 크롭 6000×3000 그대로(60 px/°, ≈1.85 km/px) | relief.jpg와 같은 크기. z6까지 선명, 그 위는 DEM 음영·인셋이 맡는다 |
| 바다 마스크 | `satellite-sea.png` 3000×1500 알파(바다=이미지, 육지=투명) 불투명도 0.94 | 영역 폴리곤이 바다로 새는 것을 덮되 수심 음영은 남긴다. 3000이면 충분하다(수심은 매끈하다) |
| 위성에서 끄는 것 | 육지 채움 · relief.jpg · 수심 벡터 · 고도색(`elev-tint`) | 전부 이미지가 대신한다. 음영(hillshade)만 0.3으로 남긴다 |
| 위성 글자 | 흰 글자 + 먹색 후광, 좌상단 연도는 반투명 먹색 판 | 이미지 위 맨글씨는 명암비를 못 지킨다(§E와 같은 병) |
| 존속연도 표기 | `BC 250~BC 50` · `BC 27~AD 476`, 이름표 아랫줄 0.75배, **z 4.5부터** | 첨부 레퍼런스(`Gaul / 250 BC – 50 BC`)의 뜻을 한글 판에 맞춘 것. 작대기 대신 물결 |
| 팔레트 밖 색 | `hsl(hash(name_en) % 360, 30%, 52%)` | 매번 같은 색(P2: 정치체는 데이터). 채도 30이라 정본 팔레트 8색보다 늘 조용하다 |
| 범례 상한 | 면적 순 12 + 「그 외 n개」 | 알렉산드리아 화면 실측 19줄 |
| LOD 단 | 5단(z3 · 4.5 · 6 · 7.5 · 9) | 3단은 실질 2단이었다(9·24·187) |

## 2. 모델링

| 모델 | 정의 | 요지 |
|---|---|---|
| 위성 베이크 | `scripts/bake-satellite.py` | `data/external/satellite/*.png`(gitignore) → `public/datasets/rome/rasters/satellite.jpg` + `satellite-sea.png`. 세로만 재투영(reproject-relief.py와 같은 식) |
| 스킨 | `style.ts MAP.satellite` + `imagery: true` | `buildStyle`이 `imagery` 플래그를 보고 land·relief·bathy를 빼고 `imagery` 래스터를 깐다 |
| 바다 마스크 | `engine.ts` ocean-mask 자리 | 위성이면 `fill` 대신 `raster`(`satellite-sea.png`). id는 같다 |
| 존속연도·색 | `fetch-external.ts` 파이썬 블록 → 버킷 속성 `span_from`·`span_to`·`color` | `:label` 점이 속성을 물려받는다. `finish-territory.py`는 속성을 보존한다 |
| 이름표 | `engine.ts territory-label text-field` | `['step', ['zoom'], 이름만, 4.5, 이름+연도]` |
| 범례 | `App.tsx legend` | `color` 속성 fallback + 12개 상한 |
| rank | `adapt.ts settlements` | 1~5. 표는 §3 III-4 |
| 라벨 층 | `style.ts label-settle-{1..5}` + `label-sea` | 점은 city·battlefield·building·미상만 |
| 계측 | `scripts/lod-count.py` | z3~9 줌별 보이는 라벨 수 표 |

## 3. Tasks

### III-1 위성 스킨 (R52·R19)
- `bake-satellite.py`: BBOX(`extent.ts`) 크롭, 세로 메르카토르 재투영, JPEG q82 저장. 바다 마스크는 `layers/ocean.geojson`을 3000×1500 메르카토르 격자에 래스터라이즈(PIL polygon, 구멍은 0으로 되그림) → 알파. 크레딧 `public/assets/CREDITS.md`·`data/external/LICENSES.md`.
- `style.ts`: `MAP.satellite`(sea `#0B1B2B`, coast `#DCE6EC`, river `#8FBFE0`, label `#FFFFFF`, label2 `#D5DEE5`, halo `#0B1620`, `imagery: true`). `SKINS`에 `위성`. `buildStyle`: imagery면 `imagery` 래스터 소스·레이어, land/relief/bathy 생략.
- `engine.ts`: ocean-mask 분기(래스터), `hillshadeTo`에서 imagery면 elev-tint 생략·exaggeration 0.3·그림자 `#000`. `addTerrain`은 `relief`만 지우므로 손대지 않는다.
- `shell.css`: `html[data-skin="satellite"]` 연도·HUD에 반투명 먹색 판.
- 검증: `look-skins.py`에 satellite 추가(명암비 ≥ 4.5), `look.py pack-intro-med` 위성 캡처 `docs/verify/overhaul/skin-satellite-intro.png`, 파일 크기(jpg+png ≤ 6 MB), `qa-sweep.py` 회귀 0.

### III-2 세력 실명 + 존속연도 (R32)
- `fetch-external.ts` 파이썬: 전 POLITY 피처를 한 번 훑어 `Name → (min FromYear, max ToYear+1)`. `keep`마다 `span_from`·`span_to`. `actor == 기타중립`이면 `color`(해시). `npm run fetch-external`(캐시라 다운로드 없음) → `npm run finish`.
- `engine.ts`: `polityColor` = `match name → pack` / `case actor==기타중립 → get color` / `fillColor`. 이름표 `text-field`를 `step`으로 z4.5부터 연도 줄. 연도 문자열은 표현식(`case` <0 → `BC n`, 아니면 `AD n`).
- `App.tsx legend`: `PACK_POLITY_COLORS[n] ?? color ?? actor.color`, 면적 순 12 + 「그 외 n개」.
- 검증: BC 100 캡처에서 이집트 = 「프톨레마이오스 왕국 / BC 305~BC 30」, 범례에 로마·프톨레마이오스·셀레우코스·폰토스 색이 다르다. `territory-bc100-names.png`.

### III-3 LOD 재설계 (R34)
- `adapt.ts`: 도시 rank 규칙. 1 = points ≥ 3 · 2 = points 2 또는 차수 ≥ 3 · 3 = points 1 & 차수 ≥ 1 · 4 = 나머지 · 5 = building. 바다 = points ≥ 2 → 1(z3), 아니면 3; 이름이 「해협」·헬레스폰투스면 3. 강·섬 = points ≥ 3 → 2, 아니면 3. 산 = points ≥ 3 → 2, 아니면 3. 전장 = 3. `minzoom` 속성은 rank 표에서 나온다.
- `style.ts`: 다섯 층 `label-settle-1..5`(z3 · 4.5 · 6 · 7.5 · 9), 바다는 `label-sea`(자간 0.2, label2 색, regular). 점 층은 `kind ∈ {city, battlefield, building, null}`만, minor 점 minzoom 4.5.
- `engine.ts`: `settle-major`/`settle-minor` 필터에 kind 조건, LAYER_GROUPS.settlements에 새 층 id.
- `scripts/lod-count.py`: 줌 3·4·5·6·7·8·9에서 `queryRenderedFeatures`로 정착지 라벨 층 개수 → 표. 완료 조건: z3에 로마·카르타고·알렉산드리아·안티오키아·콘스탄티노플이 있고, 줌 한 단마다 라벨 수 증가가 2.5배를 넘지 않는다.

### III-4 문서
- BACKLOG R32·R34·R52 ● + R19 위성 ●, MODELS.md 스킨 축, HANDOFF·00-START, 볼트 주간·handoff.

## 4. 비범위
- 도시 유구(OpenHistoricalMap)는 라이선스(CC0 확인) 뒤 별도. 위성 스킨의 z7 이상 고해상 타일(Blue Marble 500 m 판 8장 1.6 GB)은 하지 않는다. 장면 의미체계(R53)는 IV.
