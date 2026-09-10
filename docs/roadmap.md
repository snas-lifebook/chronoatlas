# 로드맵: 무엇을 만들고 있나

크로노아틀라스는 정적 지도가 아니다. **연도를 옮기면 지배·도시·전투·이동·관계가 한꺼번에 그 시점으로 다시 그려지고,
그 시점의 데이터를 그대로 받아 쓰는** 인터랙티브 역사 지도다.

새 아키텍처를 짓는 프로젝트가 아니다. 엔진은 이미 있다. `state.ts`의 단일 연도 상태, `schema.ts`의 `dateWindow(year)`,
`map/engine.ts`의 `setFilter`(연도 변경 = 필터, `setData` 재계산 아님). 새 레이어는 `valid_from`/`valid_to`만 달면 붙는다.

| 이 문서 | 다른 곳 |
|---|---|
| 축별 진행·소스 정책 | 상태·다음 할 일 → [HANDOFF.md](HANDOFF.md) · 빌드·구조·하지 말 것·DEM → [AGENTS.md](../AGENTS.md) |
| | 기능 정의 F1~F26·완료 판정 → 볼트 `Works/비주얼파이프라인/SPEC.md` · 순서 → 같은 폴더 `TASKS.md` |

## 축별 진행 (2026-09-10)

| 축 | 무엇 | 데이터·모듈 | 상태 |
|----|------|------------|------|
| 지배 | 연도별 세력 판도 | `layers/territory/<100년>.geojson`(Cliopatria 3,276) + 한글 이름표 147종 · 연도 따라 버킷 지연 로드 | 완료 |
| 도시 | 정착지, 클릭 시 상세 | `settlements`(dated Point, rank LOD z3/5/7) · 인스펙터 | 완료 |
| 전투 | 전투 지점 + 승자·병력 | `battles`(dated Point) · 승자색 마커 | 완료 |
| 이동 | 인물·군단 원정로 | `movements`(dated LineString, 정본 `_routes/`) · 원정 끝 +10년에 걷힘 | 완료 |
| 토큰 | 장군을 장기 말처럼 | `token3d.ts` CustomLayer + three(동적 import) · route별 자동 생성 | 완료 (흉상 GLB는 F12b) |
| 지형지물 | 강·산·고개·곶 | `landmarks`(Pleiades 3,552 CC BY + NE 고도점 132) · lod z5/7/9 | 완료 |
| 음영·수심 | 지형이 읽히는 베이스맵 | NE 10m Gray Earth → `rasters/relief.jpg` · 수심 7단 | 완료 |
| 기하 3D | 산지가 실제로 솟는다 | terrarium DEM(z0~7) + `hillshade` + `setTerrain` · 과장은 줌 연동(z3 12배 → z9 1.4배) | 완료 (타일은 각자 로컬, §소스) |
| 고도 단면 | 원정로의 오르내림 | `map/elevation.ts`, 원정로 클릭 시 인스펙터에 단면(카이사르 10,947km·최고 1,782m·해상 51%) | 완료 |
| 관계 | 선택 객체의 이웃 | `graph/data.ts` + `GraphPanel`(force, 1·2홉) · 지도엔 좌표 이웃 ≤12일 때만 선(D4) | 완료 |
| 내보내기 | 슬라이드에 넣을 것 | PNG 2× · MP4(mediabunny) · 카드 1080×1350 · 연도 단면 GeoJSON/CSV | 완료 |
| MCP | AI가 같은 데이터를 | `mcp/server.ts` 4툴 stdio. 브라우저와 **같은 `datasets/`**를 읽는다 | 완료 (Claude Desktop 연결은 River) |
| 배포 | URL 하나로 열린다 | GitHub Pages(Actions) | **완료**(2026-09-10) |

DEM 타일은 z0~7(840장, 53MB)이 River 맥에 있고 레포에는 없다. z8 이상은 MapLibre가 오버줌한다.
받는 법은 [AGENTS.md](../AGENTS.md) §기하 3D 지형.

## 데이터셋

| id | 무엇 | 비고 |
|---|---|---|
| `rome` | 정본 온톨로지 650객체·698관계 (`adapt.ts` 산출) | 기본값. 시간범위는 `manifest.json` |
| `chuhan-206` | 초한전쟁 BC206~202. 楚(항우)·漢(유방) | 도메인 무관성 증명용. **새 스키마·린트는 미적용**(TASKS 3.5) |
| `rome-753-218` | 8월판 로마 데이터셋 | `npm run gen`이 아직 이걸 굽는다 |

`?ds=<id>`로 전환. 엔진은 도메인을 모른다. `manifest.json`이 정한다.

## 소스·라이선스

정책은 하나: **PD·자체 트레이싱·출처표기 조건부만 재배포한다. 카피레프트·NC·상용은 참조만.**
파일 단위 대장 둘: 외부 데이터는 `data/external/LICENSES.md`(`fetch-external.ts`가 생성),
초상·문장 71점은 `public/assets/CREDITS.md`(자체 제작, 제3자 이미지 재배포 없음). 외부 소스 요약:

| 소스 | 라이선스 | 용도 | 재배포 |
|------|----------|------|--------|
| Natural Earth 10m | PD | 해안·강·호수·빙하·수심·지역명, Gray Earth 음영, 고도점 132 | O |
| Cliopatria (Seshat) | CC BY 4.0 | 연도별 정치체 폴리곤 3,276 | O (출처표기) |
| Pleiades | CC BY 3.0 | 고대 지명·지형지물 3,552 | O (출처표기) |
| KlokanTech Noto Sans CJK | OFL | 글리프 PBF | O |
| Polybius·Livy 등 고대사료 | PD | 전투·장군·병력 수치 | O |
| AWS Terrain Tiles (Mapzen/Tilezen) | 출처별 상이(PD·CC BY·ODbL 혼재) | terrarium DEM | **X**. gitignore, 각자 로컬에서 받는다 |
| AWMC | CC BY-NC | 속주·도로 | 참조만 |
| historical-basemaps | GPL-3.0 | 연도별 국경 | 참조만 |
| DARE | 미확인 | 속주·지명 | 참조만 |
| Total War 스크린샷 | 상용 | 국경·배치 트레이싱 참고 | **X**. 화면·번들에 넣지 않는다 |

## 다음

[HANDOFF.md §6](HANDOFF.md)에 에이전트가 지금 집을 수 있는 것과 River 몫이 갈려 있다.
그 너머(P1·LVP)는 볼트 `TASKS.md`의 해당 절이 정본이다.
