# OVERHAUL: 전면 개선 (2026-09-17 착수)

River의 2026-09-17 지시(원문은 [REQUESTS.md](REQUESTS.md) 9차)로 시작한 전면 개선의 **설계 정본**이다. 요구 번호는 [BACKLOG.md](BACKLOG.md) R46 이후가 원장이고, 이 문서는 「무엇을 어떤 순서로 어떻게 만드나」만 맡는다. 상태 표는 BACKLOG에만 둔다(CONSTITUTION 0-4).

## 0. 30초

- 지시의 축은 아홉이다: 스킨 · 영토 시각화 · 북마크 · 세부 지도 · 대표님 발표에 없던 장면 · 모바일 · 장기말과 군단 · 장면 의미체계 · 입체 지형(고도·수심). 한 스펙으로 못 담는다. **네 슬라이스로 쪼갠다**(§2).
- River가 정한 순서: **발표용 장면·미시지도 먼저.** 그 다음 시각 문법, 데이터 기반, 플랫폼.
- 스펙 1차 검토에서 River가 한 가지를 더 넣었다(REQUESTS 9차 후속): **미시지도에서 재생을 누르면 전투 시뮬 애니메이션이 돈다.** 도시공성 · 지형지물과 부대 배치 · 이동경로 · 전투전술의 네 문법(볼트 `A_공간지도` 43장)을 미시 축척에 직접 녹인다. 고증을 지키고, 병종·지형 콜아웃은 켜고 끄고, 객체를 눌러 세부를 보고, 로마사 이야기에 붙는다. 그래서 부대 블록과 전투 재생이 II에서 **I로 올라왔다**(§3.6).
- 이 문서의 상세 스펙은 **슬라이스 I**(§3)이다. II~IV는 범위만 적고(§4) 각자 스펙을 따로 쓴다.
- 착수 전 실측 셋이 설계를 정했다. ① 초기 JS가 예산 400 kB gz 중 399.6이라 **무엇을 넣든 번들 분할이 먼저다.** (2026-09-17 재실측: `gzip -9`로 재면 **491.8 kB**다. 399.6은 측정법이 달랐거나 낡은 값이다. 바닥이 maplibre 243 + react 60 + astryx 58 = 361이라 340은 애초에 불가능하다. 게이트는 **400 kB(gzip -9)** 로 잡는다. §3.4 P0·P1) ② 라이브에 DEM 타일이 없다(`terrain/meta.json` 404). 입체 보기는 로컬에서만 산다. ③ **이 작업 환경은 egress가 열려 있다.** 문서가 「River 터미널」로 적어 둔 재베이크·DEM 굽기를 에이전트가 직접 돌린다. River 손이 남는 것은 정본 재작성 승인뿐이고, 그것도 2026-09-17에 받았다(§3.11).

## 1. River가 정한 것 (2026-09-17)

| 물음 | 결정 |
|---|---|
| 무엇을 먼저 | 발표용 장면·미시지도. 기반 공사는 그 다음 |
| River 터미널 선행(범위 재베이크·DEM) | 둘 다 지금. egress가 열려 있어 에이전트가 돌린다 |
| 3D 지형을 라이브에 올리는 법 | 자체 베이크해서 레포에 커밋. 런타임 외부 호출 0 유지 |
| 장기말 3D 피규어 | 프로시저럴 스타일라이즈. GLB 없음, 라이선스 0 |
| `migrate_v2.py --write` → `npm run adapt` | 승인. 백업 확인 후 진행. `proposals/`는 병합하지 않는다 |
| 스펙 1차 검토(수정 요청) | 전투 재생과 A_공간지도 네 문법을 미시지도(슬라이스 I)에 넣는다 |
| 계획 실행 직전 추가(REQUESTS 9차 후속 2) | **Z** 모델링 시각화를 AI·사람 공용 중간 산출물로 · **A** 확대하면 빈 화면인 것을 고친다(자연 환경이라도) · **B** 영역 모서리·해안선·작은 섬 마감. 셋 다 슬라이스 I. 병렬 위임은 에이전트 판단(계측·초안만) |

## 2. 분해

| 슬라이스 | 닫는 요구 | 무엇 | 선행 |
|---|---|---|---|
| **I. 발표 장면·미시지도** | R44 R46 R47 R48 R49 R50 R54 **R55 R56 R57 (+R33)** | **모델링 시각화(MODELS.md)** · 번들 분할 · 미시지도 레지스트리 · 루비콘/아크로폴리스/파르살루스(+칸나이 등록) · **DEM 두 층 + 확대 시 자연 환경(토지피복·하천 인셋)** · **영역 마감(부드럽게·해안 스냅·섬 귀속)** · 전투 재생(말판 v2) · 없던 장면 · 즉석 북마크 · 모바일 따라가기 | 없음. 정본 마이그레이션은 병행(§3.4 P-A) |
| II. 시각 문법(대륙 축척) | R51 | 캠페인 스킨 v2(국경 점선 사슬 · 연도 리본 · 세리프 자간 라벨 · 장군 배너 카드) · 장기말 프로시저럴 v2 · 군단 무리 | I (청크 구조, 부대 블록 렌더러) |
| III. 데이터 기반 | R31 R32 R34 + R52 | 범위 확대 뒤 세력 실명·LOD · 수심 색(color-relief) · 위성 스킨 · 도시 유구(OpenHistoricalMap, CC0 확인 뒤). 경계 마감(R33)은 I로 올라갔다 | P-A |
| IV. 플랫폼 | R53 + R35 확장 | 장면 의미체계(사건·시대·맥락) · 프로젝트별 북마크 · 자료실 역링크 | I, III |

왜 이 순서인가. I은 다음 발표(포인트 09·10·11, 날짜 미정)가 그대로 쓸 수 있는 것이고, II는 I의 청크 구조와 부대 블록 렌더러 위에 대륙 스킨을 얹어야 번들이 안 터지며, III은 정본 마이그레이션이 풀려야 시작되고, IV는 얕은 스키마 위에 세우면 얕은 것이 넷이 된다(BACKLOG 「지도 다음」).

## 3. 슬라이스 I 스펙

### 3.0 범위와 비범위

**범위.** ① 초기 번들을 340 kB gz 이하로 ② 미시지도를 데이터 한 장으로 선언하는 레지스트리 ③ 새 미시지도 셋(루비콘 · 아테네 아크로폴리스 · 파르살루스) + 칸나이(말판은 있고 미시지도가 없었다) 등록 ④ DEM 두 층(대륙 ETOPO 2022, 인셋 Copernicus GLO-30)을 레포에 커밋 ⑤ **전투 재생**: 말판 스키마 v2, 부대 블록·기동 화살표·교전 표식 렌더러, 페이즈 보간 재생, 캡션 띠와 사료 인용 카드, 부대 탭 세부, 병종·지형 콜아웃 필터, 알레시아 말판 신설 ⑥ 대표님 녹취 대조에서 아직 없던 장면 둘(평야 · 카르하이) ⑦ 커밋 없는 즉석 북마크(R44) ⑧ 620px 이하 읽기 모드(재생 컨트롤 포함) ⑨ **모델링 시각화** `docs/MODELS.md`(Mermaid 도식 7, 데이터 모델은 zod에서 생성해 동기화) ⑩ **확대 시 자연 환경**: 대륙 DEM을 z8까지, 모든 스킨에 음영 + 옅은 고도색, 인셋에 토지피복(ESA WorldCover)·하천·호수를 겹치고, 인셋을 데이터 한 줄로 늘린다 ⑪ **영역 마감**: 빌드타임 파이프라인(부드럽게 → 해안 스냅 → 섬 귀속 → 겹침 정리) + 렌더 마감(안쪽 후광·바깥선·해안선 위 잉크).

**비범위.** 대륙 축척 스킨 신설(II) · 장기말(인물 말) 모양 변경(II) · 세력 실명·경계·LOD(III) · 수심 색(III) · 장면 의미체계(IV) · 분해도(exploded diagram, MICROMAP-UX §6 그대로 보류) · 3D 건물 모델(K&G 도시공성의 입체 건물은 벡터 도식 + 도판 + DEM 음영으로 대신한다) · 실시간 전투 연산(River 08-13 원문 「보여지기만 하면 된다」. 페이즈 사이 보간이 전부다) · `proposals/` 병합(사람 몫).

### 3.1 아키텍처

한 상태, 네 뷰 구조(AGENTS.md)는 그대로다. 바뀌는 것은 **미시지도가 코드에서 데이터로 내려오는 것**, **큰 것은 늦게 싣는 것**, 그리고 **말판이 정지 배치에서 재생되는 이야기가 되는 것** 셋이다.

```
main.tsx ── load() ── store ── App
                                 ├─ engine.ts        대륙 층(지금 그대로)
                                 │    ├─ micro.ts     ← 신설. 미시 소스 1 + 층 8 안팎. setData로 갈아끼움
                                 │    └─ battle.ts    ← 신설. 말판 v2 렌더(부대 블록·화살표·교전) + 페이즈 보간 재생
                                 ├─ Callouts.tsx      ← React.lazy. 필터 칩(지형·부대·사건)
                                 ├─ BattleBar.tsx     ← 신설. 재생·페이즈 슬라이더·캡션 띠·인용 카드
                                 └─ MobileSheet.tsx   ← 신설, ≤620px에서만
src/micromaps.ts   ← 신설. 레지스트리(가벼운 index) + 지도별 import() 로더
src/board.ts       ← 있음. phaseOf·unitsGeoJSON·자석. v2 필드는 여기서 풀이(보간 포함)
src/bookmarks.ts   ← 신설. localStorage ↔ Scene[]
schema/micromap.ts ← 신설. zod. src/에 안 넣는다(zod가 초기 번들에 실린 전력)
schema/board.ts    ← 있음. v2 필드 추가(§3.2)
data/micromaps/<id>.json ← 지도 한 장 = 파일 하나 (features + callouts + view + home + basemap + dem + board)
data/boards/<id>.json    ← 말판. 미시지도가 board로 가리킨다
public/datasets/rome/terrain/          ← 대륙 z0~8 (커밋)
public/datasets/rome/terrain-<id>/     ← 인셋 z8~12 (커밋)
```

**모듈 경계.**

| 모듈 | 하는 일 | 쓰는 법 | 의존 |
|---|---|---|---|
| `micromaps.ts` | `INDEX`(id·home·title만, 초기 번들) · `loadMicro(id): Promise<MicroMap>`(`import()`) · `microMapAt(zoom, center)` | 엔진·콜아웃·장면이 부른다 | `schema/micromap.ts` 타입만 |
| `map/micro.ts` | 소스 `micro` 하나, 층 `micro-fill/line/point/label/pin` 등 8 안팎. `kind → paint` 표. `enter(def)`/`leave()` | 엔진이 `microMapAt` 결과가 바뀔 때 부른다 | maplibre, `micromaps.ts` |
| `map/battle.ts` | 말판 소스 셋(부대 · 화살표 · 교전) · 부대 블록 기하 생성(중심·향·병종·병력 → 회전 사각형) · `play()/pause()/seek(t)` · rAF 보간 → `setData` | `BattleBar`와 엔진이 부른다. `micro.enter`가 `board`를 보면 켠다 | maplibre, `board.ts` |
| `board.ts`(확장) | `interpolate(board, t)`: 페이즈 사이 t∈[0,1]에서 부대 위치·향·상태를 준다. 순수 함수 | `battle.ts` | 없음 |
| `bookmarks.ts` | `list(ds)` · `save(state, title)` · `remove(id)` · `exportJson()` · `importJson(text)` | 장면 탭 UI | `state.ts`의 Scene |
| `BattleBar.tsx` | 재생·일시정지·한 단계·슬라이더 · 캡션 띠(페이즈 `caption`+`cite`) · 인용 카드(`quote`) · 콜아웃 필터 칩 | App이 활성 말판이 있을 때 띄운다 | `battle.ts` |
| `MobileSheet.tsx` | 설명 · 콜아웃 · 객체(부대 세부 포함) · 재생 컨트롤을 한 시트에 탭으로 | App이 폭으로 고른다 | 기존 패널 컴포넌트 재사용 |

**지금과 달라지는 것.** 엔진의 `LAYER_GROUPS.alesia/.roma/.alexandria`와 `alesia-*`·`roma-*`·`alx-*` 층 31개, `present.ts`의 `showAlesia/showRomaUrbs/showAlexandria`, `callouts.ts`의 `HOME`·`SOURCES` 하드코딩이 전부 사라지고 레지스트리 하나로 대체된다. 콜아웃은 `pack-callouts.json`에서 지도별 파일로 옮긴다(썸네일 대장 `pack-callout-thumbs.json`은 콜아웃 id로 걸리므로 그대로). 지금 엔진의 `board-unit`(병종 심볼 점)과 `board-label`은 `battle.ts`의 블록 렌더로 대체된다. 말판의 `teaching: true`·`source` 강제와 「정본 신뢰도 체계에 안 섞는다」는 그대로다.

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
  "features": [ { "type": "Feature", "properties": { "id": "rubicon:river", "name_ko": "루비콘 강", "name_la": "Rubico", "kind": "river", "grade": "논쟁", "source": "사료·근거 문장 (알레시아는 BG 절 번호)", "note_ko": "…", "wiki": "https://…" }, "geometry": { … } } ],
  "callouts": [ { "id": "rubicon:call-size", "topic": "terrain | unit | event", "anchor": { "feature": "rubicon:river" }, "side": "left", "num": 1, "title": "…", "body": "160자 이내", "cite": "수에토니우스 『카이사르』 31~33", "links": [ … ], "image": null } ]
}
```

- `kind` 어휘는 기존 세 파일의 합집합에서 시작한다(MICROMAP-UX §4 + 알레시아 전용 `ditch`·`trap`·`tower`·`camp`·`redoubt`·`oppidum` 등). **표에 없는 kind는 린트가 막는다.** 어휘를 늘리면 `micro.ts`의 paint 표에 한 줄 더한다.
- 정직성 태그 넷(확정·근사·복원·논쟁)은 **별도 필드 `grade`**다. `source`는 사료·근거 문장(자유 텍스트)이고, 알레시아처럼 `source`가 「BG 7.72」인 파일도 그대로 둔다(이관 스크립트가 `attested`에서 `grade`를 파생). `grade`가 없거나 넷 밖이면 린트 실패.
- 콜아웃 `topic`은 필터 칩(지형·부대·사건)의 근거다. 부대 콜아웃은 `anchor.unit`으로 말판 유닛 id를 가리킬 수 있고, 그 페이즈에 유닛이 있을 때만 뜬다.
- 좌표는 GeoJSON `[lng, lat]`.

**말판 v2** `data/boards/<id>.json`. `schema/board.ts`에 더하는 것은 전부 선택 필드라 지금 파일 둘(칸나이·파르살루스)이 그대로 통과한다.

```jsonc
{
  "id": "alesia-52", "title": "알레시아 · 구원군의 사흘", "year": -52, "center": [4.4958, 47.535], "zoom": 12.2,
  "teaching": true, "source": "『갈리아 전기』 7.79~88을 통설대로 도식화. 구원군 규모는 카이사르 25만 대 현대 8만~13만으로 갈린다 …",
  "phases": [
    { "t": 0, "caption": "구원군이 서쪽 언덕에 진을 친다", "cite": "BG 7.79", "quote": { "text": "…", "who": "카이사르", "cite": "BG 7.77" } | null,
      "units": [ { "id": "gaul-relief-cav", "at": [lon, lat], "actor": "갈리아", "arm": "cavalry", "label": "구원군 기병", "strength": 8000, "facing": 90, "status": "active | routed | destroyed", "path": [[lon,lat], …] | null } ],
      "arrows": [ { "from": [lon,lat], "to": [lon,lat], "via": [lon,lat] | null, "actor": "갈리아", "kind": "advance | retreat | flank" } ],
      "clashes": [ { "at": [lon,lat], "label": "서쪽 평원" } ] }
  ]
}
```

- 페이즈마다 **전체 배치**(지금 규칙). 사라진 유닛은 `status`로 말한다(`note` 없이 사라지면 린트가 막는 지금 규칙을 `status` 표기로 대체).
- `path`는 그 유닛이 **다음** 페이즈까지 가는 길이다. 없으면 직선 보간. 사료가 우회를 말할 때만 적는다.
- `arrows`는 A_공간지도 전투전술의 큰 기동 화살표(반투명, 곡선)다. `clashes`는 교전 표식(교차 검)이다. **둘 다 사료가 말하는 곳에만 둔다.** 캡션 없는 페이즈, `cite` 없는 캡션은 린트 실패.
- `quote`는 HistoryMarche식 인용 카드다. 있으면 그 페이즈로 넘어갈 때 지도 위에 한 번 뜬다.

**장면**(`state.ts` `Scene`)에 한 필드가 는다: `micro?: string`. 장면이 미시지도를 부르면 줌 문턱과 무관하게 그 지도가 켜지고 카메라는 장면 값이 이긴다. `board`·`phase`는 지금 그대로.

**북마크** localStorage 키 `chronoatlas:bookmarks:<ds>`, 값 `{ "v": 1, "items": Scene[] }`. 항목은 「북마크 조각 복사」가 내놓는 것과 같은 모양이고 `group`은 항상 `"내 북마크"`다. 내보내기는 같은 JSON, 가져오기는 zod 없이 필드 화이트리스트로 거른다(초기 번들에 zod 금지).

**DEM 메타.** `terrain/meta.json`은 지금 형식 유지(`encoding`·`maxzoom`·`exaggeration`·`credit`). 인셋은 미시지도 파일의 `dem` 블록이 정본이고 `terrain-<id>/`에는 타일만 있다. 두 군데에 같은 숫자를 적지 않는다.

### 3.3 데이터 흐름

1. 부팅: `main.tsx`는 `micromaps.INDEX`(수백 바이트)만 싣는다. 지도 JSON·콜아웃·말판·베이스맵·전투 렌더러는 안 싣는다.
2. 장면 적용 또는 `moveend`: `microMapAt(zoom, center)` 또는 `scene.micro`가 id를 준다. 이전 id와 다르면 `loadMicro(id)` → `micro.enter(def)`: 소스 `setData`, 베이스맵 이미지 소스 교체, `hide` 그룹 숨김, `dem`이 있으면 `setTerrain`을 인셋 소스로, `board`가 있으면 `battle.ts`를 싣고 켬, 콜아웃 컴포넌트 lazy 로드.
3. 전투 재생: `BattleBar`의 재생 → `battle.play()` → rAF마다 `board.interpolate(board, t)` → 부대·화살표·교전 소스 `setData`. 페이즈 경계에서 캡션 띠 갱신, `quote`가 있으면 카드가 1.5초 뜨고 재생은 그동안 멈춘다. 상태의 `phase`는 경계마다 `store.set`으로 올라가 URL(`bt=`)에 실린다. 재생 중 카메라는 고정이다.
4. 부대 탭: `battle.ts`가 히트한 유닛 id를 `store.set({ sel: 'unit:<board>:<id>' })`로 올리고 인스펙터가 부대 카드(이름 · 병종 · 병력 · 지휘관(`entity`가 있으면 정본 링크) · 근거 · 논쟁)를 그린다. `entity`가 있으면 인물 인스펙터로 가는 링크를 붙인다.
5. 나가기: `micro.leave()`가 전부 되돌린다. 재생 중이면 멈춘다. `setTerrain`은 대륙 소스로.
6. 즉석 북마크 저장: 현재 `State` → `Scene` 조각(기존 「북마크 조각 복사」 함수 재사용, `board`·`phase` 포함) → localStorage. 장면 목록은 파일 장면 + 북마크를 합친 배열이고 발표 넘김(`[` `]`)은 그룹 안에서만 돈다(지금 규칙).

### 3.4 단계와 완료 조건

근거 없이 닫지 않는다. 각 단계의 완료 조건은 계측이고, 계측값은 BACKLOG 원장에 적는다.

| 단계 | 무엇 | 완료 조건 |
|---|---|---|
| **P-Z** 병렬 | 모델링 시각화. 서브에이전트가 `docs/MODELS.md` 초안(도식 7) → 총괄 검토 → 커밋. 생성기·테스트는 P1 스키마 뒤에 붙인다 | 도식 7이 렌더되고, 데이터 모델 도식의 필드명이 계획의 Interfaces와 일치한다. 이후 모델을 바꾸는 커밋마다 갱신 |
| **P-A** 병행 | 정본 마이그레이션 → adapt → 범위 재베이크. `migrate_v2.py --write`(백업 자동, 먼저 `.bak` 존재 확인) → `adapt.ts`가 `팔레트.json`·`_registry.csv`를 `PALETTE_DIR` 또는 정본 옆 `Works/관계분석_방법론/components/`에서 읽게 고침 → `npm run adapt` → `scripts/extent.ts` `BBOX = [-25, 12, 75, 62]` → `npm run fetch-external` → `npm run adapt` 다시 → `npm run validate` | `test/extent.test.ts`·`test/year.test.ts`·`test/ontology.test.ts`의 지뢰가 초록으로. adapt 산출물 diff에서 엔티티·링크 수가 정본 행수와 같다. RUNBOOK-extent §6(콘스탄티노플·안티오키아·크테시폰·알렉산드리아 한 화면, z3~9 캡처 10장 여백 0). 기존 장면 카메라 재조준 |
| **P-B** | 영역 마감(§3.6c). `scripts/finish-territory.py` + 렌더 마감 | 두 시점 캡처에서 곶·반도·섬이 칠해진다. 예각 비율 절반 이하. `islands.csv` 산출 |
| **P0** | 번들 분할 | UI·내보내기·검색 지연 로드로 초기 JS ≤ 440 kB gz(`gzip -9`, 지금 491.8). **400 kB 게이트는 P1이 끝나는 시점에 잰다**(미시 오버레이를 두 번 옮기지 않기 위해. 계획 1/4 Task 1.6). `scripts/check-bundle.mjs`가 postbuild에서 막는다. vitest 전부 초록. 기존 미시 장면 셋의 `look.py` 층 개수가 분할 전과 같다 |
| **P1** | 레지스트리로 이관 + 칸나이 미시지도 등록 | 세 지도가 `data/micromaps/`로 옮겨지고 엔진 미시 층이 31 → 10 이하. 칸나이 미시지도(아우피두스 강 · 평원, 말판 `cannae-216` 연결). `test/micromap.test.ts` 신설. `look.py`로 알레시아·로마·알렉산드리아 층 개수 전후 동일 |
| **P2** | DEM 두 층 + 자연 환경(§3.6b) | `terrain/` 대륙 **z0~8**이 커밋되고 배포 뒤 `terrain/meta.json`이 200. z6 알프스 pitch 50 캡처에 능선이 서고, 모든 스킨에서 음영 + 옅은 고도색. 인셋 7곳(알레시아·로마·알렉산드리아·루비콘·아테네·파르살루스·칸나이) DEM z8~12 + 토지피복 타일 + 하천·호수. `data/insets.json` 한 줄로 인셋이 는다. 미시 진입 시 `map.getTerrain().source`가 인셋으로 바뀌고 나가면 되돌아온다. z11 캡처 육지 단색 픽셀 < 10%. 타일 총량 ≤ 200 MB(테스트) |
| **P3** | 새 미시지도 셋 | 각 지도 피처 ≥ 8 · 콜아웃 ≥ 5(전부 `cite`) · 앵커 미해결 0 · `source` 태그 전원. `docs/RUBICON.md`·`ATHENS.md`·`PHARSALUS.md`. 세부 지도 그룹에 장면 셋. `look.py` 층 개수 > 0, `docs/verify/overhaul/` 캡처 |
| **P4** | 전투 재생(말판 v2) | 스키마 v2가 기존 둘을 무수정 통과. 파르살루스·칸나이에 캡션·cite·화살표·교전 추가, **알레시아 말판 신설**(BG 7.79~88 세 페이즈). `board.interpolate` 테스트(t=0·1이 페이즈와 같다 · 중간이 선분 위 · `path`가 있으면 그 위 · `routed`가 페이드). 재생 캡처: 파르살루스 t=0.5 프레임에서 부대 블록이 두 페이즈 사이에 있고 화살표·캡션이 떠 있다(계측: 유닛 좌표가 양 끝점 사이). 부대 탭 → 인스펙터 제목이 유닛 라벨. 콜아웃 필터 칩으로 「부대」만 켜면 지형 콜아웃 0 |
| **P5** | 없던 장면 둘 | 「왜 제국인가: 평야」(plains 켬)·「카르하이 BC 53」. `test/present.test.ts` 연도 단조성 유지 |
| **P6** | 즉석 북마크 | 저장 → 새로고침 → 「내 북마크」 그룹에서 `[` `]`로 걷는다. 왕복 테스트(state → 조각 → 저장 → 복원 → 같은 state, `board`·`phase` 포함). 가져오기가 잘못된 JSON을 거절한다 |
| **P7** | 모바일 읽기 모드 | 390×844 에뮬레이션 캡처 6장(발표 1 · 세부 3 · 전투 재생 1 · 말판 1)에서 HUD·알약·시트의 경계 상자가 겹치지 않는다(계측). 탭 타깃 ≥ 44px. 콜아웃 핀 번호가 시트 목록 번호와 일치. 시트에서 재생·한 단계가 된다 |

**진행(2026-09-17 저녁)**: P-Z ● (`scripts/models-diagram.mjs` + `test/models.test.ts`) · P-A ● · P-B ● · P0 ◐ (410.4 kB, 게이트 450 통과, 400은 R46 잔여) · P1 ● · P2 ◐ (DEM·토지피복 됨, 스킨 고도색·인셋 하천·`insets.json`은 R56 잔여) · P3 ● · P4 ● · P5 ● · P6 ● · P7 ●. 증거는 BACKLOG R번호 행.

P-A를 앞에 두는 이유는 하나다. **범위가 바뀌면 `maxBounds`와 카메라가 바뀐다.** 새 장면 셋의 카메라를 옛 범위에서 잡으면 두 번 잡는다. P4가 P3 뒤인 이유도 하나다. 알레시아 말판은 알레시아 미시지도(레지스트리·DEM 인셋) 위에 서야 하고, 파르살루스 말판은 P3의 파르살루스 지도가 그릇이다.

### 3.5 새 미시지도 셋: 내용과 출처 원칙

좌표를 지어내지 않는다. 우선순위는 ① 번들에 이미 있는 Pleiades(`layers/landmarks.geojson`, 확인: `Rubico` 강 `[12.3607, 44.0722]`, `Enipeus` 강 `[22.3585, 39.3195]`, `Pnyx` 언덕 `[23.7195, 37.9714]`) ② 발굴 보고·학술 지도 ③ 위키백과 좌표 필드. 면·선은 현대 지형에 맞춘 근사이고 그렇게 태그한다. ODbL(OSM)·CC BY-SA 기하는 눈으로만 참조하고 복사하지 않는다.

**루비콘 · BC 49.** 보여 줄 것은 「이 강이 얼마나 작은가」와 「무장한 채 이 선을 넘으면 반란」이다. 강(비정은 논쟁이다. 사비냐노의 현대 루비코네 통설 대 피사텔로·우소 대안, 태그 `논쟁`), 라벤나·아리미눔(확정), 진군 경로 라벤나 → 강 → 아리미눔(근사, 수에토니우스 『카이사르』 31~33 · 플루타르코스 『카이사르』 32), 갈리아 키살피나/이탈리아 경계선(강을 따라, 복원), 아펜니노와 아드리아 사이 좁은 평야(DEM이 보여 준다). 콜아웃: 강의 크기 · 속주 경계 · 「주사위는 던져졌다」 사료 · 술라의 선례 링크. 말판은 없다(전투가 아니다). 대신 이동경로 문법(HistoryMarche)으로 라벤나에서 아리미눔까지 한 줄.

**아테네 아크로폴리스.** 연도는 발표 축(BC 60)에 두고 **그 해 서 있던 것만** 그린다. 아그리파 오데온(BC 15)·하드리아누스 도서관(AD 132)은 넣지 않는다. 아크로폴리스(hill) · 파르테논(temple, 확정) · 프로필라이아(gate) · 에레크테이온(temple) · 디오니소스 극장(theatre) · 아고라(forum) · 프닉스(field, 민회) · 아레오파고스(hill) · 테미스토클레스 성벽(wall, 복원) · 일리소스·에리다노스(river). 바탕 도판은 19세기 PD 지도(Curtius·Kaupert 『Karten von Attika』 1881 계열 또는 Kiepert Atlas Antiquus 아테네 인셋)를 `MICROMAP-BASEMAP.md` 절차로 지오레퍼런싱하고, 실패하면 알레시아처럼 기록하고 벡터로 간다. 콜아웃: 프닉스 민회(정족수 6,000의 근거는 `ATHENS.md`에서 사료를 확인해 적는다) · 디오니소스 극장 · 파르테논 · 아고라(불레·법정) · 대표님 논지 「로마가 그리스 정치체제를 받아들였다」의 사료 대조(리비우스 3.31~33 12표법 사절단 전승은 논쟁, 로마 공화정의 기원은 독자적). 이 마지막 콜아웃이 이 지도의 존재 이유다. 반박이 아니라 **한 번 더 증명**(PACK-CAESAR §14.2 ④의 결).

**파르살루스 · BC 48.** 있는 것을 잇는다. 말판 `pharsalus-48`(3페이즈)을 이 지도의 `board`로 걸고 DEM 인셋 위에 세운다. 에니페우스 강(확정, 전장 위치는 북안·남안 논쟁 태그) · 파르살루스 시(확정) · 폼페이우스 진영 언덕(복원) · 카이사르 진영(복원). 콜아웃: 병력(『내전기』 3.88, 당사자 수치라는 주의) · 넷째 줄 · 「하루 만에 도망자」 · 위치 논쟁(Morgan 1983 대 Pelling 1973). 내전이라 양쪽이 로마다. 색은 `proposals/20260912_palette_civilwar_2.jsonl` 승인 전까지 폴백이며 이 스펙이 그걸 바꾸지 않는다.

**칸나이 · BC 216(등록만).** 말판 `cannae-216`이 있다. 미시지도 파일은 아우피두스 강(Pleiades)과 평원(정본 `place:칸나이평원`) 정도로 얇게 만들고, 콜아웃은 말판 캡션이 맡는다. 전장 기슭 논쟁은 말판 `source`에 이미 있다.

각 지도의 근거 문서는 `docs/ROMA-URBS.md`와 같은 짜임(30초 · 무엇이 들어 있나 · 확정/근사/복원/논쟁 · 안 넣은 것 · 출처)을 따른다.

### 3.6 전투 재생과 A_공간지도 문법

River가 가리킨 볼트 `references/캡처라이브러리/A_공간지도/` 43장(BazBattles 9 · Kings and Generals 12 · HistoryMarche 18 · Epic History 4)은 제3자 화면이라 레포에 안 들어온다. 문법만 가져온다. 2026-09-17에 여섯 장을 보고 네 문법으로 갈랐다.

| 문법 | 캡처에서 보이는 것 | 우리 구현 | 어디에 |
|---|---|---|---|
| **전투전술** (Epic History 08 · K&G 02) | 양피지 바닥 위 **길쭉한 사각 블록**(보병은 넓고, 기병은 좁고 대각선 반쪽 채움), 큰 반투명 **곡선 기동 화살표**, 점선 **엄폐물·보루**, 하단 **캡션 띠** | `battle.ts`: 유닛 → 회전 사각형 폴리곤(향은 `facing`, 크기는 `arm`별 고정 + `strength` 로그 스케일로 폭만), 세력색 채움 + 잉크 테. `arrows` → 곡선 라인(`via` 제어점) + 화살촉, 반투명. 보루·해자는 미시지도 `kind`(`ditch`·`wall`)가 이미 그린다. 캡션 띠는 `BattleBar` | 말판이 있는 미시지도 전부 |
| **도시공성** (BazBattles 01 · K&G 04) | 성벽·항구·등대 같은 지물이 **그림으로**, 부대는 작은 블록 무리, 바다는 밝은 청 | 3D 건물은 안 만든다(비범위). 벡터 `kind`별 도식(성벽 두꺼운 갈색, 건물 작은 블록, 항구 선)을 미시 `campaign` paint 표로 강화 + PD 도판 + DEM 음영. 부대 블록은 위와 같다 | 알레시아 · 알렉산드리아 |
| **이동경로** (HistoryMarche 10 · Epic History 02) | 채색 음영 지형 위에 **강이 빛나고**, 행군은 선 + 교차 검 표식, 장군은 초상 카드 + 군기 | 강은 `river` kind에 후광 한 겹. 교차 검은 `clashes` 심볼(자체 SVG를 빌드타임에 PNG로 구움). 초상 카드·군기는 II(대륙 장기말 v2). 미시에서는 `entity`가 있는 유닛에 작은 초상 뱃지 대신 **이름판**만 | 루비콘 · 파르살루스 |
| **인용 카드** (HistoryMarche 18) | 흐려진 지도 위 세리프 인용문 + 발화자 | `quote`가 있는 페이즈로 넘어갈 때 1.5초 카드. 지도는 CSS 블러가 아니라 카드 판에 반투명 처리(GL 캔버스 블러는 비싸다) | 페이즈 `quote` |

**고증 규칙**(MICROMAP-UX §5의 연장). ① 페이즈마다 `cite`. ② 화살표·교전은 사료가 말하는 기동에만. 「그럴듯한」 기동을 그려 넣지 않는다. ③ 병력은 사료 수치 그대로 적고 논쟁은 `source`에. 블록 크기는 로그 스케일이라 수치 논쟁이 그림을 크게 바꾸지 않는다. ④ 배치·전장 위치가 논쟁이면 캡션 첫 페이즈에 한 줄로 밝힌다(파르살루스 북안·남안, 칸나이 기슭). ⑤ 유닛 세부 카드에 「이 배치는 도식이지 측량이 아니다」 상시 문구.

**재생 규칙.** 페이즈 전환 1.5초(발표 리듬, 장기말 `ANIM_MS`와 같은 감각). 재생 속도는 고정이고 조절 UI를 두지 않는다. `quote` 카드가 뜨는 동안 멈춘다. 마지막 페이즈에서 멈추고 처음으로 안 돌아간다. 단축키 `P` 재생·일시정지, `.`·`,` 한 페이즈 앞뒤. 스페이스는 연도 재생이라 건드리지 않는다(PACK-CAESAR §7 경고 그대로).

**알레시아 말판 신설**(`alesia-52`). 『갈리아 전기』 7.79~88 세 페이즈: ① 구원군 도착, 서쪽 평원에 진(7.79) ② 밤의 총공격과 북쪽 언덕(레아 산) 진영 급습(7.81~85) ③ 카이사르의 기병 우회와 붕괴(7.86~88). 유닛 좌표는 정본 포위선(`pack-alesia.json`의 내·외선)에서 파생한 상대 배치이고 측량이 아니다. 규모 논쟁(카이사르 25만 대 현대 8만~13만)은 `source`와 첫 캡션에.

### 3.6b 확대하면 빈 화면 (A, R56)

**진단.** 대륙 relief.jpg는 1.85 km/px라 z9에서 8배 늘어나 뭉개지고, 라이브에는 DEM이 없어 z8 이상은 육지 단색이다. 미시지도 밖에서는 NE 10m 해안·강 선만 남는다. 「맹탕」의 원인은 셋이다: 지형 해상도, 자연 환경 층(식생·물)의 부재, 그리고 인셋이 미시지도 셋에만 묶여 있는 것.

**설계 세 겹.**
1. **대륙 DEM을 z8까지**(ETOPO 15초의 원 해상도 한계, 약 460 m/px) 굽고, **모든 스킨에서** hillshade + 옅은 고도색(DESIGN 램프 `--ramp-elev`, 불투명도 15%)을 켠다. z9(미시지도 밖 최대 줌)까지 「지형이 있는 땅」이 된다.
2. **인셋에 자연 환경 세 층**: **토지피복**(ESA WorldCover 10 m 2021 v200, CC BY 4.0을 Zenodo 원문으로 확인. 3°×3° 타일, 7곳 전부 있음. `scripts/bake-landcover.py`가 zarr 창 읽기로 필요한 조각만 읽어 z8~12 래스터로 굽는다. 숲·경작·초지·나지·건조지·물을 `campaign` 팔레트로 재색) 위에 **DEM 음영**(Copernicus 인셋), 그 위에 NE 10m 하천·호수·해안(PD, 이미 있음). HydroLAKES는 CC BY 4.0이지만 782 MB 단일 파일이라 보류, HydroRIVERS는 재배포 조항이 불확실해 보류(2026-09-17 실측, REQUESTS 9차 후속 2). Google 지형도의 톤이 아니라 우리 스킨의 톤이다(P2: 지도 위 유채색은 데이터 색뿐. 토지피복은 데이터다).
3. **인셋을 데이터 한 줄로**: `data/insets.json`에 `{ "id", "at", "span", "why" }`만 적으면 `bake-dem.py`가 DEM·토지피복을 굽고 엔진이 그 범위에서 인셋 소스를 켠다. 미시지도가 없어도 된다. 미시지도의 `home`은 자동으로 인셋이다.

**안 하는 것.** 전역(대륙 전체) 고해상은 타일 수가 z10에서 5만 장을 넘어 레포에 못 넣고, 온라인 타일(Mapterhorn·OpenFreeMap)은 CONSTITUTION 6-2 「런타임 외부 호출 0」의 예외다. **River가 켜기로 하면** 「온라인 지형」 토글(기본 꺼짐, 출처 표기)로 넣는다. 결정 전까지는 인셋 방식만.

**완료 조건.** 로마·알레시아·루비콘 z11 캡처에서 육지 단색 픽셀 비율 10% 미만. **잣대(2026-09-17 확정)**: 「단색」은 스킨의 `land` 색 그대로인 **맨땅 픽셀**(채널별 ±6)이다. `scripts/blank-ratio.py`가 캡처에서 센다. 처음 두 잣대는 버렸다: 「가장 흔한 색 통의 비율」은 크림빛 경작지와 영토 색조가 한 통에 몰려 질감 가득한 로마가 25%로 나왔고, 「이웃과 같은 편평 픽셀」은 평야가 실제로 편평해서(하란 평원·알레시아 고원 61%) 좋은 지도도 떨어졌다. 실측 0.0~0.1%. z9 이탈리아 반도 캡처에 음영과 고도색이 보인다. `data/insets.json`에 한 줄 더하면 굽기부터 렌더까지 코드 수정 0.

### 3.6c 영역 마감 (B, R57 · R33 흡수)

**진단.** Cliopatria 폴리곤은 국가 단위로 일반화돼 정점이 성기고(톱니), 해안선은 NE 10m과 다른 소스라 어긋나며(곶이 비고 바다로 샌다), 작은 섬은 어느 폴리곤에도 안 들어 있다(주인 없는 땅처럼 보인다). 렌더는 채움 + 1 px 외곽선뿐이라 마감이 없다.

**파이프라인** `scripts/finish-territory.py`(shapely, 빌드타임, `npm run finish`. `fetch-external` 뒤에 `layers/territory/*.geojson`을 다시 쓴다. 정본 JSONL은 안 건드린다). **2026-09-17 구현하며 한 가지를 바꿨다: 해안선 자르기는 데이터에서 하지 않는다.** 폴리곤마다 해안선을 복사하면 정점이 6배로 뛰었다(−100 버킷 35,778 → 207,713 실측). 대신 렌더에서 바다 마스크가 자른다(아래).
1. **부드럽게**: 상한 있는 Chaikin 1회(자르는 길이 ≤ 4 km. 보통 Chaikin은 긴 사막 국경도 25%씩 깎는다) → `simplify(100 m)`. 톱니가 사라진다(예각 비율 0.009 → 0.004).
2. **넉넉하게**: 2 km 바깥 버퍼. 곶·반도가 바다 마스크 밑까지 채워진다(R33 「곶이 안 칠해진다」).
3. **섬 귀속**: 어느 폴리티에도 안 덮인 섬(NE `minor_islands` + 육지 파일의 4,000 km² 이하 조각)은 **가장 가까운 폴리티에서 40 km 이내**면 그 폴리티에 붙인다. 규칙은 피처 속성(`island_rule: "nearest<=40km"`)과 `docs/verify/overhaul/islands.csv`에 남긴다. 사실 주장이 아니라 렌더 규칙이다. 큰 섬(시칠리아·크레타·키프로스)은 데이터가 이미 가진다.
4. **겹침 정리**: 시간이 겹치는 인접 폴리티가 겹치면 면적 큰 쪽이 양보(BACKLOG C).
5. `simplify(600 m)`. 정점은 원본의 2.1배, 버킷 23개 합계 13 → 30 MB(버킷당 최대 3.5 MB, 지연 로드).

**렌더 마감**(엔진): **바다 마스크** `layers/ocean.geojson`(bbox − 육지, 작은 섬은 `land.geojson`에 덧붙여 구멍)을 영역 위에 바다색 94%로 덮는다. 어느 줌에서도 해안에 딱 맞고 데이터는 안 는다. 그 위에 수심 띠·호수·**해안선 잉크 1 px**. 영역은 채움 + **안쪽 후광**(같은 색, `line-offset` 음수 + `line-blur`, 불투명도 0.16) + 바깥선. 미시 축척에서 territory 채움을 빼는 규칙은 그대로. 덤으로 「책의 지역」 점선 216개(`admin_regions`)는 z5.5부터만 그린다(대륙 축척을 뒤덮었다).

**완료 조건.** BC 49 · AD 117 두 시점 캡처에서 이탈리아 장화 끝·펠로폰네소스·크레타·사르데냐·키클라데스가 칠해진다. 폴리곤 정점 내각 히스토그램에서 45° 미만 예각 비율이 처리 전의 절반 이하. 섬 귀속 표(`docs/verify/overhaul/islands.csv`: 섬 이름 · 붙인 폴리티 · 거리)를 River가 훑는다.

### 3.6d 모델링 시각화 (Z, R55)

**무엇.** `docs/MODELS.md`. 텍스트로 쓰고 GitHub·Obsidian에서 렌더되는 Mermaid 도식 일곱: 모듈 지도(초기 번들·지연 청크) · 데이터 모델(classDiagram: State·Scene·MicroMap·Callout·Board v2·Frame·Bookmark·Terrain) · 미시지도 진입·이탈 시퀀스 · 전투 재생 상태기계 · DEM 두 층 · 레이어 그룹과 소스 · 슬라이스 지도. 각 도식 아래에 「정본은 어디」 한 줄. 세부 규칙은 여기 안 적고 OVERHAUL·SCHEMA·MICROMAP-UX로 링크한다(CONSTITUTION 0-4).

**낡지 않게.** 데이터 모델 도식은 `scripts/models-diagram.mjs`가 zod(`schema/*.ts`)에서 classDiagram을 생성해 MODELS.md의 표시 블록(`<!-- generated:schema -->` … `<!-- /generated -->`)을 갈아끼우고, 테스트가 「생성 결과 = 문서 블록」을 검사한다. 나머지 도식은 손으로 그리되 **모델(스키마·State·Scene·엔진 반환 API)이 바뀌는 커밋은 같은 커밋에서 도식을 고친다**(§5 규칙).

**협업.** 새 모델은 코드보다 도식을 먼저 고친다. River는 도식으로 검토하고, 에이전트는 도식에서 이름을 가져다 쓴다.

### 3.7 DEM 파이프라인

**소스.** 대륙은 **ETOPO 2022 15초 표면 고도**(NOAA NCEI, 15°×15° GeoTIFF 타일, 자유 이용, 인용 DOI 10.25921/fd45-gt74). 확대 범위 `[-25,12,75,62]`를 덮는 타일은 35장(타일 이름은 좌상단 모서리, 각 33 MB)이다. 대륙은 **z0~8**까지 굽는다(§3.6b ①). 육지 고도와 수심이 한 그리드에 있지만 타일에는 **바다를 0으로 눌러** 굽는다(입체 보기에서 바다가 꺼지지 않게, 그리고 PNG가 반으로 준다). 수심 색은 지형이 아니라 NE 수심 벡터(`bathy-over`)가 낸다. 인셋은 **Copernicus GLO-30**(AWS 공개 버킷 `copernicus-dem-30m`, 1°×1° COG, 출처 표기 조건). 두 소스 다 2026-09-17에 이 환경에서 200을 확인했다. 지금 로컬에 있는 AWS Terrain Tiles(라이선스 혼합)는 커밋하지 않고 지운다.

**도구.** GDAL이 없다. `scripts/bake-dem.py`가 numpy + tifffile(+ imagecodecs)로 직접 한다: 웹 메르카토르 타일 z/x/y의 256×256 픽셀 중심을 위경도로 풀고 소스 그리드에서 이중선형 보간, terrarium 인코딩(`(h + 32768)`을 R·G·B로), PNG 저장. **양자화**: 대륙 2 m·인셋 1 m 계단으로 내린다(2026-09-17 실측: 원 정밀도 1/256 m로 구우면 z8 한 장 128 kB·대륙 4,780장 600 MB, 2 m·바다 0이면 28 kB·144 MB. 15초 화소 460 m에 2 m 계단은 경사 0.25도라 음영에 안 보인다). `--selftest`가 인코딩 왕복과 타일 경계를 단언한다. 원본은 `data/external/dem/`(gitignore)에 캐시.

**범위.** 대륙 z0~8(BBOX 안, 4,780장). 인셋은 미시지도 `home.at` ± `home.span`(지도마다 다르다. 알레시아 0.6, 로마 0.35), z8~12(Copernicus 30 m가 z12 픽셀 크기에 맞는다. z13은 뻥튀기라 안 굽는다). 인셋 소스는 같은 값을 `bounds`로 받고 `minzoom: 8`이라 밖에서는 요청이 안 나간다. 미시지도 파일이 바뀌면 굽는 범위도 따라온다.

**엔진.** 대륙 `dem` 소스는 지금 코드 그대로. 인셋은 미시 진입 때 `map.addSource('dem-<id>')` + `setTerrain({source:'dem-<id>'})` + 음영 층의 소스 교체, 이탈 때 복귀. 과장 배율은 지금의 줌 연동 규칙 유지.

**커밋.** `.gitignore`의 `public/datasets/*/terrain/`을 풀고 `terrain/`·`terrain-*/`을 커밋한다. `public/assets/CREDITS.md`와 `data/external/LICENSES.md`에 ETOPO·Copernicus 줄을 더한다. 총량 상한 200 MB는 테스트가 지킨다(2026-09-17 실측 대륙 144 MB + 인셋 일곱 35 MB = 179 MB).

### 3.8 모바일 읽기 모드

DESIGN §4 「모바일은 읽기 전용」을 그대로 따른다. 폭 620px 이하에서만.

- 남기는 것: 지도 · 장면 알약(있음) · 슬림 HUD(있음) · 콜아웃 핀(번호만) · 하단 시트 하나.
- 시트 탭 넷: **설명**(장면 note·그 해) · **콜아웃**(번호순 목록, 카드 본문 그대로, 필터 칩) · **객체**(인스펙터 축약, 부대 카드 포함) · **재생**(말판이 있을 때만: 재생·한 단계·슬라이더·캡션). 시트는 접힘 56px · 반 · 전체 세 단.
- 숨기는 것: 탐색 카드 · 레이어 토글 · 관계 그래프 · 내보내기.
- 카메라: `fitZoom`(있음). 미시지도 `view.zoom`도 같은 보정을 탄다.
- 터치: 핀 탭 → 시트가 그 콜아웃으로 스크롤. 부대 블록 탭 → 객체 탭. 지도 핀치·드래그는 MapLibre 기본.

### 3.9 오류 처리

| 상황 | 동작 |
|---|---|
| 콜아웃 앵커가 피처·유닛을 못 찾음 | 지금처럼 버리고 콘솔에 남긴다. **그리고 `test/micromap.test.ts`가 CI에서 막는다** (경고에서 실패로 승격) |
| 장면의 `micro`·미시지도의 `board`가 레지스트리에 없음 | 린트 실패. 런타임에 만나면 그것 없이 장면만 적용 |
| 미시지도·전투 렌더러 `import()` 실패 | 대륙 지도는 그대로, 콜아웃·재생 없음. 한 줄 안내 |
| 페이즈에 캡션·cite 없음, 유닛이 `status` 없이 사라짐 | 린트 실패(지금 `note` 규칙의 승격) |
| 재생 중 미시지도 이탈·장면 전환 | 재생을 멈추고 소스를 비운다. `phase`는 마지막 경계값 유지 |
| DEM 인셋 타일 없음 | `bounds`·`minzoom`으로 요청 자체가 안 나간다. 대륙 소스가 overzoom으로 받친다 |
| 베이스맵 이미지 404 | 층을 건너뛰고 `epoch_note` 자리에 「도판 없음」 |
| localStorage 없음·용량 초과 | try/catch. 북마크 UI에 한 줄 안내, 저장 버튼 비활성 |
| 가져오기 JSON이 형식 밖 | 필드 화이트리스트 통과 항목만 받고 나머지 개수를 알린다 |

### 3.10 테스트와 검증

**vitest(`npm run validate`에 포함).**
- `test/micromap.test.ts` 신설: 모든 `data/micromaps/*.json`이 zod를 통과 · `kind`가 paint 표 안 · 콜아웃 앵커(피처·유닛) 전원 해석 · `home.at`이 `view` 화면 안 · 장면 `micro`·미시지도 `board` 참조 실재 · 썸네일 대장의 콜아웃 id 실재 · `source` 태그 넷 중 하나.
- `test/board.test.ts` 확장: v2 필드가 선택이라 기존 둘이 무수정 통과 · 페이즈 `caption`·`cite` 필수 · `status` 규칙 · `interpolate` 단언(t=0·1 일치, 중간은 선분 또는 `path` 위, `routed` 불투명도 감소, 결정론).
- `test/bookmarks.test.ts` 신설: 왕복(`board`·`phase` 포함) · 그룹 고정 · 가져오기 거절.
- `test/terrain.test.ts` 신설: `meta.json` 형식 · 인셋 `bounds`가 `home.at`을 포함 · 타일 총량 ≤ 200 MB.
- 기존 `present.test.ts`(연도 단조) · `state.test.ts` · `payload.test.ts`는 그대로 지켜야 한다.

**번들.** `scripts/check-bundle.mjs`를 `postbuild`에 건다. `dist/assets/index-*.js` gz ≤ 340 kB. 동적 청크는 별도 상한(미시지도 파일당 ≤ 80 kB gz, 전투 렌더러 청크 ≤ 40 kB gz).

**렌더.** 자동화 탭에서는 지도가 안 뜬다(HANDOFF §5). `bash scripts/serve.sh` + `python3 scripts/look.py <scene>`으로 장면별 층 개수를 계측하고 `docs/verify/overhaul/`에 캡처를 남긴다. 전투 재생은 같은 창에서 `battle.seek(0.5)`를 호출해 중간 프레임을 떠서 유닛 좌표가 양 끝점 사이임을 잰다. 모바일은 같은 CDP 창에 뷰포트 390×844 · dsf 3을 걸어 캡처하고 경계 상자 겹침을 숫자로 잰다.

**사람 판정(River).** P13 「완성된 지도로 보이는가」를 새 미시지도 셋과 z6 입체 캡처, 파르살루스·알레시아 재생 프레임에 대해. 아크로폴리스 콜아웃의 사료 대조 문장. 알레시아 말판 세 페이즈의 캡션 문안.

### 3.11 River 몫

- `migrate_v2.py --write` 승인: **2026-09-17 받았다.** 백업(`.bak_YYYYMMDD`) 확인 뒤 실행. `proposals/`는 병합하지 않는다.
- 새 미시지도 셋·재생 프레임 취향 판정(P13). 아테네 사료 대조 콜아웃 문안, 알레시아 캡션 문안 확인.
- 푸시·배포 결정(PACK-CAESAR §7 규칙 그대로).
- **온라인 지형 토글**(Mapterhorn 등 외부 타일, 헌법 6-2 예외)을 넣을지. 기본은 안 넣는다(§3.6b).
- 섬 귀속 규칙(가장 가까운 폴리티 40 km)과 `islands.csv` 확인(§3.6c).
- `docs/MODELS.md` 도식이 River가 검토하기에 맞는 추상도인지(§3.6d).

## 4. 슬라이스 II~IV 범위 (각자 스펙을 따로 쓴다)

**II. 시각 문법(대륙 축척).** → 스펙 초안 [OVERHAUL-II.md](OVERHAUL-II.md) (2026-09-17, River 승인 대기). I에서 미시 축척으로 들어간 네 문법 중 대륙 축척 몫이 남는다: 점선 사슬 국경과 사선 세력권 · 연도 리본 HUD · 세리프 소문자 대문자 자간 라벨(글리프는 빌드타임 자체 생성, CONSTITUTION 6-2) · 장군 배너 카드(방패형 초상 + 이름판 + 작은 군기, HistoryMarche 10) · 장기말 프로시저럴 v2(받침 + 몸통 + 군기, 군단은 작은 말 무리를 `pack-legions` 수로) · 채색 음영 지형(`campaign` 스킨 v2, hillshade + 난색 고도색). 스킨과 UI 테마 어긋남(BACKLOG §E 미해결)은 여기서 ①(연동) 또는 ②(후광)로 닫는다.

**III. 데이터 기반.** P-A가 끝나면 BACKLOG 라운드 B·C·D를 적힌 대로. 더하는 것 둘: ETOPO 수심을 `color-relief`(maplibre-gl 6.3에 있음)로 「깊을수록 짙게」(DESIGN 램프) · 위성 스킨은 PD 래스터(NASA Blue Marble 또는 Natural Earth II)를 relief처럼 굽는다.

**IV. 플랫폼.** 장면을 「사건 · 시대 · 시공간 · 행동 맥락」으로 묶는 의미체계는 정본 온톨로지의 `event`·`period`와 장면·말판을 잇는 링크 층이다(장면 → 사건 id, 사건 → 장면들, 말판 → 사건). 프로젝트별 북마크는 I의 localStorage를 파일 내보내기로 잇는 것에서 시작한다. 자료실 `atlasUrl` 역링크(TASKS 3.6).

## 5. 이 문서와 다른 문서

- 요구 원장·상태: [BACKLOG.md](BACKLOG.md) R46~R54. 여기 상태를 적지 않는다.
- River 원문: [REQUESTS.md](REQUESTS.md) 9차와 후속.
- 미시지도 UX 규칙: [MICROMAP-UX.md](MICROMAP-UX.md)가 정본이고, 이 스펙은 그 규칙을 데이터로 옮기는 방법과 전투 재생을 더하는 방법만 적는다. 레지스트리가 붙으면 그 문서 §8 파일 표를 갱신한다.
- 말판 규칙: BACKLOG §G(2026-09-11 「해 둔 것」)의 정한 것 셋(`teaching` 강제 · 전체 배치 · zod는 `schema/`)은 그대로 살아 있다. v2는 더하기만 한다.
- 범위 바꾸기 절차: [RUNBOOK-extent.md](RUNBOOK-extent.md). P-A가 끝나면 「River 터미널」 문구를 실측으로 고친다.
- 모델 도식: [MODELS.md](MODELS.md). **모델(스키마·State·Scene·엔진 반환 API)을 바꾸는 커밋은 같은 커밋에서 해당 도식을 고친다.** 데이터 모델 도식은 생성기가 맡는다(§3.6d).
- 구현 계획(단계별 작업 목록, 2026-09-17 작성): `docs/plans/2026-09-17-overhaul-I-1-foundation.md`(P-A · P0 · P1) · `…-I-2-dem-micromaps.md`(P2 · P3) · `…-I-3-battle.md`(P4) · `…-I-4-scenes-bookmarks-mobile.md`(P5 · P6 · P7 · 마감). 각 계획 머리에 「모델링」 표가 있다. 계획은 이 스펙에서 파생되며, 어긋나면 스펙이 이긴다.
