# 포인트 01~11 지도 구체화 — 슬라이스 정본 (R59)

작성 2026-09-21. 카이사르 팩(포인트 06·07·08, [PACK-CAESAR.md](PACK-CAESAR.md))과 같은 밀도로 **포인트 01·02 / 03·04·05 / 09·10·11**을 채운다.
요구 원장은 [BACKLOG.md](BACKLOG.md) R59, 진행 상태는 이 문서 §6. 어긋나면 BACKLOG의 R번호가 이기고, 장면·교보재·세부 지도의 세부는 여기가 이긴다.

## 0. River 결정 (2026-09-21)

| 물음 | 결정 |
|---|---|
| 순서 | **01·02 → 03·04·05 → 09·10·11** (책 순서) |
| 수준 | **라이브 장면 + 세부 지도까지.** 3840×2160 정지 이미지·Drive 납품은 발표 확정 뒤 `shoot-pack.py`로 |
| 정본 | **라운드 끝에 한 번** `proposals/` 병합 + `npm run adapt`. 그 전까지 화면은 교보재로 선다 |
| 세부 지도 | **여섯 전부**: 자마 말판(BC 202) · 아이가테스 해전(BC 241) · 악티움 말판(BC 31) · 필리피(BC 42) · 카프리 섬(티베리우스) · 로마 시내 AD 41 |

발표 일정은 볼트 어디에도 없다. 마감 없이 순서대로 간다. 대표님 녹취 셋(8/16 · 8/30 · 9/13)의 지도 대조표는 볼트 `Works/크로노아틀라스/20260921_대표님발언_지도대조표_포인트01_11.md`(작성 중)이고, 여기에는 그 결과로 정한 장면만 적는다(CONSTITUTION 0-4, 같은 사실을 두 곳에 안 적는다).

## 1. 규칙 (카이사르 팩·전면 개선에서 값을 치르고 배운 것만)

1. **지어내지 않는다.** 좌표는 정본 place `lonlat`(`public/datasets/rome/layers/settlements.geojson`의 `id`) 또는 번들 안 Pleiades(`layers/landmarks.geojson`, `pid`) 또는 위키데이터 P625·위키백과 좌표 필드에서만. 연도·병력은 사료 수치만, 없으면 `null`. 모든 교보재는 `teaching: true` + `source` 문장. 말이 왜 그 해 거기 서는지 항목마다 `note`.
2. **정본(볼트 `ontology/*.jsonl`)에 직접 쓰지 않는다.** 구멍은 `proposals/YYYYMMDD_<주제>.jsonl`(`add_entity`·`add_link`, 형식은 `proposals/20260911_place_actium.jsonl`). 병합·adapt는 라운드 끝 River 승인 한 번.
3. **층 집합은 통일.** 발표 장면 = `territory·admin_regions·settlements·people·relief·rivers·labels`, 자취가 주인공인 장면만 `movements`·`story_battles`를 더한다. `skin: campaign`, `view: 2d`, 묶음 안에서 카메라를 공유하고(기본 `[14, 40] z4.2`) 필요한 장만 당긴다.
4. **연도는 그룹 안에서 단조 증가**(`test/present.test.ts`). 같은 카메라·같은 해·같은 층의 장면 둘을 두지 않는다.
5. **반열림 구간 `[from, to)`.** 「48~47년」은 `to: -46`. 렌더는 에러를 안 낸다.
6. **이름표는 도시 > 인물 > 나머지**(`engine.orderLabels`). 새 층을 얹으면 `qa-sweep.py`의 `namesDropped`가 0인지 다시 잰다.
7. **심볼 layout의 zoom step은 정수.**
8. **번들 게이트 400 kB.** 묶음 교보재는 `data/overlays/<묶음>-<종류>.json`으로 두면 `packData.loadPack`이 **지연 로드**한다(eager로 싣지 않는다).
9. **검증은 계측.** `bash scripts/serve.sh` → `look.py`·`look-micro.py`·`battle-frame.py`·`qa-sweep.py`·`lod-count.py`·`blank-ratio.py`. CDP 소비자는 한 번에 하나.
10. **에이전트 초안은 새 파일만**, 커밋 전에 사람이 읽는다(지오메트리·`source`·연도를 따로). 판정을 시키지 않고 측정·인용·초안만.
11. 대표님 대사가 사료와 어긋나면 화면 문장에 옮기지 않고 대조표에 「틀림·근거」로 남긴다(PACK-CAESAR §14.2 방식).
12. 커먼즈 도판은 User-Agent 필수, 한 장씩. 굽기는 `scripts/bake-basemap.py <id> --write`. 볼트 파일명 NFC.

## 2. 장면 그룹 셋

id 접두 `p12-`·`p345-`·`p911-`. 그룹 이름은 「포인트 …」로 시작해야 발표 그룹으로 잡힌다(`present.isPresentGroup`). 기존 「로마의 확장」·「선례」의 장면은 새 그룹으로 옮긴다(`carrhae-53`만 「선례」에 남긴다, 포인트 06 맥락). 「2회차 발표 · 카이사르 팩」 8장은 손대지 않는다.

상태: ○ 안 됨 · ◐ 골격(카메라·층·연도)만 · ● 교보재·낭독 텍스트·계측까지.

### A. 「포인트 01·02 · 일곱 언덕에서 시칠리아까지」

| id | 제목(안) | year | 지도에 서는 것 | 근거 상태 | 상태 |
|---|---|---|---|---|---|
| plains-empire (재사용) | 왜 로마인가: 평야 · BC 270 | -270 | 곡창 7·척박 3 | 그룹만 옮김. 연도 단조를 위해 **맨 앞이 아니라 BC 270 자리**에 둔다 | ○ |
| p12-palatine-753 | 일곱 언덕 · BC 753 | -753 | 라티움 z9~10, 테베레·알바롱가·팔라티노, 로물루스 말(`ruled 로마 -753` ✔) | 알바롱가 좌표(Pleiades) 확인. -800 버킷 폴리티는 L-T가 잰다 | ○ |
| p12-samnium-321 | 삼니움 · 카우디움의 멍에 · BC 321 | -321 | 이탈리아 중부 z6, 삼니움·라틴·에트루리아 면(정본 `_area`), 카우디움 점 | 카우디움 place 없음 → 제안. 삼니움전쟁 사건 연도 확인 | ○ |
| p12-pyrrhus-275 | 피로스 · 이탈리아 남부 · BC 280~275 | -275 | 베네벤토 전투점 ✔, 피로스 말(참전 -275 ✔), 에페이로스→타란토 경로(교보재, 볼트 atlas `pyrrhus`) | 경로 출처 확인 뒤 교보재 | ○ |
| rome-italy-270 (재사용) | 반도 하나 · BC 270 | -270 | 판도 | 그룹만 옮김 | ○ |
| p12-messana-264 | 메시나 해협 · 접점 · BC 264 | -264 | 시칠리아 z7, 메시나 전투점 ✔, 카르타고(서)·시라쿠사(동) 면, 히에론 말 | 시라쿠사 영역은 정본 -300 버킷 실측 | ○ |
| p12-mylae-260 | 까마귀 · 밀라이 · BC 260 | -260 | 밀라이 해전 사건 ✔(발생지 없음 → 제안, 교보재 점 먼저), 함대 교보재 | 볼트 atlas `mylae_260` 좌표 출처 확인 | ○ |
| p12-regulus-255 | 레굴루스의 아프리카 · BC 256~255 | -255 | 에크노무스(사건 연도 확인)·본곶 전투점 ✔, 레굴루스 말(✔), 경로 교보재(atlas `regulus`) | | ○ |
| rome-sicily-241 (재사용, 제목 보강) | 첫 속주 · 섬 셋 · BC 241 | -241 | 판도 + **시칠리아·사르데냐·코르시카 강조 면**(NE 10m PD) | 대표님 8/16 「지중해 한가운데 섬 셋」 | ○ |

세부 지도: **아이가테스 해전 말판**(BC 241, 폴리비오스 1.59~61, `fleet` 부대).

### B. 「포인트 03·04·05 · 한니발에서 술라까지」

| id | 제목(안) | year | 지도에 서는 것 | 근거 상태 | 상태 |
|---|---|---|---|---|---|
| p345-alps-218 | 알프스를 넘다 · BC 218 | -218 | hannibal 경로 0~5구간 ✔(국면 `han-alps`), 한니발 말(알프스 -218 ✔), 티키누스·트레비아 전투점 ✔ | | ○ |
| p345-cannae-216 | 칸나이 · BC 216 | -216 | 칸나이 전투점 ✔, 트라시메노(-217, 점 없음 → 제안) | 세부: 기존 `cannae-board` | ○ |
| p345-italy-212 | 남이탈리아의 한니발 · BC 216~204 | -212 | 경로 8~10구간 ✔(`han-italy`), 카푸아·타란토 ✔, 시라쿠사 함락(제안) | 파비우스 지연전은 캡션 | ○ |
| p345-zama-202 | 자마 · BC 202 | -202 | scipio_africanus 경로 ✔, 자마 정착지 ✔(사건 연도·발생지 → 제안), 스키피오 말(엣지 0 → 제안+교보재), 마시니사 말 ✔ | 세부: **자마 말판** | ○ |
| rome-africa-144 (재사용) | 카르타고 함락 이후 · BC 144 | -144 | 판도 | 그룹만 옮김 | ○ |
| p345-carthage-146 | 카르타고 · BC 149~146 | -146 | 전투점 ✔, 스키피오 아이밀리아누스 ✔, 평야 층 켜서 「사막이 아니다」 | 대표님 9/13 ② 반증(PACK-CAESAR §14.2)을 캡션에 | ○ |
| p345-cimbri-101 | 킴브리·테우토네스 · BC 113~101 | -101 | 아라우시오·아쿠아이 섹스티아이·베르첼라이(전부 제안, Pleiades), 마리우스 말(교보재) | 대표님 9/13 ①(알프스 프레이밍)은 옮기지 않는다 | ○ |
| sulla-88 (재사용) | 술라, 로마로 · BC 88 | -88 | | 그룹만 옮김 | ○ |
| p345-spartacus-71 | 스파르타쿠스 · BC 73~71 | -71 | 사건 ✔(발생지 없음), 카푸아 ✔·베수비오·실라루스(제안), 아피아 가도 십자가 | `event:십자가형`이 AD 30이다. 포인트 05의 십자가형(BC 71)과 같은 노드인지 제안 단계에서 가른다 | ○ |
| p345-pompey-east-63 | 폼페이우스의 동방 · 카틸리나 · BC 67~63 | -63 | pompey 경로 0~1구간 ✔(`pompey-east`), 카틸리나 사건 ✔ | 폼페이우스·크라수스 특별 지휘권으로 06에 잇는다 | ○ |

### C. 「포인트 09·10·11 · 필리피에서 네로까지」

| id | 제목(안) | year | 지도에 서는 것 | 근거 상태 | 상태 |
|---|---|---|---|---|---|
| p911-philippi-42 | 필리피 · BC 42 | -42 | 필리피 ✔(사건 없음 → 제안), 안토니우스·옥타비아누스·브루투스·카시우스 말(전부 교보재, 아피아노스 『내전기』 4) | 세부: **필리피 미시지도**(+말판 선택) | ○ |
| p911-partition-40 | 셋으로 나눈 제국 · BC 40 | -40 | 브룬디시움 협약 분할을 정본 속주 위에 **사선 3색**(교보재 hatch, 기하 없음) | 제2차 삼두정치 사건 제안 | ○ |
| p911-donations-34 | 알렉산드리아의 기증 · BC 34 | -34 | 기증 영토 사선(플루타르코스 『안토니우스』 54, 디오 49.41), cleopatra_antony 경로 ✔ | 키프로스·킬리키아·크레타·키레네 | ○ |
| p911-actium-31 | 악티움 · BC 31 | -31 | 사건 ✔(발생지 제안 대기 → 병합 전엔 교보재 점), 아우구스투스 ✔, 안토니우스·클레오파트라 | 세부: **악티움 말판** | ○ |
| p911-augustus-14 | 아우구스투스의 제국 · AD 14 | 14 | 판도, **라인·다뉴브·유프라테스 강조**(유언), 황제속주/원로원속주 사선(디오 53.12, 교보재), 티베리우스 로도스 은둔(교보재) | 대표님 9/13 「라인 강 넘어가지 마」 | ○ |
| p911-capri-27 | 카프리 · AD 27~37 | 27 | 티베리우스 ✔(로마) → 카프리 교보재(override), 세야누스 로마 | 세부: **카프리 미시지도**(빌라 요비스) | ○ |
| p911-caligula-41 | 팔라티움의 칼 · AD 41 | 41 | 칼리굴라 ✔, 친위대 | 세부: **로마 시내 AD 41**(기존 `roma` 미시지도에 시기 피처) | ○ |
| p911-claudius-43 | 브리타니아 · 푸키누스 · AD 43~52 | 43 | 클라우디우스 ✔, 브리타니아 ✔(사건 제안), 모의해전 ✔(연도 없음 → 제안 52 + 푸키누스 호수 ✔) | AD 43 영토 프레임에 브리타니아가 있는지 L-T | ○ |
| p911-nero-54 | 아그리피나의 아들 · AD 54 | 54 | 네로 ✔, 아그리피나 | 포인트 11 끝 | ○ |

## 3. 세부 지도 여섯

| id | 종류 | 근거 사료 | 필요한 것 | 상태 |
|---|---|---|---|---|
| zama (BC 202) | 미시지도 + 말판 3페이즈 | 폴리비오스 15.9~14, 리비우스 30.32~35. 비정은 논쟁(사크르 계곡 통설) → `grade: 논쟁` | 인셋 DEM·토지피복, `data/boards/zama-202.json`, `docs/ZAMA.md` | ○ |
| aegates (BC 241) | 미시지도(바다) + 말판 | 폴리비오스 1.59~61, 해저 청동 충각 발굴(레반초 섬 앞) | `fleet` 부대, 바다 인셋(DEM 0) | ○ |
| actium (BC 31) | 미시지도 + 말판 | 플루타르코스 『안토니우스』 65~66, 디오 50.31~35, 니코폴리스 승전 기념물(확정 유구) | `fleet`, 악티움 place 제안과 좌표 동일(Pleiades 530772) | ○ |
| philippi (BC 42) | 미시지도(+말판 선택) | 아피아노스 『내전기』 4.105~131, 플루타르코스 『브루투스』 38~52, 유구(도시 성벽·비아 에그나티아) | 인셋 | ○ |
| capri (AD 27~37) | 미시지도 | 수에토니우스 『티베리우스』 40~43·65, 타키투스 『연대기』 4.67, 빌라 요비스 유구(확정) | 인셋, 19세기 PD 지도 있으면 `bake-basemap.py` | ○ |
| roma AD 41 | 기존 `roma` 미시지도에 **시기 피처** | 카스트라 프라이토리아(AD 23, 유구 확정), 팔라티움, 수에토니우스 『칼리굴라』 58, 요세푸스 『유대고대사』 19 | 피처 `built_year`/`gone_year`, 콜아웃 `from_year`/`to_year` | ○ |

## 4. 교보재 파일 규약 (에이전트가 이대로 쓴다)

파일은 전부 `data/overlays/<묶음>-<종류>.json`(묶음 = `p12`·`p345`·`p911`). `packData.loadPack`이 그 해(`PACK_YEARS`: p12 [-800,-230) · p345 [-230,-60) · p911 [-45,70))나 그 묶음 장면에 들어설 때 받아 살아 있는 배열에 합친다. **파일 머리에 `"teaching": true`와 `"source"` 문장**, 항목마다 근거. 종류와 형식:

| 종류 | 합쳐지는 자리 | 형식(기존 파일과 같다) |
|---|---|---|
| `-cast.json` | `PACK_CAST.people` (+`principals.ids`) | `pack-cast.json`. `people[]`: `{ id: "person:…", place: "place:…", from_year, to_year, note, at?: [lon,lat], override?: true }`. `place`는 정본 place id여야 좌표가 붙는다(없으면 `at`을 직접, 출처 명시). `principals: { note, ids: [] }`는 그 묶음의 주역 |
| `-battles.json` | `PACK_BATTLES` | `pack-battles.json`. FeatureCollection, Point, `properties: { id, name_ko, year, valid_from, valid_to, victor(정본 actor 9개 어휘), teaching: true, source }`. `id`는 정본 place id가 있으면 그것(클릭이 인스펙터로 간다), 없으면 `place:<한글>` + `outside_canon` 주석 |
| `-routes.json` | `PACK_MOVEMENTS` | `pack-pompey.json`. FeatureCollection, LineString(정점 둘 이상), `properties: { id: "<route>@<slug>", route, owner: "person:…", actor, label, name_ko, from_year, to_year, valid_from, valid_to, teaching: true }`. **정본에 같은 `route`가 있으면 엔진이 버린다**(정본이 이긴다). 새 route id는 `routes.ts ROUTE_PHASES`에 국면을 더해야 색이 붙는다(내 몫, NOTES에 적어 달라) |
| `-places.json` | `PACK_PLACES`(이야기 장소 이름표) | `{ teaching: true, source, places: ["place:카르타고", …] }` 정본 settlements id만 |
| `-anachronisms.json` | hide_before / hide_admin_before | `pack-anachronisms.json`. `hide_before[]: { id: "place:…", valid_from, source }` — **창건 연도가 사료·Pleiades로 확실한 것만** |
| `-legions.json` | `by_person` | `pack-legions.json`의 `by_person` 형식. 사료 수치만, 없으면 `legions: null` |
| 그 밖 (`-hatch.json`·`-islands.json`·`-rivers.json`…) | `PACK_EXTRA['<묶음>-<종류>']` 원문 그대로 | 형식은 NOTES에 적는다. `hatch`는 `pack-clients.json`처럼 **기하 없이** 이름+연도(반열림)+출처. `islands`는 NE 10m(PD) 정점 복사 FeatureCollection |

제안 파일: `proposals/20260921_<묶음>.jsonl`, 한 줄 한 op. 형식은 `proposals/20260911_place_actium.jsonl`(`op: add_entity | add_link`, `set`, `note`, `proposed_by`, `date`). 좌표는 Pleiades pid나 위키데이터 QID를 `ext`에 적는다.

근거 문서: `docs/P12-NOTES.md`·`P345-NOTES.md`·`P911-NOTES.md` — 무엇을 어디서 가져왔고 **무엇을 못 찾았는지**(못 찾은 것은 비워 둔다, 채우지 않는다).

## 5. 검증

- `npm run build`(lint 새 오류 0 · typecheck · vitest · 초기 JS ≤ 400 kB gz)
- `python3 scripts/qa-sweep.py` 전 장면: 설명창·알약 밑 말 0 · 카드 겹침·화면 밖 0 · `namesDropped` [] · 페이지 오류 0
- `python3 scripts/look.py <scene>` 새 장면마다 → `docs/verify/points/<id>.png`
- `look-micro.py` 여섯 지도 · `battle-frame.py` 자마·아이가테스·악티움(·필리피) · `blank-ratio.py` 새 인셋 z11
- `lod-count.py --year -753|-264|-218|-42|14|41`: 이야기 장소가 z4~5에서 뜨는지

## 6. 실행 기록

- **2026-09-21 기반(E1~E6)**: 발표 그룹 여럿(`present.isPresentGroup`·`presentGroups`, 「↩ 발표」는 왔던 그룹으로) · `ROUTE_PHASES`에 한니발 4·스키피오 2·클레오파트라/안토니우스 3·폼페이우스 동방 국면 · 말판 arm `fleet`(`SIZE_M` 420×70 m) · 미시지도 피처 `built_year`/`gone_year`, 콜아웃 `from_year`/`to_year` · 묶음 교보재 지연 로드(`packData.loadPack`·`packsFor`, `engine.refreshPack`) · 테스트: 그룹별 연도 단조·note·view·skin·낭독 텍스트, 경로 국면. vitest 270.
