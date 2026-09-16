# SPEC — 무엇을 만드나

> 볼트 `Works/비주얼파이프라인/`에서 이관 (2026-09-16). 원본 작성 2026-08-14 · 최종 2026-09-12

"됐나?"를 여기에 대고 판정한다. 왜는 [BLUEPRINT](BLUEPRINT.md), 어떻게는 [PLAN](PLAN.md), 못 정한 건 [CLARIFY](CLARIFY.md), 데이터는 [SCHEMA](SCHEMA.md), 화면은 [DESIGN](DESIGN.md). 2026-09-07 전면 개정 — 8월판(PNG 캔버스)은 폐기.

## 한 줄

온톨로지(인물·장소·사건·세력·제도)를 **연도 하나를 기준으로 지도·관계 그래프·타임라인이 동시에 보여주고**, 사람은 브라우저에서 탐색·내보내기하며 AI는 MCP로 같은 데이터를 읽는 시스템.

## 독자

| 누구 | 하는 일 | 성공 신호 |
|---|---|---|
| 발표 준비 팀원 | 자기 포인트의 연도로 이동해 "누가 어디서 누구와" 보고, 화면·카드를 내려받아 슬라이드에 넣는다 | 발표 준비 때 자료실과 함께 켜둔다 |
| River (온톨로지 관리자) | 데이터 결함(고아·연도 미상·좌표 없음)을 화면에서 발견해 정본을 고친다 | QC 페이지에서 결함 수가 줄어든다 |
| AI 에이전트 | MCP로 스키마·객체·이웃·경로를 읽어 발표 초안·검증을 만든다 | 텔레그램 봇·Claude가 지도와 같은 답을 한다 |
| 외부 방문자 | 링크 하나로 열어 시대를 밀어보며 논다 | 첫 방문에 30초 이상 머문다 |

## 첫 장면 (MVP의 "끝")

**포인트 06~08, 기원전 60~44년.** 카이사르를 선택하면 관계 그래프에 적대 비율이 10→30→44%로 붉어지는 것이 보이고, 지도에서 갈리아 원정로가 연도를 따라 그려지며, 타임라인에서 삼두→내전→암살이 찍힌다. 9/3 발표에서 HTML 8탭으로 이미 보여준 것을 **한 화면·한 슬라이더**로 재생한다. 이 장면이 발표 한 회차에 실제로 쓰이면 MVP 완료다.

## 완료 판정 (MVP)

1. 브라우저에서 URL 하나로 열린다. 설치·로그인 없음. — **● https://snas-lifebook.github.io/chronoatlas/ (2026-09-10 배포). Actions 초록, JS·CSS·데이터·워커·글리프·초상 전부 200. 지도 렌더도 에이전트가 검증한다(HANDOFF §5 디버깅 창, 9/10). 남는 것은 미감 판정**
2. 연도 슬라이더를 밀면 지도(영토·도시·경로·전투)·관계 그래프·타임라인 커서·객체 패널이 **같은 해**로 바뀐다.
3. 정본 온톨로지 650 객체·698 관계가 **전부** 산출물에 들어 있다(손타이핑 데이터 0).
4. 객체 하나를 클릭하면 패널에 설명·연도·관계·등장 포인트·출처 배지·초상이 뜨고, "자료실에서 읽기"가 해당 포인트 본문으로 간다. 자료실 객체 페이지의 "지도에서 보기"가 여기로 돌아온다. — **◐ 패널·자료실 링크 ●. 자료실 쪽 "지도에서 보기"(`atlasUrl`)는 River**
5. 현재 화면을 PNG로, 슬라이더 구간을 MP4로, 선택 객체를 카드 PNG로 내려받는다. — **●**
6. `npx`로 MCP 서버를 띄우면 Claude가 `find_entity("카이사르")`·`neighbors(id, -60, -44)`로 화면과 같은 답을 받는다. — **◐ `npm run mcp`로 확인(neighbors 48). `npx`는 공개 후**
7. `?dataset=chuhan-206`으로 바꾸면 같은 화면이 초한지가 된다. — **●**
8. 카이사르·폼페이우스·클레오파트라 흉상 GLB가 지도 위에 서고, 패널에서 돌아간다. — **○ 흉상 GLB 미생성**
9. [DESIGN](DESIGN.md)의 반려 조건 0건. — **◐ P13 z3~6 통과. z7~9는 DEM이 붙어 재캡처 가능해졌고 에이전트가 찍을 수 있다(9/10). 남은 건 「완성된 지도로 보이는가」 판정. P14 클릭→패널 20ms, 60fps는 GPU**

## 기능 요구

### P0 — 없으면 시스템이 아니다

| | 무엇 | 판정 | 상태 (2026-09-10) |
|---|---|---|---|
| F1 | **어댑터** — 정본 JSONL → `graph.json` + `layers/*.geojson` + `entities/*.json`. 빌드 한 명령 | 산출물 객체 수 = 정본 객체 수 | ● 650/698, `npm run adapt` |
| F2 | **단일 연도 상태** — URL `?y=-52`가 지도·그래프·타임라인·패널을 한 번에 정한다 | 슬라이더 이동 시 네 뷰가 같은 해 | ● `?y` `sel` `layers` `view` `ds` `scene` |
| F3 | **지도** — 영토(스냅샷, 지리에 맞는 폴리곤)·속주·도시(LOD)·이동경로·전투 + **지형 음영·고도(DEM)·수심(GEBCO)·지형지물(Pleiades 물리 유형)** 레이어 토글, 해안·강·라벨. 레이어는 manifest 카탈로그 | 단색 배경만 보이는 줌 레벨 없음. 산맥·강·수심이 읽힌다 | ● 영토(Cliopatria 3,276, 한글 이름표·세력색)·속주·도시(rank LOD)·이동경로(정본 `_routes/`)·전투·해안·강·라벨·수심 7단(NE)·음영(NE 10m Gray Earth)·지형지물(Pleiades 3,552 + NE 고도점 132)·**기하 3D**(terrarium DEM z0~7 + hillshade + setTerrain, 과장 줌 연동) + **원정로 고도 단면**(`map/elevation.ts`). GEBCO는 안 쓴다(NE 수심으로 갈음). DEM 타일은 재배포 안 함 |
| F4 | **관계 그래프** — 선택 객체의 1·2홉 이웃, rel 의미군 7색, 연도 필터 | 노드 200개에서 라벨이 겹쳐 안 읽히면 반려 | ● 인스펙터 아래 패널(force, 1·2홉, 의미군 색, 연도 필터). 지도엔 좌표 이웃 ≤12일 때만 선(D4 하이브리드). 200노드 판정은 2홉 상한 48로 회피 |
| F5 | **타임라인** — 사건 틱 + 시대 띠(PeriodO) + 재생/일시정지 + **그 해의 인물·국가·일** | 재생 중 프레임 드롭 없이 5년/프레임 | ◐ 사건 틱·시대 띠(`data/eras` + period 엔티티, PeriodO 아님)·재생 5년/350ms ●. **연도별 요약(R36, 9/11 라운드 F)** ● — 판정 규칙을 문서에 먼저 적고 그대로 계산한다. 프레임 드롭 측정은 GPU(River) |
| F6 | **객체 패널** — 설명·연도·관계 목록·등장 포인트·출처·신뢰도·초상/문장·자료실 링크 | 원시 rel 키 노출 0 | ● 초상·세력 링·그 해의 상태·의미군 관계·등장 포인트·출처/신뢰도 배지·자료실 링크 |
| F7 | **검색** — 이름·이명·초성 | 3글자 입력 후 100ms 내 결과 | ● 이름·이명·초성(es-hangul), 인메모리 즉시 |
| F8 | **permalink** — 연도·중심·줌·레이어·선택·데이터셋이 URL에 | 링크를 새 창에 붙이면 같은 화면 | ● 2026-09-11 닫힘(R35 북마크와 함께). `?y&sel&layers&view&ds&scene` + **`c`(중심)·`z`(줌)·`p`(pitch)·`b`(bearing)·`skin`**. 지도가 `moveend`에서 상태로 쓰고 URL로 나간다(반올림: 경위도 4자리·줌 1자리·각도 정수). 실측: `?y=117&sel=place:로마&c=25.1,39.2&z=6.4&p=42&b=15&skin=oldmap&layers=…`을 새 탭에 붙여 상태·실제 지도 카메라가 모두 일치. `test/state.test.ts` 19건 |
| F9 | **내보내기** — PNG(현재 화면, 2x) · MP4(구간) · 카드 PNG(선택 객체) · GeoJSON/CSV(현재 연도) | 파일이 슬라이드에 그대로 들어간다 | ● PNG 2×·MP4(mediabunny)·카드 1080×1350·연도 단면 GeoJSON + 점 CSV(툴바 '데이터') |
| F10 | **MCP 서버** — `get_schema` `find_entity` `neighbors` `path` 읽기 전용, stdio | Claude Desktop 설정 5줄로 붙는다 | ● `npm run mcp` stdio 4툴. `npx`는 GitHub 공개 후 |
| F11 | **린트 CI** — 불변식 6 + 그래프 검사 5 + `source/confidence/src` 완결 + 라이선스 대장 | 위반 시 배포 중단 | ● Actions 배선 완료(gen → lint → typecheck → vitest → build → Pages). **실제로 막는 것이 증명됨**: 첫 배포가 node 20에서 lint 단계에 걸려 실패했고 배포까지 안 갔다. 대장 둘: `data/external/LICENSES.md`(외부) + `public/assets/CREDITS.md`(초상·문장) |
| F12 | **데이터셋 스위처** — manifest로 도메인 교체 | 초한지 데이터셋이 같은 코드로 뜬다 | ● `?ds=chuhan-206` |
| F12b | **3D 토큰** — 선택 인물의 흉상 GLB가 지도 위 위치에 서고(GLTFLoader), 패널에서 `<model-viewer>`로 회전. 흉상은 TRELLIS.2로 초상에서 생성 | 카이사르·폼페이우스·클레오파트라 3인이 BC 48 지도 위에 선다. GLB 1개 ≤ 2MB | ○ Three.js 토큰 뼈대(동적 import)만. 흉상 GLB(TRELLIS.2)는 River |

### P1 — 여기서 쓸모가 갈린다

**우선순위는 이제 [BACKLOG](../../../../../Projects/chronoatlas/docs/BACKLOG.md)의 「지금 순서」가 정한다**(레포 `docs/BACKLOG.md`). 아래 표는 기능 상태지 작업 순서가 아니다.

| | 무엇 | 상태 (2026-09-11) |
|---|---|---|
| F13 | `office`·`faction` 타입과 `history[]` — "이 해에 누가 무엇을 쥐었나" 패널 | ○ DPRR 차단 — River |
| F14 | 두 객체 최단 관계 경로 강조(graphology) | ● 인스펙터 '경로' → 검색 → 단계 목록(의미군 색·hover·클릭). BFS는 `graph/data.shortestPath`, MCP와 공유 |
| F15 | 외부 ID 조인 — Wikidata·Pleiades·DPRR·PeriodO 컬럼, 빌드타임 대조 리포트 | ◐ Pleiades 연결 제안 8건(`proposals/`). Wikidata·DPRR ○ |
| F16 | Cliopatria 영토 레이어(CC BY) + 자체 트레이싱 폴리곤 병행(신뢰도로 구분) | ◐ Cliopatria ● (전 구간·이름표·클릭). 자체 트레이싱 병행은 ○ — 지금은 전부 Cliopatria(confidence medium) |
| F17 | 스킨 — 고지도(기본)·지형(hillshade·color-relief)·위성 | ◐ 스킨 5종(중립·야간·고지도·신문톤·작전) ● · hillshade 실계산 ●(terrarium DEM, 타일 있을 때). 위성 ○ |
| F18 | QC 페이지 — 고아·연도 미상·좌표 없음·동명이인 후보 목록 | ● 탐색 카드 QC 탭 — adapt → `qc.json`(고아 216·연도 미상 283·좌표 없음 5·동명이인 11·low 19), 클릭→이동. 고치는 건 proposals/ |
| F19 | 파벌 표현 — `fill-pattern` 해칭, 영향권 `heatmap` | ○ |
| F20 | 크레딧 페이지 자동 생성 | ◐ `LICENSES.md`·각주·PNG/MP4 크레딧 줄. 페이지 ○ |
| F20b | **바람·해류 레이어** — ERA5 월별 평년 풍향·풍속, CMEMS 지중해 표층 해류를 화살표 심볼로. 월 선택 | ○ ERA5·CMEMS 차단 — River |
| F20c | **기후 레이어** — CHELSA-TraCE21k 100년 슬라이스 온도 anomaly 오버레이 + Euro-Med2k(138 BC~) 곡선을 타임라인 위에 | ○ 차단 — River |
| F20d | **전장 국지 지형** — 전투 클릭 시 COP30 클립 hillshade 확대 뷰 | ○ **DEM 대기 해제**(9/9 terrarium 붙음). BACKLOG R40·F28과 묶인다 |
| F20e | **도로망** — Itiner-e / AWMC 로마 가도 | ○ |
| F27 | **이동 시뮬레이터** — "걸어서 며칠, 말로 몇 km". ORBIS v2 노드/엣지(CC BY 3.0)에 `days`·`km`·비용·경로타입이 이미 구워져 있다 → 빌드타임에 인접리스트로 굽고 런타임은 순수 JS Dijkstra | ○ BACKLOG R04·R05. 테이블 내려받기는 River 터미널(Stanford 차단) |
| F28 | **국지 뷰(도시·전장)** — 줌 임계를 넘으면 별도 데이터셋으로 갈아탄다(`?ds=city-roma`). 도시는 OpenHistoricalMap(CC0) bbox 추출, 전장은 F20d | ○ BACKLOG R29·R40. 먼저 할 일은 OHM 커버리지 확인 쿼리 한 방 |
| F29 | **말판(교보재)** — 사람이 놓고 옮기는 유닛 층. 페이즈 배열을 넣으면 그대로 전투 재현이 된다 | ◐ 2026-09-12 — 스키마 `schema/board.ts`(zod, `teaching: true` 강제·`src`/`confidence` 금지, [CONSTITUTION](CONSTITUTION.md) 2-4)·자석 2단계(territory → settlement)·**2D 렌더**(`board-unit`·`board-label`, 병종별 아이콘, 페이즈 슬라이더)·**그 해의 인물 위치**(`src/people.ts`, R38) ●. 판 둘: 칸나이 BC216(폴리비오스 3.113~117) · **파르살루스 BC48**(카이사르 『내전기』 3.88~99). **R39 목각 GLB 남음**(볼트 3.7과 조율). 내전 판은 양쪽 다 로마라 색이 없다 — 팔레트 제안 `proposals/20260912_palette_civilwar_2.jsonl` |
### P2 — LVP

| | 무엇 | 상태 (2026-09-11) |
|---|---|---|
| F21 | 3D 확장 — 초상 50장 전원 흉상, 0 A.D. 건물 GLB가 도시 위에 | ○ |
| F22 | deck.gl TripsLayer 행군 · flubber 영토 morph | ○ |
| F23 | Remotion 오프라인 발표 영상 | ○ |
| F24 | 기번 원전 축 `src=gibbon` 토글 | ○ |
| F25 | 원격 MCP(Cloudflare Workers) · GitHub PR 제안 툴 | ○ |
| F26 | 삼국지 데이터셋 | ○ |

## 비기능

- **첫 화면 3초** — 정적 번들 + 데이터 ≤ 3MB gzip. GLB·영상 모듈은 지연 로드(선택 시에만 fetch). 실측 2026-09-10: 초기 JS 382.8 kB gz(예산 400) + CSS 37.5 + 글꼴 267.1 + 차단 데이터 15.4, 지도 뜰 때 maplibre worker·shared 약 140. **라이브 LCP 278ms · CLS 0.01**(목표 1.5s 통과).
- **정확성 표시** — 신뢰도 low는 화면에서 점선·옅은 색으로 보인다. 숨기지 않는다.
- **접근성** — 색만으로 뜻을 나르지 않는다(선 종류·라벨 병행). 키보드로 연도 이동(←→). Lighthouse 접근성 **100**(2026-09-10 라이브 실측).
- **한국어 우선** — 라벨·패널·범례는 한국어, 고대명·현대명 병기.
- **자료실과 한 시스템** — astryx 컴포넌트·토큰 공유. 두 사이트를 나란히 띄웠을 때 같은 제품으로 읽혀야 한다.
- **오프라인** — 한 번 열면 타일 외엔 네트워크 없이 동작.

## 범위 밖

실시간 전투·경제 연산 · 계정·서버 저장 · 데이터 편집 UI(편집은 PR) · 게임 재현 · Cesium 전면 채택 · CIDOC-CRM 전면 매핑.

## 관련

[BLUEPRINT](BLUEPRINT.md) · [SCHEMA](SCHEMA.md) · [PLAN](PLAN.md) · [DESIGN](DESIGN.md) · [CLARIFY](CLARIFY.md) · [TASKS](TASKS.md) · [CONSTITUTION](CONSTITUTION.md)
