# TASKS — 무엇을 어떤 순서로

> 볼트 `Works/비주얼파이프라인/`에서 이관 (2026-09-16). 원본 작성 2026-08-14 · 최종 2026-09-12

[PLAN](PLAN.md)을 잘라 놓은 것. 각 작업은 **RED 테스트 → GREEN → 반려 조건 확인**으로 닫는다. 병렬 가능한 것은 같은 라운드에 묶었다(파일 소유 분리로 충돌 0 — 8/18 방식). 상태: ○ 대기 · ◐ 진행 · ● 완료.

## Phase 0 — 다리 (착수 즉시, 2주)

| # | 작업 | 산출물 | 완료 조건 | 상태 |
|---|---|---|---|---|
| 0.0 | **레포 신설 `chronoatlas`** — visual-pipeline 코드 이식, Actions·Pages, 옛 레포 아카이브+리다이렉트, 볼트 링크 갱신 | `snas-lifebook/chronoatlas` | 새 주소에서 기존 초한지 데모가 뜬다 | ● 2026-09-10 완료. `snas-lifebook/chronoatlas`(public) 생성·push, Actions → Pages 초록, **https://snas-lifebook.github.io/chronoatlas/** 라이브. 옛 레포 `visual-pipeline`은 archived + 옛 Pages가 새 주소로 리다이렉트(공유된 링크가 안 죽게). 공개 전 프리플라이트: 비밀 0, AGENTS.md의 개인 절대경로 제거, 초상·문장 71점 출처 대장 신설 |
| 0.1 | **마이그레이션 스크립트** — 정본에 `src:"point"`·`ext:{}` 주입, 백업 `bak_20260907` | `ontology/_scripts/migrate_v2.py` | 전 레코드에 필드 존재, 기존 린트 통과 | ◐ 스크립트 `ontology/_scripts/migrate_v2.py` 배치. 정본 반영은 River 실행(`--write`) |
| 0.2 | **Zod 스키마** — entity·link·feature·manifest | `schema/*.ts` + `json-schema/` 생성 | 정본 전체가 파싱 통과 | ● `schema/ontology.ts` — 650/698 파싱 통과. json-schema 생성은 미룸 |
| 0.3 | **어댑터 v1** — JSONL → `graph.json`·`entities/*.json`·`settlements/battles/movements.geojson` | `scripts/adapt.ts` | RED: 노드 수 == 정본 수, 좌표 `[lon,lat]` 범위 | ● `scripts/adapt.ts` — 220 정착지·23 전투·land. territory/movements는 빈 컬렉션(0.5·1.3) |
| 0.4 | **린트 v1** — 불변식 6 + 그래프 5 + 완결 | `scripts/lint.ts`, CI 단계 | RED: 기원전 양수·`held_office` 수기 → 실패 | ● `scripts/lint.ts` + baseline 래칫. 정본 결함 11건 → `ontology/_proposals/20260908_rel_misuse_11.jsonl` |
| 0.5 | **외부 캐시** — Cliopatria 로마 구간 잘라 `territory.geojson` 교체, NE 해안·강, PeriodO | `scripts/fetch-external.ts`, `data/external/` + `LICENSES.md` | BC218·BC44·AD117 세 시점 육안 통과(CLARIFY Q2) | ● Cliopatria(CC BY 4.0) 정치체 3,276 → 100년 버킷 `layers/territory/<from>.geojson` 지연 로드 + 한글 이름표 147종. BC49·AD117·AD476 육안 확인. NE·글리프 ●. PeriodO 대신 `data/eras` |
| 0.6 | **레지스트리 변환** — `_registry.csv` + 초상·문장 → `registry.json`, 에셋 복사 + 출처 대장 | `scripts/registry.ts` | 50 초상·9 문장 경로 전부 존재 | ● `public/assets/{portraits 50,icons 21}` webp + adapt asset 매핑 → 인스펙터 초상(세력 링)·카드 |
| 0.7 | **MCP PoC** — `server-memory` 변환본으로 Claude Desktop에서 `search_nodes("카이사르")` | `mcp/poc-memory.jsonl` | 30분 안에 답이 온다 | ○ |
| 0.8 | **AGENTS.md** — 빌드·린트·MCP·하지 말 것 | 레포 루트 | 새 세션이 이 파일만 읽고 빌드 성공 | ● `AGENTS.md` |

0.0 → 0.1~0.2 → 0.3·0.4 병렬 → 0.5·0.6·0.7 병렬 → 0.8. Phase 0 끝 = **650개 엔티티가 지도에 점으로 찍히고 CI가 초록**.

## MVP — 첫 장면 (4~6주)

### 라운드 1 — 베이스맵·셸 먼저 (v3: "보이는 것"부터 제품 등급으로)

DESIGN v3 순서. 상태(1.1)는 셸의 전제라 그대로 첫째, 그다음 **베이스맵(1.6→1.4→1.3)**과 **셸(1.8)**을 세우고, 타임라인·지형지물은 그 위에 얹는다. 라운드 1이 끝나면 데이터가 하나도 안 켜져 있어도 P13을 통과하는 지도가 있어야 한다.

| # | 작업 | 산출물 | 완료 조건 | 상태 |
|---|---|---|---|---|
| 1.1 | **단일 연도 상태 + URL** — `?y&sel&layers&view&ds` + 장면 프리셋(첫 진입 BC60 카이사르) | `src/state.ts` | RED: URL→state→URL 왕복 동일. 프리셋 로드 시 카메라·연도·선택 세팅 | ● `src/state.ts` + `data/scenes/rome.json`(caesar/rubicon/ides). 테스트 5 |
| 1.6 | **베이스맵 데이터·지형** — NE 10m 전체(bbox W15–E65, N20–60: 육지·해안·강·호수·빙하) + Mapterhorn `pmtiles extract` + GEBCO 클립 → terrarium. `fetch-external.ts`로 캐시·커밋, `LICENSES.md` | `scripts/fetch-external.ts`, `data/external/`, `datasets/rome/rasters/` | 서지중해 클립 삭제. 동방(콘스탄티노플·안티오키아)까지 육지 | ● NE 10m 전체(bbox W15–E65/N20–60) + **NE 10m Gray Earth 음영**(4800×2400, SR_50M 교체) + 수심 7단 + 고도점 132 + 글리프. DEM은 Mapterhorn·GEBCO 대신 **AWS terrarium 타일**(z0~7 840장 53MB, River 맥에 있음·gitignore): 런타임 `terrain/meta.json` 감지 → hillshade + setTerrain, 과장은 줌 연동(z3 12배 → z9 1.4배). DEM 있으면 relief.jpg는 걷힌다(음영 두 벌 겹침). 파생으로 원정로 **고도 단면**(`map/elevation.ts`, terrarium 직접 디코딩) |
| 1.4 | **베이스맵 스타일** — DESIGN v3 §1: multidirectional hillshade 기본 ON, hypsometric 15%, 수심 램프, 해안 1px, 강 interpolate, Pretendard 글리프 PBF 빌드, 라벨 LOD z3/5/7, 바다·지역명 대문자 자간, 다크 스왑, **기본 뷰 pitch 50 · terrain exaggeration 2.5**(미니어처 뷰), 2D/3D 토글 | `src/map/style.ts`, `scripts/glyphs.ts` | **P13**: 줌 3~9 임의 캡처 10장 전부 "완성된 지도". P4·P9 반려 0 | ◐ `src/map/style.ts` 순서·램프·라벨 LOD·다크·pitch 50. 글리프는 Noto Sans CJK(Pretendard 교체 대기). P13 캡처 10장 검수는 4.1에서 |
| 1.8 | **앱 셸(React 19 + astryx, 풀블리드 + 떠 있는 카드)** — 타이틀 블록·탐색 카드 300(객체/레이어/장면 탭)·인스펙터 360·알약 툴바·환경 세그먼트·타임라인 띠 88·각주 줄. vanilla DOM 폐기. <1024 하단 시트 | `src/app/`, `src/shell/` | 자료실 옆에 띄워 같은 시스템(P1). **P14b** 카드 면적 ≤40%. 반응형 3단 스크린샷 | ● `src/app/App.tsx`+`shell.css`, astryx 0.4.0(자료실과 동일). 카드 5·툴바·타임라인 띠·각주·키보드. JS는 494 → **382.8 kB gz**로 예산 안(4.5에서 정리) |
| 1.3 | **지도 레이어 재배선 + 인터랙션** — adapt 산출물 + `setFilter` 시간 필터, `feature-state` hover/selected(+10% 밝기·1.5px / 2px 세력색·40% 디밍), 툴팁 120ms, `easeTo` 600ms padding 오프셋 | `src/map/layers.ts`, `src/map/interact.ts` | **P14**: hover→클릭→패널→카메라 300ms·60fps(Playwright trace). P5 반려 0 | ● `src/map/engine.ts` hover/selected feature-state·툴팁 120ms·디밍. 클릭→패널 20ms 측정. 60fps는 River 맥에서 |
| 1.2 | **history fold** — `state(id, year)` | `src/time.ts` | RED: 3 patch에서 -50 → -59만 반영 | ● `src/time.ts` stateAt(). 테스트 5 |
| 1.5 | **타임라인** — 틱·시대 띠·재생·키보드(`←→`·`Shift`·`Space`·`/`·`Esc`·`1~9`) | `src/timeline/` | 5년/프레임 드롭 없음, 키 전부 동작 | ● 시대 띠(`data/eras/rome.json` + period 엔티티)·틱·슬라이더·재생·키보드 전부 — 셸 안 |
| 1.7 | **지형지물 객체** — Pleiades 4.1 물리 유형 필터 + AWMC 강 → `landmarks.geojson` + 온톨로지 place 엔티티 제안 파일 | `scripts/fetch-external.ts`, `layers/landmarks.geojson` | 강·산맥·곶·고개 클릭 시 패널 | ● Pleiades GIS(GitHub 미러, CC BY 3.0) 30유형 3,552점 → `landmarks.geojson`(lod z5/6/8, 클릭→인스펙터·딥링크 `landmark:<pid>`) + NE 폴리곤. 정본 place↔Pleiades 연결 제안 8건(`proposals/20260908_place_pleiades_link.jsonl`). AWMC 강은 P1 |

### 라운드 2 — 그래프·패널·검색 (병렬 3 스트림)

| # | 작업 | 산출물 | 완료 조건 | 상태 |
|---|---|---|---|---|
| 2.1 | **Sigma 오버레이** — 선택 1·2홉, 룬델 노드, 의미군 선, 고정 시드 배치 | `src/graph/` | 카이사르 선택 시 41관계가 겹침 없이, 200 노드에서 2홉 자동 접힘 | ● MapLibre 네이티브 1홉 오버레이(`engine.setEgo`, 의미군 선색, 링 배치). Sigma(D4)는 2홉·전역 뷰 때 P1 |
| 2.2 | **객체 패널** — DESIGN v3 §3: compact 스케일, 의미군별 접이식 관계 그룹 + 숫자 배지, 행 hover→지도 펄스, tabular-nums, 빈 값은 행 삭제, 출처 배지 자료실 import | `src/panel/` | **P15**: 자료실·Linear 옆 비교 통과. 원시 키·"—"·빈 헤더 0 | ● `src/app/Inspector.tsx` + `src/graph/data.ts`(graph.json 지연 로드). P15 원시 키 0. 초상은 0.6 레지스트리 후 |
| 2.3 | **검색** — es-hangul, 이름·이명·초성 | `src/search/` | 3글자 100ms | ● `src/search.ts`(es-hangul) + `Search.tsx` ⌘K·/ 팔레트. 테스트 5 |
| 2.4 | **범례** — 켜진 레이어·연도 따라 자동 생성, 접힘/펼침 | `src/legend.ts` | 꺼진 레이어 항목 0, 제목 줄 상시 | ● 연도·레이어·선택 관계에 따라 자동(App legend) |
| 2.5 | **UI를 astryx로** — AppShell·Aside·버튼·배지·검색을 자료실과 같은 패키지·테마로 교체, light-dark | `src/ui/` | 자료실과 나란히 띄워 같은 시스템(DESIGN P1) | ◐ `src/links.ts` 레지스트리 + ?sel= 첫 진입 카메라. **자료실 `site/lib/links.ts`에 atlasUrl 추가는 River** |

### 라운드 3 — 내보내기·MCP·데이터셋

| # | 작업 | 산출물 | 완료 조건 | 상태 |
|---|---|---|---|---|
| 3.1 | **PNG** — 두 캔버스 오프스크린 합성, 연도·범례·출처 줄 포함 | `src/export/png.ts` | RED: 크기 = 2×viewport | ● `src/export/png.ts` 2× 합성(연도·사건·범례·출처 띠). 테스트 2 |
| 3.2 | **MP4** — mediabunny, 구간 스크럽 | `src/export/mp4.ts` | 1080p 10초 파일이 QuickTime·PPT에서 열림 | ● `src/export/mp4.ts` mediabunny 동적 import, 장면 구간 12fps. 헤드리스 VP9 확인 — **QuickTime·PPT 열림은 River 맥에서**(H.264) |
| 3.3 | **카드** — 인물·사건 템플릿, modern-screenshot | `src/export/card.ts` | 1080×1350, 초상 50장 일괄 생성 통과 | ● `src/export/card.ts` 1080×1350 Canvas 2D. 인스펙터 "카드" 버튼. 50장 일괄은 미실행 |
| 3.4 | **MCP 서버** — 4툴, stdio | `mcp/server.ts` | Claude Desktop에서 `neighbors(카이사르,-60,-44)`가 패널과 같은 목록 | ● `mcp/{tools,server}.ts` stdio 4툴, `npm run mcp`. stdio 프로브 통과. **Claude Desktop 연결은 River** |
| 3.5 | **초한지 데이터셋 재검증** — 새 스키마로 `chuhan-206` 통과 | `datasets/chuhan-206/` | 린트 통과, `?ds=` 전환 | ◐ `?ds=chuhan-206` 새 셸에서 뜸. `validateDataset` 통과 확인(`test/chuhan-dataset.test.ts`). **막힌 것 = 베이스맵**: manifest에 `basemap`·`bbox`·`relief`가 없고 `land.geojson`은 경도 −15~65(지중해)만 덮어 중원(100~125)에 쓸 육지·해안·강이 없다 → 전 줌에서 F3 반려("단색 배경"). 중원 bbox로 NE 재굽기는 egress 필요(River). 온톨로지가 없어 `graph.json`도 없다. 검색 팔레트가 '불러오는 중'에 영영 멈추던 것은 빈 상태로 이름 붙여 해결(9/10) |
| 3.6 | **자료실 역링크** — 객체 페이지에 `지도에서 보기` | 자료실 레포 PR 1건 | 왕복 딥링크 동작 | ○ **막힘 풀림**(9/10): 가리킬 주소가 생겼다: `https://snas-lifebook.github.io/chronoatlas/?ds=rome&sel={id}&y={연도}`. 자료실 `site/lib/links.ts`에 `atlasUrl` 추가 |
| 3.7 | **흉상 GLB 3인** — TRELLIS.2로 카이사르·폼페이우스·클레오파트라 초상→GLB, 감량 ≤2MB, 출처 대장 | `tools/bust/`, `assets/bust/*.glb` | 3개 GLB, "AI 같다" 반응 없음(팀 1명 확인) | ○ |
| 3.8 | **3D 토큰 + 패널 뷰어** — GLTFLoader로 지도 위 위치에, 패널 `<model-viewer>` 회전, 선택 시 지연 로드 | `src/token3d.ts` 확장, `src/panel/` | BC 48에 3인이 서고 첫 화면 번들에 GLB 미포함 | ○ |

### 라운드 4 — 닫기

| # | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| 4.1 | Playwright 스크린샷 4장(지도·그래프·패널·카드) vs DESIGN 반려 조건 체크리스트 | 반려 0 | ◐ P13 캡처 10장: z3~6 통과. z7~9를 막던 DEM·Pleiades는 9/9에 둘 다 붙었고 **재캡처만 남았다**. **에이전트도 캡처할 수 있게 됐다**(HANDOFF §5 디버깅 창). 남은 건 "완성된 지도로 보이는가" 판정. `assets/ref/p13_sheet.png` |
| 4.2 | 첫 장면 시연 — P06~08 BC60→44 재생 영상 1개 | 팀 텔레그램에 링크 | ● `assets/demo_BC60-BC44_v2.mp4`(9/9 재촬영 — 영토·한글 이름표·원정로 반영, 9.9초 VP9). 구버전 `demo_BC60-BC44.mp4`는 영토 없던 판. 텔레그램 공유는 River |
| 4.3 | 문서 정합 — MOC·SPEC 상태·README 수치 | 정본 = 실제 | ● 9/8 1차 · **9/10 2차**(지형·고도 단면·번들 반영, SPEC F3·F17·판정 9, TASKS 1.6·4.1·4.5, MOC). 레포 쪽은 `docs/HANDOFF.md` 신설(한 번도 커밋된 적 없던 파일) + `docs/roadmap.md` 재작성(한 세대 낡아 있었다). 다음 정합은 MVP 완료 판정 때 |
| 4.4 | 다음 발표 한 회차에서 실제 사용 | 발표 후 회고 노트 | ○ |
| 4.5 | **첫인상·빈 상태·성능(v3 §4)** — 베이스맵 선 렌더+200ms 페이드, 빈 상태 3종(한 줄+버튼 1), Three.js 동적 import, graph.json 지연 로드, `prefers-reduced-motion`, Lighthouse CI | `src/app/empty.tsx`, `.github/workflows/perf.yml` | **P17**: 첫 페인트 1.5s·JS 400KB gz·초기 1MB·Lighthouse 90+ CI 측정 | ◐ reduced-motion·Three.js/mediabunny 동적 import·베이스맵 선렌더·**빈 상태 3종 ●**(검색/P1 레이어/연도 밖 객체, 한 줄+버튼 1). **번들·페이로드 실측 완료**(9/10 `95aa07b`): 초기 JS 410.8 → **382.8 kB gz**(예산 400 통과. `graph/data.ts`가 상수 하나 때문에 zod를 통째 끌고 있었다 → `schema/vocab.ts`로 분리), 첫 페인트 차단 데이터 228.9 → **15.4 kB gz**(landmarks 1.2MB를 지도와 패널이 두 벌 받고 하나가 첫 화면을 막고 있었다 → 선택 시 지연). `test/payload.test.ts`가 60kB에서 막는다. 바닥은 maplibre 243.3 + react 59.6 + astryx 58.4. **Lighthouse 실측 완료**(9/10 라이브, desktop): 접근성 **100** · Best Practices 96 · SEO **100** · **LCP 278ms**(목표 1.5s) · CLS 0.01. P17 통과. 그 과정에 실제 결함 3건 수정: 툴바 접근명이 보이는 글자를 못 담던 것(WCAG 2.5.3), 보조 라벨 대비 4.32:1, meta description 없음. Best Practices의 -4는 `terrain/meta.json` 404 하나이고 설계대로다(AGENTS.md에 명시) |
| 4.6 | **30초 테스트** — 스터디 멤버 3명, "카이사르 BC 49 루비콘" 찾아 클릭 | 회고 노트 | **P16**: 3/3 성공 | ○ 9/8 River 맥 Chrome(dev 서버)으로 사전 점검 — 숨김 패널이라 fps 미측정. 잡은 것: dev 워커 404·astryx 토큰명 오류(투명 배경)·settlements promoteId(도시 hover/선택 사망)·숨김 리사이즈. 전부 `e0604d7` |

## P1 — 순서는 BACKLOG가 정한다 (2026-09-11 개정)

**우선순위 정본이 바뀌었다.** 예전에는 이 절의 F 나열이 순서였는데, 그 순서를 따라가니
이미 ●가 많은 「지도가 그리는 것」 축에 계속 붓고 있었다(9/10 PM 점검에서 드러남).
**지금은 레포 `docs/BACKLOG.md`의 요구 원장 R01~R40과 「지금 순서」(라운드 A~H)가 정본이다.**
이 절은 기능 지도이지 작업 대기열이 아니다.

| 라운드 | 무엇 | 요구 | 상태 |
|---|---|---|---|
| A | 지도 범위 확대 | R31 | ○ 준비 ● — `docs/RUNBOOK-extent.md`, BBOX는 `scripts/extent.ts` 한 곳. **River 터미널 실행 대기** |
| B | 세력 실명 + 존속연도 | R32 | ○ A 대기. 데이터는 이미 있다(`name`·`name_en`·`wikidata`) — `ACTOR_OF`가 8세력으로 뭉개고 있을 뿐 |
| C | 경계 넉넉하게·부드럽게 | R33 | ○ A 대기. shapely buffer+simplify, NE land 클립 순서를 먼저 의심 |
| D | 도시·산·강·바다 LOD 재설계 | R34 | ○ A 대기. rank 1급 9·2급 24·3급 187로 실질 2단계 |
| E | 북마크·프로젝트 | R35 | **● 2026-09-11** — 카메라·스킨·레이어가 URL에. F8도 함께 닫힘 |
| F | 타임라인의 그 해 | R36 | **● 2026-09-11** |
| G | 말판·인물 위치·자석 | R21·R37·R38·R39 | **◐ 2026-09-12** 스키마·자석·2D 렌더·인물 위치 ●, 판 둘(칸나이·파르살루스). R39 목각 GLB 남음 |
| H | 데이터 결손·회귀 | R25 + 4건 | **◐ 2026-09-11** 코드 ●, 정본은 `proposals/` 3건으로 River 대기 |

**River 한 줄이 셋을 푼다** — `migrate_v2.py --write` → `npm run adapt`이 살아나면
H의 연도 3건·battles id 중복·장면 파일이 한꺼번에 산출물에 반영된다.

기능 상태는 [SPEC](SPEC.md)의 F 목록이 정본이다. 새로 등록된 것: **F27 이동 시뮬레이터**(ORBIS CC BY 3.0) ·
**F28 국지 뷰**(OHM CC0) · **F29 말판**. 관계 그래프 패널 ●(하이브리드 D4, 2홉 포함).
내보내기 스킨 5종 ●. campaign 세리프 글리프는 남음. F14 최단 경로는 ● — 옛 P1 나열에 남아 있던 것을 지운다.

## LVP

F21 3D 확장(50인 흉상·0 A.D. 건물) → F22 deck.gl → F24 기번 원전 축 → F26 삼국지 → F23 Remotion → F25 원격 MCP.

## 안 하는 것 (다시)

서버·DB·로그인·편집 UI·Cesium·Hunyuan3D·미러 서브모듈. 알프스 3D 지형 시뮬은 여전히 동결 — D8로 들어온 것은 흉상 토큰 3인뿐이다.
