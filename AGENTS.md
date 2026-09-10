# AGENTS.md — 크로노아틀라스를 만지는 AI가 먼저 읽는 것

정본은 볼트 `Works/비주얼파이프라인/`의 CONSTITUTION·SPEC·SCHEMA·DESIGN·TASKS다. 이 파일은 그 실행 요약.

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
- `data/scenes/rome.json` 장면 프리셋, `data/eras/rome.json` 시대 띠 — 사람이 쓰는 파일.

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

"입체 보기"는 기본이 카메라 pitch만이다 — 굴곡은 DEM 타일이 있어야 생긴다. 타일은 용량·라이선스 때문에 레포에 없다(`.gitignore`).

```
TERRAIN=1 npm run fetch-external
```

지형만 받고 즉시 끝난다(NE 재다운로드·PIL·mapshaper 안 씀). AWS Terrain Tiles(terrarium) bbox·z0~7, 약 730장 20MB.
브라우저 새로고침하면 켜진다 — `terrain/meta.json`을 엔진이 런타임에 보고 `raster-dem` + `hillshade` + `setTerrain`을 붙인다. **adapt 불필요**
(manifest에 박지 않는 이유: manifest는 커밋되는데 타일은 아니라서 없는 타일을 요청하게 된다).

**타일이 없으면 콘솔에 `terrain/meta.json` 404가 한 줄 남는다. 이건 정상이다** — 런타임 감지가 곧 이 요청이다.
Lighthouse의 "errors in console"이 이걸 잡지만 고치지 말 것. 없애려고 meta.json을 커밋하면 위 괄호의 버그로 되돌아간다.

- 더 촘촘히: `TERRAIN_MAX=8` (약 2,900장 55MB). z8 이상은 MapLibre가 오버줌해서 부드럽게 쓴다.
- 과장·인코딩은 `public/datasets/<ds>/terrain/meta.json`의 `exaggeration`·`encoding`(terrarium|mapbox).
- 끄기: `rm -rf public/datasets/rome/terrain`
- 검증됨(2026-09-09): MapLibre 데모 타일(JAXA AW3D30, mapbox 인코딩)로 알프스 융기·인스브루크 고도 939m 확인.
- 라이선스가 출처별로 섞여 있다(SRTM·GMTED PD, 일부 ODbL) — 커밋할 거면 확인 후.

## 정본 온톨로지 경로

`npm run adapt`은 `ONTOLOGY_DIR` 환경변수를 쓴다. 매번 치기 싫으면 `data/ontology-dir.txt`(gitignore)에 경로 한 줄:

```
# <볼트> = Obsidian 볼트 루트 (공개 레포라 개인 경로는 안 적는다)
echo "<볼트>/Efforts/Notes/산업스터디/Projects/인생책_읽기_편데/Books/로마제국쇠망사/ontology" > data/ontology-dir.txt
```
