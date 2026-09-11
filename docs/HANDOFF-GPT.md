# 인수인계 패킷 — 다른 계열 에이전트로 세션을 옮길 때

작성 2026-09-11 · 대상: Claude 계열이 아닌 에이전트(GPT Astra 등)가 이 프로젝트를 처음 이어받을 때

**정본은 `docs/HANDOFF.md`다.** 이 문서는 그것을 대체하지 않는다. 여기에는 **레포 안에 안 적혀 있는 것**만 있다 — 용어, 못 하는 일, 문서 계보, 판단 관례, 인수인계 절차.

---

## 0. 30분 안에 읽을 순서

1. `docs/HANDOFF.md` — 현재 상태·폴더 지도·환경 함정·열린 작업
2. `docs/BACKLOG.md` — **요구 정본.** R01~R40, 라운드 A~H
3. `AGENTS.md` — 빌드·MCP·하지 말 것
4. 이 문서 §3(용어) · §4(못 하는 일) · §6(관례)
5. 볼트 `Works/비주얼파이프라인/SPEC.md`의 F 목록

그 다음 `npm i && npm run build`가 초록인지 확인하고 시작한다.

---

## 1. 이 프로젝트가 무엇인가

**크로노아틀라스** — 에드워드 기번 『로마제국쇠망사』를 500여 명 스터디(산스·인생책 편데)에서 읽기 위한 **온톨로지 중심 인터랙티브 역사 지도.**

정본 온톨로지 650객체를 실제 지리 위에 올린다. 연도 슬라이더를 옮기면 영토·도시·전투·원정로가 다시 그려지고, 객체를 고르면 옵시디언 그래프뷰식 패널에 1~2홉 관계가 뜬다. 3D는 카메라 기울이기가 아니라 실제 DEM 기하다.

- **라이브**: <https://snas-lifebook.github.io/chronoatlas/>
- **레포**: `snas-lifebook/chronoatlas` (로컬 `~/Projects/chronoatlas`)
- **품질 기준**: "UXUI를 배포하고 구독으로 돈을 받을 정도" — 실제 판매는 안 한다. 레퍼런스 Esri·Mapbox
- **최종 지향**: 팔란티어형 학습 프로그램. 연도를 옮기면 그 시점의 영토·관계·관직·재산까지 보이는 것

**성능 헌법이 하나 있다.** River의 2026-08-13 원문: 「무거운 실시간 연산은 필요 없고 그렇게 "보여지기만" 하면 된다.」 → **실시간 시뮬레이션 엔진을 만들지 마라.** 미리 구운 데이터를 시간축 위에서 다시 그리는 것으로 충분하다.

---

## 2. 문서 계보 — 무엇이 무엇의 정본인가

문서가 여럿이라 헷갈린다. 충돌하면 아래 표의 「정본」이 이긴다.

| 문서 | 무엇의 정본 | 위치 |
|---|---|---|
| `CONSTITUTION.md` | **규칙.** 다른 모든 것보다 위 | 볼트 `Works/비주얼파이프라인/` |
| `SPEC.md` | **기능** F1~F26 + 상태 | 볼트 |
| `SCHEMA.md` | 온톨로지 스키마 | 볼트 |
| `DESIGN.md` | 디자인 반려 조건 P1~P17 | 볼트 |
| `TASKS.md` | 작업 단위 Phase/라운드 | 볼트 |
| **`docs/BACKLOG.md`** | **요구** R01~R40. "River가 무엇을 요구했나" | 레포 |
| `docs/HANDOFF.md` | **현재 상태**. 매 세션 갱신 | 레포 |
| `docs/RUNBOOK-*.md` | 절차(사람이 실행할 명령) | 레포 |
| `docs/roadmap.md` | 6개 축 + 소스·라이선스 표 | 레포 |
| `AGENTS.md` | 빌드·MCP·금지 요약 | 레포 |
| `Context/비주얼파이프라인_프롬프트_원문.md` | **River가 실제로 친 말** | 볼트 |
| `프롬프트_원문.md` | 1부 온톨로지 / 2부 자료실 원문 | `~/project/active/decline-and-fall-of-the-roman-empire/` |

**F와 R의 차이가 핵심이다.** F는 "무엇을 만들었나", R은 "무엇을 요구받았나". 무엇을 할지는 **R에서 고른다.** F 목록 순서를 따라가면 이미 잘 되는 축에 또 붓게 된다(2026-09-10에 실제로 그랬다).

볼트 경로:
```
~/Library/Mobile Documents/iCloud~md~obsidian/Documents/River's Second Brain/
  Efforts/Notes/산업스터디/Projects/인생책_읽기_편데/
    Works/비주얼파이프라인/          ← 크로노아틀라스 정본
    Books/로마제국쇠망사/ontology/   ← 정본 JSONL (ONTOLOGY_DIR)
```

---

## 3. 용어 — 직역하면 틀린다

| 말 | 뜻 | 주의 |
|---|---|---|
| **정본** | 단일 진실 원천(canonical source). 볼트의 `ontology/*.jsonl`과 설계 문서 | "원본"이 아니다. **에이전트가 쓰지 못하는 것**이라는 함의가 붙어 있다 |
| **원장** | 요구사항 대장(ledger). `docs/BACKLOG.md` | 회계 장부처럼 **닫을 때마다 근거를 적는다** |
| **제안 / proposals** | 정본을 고치고 싶을 때 내는 파일 `proposals/*.jsonl` | River가 승인해야 정본에 들어간다. 에이전트가 정본을 직접 못 고치는 우회로 |
| **버킷** | 100년 단위로 자른 영토 파일 `layers/territory/<from>.geojson` | 전 구간 한 파일은 26MB라 초기 예산(1MB)을 깬다 |
| **스킨** | 지도 색 프리셋 5종(light·dark·oldmap·press·campaign) | CSS 테마가 아니다. MapLibre 스타일 전체 교체 |
| **말판** | 보드게임 판. 사람이 유닛을 놓고 옮기는 층 | `data/boards/*.json`. **정본과 분리한다** — 사실 주장이 아니라 교보재 |
| **자석** | 유닛을 지리에 스냅시키는 UX | 2단계: territory 폴리곤(어느 나라) → settlement(어느 도시) |
| **세력 / actor** | 정본 팔레트의 8세력(로마·카르타고·그리스계…) | **정치체(polity)와 다르다.** 프톨레마이오스·셀레우코스가 전부 「그리스계」로 뭉개진 것이 R32의 원인 |
| **포인트** | 『30포인트로 읽는 로마제국쇠망사』의 각 장 | 1~30. 객체의 `points` 필드가 이걸 가리킨다 |
| **편데** | 「인생책 편데」 — 스터디 프로그램 이름 | 고유명사. 번역하지 마라 |
| **자료실** | 별개 프로젝트(읽기 사이트). 지도와 왕복 딥링크로 연결 | `Works/로마쇠망사_자료실/` |
| **래칫** | 린트 baseline. 새 오류만 실패시킨다 | `scripts/lint.baseline.json` |

---

## 4. 이 에이전트가 **못 하는 일**

시도하다 시간을 버리지 마라. 전부 실측으로 확인된 것이다.

| 못 하는 것 | 왜 | 대신 |
|---|---|---|
| **정본 `ontology/*.jsonl` 쓰기** | CONSTITUTION 0-3 | `proposals/*.jsonl`로 제안 |
| `public/datasets/` 손으로 고치기 | 어댑터 산출물이다 | `scripts/adapt.ts`를 고친다 |
| AWS·Zenodo·Stanford·ArcGIS 등에서 데이터 받기 | 샌드박스·Cowork VM egress 차단 | **River 터미널.** RUNBOOK으로 명령을 넘긴다 |
| River의 Terminal.app 조작 | 터미널·IDE는 "보기+클릭" 등급, 타이핑 차단 | 명령을 정리해 붙여넣게 한다 |
| 샌드박스에서 fps·프레임 측정 | swiftshader 소프트웨어 렌더링. hillshade 켜면 프레임당 3~4초 | 데이터 갱신만 따로 잰다(연도 스크럽 24스텝 = 115ms가 실측치) |
| 카피레프트 데이터 번들 | ODbL·GPL·CC BY-SA | 참조만. 번들은 **PD와 CC BY만** |

**egress 허용 목록**(2026-09-09 실측): `raw.githubusercontent.com` · `api.github.com`(레포 스코프만) · `files.pythonhosted.org` · `registry.npmjs.org`. 그 외는 막혔다고 보면 된다.

---

## 5. 지금 상태 스냅샷 (2026-09-11)

`HEAD = ba37e5c` · 워킹트리 깨끗 · 배포 살아 있음

**닫힌 라운드**: E(북마크) ● · F(그 해의 인물·국가·사건) ● · H(데이터 결손) ◐ 코드만 · G(말판) ◐ 스키마·칸나이·자석

**남은 것**:
- **A 지도 범위 확대** — 준비 끝(`docs/RUNBOOK-extent.md`, `scripts/extent.ts`로 BBOX 일원화). **River 터미널 실행 대기**
- **B·C·D** — A를 기다린다(세력 실명 / 경계 부드럽게 / LOD 재설계)
- **G 나머지** — 렌더. 지금도 가능
- **R40** 도시·전투 국지 뷰 — A 이후

**River 한 줄이 셋을 푼다**: `migrate_v2.py --write` → `npm run adapt`이 살아나면 H의 연도 3건·battles id 중복·장면 파일이 한꺼번에 산출물에 반영된다. 지금은 코드만 고쳐 두고 테스트에 지뢰를 심어 둔 상태.

**결재 대기**: `proposals/` 3건(연도 3건 · 악티움 place · resource/terrain 7건) + 팔레트 제안(페르시아 `#2F5DA8` · 이슬람세력 `#8E3A6B` · 유목민 `#6E7A22` — 승인 전까지 셋 다 회색)

---

## 6. 일하는 관례

이 프로젝트에서 **판단을 틀리게 만드는 습관**들이 있다. 앞선 세션들이 실제로 밟은 것만 적는다.

**근거 없이 ●로 바꾸지 마라.** 요구를 닫을 때는 실측 수치·스크린샷 경로·테스트 이름을 함께 적는다. `roadmap.md`가 "자원 정보 완료"라고 적어둔 채 실제로는 필드가 빠져 있던 회귀가 이 규칙이 없어서 생겼다.

**수치 프로브보다 렌더 결과가 진실이다.** `queryTerrainElevation`이 0을 뱉어서 "DEM이 죽었다"고 오진할 뻔했는데 스크린샷에는 알프스가 멀쩡히 솟아 있었다. Playwright로 찍고 **실제로 이미지를 봐라.**

**지어내지 마라 — 이게 이 프로젝트의 제1 감수성이다.** 신뢰도 값, 한글 이름, 고도 스케일, 인구, 중요도 순위. 한글 이름이 없으면 원문(라틴·영문) 그대로 둔다. 스케일 미상 bump map으로 고도를 만들지 않는다. 순위를 매기려면 **규칙을 먼저 문서에 적고** 그 규칙대로 계산한다.

**증상이 아니라 원인을 고친다.** "영토가 안 보인다" → 데이터 0건 → 이식 누락. "3D가 평면" → 과장 배수. 한 겹 더 내려가라.

**커밋 메시지는 한국어로 "무엇을 왜".** 증상과 원인을 같이 적는다. 이 레포의 커밋 로그가 디버깅 지식의 실질적 저장소다.

**3단계 이상 작업은 마일스톤으로 끊고 River 확인을 받는다.** 설계 결정이 필요하면 **선택지 2~3개 + 트레이드오프 한 줄씩**을 내놓고 River가 방향을 잡으면 그대로 실행한다.

**붙여넣기용 명령에 인라인 `#` 주석 금지.** zsh는 기본적으로 `#`을 주석으로 안 본다. `npm run x   # 730장`이 `zsh: unknown file attribute: ~`로 죽는다.

**River에게 쓰는 말투**: 친구에게 말하듯, 핵심 먼저, 장황하지 않게. 한국어. 기술 용어(함수명·라이브러리명·에러 메시지)는 영어 그대로.

---

## 7. 알려진 함정 (재발 방지)

**MapLibre 6**
- 소스에 `promoteId`가 없으면 `feature-state` hover/selected/디밍이 **전부 무효**가 된다. 조용히 안 된다
- 같은 id를 가진 피처가 둘이면 한쪽에 hover했을 때 다른 쪽도 같이 반응한다
- `setStyle`은 소스·레이어를 지운다 → 스킨 전환마다 데이터 재구축이 돈다. 리스너를 그 안에서 걸면 쌓인다
- `ResizeObserver` 첫 콜백을 버리면 숨긴 컨테이너에서 400×300에 고착
- MultiPolygon은 부분마다 심볼 라벨이 붙는다 → 최대 부분 무게중심 Point 하나만 라벨
- `queryTerrainElevation`은 여기서 **늘 0**. 고도가 필요하면 `src/map/elevation.ts`처럼 타일을 직접 디코딩
- `raster-dem` `encoding`을 잘못 주면 고도가 -51767m로 나온다(terrarium | mapbox)
- 자동화 탭에서 `document.hidden=true`면 rAF가 멈추고 `map.on('load')`가 영영 안 fire한다. JS 에러 0·WebGL 정상이라 코드 버그로 오진하기 쉽다 → 포그라운드 dev로 검증

**빌드·환경**
- `vite preview`에 `--base /chronoatlas/`를 빼면 index.html이 자산을 404로 찾는다
- maplibre-gl 프리번들 시 워커 404 → `optimizeDeps: { exclude: ['maplibre-gl'] }`
- `--experimental-strip-types`로 `.ts`를 직접 돌리므로 **node 22.6+ 필요**. CI에서 node 20으로 죽은 적 있다
- astryx 토큰명을 지어내면 배경이 통째로 투명해진다. 실제 이름: `--color-background-surface/muted/gray` · `--color-border` · `--color-border-emphasized` · `--color-text-primary/secondary` · `--color-accent` · `--color-on-accent` · `--shadow-med` · `--radius-element/container`. **`--color-bg-primary` 같은 건 없다**
- astryx 토큰 값이 `light-dark(...)` 문자열이라 Canvas가 못 읽는다 → 요소 `style.color`에 대입해 계산된 rgb로 푼다

**공개 레포다**
- 개인 절대경로(사용자명·볼트 이름·iCloud 경로)를 커밋하지 마라. 한 번 들어갔다가 뺐다
- API 키를 파일에 쓰지 마라
- DEM 타일은 `.gitignore` — 용량·라이선스. 런타임에 `terrain/meta.json`으로 감지한다

---

## 8. 다음 에이전트에게 넘길 때

세션을 끝낼 때 **이 셋을 갱신하고 넘긴다.** 안 하면 다음 세션이 이미 만든 것을 또 만든다(2026-08-14~16에 실제로 그랬다).

1. `docs/HANDOFF.md` §1 상태와 §6 열린 작업
2. `docs/BACKLOG.md` — 닫은 요구에 상태 + **근거**
3. 볼트 `Context/비주얼파이프라인_프롬프트_원문.md` — River가 친 말과 그것이 무엇을 고쳤는지

볼트 문서(SPEC·TASKS 상태 열)는 라운드가 끝날 때 함께 맞춘다.

---

## 9. River가 판단해야만 하는 것

기계가 대신 못 한다. 막히면 물어라.

- **취향·미감**: P13 "완성된 지도로 보이는가", 해칭 디자인, 피규어 느낌
- **범위 숫자**: 지도 bbox 최종값(RUNBOOK §0)
- **정본 승인**: `proposals/` 검토, `migrate_v2.py --write`
- **규칙 정의**: "메인 인물"을 무엇으로 판정할지, 도시 rank를 무엇으로 매길지
- **차단된 것**: DPRR · ERA5/CMEMS 기후·바람 · 흉상 GLB(GPU) · DEM z8+ · 자료실 `atlasUrl` · Claude Desktop MCP 연결
- **실전 판정**: 30초 테스트(스터디 3명), 발표에서 실제 사용
