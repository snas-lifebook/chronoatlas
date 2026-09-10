# HANDOFF: 세션을 넘겨받는 사람이 먼저 읽는 것

빌드·구조·MCP·DEM 받는 법은 [AGENTS.md](../AGENTS.md)에 있다. 중복하지 않는다.
이 파일은 **지금 어디까지 됐고, 다음에 뭘 집을 수 있는지**만 적는다.

작성 2026-09-10. 이 문서가 실제와 어긋나면 이 문서가 틀린 것이다. 레포와 볼트를 믿어라.

## 1. 지금 상태

- **라이브: https://snas-lifebook.github.io/chronoatlas/** (2026-09-10 배포). 원격 `origin` = `snas-lifebook/chronoatlas`(public).
  push하면 Actions가 `npm ci` → `npm run build`(= gen·lint·typecheck·vitest·vite) → Pages. **빌드가 깨지면 배포가 안 된다.**
  옛 레포 `visual-pipeline`은 archived이고 옛 Pages 주소는 여기로 리다이렉트한다.
  (커밋 해시는 여기 안 적는다. 한 커밋마다 낡는다. `git log --oneline -5`를 보라.)
- **CI의 node는 22여야 한다.** `lint`·`adapt`·`mcp`가 `node --experimental-strip-types`로 `.ts`를 직접 돌리는데
  그 플래그는 22.6+다. 첫 배포가 node 20에서 정확히 여기서 죽었다.
- `npm run build` 초록: lint 0 new / 11 baseline / 23 warn, vitest 81 통과. **수치가 다르면 이 문서가 낡은 것이다.**
- **라이브 실측(2026-09-10, Lighthouse desktop)**: 접근성 100 · Best Practices 96 · SEO 100 · LCP 278ms · CLS 0.01.
  Best Practices의 -4는 아래 §5의 `terrain/meta.json` 404 하나뿐이고 그건 설계대로다.
- `npm run validate` = gen → lint → **typecheck** → vitest. typecheck는 9/10에 붙였다(그전엔 게이트에 없었다).
- 초기 JS **382.8 kB gz** (예산 400 통과). 동적 청크는 별개: three 129.4, mediabunny 45.5.
- 첫 페인트 차단 데이터 **15.4 kB gz** (9/10 이전엔 228.9였다. landmarks 1.2MB가 끼어 있었다).
- **`chuhan-206`은 베이스맵이 없다.** manifest에 `basemap`·`bbox`·`relief`가 없고, `rome/layers/land.geojson`은
  경도 −15~65(지중해)만 덮어 중원(100~125)에 쓸 육지·해안·강이 아예 없다. `?ds=chuhan-206`은 빈 배경 위에
  데이터 레이어만 뜬다 = SPEC F3 반려("단색 배경만 보이는 줌 레벨 없음")를 이 데이터셋은 전 줌에서 위반한다.
  중원 bbox로 NE를 다시 구우려면 egress가 필요하다. 온톨로지가 없어 `graph.json`도 없다(검색·관계 패널은 빈 상태로 이름 붙여 놨다).

문서는 9/10에 맞춰 놨다(볼트 `SPEC`·`TASKS`·MOC, 레포 `README`·`roadmap.md`).
남은 어긋남 하나: `data/external/LICENSES.md`는 생성물인데 캐시가 비어 재생성을 못 했다.
`fetch-external.ts` 쪽은 고쳤으니 egress 있는 데서 `npm run fetch-external` 한 번 돌리면 맞는다.

## 2. 폴더 지도

구조는 [AGENTS.md §구조](../AGENTS.md)가 정본. 여기 없는 것만:

| 경로 | 무엇 | 커밋하나 |
|---|---|---|
| `public/datasets/rome/` | 어댑터 산출물. **손으로 고치지 않는다** | O |
| `public/datasets/rome-753-218/` | 8월 판 데이터셋. `npm run gen`이 아직 이걸 굽는다 | O |
| `public/datasets/*/terrain/` | DEM 타일 | X (gitignore) |
| `data/external/` | 외부 원본 캐시 149MB | X |
| `data/ontology-dir.txt` | 정본 경로 폴백 | X |
| `proposals/` | 정본 결함 제안. 정본에 직접 안 쓴다 | O |

## 3. 정본 볼트 경로

```
Efforts/Notes/산업스터디/Projects/인생책_읽기_편데/
├── Works/비주얼파이프라인/     ← SDD 문서 정본(CONSTITUTION·SPEC·SCHEMA·PLAN·DESIGN·TASKS)
└── Books/로마제국쇠망사/ontology/  ← 정본 JSONL (ONTOLOGY_DIR)
```

폴더명이 `비주얼파이프라인`인 것은 이력 때문이다. 제품명은 **크로노아틀라스**(D1).

## 4. 하지 말 것

[AGENTS.md §하지 말 것](../AGENTS.md)이 정본. 더할 것 하나:

- **`main.tsx`의 `load()` Promise.all에 큰 레이어를 넣지 않는다.** 거기 담긴 것은 전부 첫 페인트를 막는다.
  지도는 `style.ts`가 URL 소스로 알아서 받고, 패널만 쓰는 사본은 engine이 필요할 때 받는다.
  `test/payload.test.ts`가 60 kB gz에서 막는다.

## 5. 환경 함정

DEM egress 차단·`ONTOLOGY_DIR`은 AGENTS.md에. 그 외 실측으로 확인한 것:

- **`npm run preview`는 스모크에 못 쓴다.** `base: '/chronoatlas/'`인데 preview는 모든 경로에 `index.html`을 준다
  (JS도 데이터셋도 883바이트 index.html). AGENTS.md가 말하는 대로 **정적 서버로 `dist/`를 `/chronoatlas/`에 마운트**해야 한다:
  ```
  mkdir -p /tmp/smoke && ln -s ~/Projects/chronoatlas/dist /tmp/smoke/chronoatlas
  cd /tmp/smoke && python3 -m http.server 4180   # → localhost:4180/chronoatlas/
  ```
- **자동화 탭(Claude in Chrome)에서는 지도가 안 뜬다.** 원인은 `document.hidden = true`다(2026-09-10 직접 측정:
  `visibilityState: "hidden"`, rAF 1초에 **0틱**). 배경 탭에서는 rAF가 멈추고, MapLibre는 스타일 로드를 rAF로
  굴리므로 `map.on('load')`가 영영 안 fire한다. 같은 이유로 **첫 페인트 뒤에 도착한 이미지도 화면에 안 나타난다**
  (DOM엔 `complete: true`인데 스크린샷은 빈 자리). JS 에러 0, WebGL 정상이라 코드 버그처럼 보인다.
  rAF에 의존하는 코드를 `await`하면 렌더러가 멈춘 채 45초 타임아웃이 난다.
  이 함정은 8월에 한 번 밟았다. **다시 파지 말 것.**
- **그래서 이렇게 검증한다(에이전트도 된다).** 디버깅 포트를 연 진짜 창을 띄우면 `visibilityState: "visible"`,
  rAF 61틱/초가 되고 지도가 정상으로 뜬다. `mcp__arc-devtools__*`가 여기에 붙는다.
  ```
  open -na "Google Chrome" --args --remote-debugging-port=9222 \
       --user-data-dir=/tmp/ca-chrome --no-first-run \
       "https://snas-lifebook.github.io/chronoatlas/"
  ```
  별도 프로파일이라 River의 Chrome 세션은 안 건드린다. 끝나면 `pkill -f "user-data-dir=/tmp/ca-chrome"`.
  이 경로로 지도 렌더·Lighthouse·성능 트레이스까지 전부 실측했다(2026-09-10).
- 헤드리스 Playwright는 없다(파이썬 `playwright`는 있으나 chromium 미설치, 설치는 egress 필요). 위 방법을 쓸 것.

## 6. 에이전트가 지금 할 수 있는 것

**무엇을 할지는 [BACKLOG](BACKLOG.md) 「지금 순서」에서 고른다. 볼트 P1 순서가 아니다.**
볼트 `SPEC.md`의 F 목록은 "무엇을 만들었나"(기능 정본)이고 BACKLOG의 R 목록은
"River가 무엇을 요구했나"(요구 정본)다. 아래는 그 라운드 표를 옮긴 것이니
**세부 지시는 BACKLOG의 「라운드별 지시」를 읽어라.** 여기 요약만 보고 착수하지 마라.

하나 골라서 착수하고, 착수 전에 River 확인을 받는다.
요구를 닫을 때는 **근거**(실측 수치·스크린샷 경로·테스트 이름)를 BACKLOG 원장에 적는다.
근거 없이 ●로 바꾸지 않는다.

| 라운드 | 무엇 | 닫는 요구 | 크기 | 선행 |
|---|---|---|---|---|
| A | 지도 범위 확대 (`BBOX` [-15,20,65,60] → 넓게) | R31 | 중 | **River 터미널**(재베이크·DEM, egress) |
| B | 세력 실명 + 존속연도 (이집트가 「그리스계」로 칠해진다) | R32 | 중 | A |
| C | 경계 넉넉하게·부드럽게 (곶이 안 칠해진다) | R33 | 소~중 | A |
| D | 도시·산·강·바다 LOD 재설계 (카르타고가 안 보인다) | R34 | 중 | A |
| **E** | **북마크·프로젝트** | R35 | 소~중 | **없음 — 지금 가능** |
| F | 타임라인에 그 해의 인물·국가·사건 | R36 | 중 | 없음 |
| G | 말판 + 인물 위치 + 자석 | R21·R37·R38·R39 | 대 | 스키마 설계가 본체 |
| **H** | **데이터 결손·회귀 정리** | R25 + 결손 4건 | 소 | **없음 — 지금 가능** |

**E와 H는 A의 대기 시간에 병행한다.** A는 River가 자기 터미널에서 재베이크를 돌려야 하는 구간이 있다.

**H에는 이 레포 사정이 하나 낀다.** `resource`·`terrain` 소실은 어댑터 수정이지만
**`npm run adapt`이 지금 돌지 않는다**(§1의 정본 마이그레이션). 그래서 H는
`proposals/` 제출과 어댑터 코드 수정까지는 닫히고, **라이브 반영은 River의
`migrate_v2.py --write` 뒤로 밀린다.** 착수 전에 이걸 알고 골라라.

**뒤로 민 것**(BACKLOG 「함께 가는 것」): 자료실 역링크(볼트 TASKS 3.6, 짧고 독립적이라 언제든) ·
F19 파벌 해칭 · F20 크레딧 페이지 · 번들 감량. 이미 ●가 많은 「지도가 그리는 것」 축이다.

**막힌 것**(고르지 말 것): TASKS 3.5 초한지 베이스맵(egress) · F13(DPRR) · F20b·F20c(ERA5·CMEMS) ·
3.7·3.8 흉상 GLB(GPU) · `LICENSES.md` 재생성(egress) · DEM z8+(egress).

닫힌 것(9/10): **0.0 레포·Pages 배포**(+ 옛 레포 archived·리다이렉트) · `docs/roadmap.md` 재작성 ·
볼트 SPEC·TASKS·MOC 정합 · README 수치 · 라이선스 대장 3건(외부 2 + 에셋 대장 신설) ·
typecheck 게이트(+ 고도 단면 `<title>`) · `loadGraph` 거절 캐시 · 검색 팔레트 빈 상태 · 뒤로가기 `ds` 어긋남 ·
4.1 P13 재캡처와 4.5 Lighthouse(§5 방법으로 풀렸다).

**9/10 소넷 6인 검수에서 나와 고친 것**(커밋 `4aa159f`·`28fe182`, vitest 81 → 88):
- **공유 링크가 늘 BC 60으로 열렸다.** 장면이 URL의 `y`·`sel`을 덮어썼다. `test/state.test.ts` 4건 추가(RED 확인 2건).
- **한 번도 그려진 적 없는 레이어 셋**(`ego-node`·`ego-label`·`label-marine`) 제거. 레이어 28 → 25, 초기 콘솔 경고 2 → 0.
- **바다 위 툴팁이 `undefined`**였고 클릭하면 `sel`이 `landmark:undefined`가 됐다. 겸사겸사 `setHTML` → `setDOMContent`.
- **`battles` id 중복 3건**(삼니움·제1차포에니·제2차포에니): 어댑터·엔진은 고쳤고 **산출물은 정본 대기**. `test/ontology.test.ts`에 지뢰.

## 7. River 몫

DEM z8+ · Pretendard/세리프 글리프 · DPRR · 기후·바람·해류 ·
`migrate_v2.py --write` · `proposals/` 2건 검토 · 자료실 `atlasUrl` · Claude Desktop MCP 연결 · 흉상 GLB(F12b).

지도 렌더 검증은 더 이상 River 몫이 아니다(§5). 남는 것은 **취향·판정**이다: P13 "완성된 지도로 보이는가",
P16 30초 테스트, 4.4 실전 사용. 기계가 대신 못 하는 건 그쪽이다.

## 8. 다음 라운드를 설계한다면

**[BACKLOG](BACKLOG.md)가 요구 정본이다**(2026-09-10 신설). 라운드 A~H와 원장 R01~R40,
데이터 결손 표, 오픈소스 판정(번들은 PD 또는 CC BY만)이 전부 거기 있다.

- **무엇을 할까**는 BACKLOG 「지금 순서」에서 고른다. 볼트 `TASKS.md`의 P1 순서가 아니다.
- **무엇을 만들었나**는 볼트 [SPEC](../../Works/비주얼파이프라인/SPEC.md)의 F 목록이 정본이다.
  F와 R은 다른 축이다 — F는 산출물, R은 요구다. 둘 다 갱신한다.
- 볼트 상대경로는 레포 밖이라 안 열린다. 볼트에서 열어라.

BACKLOG가 짚은 패턴 하나: ●로 끝난 요구는 거의 전부 **지도가 그리는 것**이고,
○로 남은 요구는 거의 전부 **객체가 들고 있어야 할 것**(이동 시간·재산·인구·자원·언어권·관직)이다.
**엔진은 섰고 스키마가 얕다.** 지형과 스킨을 더 올려도 이 축은 안 움직인다.
