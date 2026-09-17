# 전면 개선 슬라이스 II · 계획: 시각 문법(대륙 축척) (R51)

**Goal:** `campaign` 스킨을 레퍼런스(Kings and Generals · Epic History · HistoryMarche)의 문법으로 올리고, 장기말에 군기·군단 무리를 달고, 고른 장군에 배너 카드를 붙인다.

**Spec:** `docs/OVERHAUL-II.md`(2026-09-17 River 승인: Cinzel 두 줄 · 작은 말 무리 + 명패 · 카드는 선택에만 · 채도 유지).

**Architecture:** 스킨 조건은 전부 `engine.ts activeSkin` 한 곳에서 갈린다(addData가 스킨 전환 때 다시 돈다). 글리프·문장은 빌드타임 산출물(레포 커밋). 말은 `token3d.ts` 프로시저럴 한 파일. 카드는 콜아웃과 같은 DOM 방식의 지연 청크.

> **2026-09-17 밤 실행 기록.** 전부 됨. 계획과 다른 점: 깃발은 탑다운 시점에서 면이 보이게 **뒤로 52도 눕혔다**(세워 두면 위에서 선 하나다). 명패는 말 앞에 눕힌 판(로마 숫자, 캔버스 텍스처). 케이싱 색은 polityColor 곱이 아니라 스킨 `coast` 잉크 0.55(표현식에 색 산술이 없다). 이름표 자간은 두 줄 전체 0.12. 배너 카드는 인스펙터가 오른쪽에 서 있으면 말 왼쪽으로 뒤집는다(그리스 장면에서 패널 밑에 깔렸다). 볼트 문장 파일명이 NFD라 NFC 정규화 없이는 카르타고가 빠졌다. `look-skins.py` 명암비 10.2~13.2. MODELS.md 모듈 지도에 token3d·BannerCard는 **아직 안 넣었다**(손 도식, 다음 세션).

## Global Constraints

- 초기 JS ≤ 400 kB gz(게이트). token3d 청크 +10 kB 이내. 글리프·문장은 번들이 아니다.
- 런타임 외부 호출 0. 글리프 PBF는 `public/glyphs/`, 문장은 `public/assets/emblems/`, 웹폰트는 `public/fonts/`.
- 지어내지 않는다: 군단 수는 `pack-legions`, 문장은 있는 세력만, 라틴 이름은 `name_en`.
- `git add` 경로 명시. push는 River가 말할 때만. 작대기·이모지 금지.

## 모델링

| 모델 | 정의 | 요지 |
|---|---|---|
| 글리프 빌드 | `scripts/build-glyphs.mjs` | fontnik(설치는 `--no-save`) → `public/glyphs/Cinzel Regular/{0-255,256-511}.pbf` |
| 문장 | `scripts/build-emblems.py` → `public/assets/emblems/<actor>.png` + `data/overlays/pack-emblems.json` `{ actors: string[] }` | 있는 세력만. 깃발·카드가 `PACK_EMBLEMS.has(actor)`로 본다 |
| 말 v2 | `token3d.ts createToken(color, name, portrait, scale, { emblem })` + `setLegions(n)` | 깃대·깃발·명패·무리. 무리는 z6 이상에서만 |
| 배너 카드 | `src/app/BannerCard.tsx({ engine, person, root })` | `sel`이 person이고 그 해 지도에 있을 때만 |
| 스킨 속성 | `documentElement.dataset.skin` | 리본 CSS·카드 CSS가 본다 |

## Tasks

### II-0 글리프 (됨, 2026-09-17)
fontnik 0.7.7이 이 환경에서 프리빌트로 설치됐고 Cinzel 두 범위 136 kB가 나왔다. `data/external/fonts/`(gitignore)에 원본 + OFL.

### II-1 스킨 v2: 두 겹 테 · 리본 · 두 줄 이름표
- `engine.ts addData`: `activeSkin === 'campaign'`이면 `territory-casing`(polityColor 어둡게, 3.2px, 0.9) 위 `territory-outline`(halo색, 1.2px, dash [2,2]); 아니면 지금 한 겹. `LAYER_GROUPS.territory`에 `territory-casing`.
- `territory-label`: `campaign`·`oldmap`이면 `format` 두 줄(윗줄 `upcase(name_en)` Cinzel 1.0, 아랫줄 `name` Noto 0.8) + `text-letter-spacing 0.12`. `name_en`이 `name`과 같으면(한글 이름 없음) 한 줄.
- App: `useEffect(() => { documentElement.dataset.skin = s.skin }, [s.skin])`. CSS: `html[data-skin="campaign"] .shell.is-present .shell-year, html[data-skin="campaign"] .shell-present-hud .ph-y` 리본(양피지 띠·제비꼬리 `clip-path`·Cinzel 웹폰트 `public/fonts/Cinzel.woff2` 대신 ttf를 그대로 `@font-face`로, 파일 하나).
- 검증: `look.py pack-intro-med`·`pack-gaul-52` 캡처(두 겹 테·두 줄 이름표), 라벨 충돌 수 전후 비교(`look.py`의 라벨 목록 길이), 초기 JS.

### II-2 말 v2 + 군단 무리
- `token3d.ts pieceMesh`에 깃대(원기둥 h1.1 r0.03 먹색, 말 뒤 -z)·깃발(평면 0.5×0.34, 세력색; 문장 있으면 텍스처)·명패(평면 0.3×0.12, 캔버스 텍스처에 로마 숫자). `createToken` 옵션 `{ emblem?: string | null }`. `setLegions(n)`: 명패 갱신 + 무리 재생성(n ≤ 12, 작은 말 = 받침+몸통 r0.22, 4열 간격 0.55, 장군 뒤).
- `render()`에서 `cluster.visible = map.getZoom() >= 6`.
- `engine.ts syncPeopleTokens`: `createToken(…, { emblem: PACK_EMBLEMS.has(p.faction) ? \`${root}assets/emblems/${p.faction}.png\` : null })`, 매 동기화마다 `t.setLegions(p.legions ?? 0)`.
- 검증: `pack-gaul-52`(카이사르 10군단)·`pack-greece-48`(카이사르 8·폼페이우스 11) 캡처 + `__ca` 훅으로 무리 수 읽기. token3d 청크 크기.

### II-3 배너 카드
- `src/app/BannerCard.tsx`: props `{ map, person: PersonAt, legion, root, dark }`. 위치는 `map.project(person.at)` 오른쪽 위(+40, -60), `move`마다 갱신. 내용: 방패꼴 초상(`clip-path: polygon`), 이름판(한글, `name_la`는 그래프 노드에 있으면), 군기(세력색 + 문장), `N군단 · 병력`, 「그 해」 한 줄. 발표 모드·일반 모드 모두 **선택에만**.
- App: `s.sel`이 `person:`이고 `people.find(p => p.id === s.sel)`이 있으면 띄운다(지연 청크). 좁은 화면은 시트가 있으니 안 띄운다.
- 검증: pack-greece-48에서 카이사르 선택 → 카드 캡처, HUD·알약과 경계 상자 겹침 0(계측).

### II-4 §E 확인 + 문서
- `scripts/look-skins.py`: 다섯 스킨 × 두 테마 캡처 10장, `.shell-year` 글자색 대 바탕 픽셀 명암비.
- BACKLOG R51 ●·§E ●, MODELS.md(말 v2·카드), HANDOFF·00-START, 볼트 주간·handoff.
