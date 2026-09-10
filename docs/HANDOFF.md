# HANDOFF — 세션을 넘겨받는 사람이 먼저 읽는 것

빌드·구조·MCP·DEM 받는 법은 [AGENTS.md](../AGENTS.md)에 있다. 중복하지 않는다.
이 파일은 **지금 어디까지 됐고, 다음에 뭘 집을 수 있는지**만 적는다.

작성 2026-09-10. 이 문서가 실제와 어긋나면 이 문서가 틀린 것이다 — 레포와 볼트를 믿어라.

## 1. 지금 상태

- `main` @ `1c1927c`. GitHub 원격 **없음**(로컬 + `bundle/main`만). Pages 미배포 — 완료 판정 1이 여기서 막혀 있다.
- `npm run build` 초록: lint 0 new / 11 baseline / 23 warn, **vitest 79 통과**.
- 초기 JS **382.8 kB gz** (예산 400 통과). 동적 청크는 별개: three 129.4, mediabunny 45.5.
- 첫 페인트 차단 데이터 **15.4 kB gz** (9/10 이전엔 228.9 — landmarks 1.2MB가 끼어 있었다).
- `npx tsc --noEmit` 에러 1건 상존: `src/app/Profile.tsx:42` SVG `title` prop. **빌드 게이트에 typecheck가 없다.**

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
- **Claude in Chrome 자동화 탭에서는 지도가 안 뜬다** (2026-09-10 실측). 셸·패널·그래프·타임라인·데이터는 다 뜨는데
  MapLibre 스타일이 `_loaded: false`에서 멈춘다(`getStyle()` 없음, 소스 0, 글리프 요청 0). WebGL은 정상(M3 Metal, 컨텍스트 안 잃음).
  **dev·빌드 둘 다, `958adfa`(내 수정 전)에서도 같다** — 즉 코드 회귀가 아니라 그 브라우저 컨텍스트 문제다.
  River 맥의 평범한 Chrome에서는 뜬다(4.2 영상이 증거). **지도 렌더가 걸린 검증은 에이전트가 못 한다 — River 몫.**
  원인은 안 팠다.
- 브라우저 검증이 필요하면 헤드리스 Playwright도 없다(파이썬 `playwright`는 있으나 chromium 미설치, 설치는 egress 필요).

## 6. 에이전트가 지금 할 수 있는 것

지도 렌더·외부 네트워크·GPU가 안 걸리는 것만. 하나 골라서 착수하고, 착수 전에 River 확인을 받는다.

| # | 무엇 | 왜 지금 | 근거 |
|---|---|---|---|
| 6.1 | **초한지 데이터셋 새 스키마·린트 적용** — `chuhan-206`이 옛 포맷 그대로 | 완료 판정 7의 ◐ 하나 | TASKS 3.5 |
| 6.2 | **`Profile.tsx` typecheck 에러 1건** + `npm run validate`에 `tsc --noEmit` 추가 | 게이트에 구멍이 하나 있다 | §1 |
| 6.3 | **크레딧 페이지** — `LICENSES.md` + 각주에서 생성 | 작고 독립적 | SPEC F20 ◐ |
| 6.4 | **F19 파벌 해칭** — `fill-pattern`·영향권 `heatmap` | 정치 세력 데이터(F13)는 막혔지만 `confidence` 기반 해칭은 지금 됨 | SPEC F19 ○ |
| 6.5 | **번들 나머지** — 초기 JS 382.8 gz의 바닥은 maplibre 243.3 + react 59.6 + astryx 58.4 + 앱 23.8. 더 줄이려면 첫 페인트에서 뺄 것을 River가 정해야 한다 | 예산은 이미 통과. 더 갈지는 판단 | TASKS 4.5 |

닫힌 것(9/10): `docs/roadmap.md` 재작성 · 볼트 SPEC·TASKS·MOC 정합 · README 수치 · 라이선스 대장 누락 2건.

**막힌 것**(고르지 말 것): 4.1 P13 z7~9(DEM) · 4.5 Lighthouse CI(배포) · 3.6 자료실 역링크(크로노아틀라스 URL이 아직 없다) · F13(DPRR) · F20b·F20c(ERA5·CMEMS) · 3.7·3.8 흉상 GLB(GPU).

## 7. River 몫

GitHub 레포 생성·push·Pages · DEM z8+ · Pretendard/세리프 글리프 · DPRR · 기후·바람·해류 ·
`migrate_v2.py --write` · `proposals/` 2건 검토 · 자료실 `atlasUrl` · Claude Desktop MCP 연결 · 흉상 GLB(F12b) ·
**그리고 지도 렌더가 걸린 모든 검증**(§5).

## 8. 다음 라운드를 설계한다면

`docs/BACKLOG.md`는 아직 없다. 라운드 설계는 볼트 [TASKS](../../Works/비주얼파이프라인/TASKS.md) 「P1」·「LVP」 절이 정본이다.
(볼트 상대경로는 레포 밖이라 안 열린다 — 볼트에서 열어라.)
