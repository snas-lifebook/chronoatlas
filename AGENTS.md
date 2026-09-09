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

지금 "입체 보기"는 카메라 pitch만이다 — 굴곡은 없다. 켜려면 DEM 타일이 필요하다(런타임 외부 호출 0 원칙 → 미리 받아 둔다).

```
TERRAIN=1 npm run fetch-external   # AWS terrarium 타일 bbox·z0~7 (~730장, ~20MB). 샌드박스에선 egress 차단 — 로컬 터미널에서
npm run adapt                      # manifest.terrain 갱신 → 엔진이 raster-dem + hillshade + setTerrain 자동 적용
```

`public/datasets/<ds>/terrain/meta.json`의 `encoding`(terrarium|mapbox)·`maxzoom`·`exaggeration`을 바꾸면 그대로 반영된다.
검증됨(2026-09-09): MapLibre 데모 타일(JAXA AW3D30, mapbox 인코딩)로 알프스가 실제로 솟는 것 확인. `.gitignore`에 걸려 있으니 커밋은 라이선스 확인 후.
