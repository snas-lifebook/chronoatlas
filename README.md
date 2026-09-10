# 크로노아틀라스 (chronoatlas)

온톨로지가 중심인 **역사 지도·관계 그래프·타임라인**. 산스 인생책 편데의 『로마제국쇠망사』 시즌을 위해 만들고, 데이터셋만 바꾸면 다른 책·시대에도 쓴다. 단일 연도 상태(URL `?y=`)가 지도·그래프·타임라인·패널 네 뷰를 동시에 움직인다. 소비자는 사람(브라우저)과 AI(MCP) 둘.

이 레포는 코드다. 왜 이렇게 만드는지(헌장·명세·스키마·디자인·작업 순서)는 볼트 `Works/비주얼파이프라인/`이 정본이다.
AI가 먼저 읽을 것은 **`docs/HANDOFF.md`**(현재 상태·환경 함정·지금 집을 수 있는 것)와 **`AGENTS.md`**(빌드·구조·하지 말 것).

**라이브: <https://snas-lifebook.github.io/chronoatlas/>**

## 빠른 시작

```
npm i
ONTOLOGY_DIR=<볼트 Books/로마제국쇠망사/ontology> npm run adapt   # 정본 JSONL → public/datasets/rome
npm run dev                                                     # http://localhost:5173/?ds=rome
```

첫 화면은 장면 프리셋(BC 60 카이사르). `/` 또는 ⌘K 검색, `←→` 연도, `Space` 재생, `V` 평면/입체, `1~9` 레이어, `Esc` 해제.

## 무엇이 있나

- **베이스맵**: Natural Earth 10m(육지·해안·강·호수·빙하·수심 7단·바다/지역명) + **10m Gray Earth 음영기복(4800×2400, 하계망 각인)** + 자체 글리프. 기하 3D는 `TERRAIN=1 npm run fetch-external`(AGENTS.md) + Pleiades 지형지물 3,552점(산·강·곶·고개·호수·섬…, CC BY) + NE 고도점 132곳(이름난 봉우리에 실측 고도). 원정로를 클릭하면 DEM 타일을 디코딩해 **해발고도 단면**을 그린다(`src/map/elevation.ts`). 런타임 외부 호출 0.
- **데이터 레이어**: 정착지(rank LOD)·사건(30년 창)·**영토(Cliopatria 정치체 3,276개, 100년 버킷 지연 로드, 팔레트 세력색)**·속주·이동경로(정본 `_routes/`, 연도 따라 그려짐) + 지형지물(NE 폴리곤·Pleiades 점이 클릭 객체).
- **관계 그래프**: 인스펙터 아래 패널(옵시디언 로컬 그래프식 force 캔버스, 1·2홉, 드래그·hover·클릭). 지도엔 좌표 있는 이웃이 12개 이하일 때만 선.
- **인스펙터**: 초상(세력 링)·그 해의 상태(history fold)·의미군별 관계·등장 포인트·자료실 링크.
- **내보내기**: PNG 2× · 카드 1080×1350 · MP4(장면 구간, WebCodecs). 스킨 5종(중립·야간·고지도·신문톤·작전)은 내보낼 때만 갈아끼운다. 전부 브라우저에서.
- **MCP**: `npm run mcp` — `get_schema` `find_entity` `neighbors` `path` (stdio, 읽기 전용, 브라우저와 같은 `graph.json`).
- **데이터셋 스위처**: `?ds=chuhan-206`(초한전쟁) — 스키마 무관 실증.

## 스크립트

```
npm run adapt            # 정본 온톨로지 → datasets/rome (ONTOLOGY_DIR 필요)
npm run fetch-external   # Natural Earth·음영·Pleiades·Cliopatria·글리프 다시 굽기 (캐시 data/external/, 커밋 안 함)
npm run lint             # 온톨로지 불변식 (baseline 래칫 — 새 오류만 실패)
npm run build            # gen + lint + vitest + vite build (+ MapLibre 워커 복사)
npm run mcp              # MCP stdio 서버
```

## 구조

`src/state.ts`(상태↔URL) · `src/map/{style,engine,elevation}.ts`(베이스맵·데이터·인터랙션·1홉 그래프·고도 단면) · `src/app/{App,Inspector,GraphPanel,Search}.tsx`(떠 있는 astryx 카드) · `src/graph/data.ts`(graph.json 인덱스) · `src/export/{png,card,mp4,data}.ts` · `mcp/` · `scripts/{adapt,fetch-external,lint}.ts` · `schema/{vocab,ontology}.ts`(어휘 상수 / Zod, SCHEMA v2 — 브라우저는 vocab만 쓴다) · `data/{scenes,eras}/`(사람이 쓰는 장면·시대).

## 출처

Natural Earth(Public Domain) · Pleiades(CC BY 3.0, Bagnall·Talbert 외, isawnyu/pleiades-datasets) · Cliopatria(CC BY 4.0, Seshat Global History Databank — 정치체 경계는 한 견해) · Noto Sans CJK 글리프(OFL, Pretendard로 교체 예정) · Pretendard(OFL) · AWS Terrain Tiles(Mapzen/Tilezen, 출처별 라이선스가 섞여 있어 **재배포하지 않는다** — 각자 로컬에서 받는다) · 초상·아이콘은 편데 관계분석 컴포넌트(자체 제작, 제3자 이미지 재배포 없음) · 온톨로지는 편데 정본.
대장 둘: 외부 데이터는 `data/external/LICENSES.md`, 초상·문장은 `public/assets/CREDITS.md`.
