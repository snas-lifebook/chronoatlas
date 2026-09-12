# 카이사르 팩 지도 — 요구와 인수인계

작성 2026-09-13. 2회차 발표 「로마토탈워: 카이사르 팩」에서 크로노아틀라스를 라이브로 띄우기 위한 슬라이스.

**이 문서가 이 슬라이스의 정본이다.** 전체 제품 요구는 [BACKLOG](BACKLOG.md), 레포 현황은 [HANDOFF](HANDOFF.md). 세 문서가 어긋나면 BACKLOG의 R번호가 이기고, 이 슬라이스의 세부(장면·말·교보재)는 여기가 이긴다.

볼트 요청 원문: `Projects/인생책_읽기_편데/Production/2026-09_제작_로마쇠망사_카이사르팩/notes/20260911_요청_크로노아틀라스_발표북마크.md`

---

## 0. 30초

- **라이브(원격)는 아직 9/12 커밋 `b53d1da`다.** 장기말·연도 구간 제목·폼페이우스 교보재 경로, 그리고 9/13 정지 이미지 작업은 **로컬 커밋까지만** 되어 있다. 푸시하지 않았다.
- **정지 이미지 아홉 장은 나왔다** (2026-09-13, §9). `bash scripts/serve.sh` → `python3 scripts/shoot-pack.py`.
- 맵은 하나다. `https://snas-lifebook.github.io/chronoatlas/?present=1&scene=pack-intro-med` (배포 후). 지금은 로컬 `http://127.0.0.1:4180/chronoatlas/?present=1&scene=pack-intro-med`.
- **`layers=`가 URL에 있으면 장면 레이어를 덮어쓴다.** 옛 링크 `layers=territory,admin_regions,settlements,relief,rivers,labels`는 인물·경로·전투가 꺼진 채 열린다. 공유는 `?present=1&scene=pack-…`만.
- 숫·좌표·군단 수를 지어내지 않는다. `public/datasets/`를 손으로 안 고친다. `npm run adapt`은 River `migrate_v2.py --write` 대기.

---

## 1. ID가 두 갈래다

볼트 요청 노트가 R41~R43을 썼는데, 레포 BACKLOG R41은 **다른 요구**(미시 전투 시뮬, 인스타 릴)다. 섞지 마라.

| 볼트 요청 노트 | 레포 BACKLOG | 무엇 |
|---|---|---|
| (이름만 R41) 북마크 아홉 | **R42** | 2회차 발표 장면 아홉 + 라이브 점프 |
| (이름만 R42) 발표 모드 | **R43** | `?present=1` · `F` · `[` `]` |
| (이름만 R43) 즉석 북마크 | **R44** | 브라우저 localStorage. **안 함** |
| — | **R41** | 미시 전투 시뮬 톤. 릴 스크린샷 없음. **손대지 말 것** |
| 2026-09-13 구두 | **R45** | 연도 구간 북마크 · 장기말+이름 · 경로/도시/전투/적장 최종 위치 · 공유 링크 |

---

## 2. 요구 원장 (이 슬라이스)

상태: ● 됨 · ◐ 부분(근거 있음) · ○ 안 됨. ●는 실측 없이 쓰지 않는다.

### 2.1 발표 골격 (9/11 요청 → 9/12 `b53d1da`)

| # | 요구 | 상태 | 근거 |
|---|---|---|---|
| R42 | 에셋 사양서 B절과 같은 아홉 장면을 `group: 2회차 발표 · 카이사르 팩`으로 | ◐ | 아홉 id가 `data/scenes/rome.json`에 있다. 라이브는 이 커밋까지. 워킹트리에서 제목에 연도 구간을 넣음 |
| R43 | 크롬을 숨기고 `[` `]`로 같은 그룹만 순환. `n / 9` | ◐ | `src/present.ts` · `F` 토글. 검증 HUD `1 / 9` `2 / 9` `5 / 9` `6 / 9` |
| R44 | 커밋 없이 즉석 북마크(localStorage) | ○ | 손 안 댐 |
| — | 정지 이미지 아홉 장 백업 | ● | 2026-09-13 완료. `scripts/shoot-pack.py` · 3840×2160 · 아래 §9 |
| — | 말은 북마크 점프 때 경로를 걷는다(~1.2s) | ◐ | `token3d` `ANIM_MS=1200`. 경로 있는 인물만 |

### 2.2 고쳐 달라던 버그 (9/13 오전)

| 증상 | 원인 | 상태 |
|---|---|---|
| 입체 보기(`V`)가 안 됨 | 판도 장면 `pitch: 0`인데 view가 3d로 남음 → `moveend`가 입체 각도를 0으로 기억 | 워킹트리. `viewOfScene` · `rememberPitch3d`(pitch&lt;15 버림) |
| 영역이 깨짐 | 갈리아 교보재 8점 폴리곤이 BC51 이전 **모든 해**에 Cliopatria를 덮음 | 워킹트리. `showGalliaOverlay`는 `pack-extent-60`만 |
| 사건 설명·등장인물이 안 뜸 | 발표 모드가 인스펙터를 숨기고, 1100px 아래에선 「그 해」도 숨김. 장면 `note` 없음 | 워킹트리. HUD에 제목·note·말·그 해. 선택 있으면 오른쪽 인스펙터 |
| 카이사르·주변 그래픽 | 60km 원뿔 + 작은 초상 뱃지 | 워킹트리. 뱃지 제거. 3D 장기말 + 이름 항상 |

### 2.3 지도에 무엇을 그릴지 (9/13 오후, R45)

원문 요약: 북마크는 **BC 몇년~몇년**. 그 구간에 카이사르 이동 경로, 주요 도시, 주요 전투, 적장 **최종** 위치, 같이 있는 사람, 동시대 위치를 **장기말로**. 뱃지는 작고 안 멋짐. 이름 띄울 것. 맵 프로그램은 하나. 링크를 걸면 남도 연다.

| # | 요구 | 상태 | 메모 |
|---|---|---|---|
| R45a | 북마크 제목에 연도 구간 | ◐ | 예: `갈리아 원정 · BC 58–51`. 지도 연도는 그 구간의 키 해(알레시아 -52, 파르살루스 -48) |
| R45b | 카이사르 경로 | ◐ | 어댑터 `route=caesar`. 지나온 구간만 실선(`to_year <= year`). BC52는 `from_year` 출발점(알레시아) 예외 |
| R45c | 주요 도시 이름 | ◐ | 발표 줌에서 rank 3이 안 떠 `PACK_PLACES` 레이어를 따로 켬 |
| R45d | 주요 전투 | ◐ | 정본 battles는 이 구간에 암살 하나. 교보재 `data/overlays/pack-battles.json`(정본 `_routes/caesar.geojson` 정점) |
| R45e | 적장 최종 위치 | ◐ | BC48 폼페이우스 = 알렉산드리아(`located_in`). 교보재 경로로 BC49 에페이로스 |
| R45f | 동행·동시대 장기말 | ◐ | `peopleAtYear` + 같은 장소 고리 벌림(`unstack`) |
| R45g | 장기말 + 이름 (뱃지 금지) | ◐ | `src/token3d.ts` 팔각+받침+머리. 줌 보정 `tokenMeters`. 라벨 overlap 허용 |
| R45h | 한 맵 · 공유 URL | ◐ | 코드는 한 앱. **layers를 URL에 박으면 장면이 진다** — 공유 규칙 §0 |
| R45i | 디자인 레퍼런스 | ● | 아래 §5. 구현에 반영한 것과 버린 것을 적음 |

완료 조건(요청 원문, 아직 전체는 못 닫음): 리허설에서 아홉 번 눌러 3초 안에 뜰 것. 각 장면에 영역·도시·경로·전투·말이 빈 지도가 아닐 것. 화살표만으로 아홉을 통과.

---

## 3. 장면 아홉

`data/scenes/rome.json` · `group: 2회차 발표 · 카이사르 팩`. `[` `]` 순서 = 파일 순서.

| id | 제목 (워킹트리) | year | view | 켜는 레이어 | 그 해에 말이 서는 근거 |
|---|---|---|---|---|---|
| pack-intro-med | 지중해 판도 · BC 60 | -60 | 2d | 영토·속주·도시·인물 | 폼페이우스·크라수스 `ruled` 로마. 카이사르는 위치 근거 없음 → 안 그림 |
| pack-gaul-52 | 갈리아 원정 · BC 58–51 | -52 | 3d | 영토·도시·경로·전투·인물 | 카이사르 경로 출발점 알레시아. 베르킹게토릭스 교보재 `pack-cast` |
| pack-extent-60 | 판도 · BC 60 | -60 | 2d | 영토·속주 + 갈리아 점선 | 말 없음(의도). 갈리아 오버레이 **여기만** |
| pack-extent-51 | 판도 · BC 51 | -51 | 2d | 영토·속주 | 말 없음. Cliopatria 100년 버킷이라 60과 면이 같을 수 있음 |
| pack-rubicon | 루비콘 · BC 49 | -49 | 3d | 영토·도시·경로·전투·인물 | 카이사르 `located_in` 루비콘(경로의 일레르다를 이김). 폼페이우스 교보재 경로 → 에페이로스 |
| pack-greece-48 | 그리스 내전 · BC 49–48 | -48 | 3d | 동 | 카이사르 경로 파르살루스. 폼페이우스 `located_in` 알렉산드리아(그 해 최종) |
| pack-egypt-47 | 이집트 · BC 48–47 | -47 | 3d | 동 | 카이사르 경로 젤라(정본 세그먼트). 클레오파트라는 `ruled` 알렉산드리아 |
| pack-extent-44 | 최대 판도 · BC 44 | -44 | 2d | 영토·속주·도시 | 카이사르 경로 종료(`to_year -45`) 후 암살 `occurred_at` 마르스 광장으로 rel |
| pack-augustan-27 | 제정 · BC 27 | -27 | 2d | 영토·속주 | 이 팩 범위 밖 말 없음 |

실측 스크린샷(워킹트리, 포그라운드 Chrome `127.0.0.1:4180`):

- `docs/verify/pack-gaul-52.png` — BC52 알레시아 말 둘 · 포위전 점 · HUD
- `docs/verify/pack-rubicon.png` — BC49 루비콘 말 · 갈리아에서 온 선 · 일레르다 점
- `docs/verify/pack-greece-48.png` — BC48 파르살루스 말 · 디르하키움·파르살루스 점
- `docs/verify/pack-intro-tokens.png` — 초상 뱃지 시절(이름만 로마). **장기말 재빌드 전**

---

## 4. 코드 지도 (이 슬라이스가 만진 것)

| 파일 | 역할 |
|---|---|
| `data/scenes/rome.json` | 아홉 장면. 사람이 편집 |
| `data/overlays/gallia-free.json` | 자유 갈리아 3속주. `pack-extent-60`만 |
| `data/overlays/pack-pompey.json` | 폼페이우스 경로 교보재. 정본 `_routes/pompey.geojson` 정점, **BC49부터만**(그 전을 넣으면 BC60에 예루살렘에 선다) |
| `data/overlays/pack-battles.json` | 전투점 교보재. 정본 `_routes/caesar.geojson` 정점 |
| `data/overlays/pack-cast.json` | 베르킹게토릭스 → 알레시아 -52. 사건 `occurred_at`이 없어 교보재로 잇는다 |
| `src/packData.ts` | 위 셋 + `PACK_PLACES` glob |
| `src/present.ts` | 그룹 순환 · 갈리아 게이트 |
| `src/people.ts` | 위치 규칙 7개(파일 머리). located_in > 경로 > 교보재 > ruled/participated_in+occurred_at. `unstack` |
| `src/schema.ts` | `positionByRoute`: 원정 끝나면 null. 카이사르 첫 구간만 `from_year==year` 출발점 |
| `src/token3d.ts` | 장기말 메시 · `tokenMeters(zoom)` · 경로 보간 1.2s |
| `src/map/engine.ts` | 말은 people 레이어가 드라이브. 뱃지 원 히트박스만. 경로 필터 `to_year<=year` |
| `src/state.ts` | `Scene.view` · `viewOfScene` · `rememberPitch3d` |
| `proposals/20260913_alesia_occurred_at.jsonl` | 정본에 사건·장소는 있고 링크만 없음 |

테스트: 전체 **176**. 이 슬라이스 `test/people.test.ts` · `token-route.test.ts` · `present.test.ts` · `token-color.test.ts`.

초기 JS **399.62 kB gz** (예산 400). 한 줄만 더 실리면 깨진다.

---

## 5. 디자인 결정 (R45i)

가져온 것:

- **Rome: Total War 캠페인 맵** — 장군은 3D 말 + 이름. 배너는 줌과 무관하게 읽힌다 → `tokenMeters`가 낮은 줌에서 말을 키움.
- **미나르 1812** — 지나온 길만. 병력 수는 필드가 없어 굵기를 안 바꿈.
- **장기 실물** — 탑다운에서 팔각+받침이 알로 읽히게. pitch면 폰 실루엣.
- **자석** — 같은 칸 겹침은 고리로 벌림. 정치체 스냅은 기존 `containingPolity`(인스펙터).

버린 것:

- **초상 뱃지** — 줌 4에서 ~10px. 요청이 명시한 실패.
- **캔버스 텍스처로 말 위에 글자** — MapLibre와 GL 컨텍스트를 나눠 쓰면 말이 안 그려졌다. 이름은 MapLibre 심볼.
- **국가 로고/SPQR 방패** — 정본 자산 없음. 가짜 문장은 P2(지도 유채색은 데이터 색뿐)를 깬다. 영역색+지명.
- **미나르식 두께** — 군단 수 필드 0.
- **거리 비례 행군 시간** — 지중해를 10초 기면 발표가 죽는다. 고정 1.2s.

---

## 6. 데이터 한계 (adapt 전)

정본 온톨로지에는 `_routes/caesar.geojson`(11정점) · `pompey.geojson`이 있다. 어댑터 산출 `public/datasets/rome/layers/movements.geojson`은 카이사르만, 첫 세그먼트 `from_year=-52`인데 `valid_from=-49`. 전투 GeoJSON은 이 구간에 `카이사르암살` 하나.

그래서 교보재(`teaching: true`)로 정본 **정점 좌표를 복사**해 올렸다. 좌표를 지어내지 않았다. adapt가 살아나면 교보재는 걷어내고 산출물을 쓰면 된다.

크라수스는 온톨로지가 로마 통치를 -71~-49로 줘서, 전사(-53 카르하이) 뒤인 BC52에도 로마에 선다. 죽은 해를 지어내 지우지 않았다.

갈리아 내부 행군(게르고비아 등) 세그먼트는 정본 경로에도 알레시아 한 점뿐이다.

---

## 7. 이어받는 사람

```
cd ~/Projects/chronoatlas
git log --oneline -5          # 원격 끝은 b53d1da 일 가능성 큼
git status                    # 워킹트리에 팩 패치가 있으면 그게 이 문서의 ◐
npm run build                 # 400kB 게이트. postbuild가 워커를 복사한다
```

스모크: `mkdir -p /tmp/smoke && ln -sfn ~/Projects/chronoatlas/dist /tmp/smoke/chronoatlas && cd /tmp/smoke && python3 -m http.server 4180`

검증 창(자동화 탭 금지, `document.hidden`이면 지도가 안 뜸):

```
open -na "Google Chrome" --args --remote-debugging-port=9222 \
  --user-data-dir=/tmp/ca-chrome --no-first-run \
  "http://127.0.0.1:4180/chronoatlas/?present=1&scene=pack-intro-med"
```

발표 키: `F` 발표 · `[` `]` 장면 · `V` 입체. 스페이스는 **연도 재생**이라 발표 중에 누르면 해가 5년씩 뛴다.

커밋 메시지 후보(아직 하지 말 것 — River가 배포를 말할 때):

```
feat(발표): 카이사르 팩 장기말·연도 구간·교보재 경로
```

포함할 것: §4 파일 + `docs/verify/pack-*.png` + 이 문서 + BACKLOG R42~R45 줄. `public/datasets/`는 넣지 말 것.

### 다음에 집을 수 있는 것

1. **River가 푸시를 말하면** 위 커밋 → Pages. 그 전엔 라이브가 구버전이다.
2. **자막 버그** — BACKLOG 2026-09-12. `nearest`에 거리 상한. 이 팩과 무관, 선행 없음.
3. **파르살루스 말판 장면 등록** — 보드는 있고 `group: 말판` 장면이 없음.
4. **R44 즉석 북마크** — 요청은 있으나 손 안 댐.
5. 집지 말 것: adapt, `public/datasets/` 손편집, R41 미시 시뮬, 군단 수, 국가 로고, Hunyuan3D.

### 막힌 것 (River)

`migrate_v2.py --write` → `npm run adapt`. 그 뒤에야 카이사르 `valid_from`, 폼페이우스 경로, 알레시아 `occurred_at`이 산출물에 들어온다. 제안 파일은 `proposals/20260913_alesia_occurred_at.jsonl`.

---

## 9. 정지 이미지 아홉 장 (2026-09-13)

`python3 scripts/shoot-pack.py` — 떠 있는 포그라운드 Chrome(9222)에 playwright가 CDP로 붙어
**맨 캔버스만** 읽는다. 1920×1080 @ dsf 2 = **3840×2160**, 16:9 정확. 납품은 볼트
`assets/지도/*_v1.jpeg`, 작업 원본은 `docs/verify/shot/*.png`, 층 개수는 `_shot.json`.

앱의 툴바 PNG 버튼을 쓰지 않는다 — 하단 띠에 연도·범례·출처를 합성해 굽는다(`src/export/png.ts`).
캔버스만 읽으면 HUD·인스펙터가 **구조적으로** 안 들어온다(DOM이라서). 장기말은 MapLibre
custom layer라 같은 캔버스에 그려져 같이 담긴다.

| # | 파일 | 층 |
|---|---|---|
| 1 | `intro_지도_지중해판도_BC60_v1` | 영 속 도 · 말 2(폼페이우스·크라수스) |
| 2 | `M2_지도_갈리아원정_BC52_v1` | 영 도 전 말 2(카이사르·베르킹게토릭스) |
| 3 | `M2_지도_판도_BC60_v1` | 영 속 + 갈리아 초록 점선 |
| 4 | `M2_지도_판도_BC51_v1` | 영 속 + 갈리아 **로마색** |
| 5 | `M3_지도_루비콘_BC49_v1` | 영 도 경 전 말 |
| 6 | `M3_지도_그리스내전_BC48_v1` | 영 도 경 전 **말 4** — 카이사르·폼페이우스·클레오파트라·프톨레마이오스 |
| 7 | `M4_지도_이집트_BC47_v1` | 영 도 경 전 말 3 |
| 8 | `M4_지도_판도_BC44_v1` | 영 속 도. 이집트는 아직 프톨레마이오스(청록) |
| 9 | `epilogue_지도_제정_BC27_v1` | 영 속. **이집트가 로마색** — 판도가 실제로 다르다 |

아홉 장 md5 전부 다르다. 3·4번은 카메라가 픽셀 단위로 같고 **차이가 갈리아 한 덩이에만**
갇힌다(x 14~32%, y 9~41%) — 비교 두 컷의 요건.

### 이번에 고친 것 여섯

1. **`layers=` 함정이 실제로 세 장을 죽였다.** 9/12 캡처의 `_못만든것/ca_02`·`ca_05`는 코드
   버그가 아니라 §0이 경고한 그 URL이었다. 인물·경로·전투가 꺼진 채 열려 **영역과 도시 점만
   있는 빈 지도**가 나왔다. 판도 장은 territory·admin만 필요해서 같은 URL로도 살았다.
   캡처 URL은 `?present=1&scene=…&skin=campaign`까지만.
2. **장기말이 땅에 누워 있었다.** `token3d`의 `group.rotation.x`가 `-π/2`였다. 모델 행렬이
   y를 뒤집어 쓰므로(`.scale(s,-s,s)`) 부호는 `+`여야 한다. 아홉 장이 아니라 **9/12 캡처
   넷이 전부** 받침에서 머리로 가는 물방울 얼룩이었다. 세우니 팔각 폰 실루엣이 나온다.
3. **판도 BC51이 BC60과 바이트까지 같았다**(md5 `f88797a9…`). Cliopatria 100년 버킷.
   `gallia-free` **같은 폴리곤**을 로마색으로 한 겹 더 얹어 풀었다(`present.showGalliaRoman`).
   폴리곤을 새로 만들지 않은 것이 요점 — 두 컷의 기하가 동일함이 보장된다.
4. **라벨이 뭉개졌다.** `people-label`이 `text-ignore-placement: true`라 충돌 색인에 안
   올라가서, 전투·도시 이름표가 인물 이름 위에 겹쳐 찍혔다. `false`로 바꾸고(allow-overlap은
   유지 — R45g) 전투·도시 라벨에 `text-variable-anchor`를 줘 비켜 가게 했다.
5. **같은 칸의 말이 포개졌다.** `unstack`이 ①`place ?? 좌표`로 묶어서 **같은 자리인데 근거가
   다른 두 사람**(경로 기반 카이사르 place=null vs 교보재 베르킹게토릭스)을 못 묶었고,
   ②벌림이 0.32도 고정이라 넓은 줌의 말 폭(≈230km)보다 훨씬 작았다. 좌표로만 묶고
   `spreadDeg(zoom)`으로 화면 기준 벌림을 쓴다. 고리 시작을 **동쪽**으로 돌려 남북이 아니라
   동서로 벌린다(남북이면 위 말 이름이 아래 말 몸통에 묻힌다).
6. **먼 대서양이 검게 나왔다.** DEM 타일이 없는 경도 −15 서쪽은 캔버스가 **투명**이다.
   화면에서는 페이지 배경이 받쳐 줘 안 보이지만 캔버스만 떠서 RGB로 눕히면 검어진다 —
   판도 다섯 장이 각각 122,981픽셀씩 그랬다(같은 카메라라 수치까지 동일). 캡처 때
   `campaign` 바다색 `#C7D2CB`을 깔고 합성한다. 앱은 안 고쳤다 — 화면에는 결함이 없다.

### 고증으로 걷어낸 것 둘 (연도를 지어내지 않았다)

- **크라수스가 BC52·49에 로마에 서 있었다.** 정본 `ruled 로마 -71..-49`가 굵어서다. 정본
  `links.jsonl`의 `카이사르 allied_with 크라수스`와 `폼페이우스 allied_with 크라수스`가
  **둘 다 `to_year -53`**(카르하이)이라, 그 두 링크를 근거로 `pack-cast.json`의 `gone`에
  넣었다. 정본에 카르하이 사건도 사망 필드도 없다.
- **BC48 지도에 「콘스탄티노플」이 떴다.** 정착지 220개에 연도 필드가 **하나도 없어서**
  어느 해를 띄워도 다 뜬다. `pack-anachronisms.json`에 확실히 후대인 이름만 넣어 가린다
  (콘스탄티노플 AD 330 · 「로마 제국」은 제정 BC 27부터). 정착지에 연도가 들어오면 걷어낸다.

### 남은 흠

- **6번에 말이 넷이다.** 사양서는 「말 두 개」(쫓는 카이사르·쫓기는 폼페이우스)를 말하는데
  BC48 알렉산드리아에 클레오파트라·프톨레마이오스도 같은 해 근거로 선다. 사실이고 7번을
  예고하지만, 아래 38%(대사창 자리)까지 내려온다. 카메라를 더 조이면 폼페이우스가 화면 밖이다
- **프톨레마이오스 13세가 BC47 지도에 산다.** 실제로는 BC47 초 나일강에서 익사. 정본에
  사망 근거가 없어 `gone`에 못 넣었다 — 크라수스와 달리 **끝 연도를 주는 링크가 없다**
- 2번에 카이사르 경로선이 없다. 정본 경로의 BC52 구간이 알레시아 한 점뿐이다(§6)

---

## 8. 이 세션에서 하지 않은 것

- 푸시 (커밋은 했다 — River가 배포를 말할 때 Pages로)
- R44 localStorage 북마크
- 파르살루스 말판을 발표 그룹에 넣기
- 정본 JSONL 수정
- 산스 아트 트랙(초상·씬 jpeg). 그건 볼트 `.agent/handoff.md`의 다른 에이전트 몫
