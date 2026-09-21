# AGENTS.md — 크로노아틀라스를 만지는 AI가 먼저 읽는 것

정본은 `docs/`의 [CONSTITUTION](docs/CONSTITUTION.md)·[SPEC](docs/SPEC.md)·[SCHEMA](docs/SCHEMA.md)·[DESIGN](docs/DESIGN.md)·[TASKS](docs/TASKS.md)다. 이 파일은 그 실행 요약. (2026-09-16까지 그 다섯은 볼트에 있었다.)

**새 세션이면 [`docs/00-START.md`](docs/00-START.md)를 먼저 읽어라.** 문은 그것 하나다. 읽는 순서·문서 지도·지금 막힌 것·River만 할 수 있는 것이 거기 있다. 현재 상태는 [`docs/HANDOFF.md`](docs/HANDOFF.md), 무엇을 할지는 [`docs/BACKLOG.md`](docs/BACKLOG.md)(요구 원장 R01~R45)에서 고른다. Claude 계열이 아니면 [`docs/HANDOFF-GPT.md`](docs/HANDOFF-GPT.md)의 용어·못 하는 일·관례를 함께 본다.

## 빌드·검증
- `npm i` → `ONTOLOGY_DIR=<볼트 ontology 폴더> npm run adapt` (정본 JSONL → `public/datasets/rome/`) → `npm run build` (= gen + lint + vitest + vite).
- `npm run fetch-external` — Natural Earth 베이스맵·수심·음영·글리프 다시 굽기(캐시 `data/external/`는 커밋 안 함).
- `npm run lint` — 온톨로지 불변식. 새 오류만 실패(`scripts/lint.baseline.json` 래칫). 정본 결함은 `proposals/`에 제안 파일로.
- `npx vitest run` — 어댑터·스키마·상태·스타일·그래프·검색·MCP. 뷰 코드에는 로직을 두지 않는다.
- 스모크: `npm run build` 후 정적 서버로 `dist/`를 `/chronoatlas/`에 마운트해 열기(Pages 경로와 같다).

## 구조 (한 상태, 네 뷰)
- `src/state.ts` — 단일 상태 `{year, sel, layers, view, ds, scene}` ↔ URL. 뷰는 store만 구독한다. 뷰끼리 직접 부르지 않는다.
- `src/map/style.ts` — 베이스맵 스타일(순수 함수). `src/map/engine.ts` — MapLibre + 데이터 레이어 + 인터랙션 + 1홉 그래프.
- `src/app/App.tsx` — 떠 있는 카드(astryx). `Inspector.tsx` 객체 패널, `Search.tsx` ⌘K.
- `src/graph/data.ts` — graph.json 인덱스·이웃. `mcp/tools.ts`가 **같은 파일**을 읽는다.
- `data/scenes/rome.json` 장면 프리셋, `data/eras/rome.json` 시대 띠 — 사람이 쓰는 파일. 발표 그룹은 「포인트 …」로 시작하는 group(`present.isPresentGroup`), 정본은 `docs/POINTS-01-11.md`.
- `data/overlays/p12-*|p345-*|p911-*.json` 포인트 묶음 교보재(cast·battles·routes·places·peoples·islands·anachronisms·legions·hatch·rivers). **지연 로드**: `packData.loadPack`이 그 해·그 장면에서 받아 살아 있는 배열에 합치고 `engine.refreshPack`이 다시 싣는다. 새 종류는 `mergePack`·`refreshPack` 둘 다 손본다. `pack-*.json`은 카이사르 팩(eager).

## MCP (읽기 전용 4툴)
`npm run mcp` (stdio). Claude Desktop: `{"mcpServers":{"chronoatlas":{"command":"node","args":["--experimental-strip-types","<repo>/mcp/server.ts"]}}}`
툴: `get_schema` · `find_entity(q,type?)` · `neighbors(id,from_year?,to_year?,rels?)` · `path(a,b,max_hops?)`. 연도는 정수, BC는 음수.

## 하지 말 것
- 정본(볼트 `ontology/*.jsonl`)에 직접 쓰지 않는다. 제안은 `proposals/*.jsonl`로(CONSTITUTION 0-3).
- `public/datasets/`를 손으로 고치지 않는다 — 어댑터 산출물이다.
- 런타임 외부 호출 0. 새 데이터는 빌드타임에 `data/external/`로 굽는다. 카피레프트(ODbL) 데이터는 재배포하지 않는다.
- 웹 UI에 astryx 밖의 색·간격을 넣지 않는다(DESIGN P1). 지도 위 유채색은 데이터 색뿐(P2). 클릭 안 되는 지도 요소를 만들지 않는다(P5).
- 신뢰도 값을 지어내지 않는다. Hunyuan3D 금지.

## 기하 3D 지형(DEM)

DEM 타일은 **레포에 커밋돼 있다**(2026-09-17, OVERHAUL §3.7). 런타임 외부 호출 0. 엔진은 `public/datasets/rome/terrain/meta.json`을 보고 `raster-dem` + `hillshade` + `setTerrain`을 붙이고, 미시지도에 들어가면 그 지도의 `dem.dir`(`terrain-<id>/`)로 소스를 갈아 끼운다.

| 폴더 | 원본 | 범위 | 크기 |
|---|---|---|---|
| `terrain/` | ETOPO 2022 15초(NOAA, 자유 이용) | z0~8, BBOX(`scripts/extent.ts`) | 4,780장 144 MB |
| `terrain-<id>/` | Copernicus GLO-30(출처 표기) | z8~12, 미시지도 `home.at ± span` | 지도당 1~15 MB |
| `landcover-<id>/` | ESA WorldCover 2021(CC BY 4.0) | z8~12, 같은 범위 | 지도당 1~5 MB |
| (인셋 추가) | `data/insets.json`에 `{ id, at, span, why }` 한 줄 | 미시지도 없이도 그 범위에서 인셋 DEM·토지피복이 켜진다(`src/insets.ts`). 굽기는 같은 두 스크립트에 `<id>` | |

```
python3 scripts/bake-dem.py --selftest
python3 scripts/bake-dem.py continental          # 원본 35장(884 MB)은 data/external/dem/에 캐시(gitignore). 굽기 자체는 2분
python3 scripts/bake-dem.py inset <id> | --all   # <id>는 미시지도 또는 insets.json. 범위를 바꾸면 다시 굽는다
python3 scripts/bake-landcover.py <id> | --all
python3 scripts/bake-basemap.py <id> --write      # 미시지도 도판 지오레퍼런싱(통제점 data/basemaps/<id>.json, 원본 data/external/basemaps/). 아테네 선례 RMS 35 m
python3 scripts/bake-satellite.py                # 위성 스킨 래스터 둘(rasters/satellite.jpg + satellite-sea.png). 원본 Blue Marble 190 MB는 data/external/satellite/(gitignore), 주소는 스크립트 머리
npm run fetch-external && npm run finish         # 영토 버킷 재베이크(span_from·span_to·color 포함). 순서 고정: fetch가 굽고 finish가 마감한다
npm run adapt                                    # 정착지 rank(LOD 5단)·그래프. ONTOLOGY_DIR 또는 data/ontology-dir.txt
```

- 대륙 DEM 위에는 모든 스킨에서 `color-relief` 고도색(0.15)과 hillshade가 깔린다(`style.ts ELEV_RAMP`). 「확대하면 빈 화면」의 완료 조건은 `scripts/blank-ratio.py`로 잰다.
- 인코딩은 terrarium이되 **대륙 2 m·인셋 1 m로 양자화하고 바다는 0**이다. 원 정밀도로 구우면 4배(600 MB)가 된다. 수심 색은 DEM이 아니라 NE 수심 벡터 몫.
- 총량 상한 200 MB는 `test/terrain.test.ts`가 지킨다. 넘으면 인셋 `maxzoom`을 11로 내린다.
- 크레딧은 `public/assets/CREDITS.md`, 원본 라이선스는 `data/external/LICENSES.md`. AWS Terrain Tiles(라이선스 혼합)는 2026-09-17에 걷어냈다.
- 과장·인코딩은 `terrain/meta.json`의 `exaggeration`·`encoding`.

## 정본 온톨로지 경로

`npm run adapt`은 `ONTOLOGY_DIR` 환경변수를 쓴다. 매번 치기 싫으면 `data/ontology-dir.txt`(gitignore)에 경로 한 줄:

```
# <볼트> = Obsidian 볼트 루트 (공개 레포라 개인 경로는 안 적는다)
echo "<볼트>/Efforts/Notes/산업스터디/Projects/인생책_읽기_편데/Books/로마제국쇠망사/ontology" > data/ontology-dir.txt
```
