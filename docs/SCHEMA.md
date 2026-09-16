# SCHEMA — 데이터 계약 v2

> 볼트 `Works/비주얼파이프라인/`에서 이관 (2026-09-16). 원본 작성 2026-08-14 · 최종 2026-09-12

정본 온톨로지(`entities.jsonl`·`links.jsonl`)와 빌드 산출물(`graph.json`·`layers/*.geojson`) 사이의 계약. v1(2026-08-14)의 GeoJSON·시간 모델·LOD·출처 규칙은 유지하고, 청사진의 **history·faction·office·src·외부 ID·에셋**을 얹는다. 기존 데이터는 전부 유효하다 — 추가는 선택 필드거나 새 타입이다. 규율은 [CONSTITUTION](CONSTITUTION.md), 왜는 [BLUEPRINT](BLUEPRINT.md).

## 원칙

- **정본은 JSONL 두 파일.** 산출물은 빌드가 만들고 손대지 않는다.
- **GeoJSON 네이티브, `[경도, 위도]`.** atlas(Leaflet)는 `[lat, lon]`이었다 — 포팅 시 뒤집는다. 최대 버그원.
- **시간은 세 모델** — 스냅샷(territory/admin_regions) · 구간 valid(대부분) · 단계 보간(movements). 렌더는 `setFilter`, `setData` 아님.
- **base + history[]** — 불변 속성은 본체에, 시간에 따라 바뀌는 상태는 `history`에. 연도 지도는 patch를 그 해까지 접어서(fold) 만든다.
- **출처·신뢰도·계통 필수** — `source` · `confidence` · `src`.
- **도메인 무관** — `manifest.json`이 도메인을 정한다. 엔진은 로마를 모른다.

## 정본 — `entities.jsonl`

```jsonc
{
  "id": "person:카이사르",            // type:슬러그. 파일명·에셋 키·URL의 근원
  "type": "person",                  // 아래 타입 9종
  "name": "카이사르",
  "aliases": ["가이우스 율리우스 카이사르", "Caesar"],
  "name_ancient": "Gaius Iulius Caesar",
  "name_modern": null,
  "points": [5, 6, 7, 8],            // 편역본 등장 포인트
  "chapters": [],                    // 기번 원전 등장 장(미래)
  "attrs": { "born": -100, "died": -44, "gens": "율리우스" },
  "descs": [ { "text": "…", "point": 6, "src": "point" } ],
  "history": [                       // 시간 상태(선택). 연도 오름차순
    { "year": -59, "patch": { "office": "office:집정관" } },
    { "year": -49, "patch": { "status": "내전" } }
  ],
  "ext": { "wikidata": "Q1048", "pleiades": null, "dprr": "…", "periodo": null },
  "location": null,                  // place만: [lon, lat]
  "mapmarker": null,                 // place만: city·region·river·sea·building·island·battlefield·mountain·lake·cape
  "source": "book+web",
  "confidence": "high",
  "src": "point",                    // point | gibbon | wikidata | dprr | manual
  "note": ""
}
```

### 타입 9종

| type | 무엇 | 필수 추가 | 지오메트리 |
|---|---|---|---|
| `person` | 인물 | `attrs.born/died` | — |
| `place` | 지명 | `location`, `mapmarker` | Point (+ region이면 폴리곤은 layers에) |
| `event` | 사건 | `attrs.year` 또는 `from/to` | occurred_at으로 place 참조 |
| `group` | 세력·민족·집단(국가 포함) | — | territory 스냅샷은 layers에 |
| `institution` | 제도·기구(원로원·백인대회·12표법) | `attrs.requires[]`(선택) | — |
| `work` | 저작·구조물(아피아 가도·판테온) | — | Point/Line 선택 |
| `period` | 시대 구간 | `attrs.from/to`, `ext.periodo` | — |
| **`faction`** (신설) | 세력 **안의** 세력: 정파·계급·가문·군벌 | `attrs.kind`(party/class/gens/warlord), `attrs.parent`(group id) | — |
| **`office`** (신설) | 자리: 집정관·호민관·속주총독·황제 | `attrs.max_holders`, `attrs.term_years`, `history[{year, holder}]` | — |

`faction`은 관계분석 레지스트리의 파생 필드였던 것을 1급으로 올린 것이다. 레지스트리의 `faction` 열은 **소속·출신 정체성**(불변)이고, 이 타입은 **정치 세력**(가변)이다. 둘은 다르다 — 히에론은 정체성이 그리스계이고 정파는 시대에 따라 바뀐다.

## 정본 — `links.jsonl`

```jsonc
{ "from": "person:카이사르", "to": "person:폼페이우스", "rel": "opposed",
  "point": 7, "from_year": -49, "to_year": -48, "year_basis": "explicit",
  "src": "point", "confidence": "high", "note": "" }
```

### rel — 기존 16 + 신설 6

| 의미군(선 스타일) | rel | 방향 |
|---|---|---|
| 동맹·우호 (실선) | `allied_with` · `protected` | 대칭 / 보호자→피보호자 |
| 적대 (붉은 지그재그) | `opposed` | 대칭 |
| 지배·정복 (화살촉) | `ruled` · `conquered` · **`controls`** · **`claims`** · **`core`** | 주체→객체. controls=실효 지배, claims=명목·법적 권리, core=본토 (EU4 패턴) |
| 계승·혈통 (계보선) | `succeeded` · `child_of` · `married` | 후임→전임 / 자→부모 / 대칭 |
| 소속 (점선) | `member_of` · `held_office` · **`aligned_with`** | 인물·집단→집단·제도 / 인물→office / faction→faction·group |
| 위치 (옅은 선) | `located_in` · `occurred_at` | 주어→place. occurred_at의 주어는 항상 event |
| 참여·결정 | `participated_in` · `decided` · **`triggers`** | 인물·집단→사건 / 인물·제도→사건 / faction·event→event |
| 생성·적용 | `created` · `applied_to` · **`grants`** | 주체→저작 / 제도·정책→장소·집단 / institution→faction·office |

`held_office`는 `office.history`에서 **빌드가 파생**한다. 손으로 쓰지 않는다 — 두 곳에 쓰면 어긋난다.

## 산출물 — 빌드가 만든다

```
datasets/rome/
  manifest.json          # 시간범위 · 레이어 목록 · 스킨 · 데이터셋 표시명 · 자료실 base URL
  graph.json             # 노드·엣지 전체 + 인접 인덱스 + 연도 인덱스 (Sigma/Graphology 로드)
  layers/
    territory.geojson    # group별 스냅샷 폴리곤. Cliopatria 구간 + 자체 트레이싱(confidence로 구분)
    admin_regions.geojson
    settlements.geojson  # place Point, rank로 LOD
    roads.geojson · aqueducts.geojson · trade_routes.geojson · resources.geojson · landmarks.geojson
    movements.geojson    # 단계별 좌표+연도
    battles.geojson
    landmarks.geojson    # 지형지물 객체: 강·산·곶·고개·호수·화산·숲 (Pleiades 물리 유형 + AWMC)
  rasters/               # 빌드타임에 구운 래스터 (또는 PMTiles 참조)
    terrain.pmtiles      # Mapterhorn 지중해 extract, terrarium (hillshade·color-relief)
    bathy.pmtiles        # GEBCO_2026 지중해 클립, terrarium 음수
    climate/anom_-500.png … # CHELSA-TraCE21k 100년 슬라이스 anomaly (P1)
    wind/{01..12}.geojson · currents/{01..12}.geojson  # 월별 화살표 포인트 (P1)
  entities/
    people.json · actors.json · events.json · offices.json · factions.json
  timeline.json          # 사건 틱 + period 띠
  registry.json          # 엔티티 id → 에셋(초상·문장·GLB) 경로, 티어 (관계분석 `_registry.csv` 변환)
  export/
    places.lpf.json      # Linked Places Format
    graph.jsonld         # @context(CIDOC 힌트 5~6개)
  qc.json                # 고아 · 연도 미상 · 좌표 없음 · 동명이인 후보 · 외부ID 불일치
```

래스터 레이어도 manifest에 `{key, type:'raster-dem'|'raster'|'geojson', url, attribution, ramp}`로 등록한다. 새 레이어 = manifest 한 줄 + 파일 하나, 코드 수정 없음.

### 공통 피처 `properties` (v1 유지)

`id` · `layer` · `name_ko` · `name_ancient` · `name_modern` · `name_history[]` · `source` · `confidence` · `src` · `valid_from` · `valid_to` · `minzoom` · `rank` · `actor`

## 말판 — `data/boards/*.json` (정본 아님)

교보재 배치다. **정본 온톨로지와 분리된 별개 스키마**이고 어댑터를 타지 않는다. 정의는 레포 `schema/board.ts`(zod).

```
{ id, at, actor, arm, label, strength?, facing?, entity? }   ← 유닛
{ teaching: true, source: "...", event?, phases: [ [유닛…], [유닛…] ] }   ← 판
```

정한 것 셋(2026-09-11):

- **`teaching: true` 강제.** 빼거나 false면 파싱이 실패한다. `source`도 빈 문자열이면 실패한다. **`src`·`confidence`는 안 쓴다** — [CONSTITUTION](CONSTITUTION.md) 2-4.
- **페이즈마다 델타가 아니라 전체 배치.** 손으로 찍는 파일이라 델타는 사람이 못 읽고 렌더도 누적 상태를 들어야 한다. 유닛이 페이즈 사이에 사라지면 `note` 없이는 린트가 막는다.
- **zod는 `schema/`에 두고 `src/`에 안 넣는다.** 예전에 `graph/data.ts`가 상수 하나 때문에 zod를 초기 번들에 통째로 끌고 온 적이 있다.

정본과 잇는 끈은 `event`·`entity` 둘뿐이고 **둘 다 선택**이다. 말판은 혼자 선다. 첫 예시는 `data/boards/cannae-216.json`(3 페이즈, 유닛 14·13·12).

## 시간 모델 (v1 유지 + history)

| 방식 | 어디 | 규칙 |
|---|---|---|
| 스냅샷 | territory / admin_regions | `year <= 현재`인 최근 스냅샷 |
| 구간 | settlements / roads / battles / links | `valid_from <= 현재 <= valid_to` |
| 단계 보간 | movements | step의 연도까지만, 없는 단계는 앞뒤 보간 |
| **history fold** | entity 상태 | `history`를 현재 해까지 접어 `state(year)` 산출. 패널·그래프 색이 이걸 본다 |

연도는 정수, 기원전 음수. 재생 해상도는 1년.

## 외부 ID 조인 (빌드타임)

| 키 | 소스 | 빌드에서 하는 일 |
|---|---|---|
| `ext.wikidata` | Wikidata SPARQL | 생몰·좌표·초상 URL 대조 → `qc.json`에 불일치 기록. 자동 덮어쓰기 없음 |
| `ext.pleiades` | Pleiades JSON | 좌표 대조, 이명 `name_history` 보강 |
| `ext.dprr` | DPRR SPARQL | 공화정 관직 이력 → `office.history` 제안 파일(사람이 병합) |
| `ext.periodo` | PeriodO `p0d.json` | period 구간 라벨 표준화 |

## 검증 (린트, CI 게이트)

불변식 6(객체=노트 1:1 · rel 정의 종류만 · 기원전 음수 · occurred_at 주어=event · participated_in 방향 · 끊어진 링크 0) + 그래프 검사 5(양끝 id 존재 · 고아 · 연도 순서 생<몰, 링크⊂생존 · 좌표 없는 place · 이름 유사 중복) + `source/confidence/src` 완결 + GeoJSON 좌표 범위·flip 탐지 + `history` 연도 오름차순 + 에셋 경로 존재 + 라이선스 대장 누락.

`held_office`가 links에 손으로 있으면 실패. `office.history`만 정본이다.

## 마이그레이션 (한 번)

1. 전 레코드에 `src: "point"` 상수 주입 (`descs[]`·`links[]` 포함).
2. `ext: {}` 빈 객체 주입.
3. 관직 7종(집정관·독재관·감찰관·호민관·법무관·조영관·재무관)을 `office` 객체로 신설. 기존 `ruled`(레굴루스 등 오용)을 `office.history`로 옮기고 제안 파일로 검토.
4. 관계분석 `_registry.csv` → `registry.json` 변환. `faction` 열은 유지(정체성), 정치 세력은 새 `faction` 타입으로 P1에서.

## 관련

[BLUEPRINT](BLUEPRINT.md) · [SPEC](SPEC.md) · [PLAN](PLAN.md) · `research/20260907_리서치_게임데이터모델.md`(history·office·controls 패턴 근거) · `research/20260907_리서치_저장질의MCP.md`(LPF·JSON-LD·외부 ID)
