# OVERHAUL: 전면 개선 (2026-09-17 착수)

River의 2026-09-17 지시(원문은 [REQUESTS.md](REQUESTS.md) 9차)로 시작한 전면 개선의 **설계 정본**이다. 요구 번호는 [BACKLOG.md](BACKLOG.md) R46 이후가 원장이고, 이 문서는 「무엇을 어떤 순서로 어떻게 만드나」만 맡는다. 상태 표는 BACKLOG에만 둔다(CONSTITUTION 0-4).

## 0. 30초

- 지시의 축은 아홉이다: 스킨 · 영토 시각화 · 북마크 · 세부 지도 · 대표님 발표에 없던 장면 · 모바일 · 장기말과 군단 · 장면 의미체계 · 입체 지형(고도·수심). 한 스펙으로 못 담는다. **네 슬라이스로 쪼갠다**(§2).
- River가 정한 순서: **발표용 장면·미시지도 먼저.** 그 다음 시각 문법, 데이터 기반, 플랫폼.
- 이 문서의 상세 스펙은 **슬라이스 I**(§3)이다. II~IV는 범위만 적고(§4) 각자 스펙을 따로 쓴다.
- 착수 전 실측 셋이 설계를 정했다. ① 초기 JS가 예산 400 kB gz 중 399.6이라 **무엇을 넣든 번들 분할이 먼저다.** ② 라이브에 DEM 타일이 없다(`terrain/meta.json` 404). 입체 보기는 로컬에서만 산다. ③ **이 작업 환경은 egress가 열려 있다.** 문서가 「River 터미널」로 적어 둔 재베이크·DEM 굽기를 에이전트가 직접 돌린다. River 손이 남는 것은 정본 재작성 승인뿐이고, 그것도 2026-09-17에 받았다(§3.10).

## 1. River가 정한 것 (2026-09-17)

| 물음 | 결정 |
|---|---|
| 무엇을 먼저 | 발표용 장면·미시지도. 기반 공사는 그 다음 |
| River 터미널 선행(범위 재베이크·DEM) | 둘 다 지금. egress가 열려 있어 에이전트가 돌린다 |
| 3D 지형을 라이브에 올리는 법 | 자체 베이크해서 레포에 커밋. 런타임 외부 호출 0 유지 |
| 장기말 3D 피규어 | 프로시저럴 스타일라이즈. GLB 없음, 라이선스 0 |
| `migrate_v2.py --write` → `npm run adapt` | 승인. 백업 확인 후 진행. `proposals/`는 병합하지 않는다 |

## 2. 분해

| 슬라이스 | 닫는 요구 | 무엇 | 선행 |
|---|---|---|---|
| **I. 발표 장면·미시지도** | R44 R46 R47 R48 R49 R50 | 번들 분할 · 미시지도 레지스트리 · 루비콘/아크로폴리스/파르살루스 · DEM 두 층 · 없던 장면 · 즉석 북마크 · 모바일 따라가기 | 없음. 정본 마이그레이션은 병행(§3.4 P-A) |
| II. 시각 문법 | R51 | 캠페인 스킨 v2(A_공간지도 문법) · 장기말 v2 · 부대 블록 · 군단 무리 | I (청크 구조) |
| III. 데이터 기반 | R31 R32 R33 R34 + R52 | 범위 확대 뒤 세력 실명·부드러운 경계·LOD · 수심 색(color-relief) · 위성 스킨 | P-A |
| IV. 플랫폼 | R53 + R35 확장 | 장면 의미체계(사건·시대·맥락) · 프로젝트별 북마크 · 자료실 역링크 | I, III |

왜 이 순서인가. I은 다음 발표(포인트 09·10·11, 날짜 미정)가 그대로 쓸 수 있는 것이고, II는 I의 청크 구조 위에 스킨을 얹어야 번들이 안 터지며, III은 정본 마이그레이션이 풀려야 시작되고, IV는 얕은 스키마 위에 세우면 얕은 것이 넷이 된다(BACKLOG 「지도 다음」).

## 3. 슬라이스 I 스펙

### 3.0 범위와 비범위

**범위.** ① 초기 번들을 340 kB gz 이하로 ② 미시지도를 데이터 한 장으로 선언하는 레지스트리 ③ 새 미시지도 셋(루비콘 · 아테네 아크로폴리스 · 파르살루스) ④ DEM 두 층(대륙 ETOPO 2022, 인셋 Copernicus GLO-30)을 레포에 커밋 ⑤ 대표님 녹취 대조에서 아직 없던 장면 둘(평야 · 카르하이) ⑥ 커밋 없는 즉석 북마크(R44) ⑦ 620px 이하 읽기 모드.

**비범위.** 스킨 신설(II) · 장기말 모양 변경(II) · 세력 실명·경계·LOD(III) · 수심 색(III) · 장면 의미체계(IV) · 분해도(exploded diagram, MICROMAP-UX §6 그대로 보류) · R41 미시 전투 시뮬 톤(릴 스크린샷 없음) · `proposals/` 병합(사람 몫).

### 3.1 아키텍처

한 상태, 네 뷰 구조(AGENTS.md)는 그대로다. 바뀌는 것은 **미시지도가 코드에서 데이터로 내려오는 것**과 **큰 것은 늦게 싣는 것** 둘이다.

```
main.tsx ── load() ── store ── App
                                 ├─ engine.ts        대륙 층(지금 그대로)
                                 │    └─ micro.ts     ← 신설. 미시 소스 1 + 층 8 안팎. setData로 갈아끼움
                                 ├─ Callouts.tsx      ← React.lazy
                                 └─ MobileSheet.tsx   ← 신설, ≤620px에서만
src/micromaps.ts   ← 신설. 레지스트리(가벼운 index) + 지도별 import() 로더
src/bookmarks.ts   ← 신설. localStorage ↔ Scene[]
schema/micromap.ts ← 신설. zod. src/에 안 넣는다(zod가 초기 번들에 실린 전력)
data/micromaps/<id>.json ← 지도 한 장 = 파일 하나 (features + callouts + view + home + basemap + dem + board)
public/datasets/rome/terrain/          ← 대륙 z0~7 (커밋)
public/datasets/rome/terrain-<id>/     ← 인셋 z8~12 (커밋)
```

**모듈 경계.**

| 모듈 | 하는 일 | 쓰는 법 | 의존 |
|---|---|---|---|
| `micromaps.ts` | `INDEX`(id·home·title만, 초기 번들) · `loadMicro(id): Promise<MicroMap>`(`import()`) · `microMapAt(zoom, center)` | 엔진·콜아웃·장면이 부른다 | `schema/micromap.ts` 타입만 |
| `map/micro.ts` | 소스 `micro` 하나, 층 `micro-fill/line/point/label/pin` 등 8 안팎. `kind → paint` 표. `enter(def)`/`leave()` | 엔진이 `microMapAt` 결과가 바뀔 때 부른다 | maplibre, `micromaps.ts` |
| `bookmarks.ts` | `list(ds)` · `save(state, title)` · `remove(id)` · `exportJson()` · `importJson(text)` | 장면 탭 UI | `state.ts`의 Scene |
| `MobileSheet.tsx` | 설명 · 콜아웃 목록 · 인스펙터를 한 시트에 탭으로 | App이 폭으로 고른다 | 기존 패널 컴포넌트 재사용 |

**지금과 달라지는 것.** 엔진의 `LAYER_GROUPS.alesia/.roma/.alexandria`와 `alesia-*`·`roma-*`·`alx-*` 층 31개, `present.ts`의 `showAlesia/showRomaUrbs/showAlexandria`, `callouts.ts`의 `HOME`·`SOURCES` 하드코딩이 전부 사라지고 레지스트리 하나로 대체된다. 콜아웃은 `pack-callouts.json`에서 지도별 파일로 옮긴다(썸네일 대장 `pack-callout-thumbs.json`은 콜아웃 id로 걸리므로 그대로).

### 3.2 데이터 계약

**미시지도 파일** `data/micromaps/<id>.json`. zod 정본은 `schema/micromap.ts`. 아래는 계약의 요지다.

```jsonc
{
  "id": "rubicon", "title": "루비콘 강 · BC 49", "year": -49,
  "teaching": true, "source": "무엇이 확정이고 무엇이 논쟁인지 한 문단 (필수, 빈 문자열 불가)",
  "home": { "at": [12.36, 44.07], "minZoom": 10, "span": 0.5 },     // microMapAt: 줌 문턱 + 거리
  "view": { "center": [12.36, 44.07], "zoom": 11.2, "pitch": 0, "bearing": 0 },
  "hide": ["movements"],                                              // 미시 축척에서 끌 대륙 층 그룹. 기본값은 MICROMAP-UX §3
  "basemap": { "file": "…jpg", "corners": [[lon,lat],[…],[…],[…]], "opacity": 0.5, "credit": "…", "epoch_note": "…" } | null,
  "dem": { "dir": "terrain-rubicon", "minzoom": 8, "maxzoom": 12 } | null,          // 범위는 home.at ± home.span에서 파생. 두 번 적지 않는다
  "board": "pharsalus-48" | null,
  "features": [ { "type": "Feature", "properties": { "id": "rubicon:river", "name_ko": "루비콘 강", "name_la": "Rubico", "kind": "river", "source": "논쟁 | 확정 | 근사 | 복원", "note_ko": "…", "wiki": "https://…" }, "geometry": { … } } ],
  "callouts": [ { "id": "rubicon:call-size", "anchor": { "feature": "rubicon:river" }, "side": "left", "num": 1, "title": "…", "body": "160자 이내", "cite": "수에토니우스 『카이사르』 31~33", "links": [ … ], "image": null } ]
}
```

- `kind` 어휘는 기존 세 파일의 합집합에서 시작한다(MICROMAP-UX §4 + 알레시아 전용 `ditch`·`trap`·`tower`·`camp`·`redoubt`·`oppidum` 등). **표에 없는 kind는 린트가 막는다.** 어휘를 늘리면 `micro.ts`의 paint 표에 한 줄 더한다.
- `source` 태그 넷(확정·근사·복원·논쟁)은 그대로. 태그가 없거나 빈 피처는 린트 실패.
- 좌표는 GeoJSON `[lng, lat]`.

**장면**(`state.ts` `Scene`)에 한 필드가 는다: `micro?: string`. 장면이 미시지도를 부르면 줌 문턱과 무관하게 그 지도가 켜지고 카메라는 장면 값이 이긴다. `board`는 지금 그대로.

**북마크** localStorage 키 `chronoatlas:bookmarks:<ds>`, 값 `{ "v": 1, "items": Scene[] }`. 항목은 「북마크 조각 복사」가 내놓는 것과 같은 모양이고 `group`은 항상 `"내 북마크"`다. 내보내기는 같은 JSON, 가져오기는 zod 없이 필드 화이트리스트로 거른다(초기 번들에 zod 금지).

**DEM 메타.** `terrain/meta.json`은 지금 형식 유지(`encoding`·`maxzoom`·`exaggeration`·`credit`). 인셋은 미시지도 파일의 `dem` 블록이 정본이고 `terrain-<id>/`에는 타일만 있다. 두 군데에 같은 숫자를 적지 않는다.

### 3.3 데이터 흐름

1. 부팅: `main.tsx`는 `micromaps.INDEX`(수백 바이트)만 싣는다. 지도 JSON·콜아웃·말판·베이스맵은 안 싣는다.
2. 장면 적용 또는 `moveend`: `microMapAt(zoom, center)` 또는 `scene.micro`가 id를 준다. 이전 id와 다르면 `loadMicro(id)` → `micro.enter(def)`: 소스 `setData`, 베이스맵 이미지 소스 교체, `hide` 그룹 숨김, `dem`이 있으면 `setTerrain`을 인셋 소스로, `board`가 있으면 말판 켬, 콜아웃 컴포넌트 lazy 로드.
3. 나가기: `micro.leave()`가 전부 되돌린다. `setTerrain`은 대륙 소스로.
4. 즉석 북마크 저장: 현재 `State` → `Scene` 조각(기존 「북마크 조각 복사」 함수 재사용) → localStorage. 장면 목록은 파일 장면 + 북마크를 합친 배열이고 발표 넘김(`[` `]`)은 그룹 안에서만 돈다(지금 규칙).

### 3.4 단계와 완료 조건

근거 없이 닫지 않는다. 각 단계의 완료 조건은 계측이고, 계측값은 BACKLOG 원장에 적는다.

| 단계 | 무엇 | 완료 조건 |
|---|---|---|
| **P-A** 병행 | 정본 마이그레이션 → adapt → 범위 재베이크. `migrate_v2.py --write`(백업 자동, 먼저 `.bak` 존재 확인) → `adapt.ts`가 `팔레트.json`·`_registry.csv`를 `PALETTE_DIR` 또는 정본 옆 `Works/관계분석_방법론/components/`에서 읽게 고침 → `npm run adapt` → `scripts/extent.ts` `BBOX = [-25, 12, 75, 62]` → `npm run fetch-external` → `npm run adapt` 다시 → `npm run validate` | `test/extent.test.ts`·`test/year.test.ts`·`test/ontology.test.ts`의 지뢰가 초록으로. adapt 산출물 diff에서 엔티티·링크 수가 정본 행수와 같다. RUNBOOK-extent §6(콘스탄티노플·안티오키아·크테시폰·알렉산드리아 한 화면, z3~9 캡처 10장 여백 0). 기존 장면 카메라 재조준 |
| **P0** | 번들 분할 | 초기 JS ≤ 340 kB gz(`scripts/check-bundle.mjs`가 postbuild에서 막는다). vitest 전부 초록. 기존 미시 장면 셋의 `look.py` 층 개수가 분할 전과 같다 |
| **P1** | 레지스트리로 이관 | 세 지도가 `data/micromaps/`로 옮겨지고 엔진 미시 층이 31 → 10 이하. `test/micromap.test.ts` 신설. `look.py`로 알레시아·로마·알렉산드리아 층 개수 전후 동일 |
| **P2** | DEM 두 층 | `terrain/` 대륙 z0~7이 커밋되고 배포 뒤 `terrain/meta.json`이 200. z6 알프스 pitch 50 캡처에 능선이 선다. 인셋 6곳(알레시아·로마·알렉산드리아·루비콘·아테네·파르살루스) z8~12. 미시 진입 시 `map.getTerrain().source`가 인셋으로 바뀌고 나가면 되돌아온다. 타일 총량 ≤ 120 MB(테스트) |
| **P3** | 새 미시지도 셋 | 각 지도 피처 ≥ 8 · 콜아웃 ≥ 5(전부 `cite`) · 앵커 미해결 0 · `source` 태그 전원. `docs/RUBICON.md`·`ATHENS.md`·`PHARSALUS.md`. 세부 지도 그룹에 장면 셋. `look.py` 층 개수 > 0, `docs/verify/overhaul/` 캡처 |
| **P4** | 없던 장면 둘 | 「왜 제국인가: 평야」(plains 켬)·「카르하이 BC 53」. `test/present.test.ts` 연도 단조성 유지 |
| **P5** | 즉석 북마크 | 저장 → 새로고침 → 「내 북마크」 그룹에서 `[` `]`로 걷는다. 왕복 테스트(state → 조각 → 저장 → 복원 → 같은 state). 가져오기가 잘못된 JSON을 거절한다 |
| **P6** | 모바일 읽기 모드 | 390×844 에뮬레이션 캡처 5장(발표 1 · 세부 3 · 말판 1)에서 HUD·알약·시트의 경계 상자가 겹치지 않는다(계측). 탭 타깃 ≥ 44px. 콜아웃 핀 번호가 시트 목록 번호와 일치 |

P-A를 앞에 두는 이유는 하나다. **범위가 바뀌면 `maxBounds`와 카메라가 바뀐다.** 새 장면 셋의 카메라를 옛 범위에서 잡으면 두 번 잡는다.

### 3.5 새 미시지도 셋: 내용과 출처 원칙

좌표를 지어내지 않는다. 우선순위는 ① 번들에 이미 있는 Pleiades(`layers/landmarks.geojson`, 확인: `Rubico` 강 `[12.3607, 44.0722]`, `Enipeus` 강 `[22.3585, 39.3195]`, `Pnyx` 언덕 `[23.7195, 37.9714]`) ② 발굴 보고·학술 지도 ③ 위키백과 좌표 필드. 면·선은 현대 지형에 맞춘 근사이고 그렇게 태그한다. ODbL(OSM)·CC BY-SA 기하는 눈으로만 참조하고 복사하지 않는다.

**루비콘 · BC 49.** 보여 줄 것은 「이 강이 얼마나 작은가」와 「무장한 채 이 선을 넘으면 반란」이다. 강(비정은 논쟁이다. 사비냐노의 현대 루비코네 통설 대 피사텔로·우소 대안, 태그 `논쟁`), 라벤나·아리미눔(확정), 진군 경로 라벤나 → 강 → 아리미눔(근사, 수에토니우스 『카이사르』 31~33 · 플루타르코스 『카이사르』 32), 갈리아 키살피나/이탈리아 경계선(강을 따라, 복원), 아펜니노와 아드리아 사이 좁은 평야(DEM이 보여 준다). 콜아웃: 강의 크기 · 속주 경계 · 「주사위는 던져졌다」 사료 · 술라의 선례 링크.

**아테네 아크로폴리스.** 연도는 발표 축(BC 60)에 두고 **그 해 서 있던 것만** 그린다. 아그리파 오데온(BC 15)·하드리아누스 도서관(AD 132)은 넣지 않는다. 아크로폴리스(hill) · 파르테논(temple, 확정) · 프로필라이아(gate) · 에레크테이온(temple) · 디오니소스 극장(theatre) · 아고라(forum) · 프닉스(field, 민회) · 아레오파고스(hill) · 테미스토클레스 성벽(wall, 복원) · 일리소스·에리다노스(river). 바탕 도판은 19세기 PD 지도(Curtius·Kaupert 『Karten von Attika』 1881 계열 또는 Kiepert Atlas Antiquus 아테네 인셋)를 `MICROMAP-BASEMAP.md` 절차로 지오레퍼런싱하고, 실패하면 알레시아처럼 기록하고 벡터로 간다. 콜아웃: 프닉스 민회(정족수 6,000의 근거: 아리스토텔레스 『아테네 정치제도』·데모스테네스, 정확한 인용은 문서에) · 디오니소스 극장 · 파르테논 · 아고라(불레·법정) · 대표님 논지 「로마가 그리스 정치체제를 받아들였다」의 사료 대조(리비우스 3.31~33 12표법 사절단 전승은 논쟁, 로마 공화정의 기원은 독자적). 이 마지막 콜아웃이 이 지도의 존재 이유다. 반박이 아니라 **한 번 더 증명**(PACK-CAESAR §14.2 ④의 결).

**파르살루스 · BC 48.** 있는 것을 잇는다. 말판 `pharsalus-48`(3페이즈)을 이 지도의 `board`로 걸고 DEM 인셋 위에 세운다. 에니페우스 강(확정, 전장 위치는 북안·남안 논쟁 태그) · 파르살루스 시(확정) · 폼페이우스 진영 언덕(복원) · 카이사르 진영(복원). 콜아웃: 병력(『내전기』 3.88, 당사자 수치라는 주의) · 넷째 줄 · 「하루 만에 도망자」 · 위치 논쟁(Morgan 1983 대 Pelling 1973). 내전이라 양쪽이 로마다. 색은 `proposals/20260912_palette_civilwar_2.jsonl` 승인 전까지 폴백이며 이 스펙이 그걸 바꾸지 않는다.

각 지도의 근거 문서는 `docs/ROMA-URBS.md`와 같은 짜임(30초 · 무엇이 들어 있나 · 확정/근사/복원/논쟁 · 안 넣은 것 · 출처)을 따른다.

### 3.6 DEM 파이프라인

**소스.** 대륙은 **ETOPO 2022 15초 표면 고도**(NOAA NCEI, 15°×15° GeoTIFF 타일, 자유 이용, 인용 DOI 10.25921/fd45-gt74). 확대 범위 `[-25,12,75,62]`를 덮는 타일은 28장이다. 육지 고도와 수심이 한 그리드에 있어 슬라이스 III의 수심 색이 같은 타일에서 나온다. 인셋은 **Copernicus GLO-30**(AWS 공개 버킷 `copernicus-dem-30m`, 1°×1° COG, 출처 표기 조건). 두 소스 다 2026-09-17에 이 환경에서 200을 확인했다. 지금 로컬에 있는 AWS Terrain Tiles(라이선스 혼합)는 커밋하지 않고 지운다.

**도구.** GDAL이 없다. `scripts/bake-dem.py`가 numpy + tifffile(+ imagecodecs)로 직접 한다: 웹 메르카토르 타일 z/x/y의 256×256 픽셀 중심을 위경도로 풀고 소스 그리드에서 이중선형 보간, terrarium 인코딩(`(h + 32768)`을 R·G·B로), PNG 저장. `--selftest`가 인코딩 왕복과 타일 경계를 단언한다. 원본은 `data/external/dem/`(gitignore)에 캐시.

**범위.** 대륙 z0~7(BBOX 안). 인셋은 미시지도 `home.at` ± `home.span`(지도마다 다르다. 알레시아 0.6, 로마 0.35), z8~12(Copernicus 30 m가 z12 픽셀 크기에 맞는다. z13은 뻥튀기라 안 굽는다). 인셋 소스는 같은 값을 `bounds`로 받고 `minzoom: 8`이라 밖에서는 요청이 안 나간다. 미시지도 파일이 바뀌면 굽는 범위도 따라온다.

**엔진.** 대륙 `dem` 소스는 지금 코드 그대로. 인셋은 미시 진입 때 `map.addSource('dem-<id>')` + `setTerrain({source:'dem-<id>'})` + 음영 층의 소스 교체, 이탈 때 복귀. 과장 배율은 지금의 줌 연동 규칙 유지.

**커밋.** `.gitignore`의 `public/datasets/*/terrain/`을 풀고 `terrain/`·`terrain-*/`을 커밋한다. `public/assets/CREDITS.md`와 `data/external/LICENSES.md`에 ETOPO·Copernicus 줄을 더한다. 총량 상한 120 MB는 테스트가 지킨다.

### 3.7 모바일 읽기 모드

DESIGN §4 「모바일은 읽기 전용」을 그대로 따른다. 폭 620px 이하에서만.

- 남기는 것: 지도 · 장면 알약(있음) · 슬림 HUD(있음) · 콜아웃 핀(번호만) · 하단 시트 하나.
- 시트 탭 셋: **설명**(장면 note·그 해) · **콜아웃**(번호순 목록, 카드 본문 그대로) · **객체**(인스펙터 축약). 시트는 접힘 56px · 반 · 전체 세 단.
- 숨기는 것: 탐색 카드 · 레이어 토글 · 관계 그래프 · 내보내기.
- 카메라: `fitZoom`(있음). 미시지도 `view.zoom`도 같은 보정을 탄다.
- 터치: 핀 탭 → 시트가 그 콜아웃으로 스크롤. 지도 핀치·드래그는 MapLibre 기본.

### 3.8 오류 처리

| 상황 | 동작 |
|---|---|
| 콜아웃 앵커가 피처를 못 찾음 | 지금처럼 버리고 콘솔에 남긴다. **그리고 `test/micromap.test.ts`가 CI에서 막는다** (경고에서 실패로 승격) |
| 장면의 `micro`가 레지스트리에 없음 | 린트 실패. 런타임에 만나면 미시지도 없이 장면만 적용 |
| 미시지도 `import()` 실패(오프라인 등) | 대륙 지도는 그대로, 콜아웃 없음. 한 줄 안내 |
| DEM 인셋 타일 없음 | `bounds`·`minzoom`으로 요청 자체가 안 나간다. 대륙 소스가 overzoom으로 받친다 |
| 베이스맵 이미지 404 | 층을 건너뛰고 `epoch_note` 자리에 「도판 없음」 |
| localStorage 없음·용량 초과 | try/catch. 북마크 UI에 한 줄 안내, 저장 버튼 비활성 |
| 가져오기 JSON이 형식 밖 | 필드 화이트리스트 통과 항목만 받고 나머지 개수를 알린다 |

### 3.9 테스트와 검증

**vitest(`npm run validate`에 포함).**
- `test/micromap.test.ts` 신설: 모든 `data/micromaps/*.json`이 zod를 통과 · `kind`가 paint 표 안 · 콜아웃 앵커 전원 해석 · `home.at`이 `view` 화면 안 · 장면 `micro` 참조 실재 · 썸네일 대장의 콜아웃 id 실재 · `source` 태그 넷 중 하나.
- `test/bookmarks.test.ts` 신설: 왕복 · 그룹 고정 · 가져오기 거절.
- `test/terrain.test.ts` 신설: `meta.json` 형식 · 인셋 `bounds`가 `home.at`을 포함 · 타일 총량 ≤ 120 MB.
- 기존 `present.test.ts`(연도 단조) · `state.test.ts` · `payload.test.ts`는 그대로 지켜야 한다.

**번들.** `scripts/check-bundle.mjs`를 `postbuild`에 건다. `dist/assets/index-*.js` gz ≤ 340 kB. 동적 청크는 별도 상한(미시지도 파일당 ≤ 80 kB gz).

**렌더.** 자동화 탭에서는 지도가 안 뜬다(HANDOFF §5). `bash scripts/serve.sh` + `python3 scripts/look.py <scene>`으로 장면별 층 개수를 계측하고 `docs/verify/overhaul/`에 캡처를 남긴다. 모바일은 같은 CDP 창에 뷰포트 390×844 · dsf 3을 걸어 캡처하고 경계 상자 겹침을 숫자로 잰다.

**사람 판정(River).** P13 「완성된 지도로 보이는가」를 새 미시지도 셋과 z6 입체 캡처에 대해. 아크로폴리스 콜아웃의 사료 대조 문장.

### 3.10 River 몫

- `migrate_v2.py --write` 승인: **2026-09-17 받았다.** 백업(`.bak_YYYYMMDD`) 확인 뒤 실행. `proposals/`는 병합하지 않는다.
- 새 미시지도 셋 취향 판정(P13). 아테네 사료 대조 콜아웃 문안 확인.
- 푸시·배포 결정(PACK-CAESAR §7 규칙 그대로).

## 4. 슬라이스 II~IV 범위 (각자 스펙을 따로 쓴다)

**II. 시각 문법.** River가 가리킨 볼트 `references/캡처라이브러리/A_공간지도/`(BazBattles · Kings and Generals · HistoryMarche · Epic History, 43장, 제3자 자산이라 레포에 안 들어온다)에서 뽑을 문법은 여섯이다: 채색 음영 지형(hillshade + 난색 고도색 + 숲 점묘) · 장군 배너(방패형 초상 카드 + 이름판, 위치에는 작은 군기) · 부대 블록(사각형, 향과 세력색) · 점선 사슬 국경과 사선 세력권 · 연도 리본 · 세리프 소문자 대문자 자간 라벨. 전부 `campaign` 스킨 v2와 장기말 v2(프로시저럴: 받침 + 몸통 + 군기, 군단은 작은 말 무리를 `pack-legions` 수로)로 들어간다. 세리프 글리프는 빌드타임 자체 생성(CONSTITUTION 6-2). 스킨과 UI 테마 어긋남(BACKLOG §E 미해결)은 여기서 ①(연동) 또는 ②(후광)로 닫는다.

**III. 데이터 기반.** P-A가 끝나면 BACKLOG 라운드 B·C·D를 적힌 대로. 더하는 것 둘: ETOPO 수심을 `color-relief`(maplibre-gl 6.3에 있음)로 「깊을수록 짙게」(DESIGN 램프) · 위성 스킨은 PD 래스터(NASA Blue Marble 또는 Natural Earth II)를 relief처럼 굽는다.

**IV. 플랫폼.** 장면을 「사건 · 시대 · 시공간 · 행동 맥락」으로 묶는 의미체계는 정본 온톨로지의 `event`·`period`와 장면을 잇는 링크 층이다(장면 → 사건 id, 사건 → 장면들). 프로젝트별 북마크는 I의 localStorage를 파일 내보내기로 잇는 것에서 시작한다. 자료실 `atlasUrl` 역링크(TASKS 3.6).

## 5. 이 문서와 다른 문서

- 요구 원장·상태: [BACKLOG.md](BACKLOG.md) R46~R53. 여기 상태를 적지 않는다.
- River 원문: [REQUESTS.md](REQUESTS.md) 9차.
- 미시지도 UX 규칙: [MICROMAP-UX.md](MICROMAP-UX.md)가 정본이고, 이 스펙은 그 규칙을 데이터로 옮기는 방법만 적는다. 레지스트리가 붙으면 그 문서 §8 파일 표를 갱신한다.
- 범위 바꾸기 절차: [RUNBOOK-extent.md](RUNBOOK-extent.md). P-A가 끝나면 「River 터미널」 문구를 실측으로 고친다.
- 구현 계획(단계별 작업 목록)은 이 스펙이 승인된 뒤 따로 쓴다.
