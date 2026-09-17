# 알레시아 포위전 오버레이 (`data/overlays/pack-alesia.json`)

BC 52년 알레시아 포위전의 상세 지도용 교보재 오버레이. 51개 피처, 약 52 KB
(정본 43 + 함정·해자 띠 8. 뒤쪽 8개는 `scripts/build-alesia-traps.py`가 굽는 파생 기하이고
좌표가 촘촘해 한 줄씩 압축해 적었다 — `pack-peoples.json`과 같은 관례다).
앵커는 이 프로젝트에서 이미 정본인 **47.5392 N / 4.5006 E**(몽 옥수아, Alise-Sainte-Reine, 부르고뉴)이고
모든 지물을 그 좌표에 맞춰 배치했다.

## 비정: 알리즈생트렌을 따른다

알레시아의 위치에는 두 설이 있다.

- **Alise-Sainte-Reine (Côte-d'Or)**: 나폴레옹 3세가 1861~1865년에 시킨 발굴이 공성 시설의 참호를 거의 전 구간에서 찾아냈고,
  1991~1997년 프랑스·독일 공동조사(Reddé / von Schnurbein)가 항공사진·물리탐사·표적 발굴로 전체 회로를 다시 그렸다. 현재의 통설.
- **Chaux-des-Crotenay (Jura)**: André Berthier가 낸 소수설.

이 오버레이는 **알리즈생트렌 설을 따른다**. 파일의 최상위 `source`에도 그렇게 적어 두었다.

다만 알리즈 설의 약점도 데이터에 같이 적었다. 카이사르가 말한 "북쪽 산"으로 비정되는 몽 레아는 몽 옥수아의 **정북이 아니라 북서쪽**이다.
18세기 지리학자 d'Anville은 라틴어를 고칠 수 없으니 지도를 돌려 버렸다. 1741년 간행본에서 몽 옥수아와 주변 구릉을 회전시켜 몽 레아를 정북에 맞췄다.
Jacques Harmand은 몽 레아 대신 뷔시 산을 북쪽 산으로 보려 했다.

## 카이사르가 준 수치 (『갈리아 전기』 7권)

| 출처 | 내용 |
|------|------|
| 7.68~7.69 | 오피둠은 매우 높은 언덕 꼭대기. 양쪽 기슭을 두 강이 씻는다. 앞에 약 **3마일** 길이의 평지. 사방에 비슷한 높이의 구릉 |
| 7.69 | 갈리아군이 해 뜨는 쪽 사면을 메우고 앞에 참호와 높이 **6피트** 돌담을 둘렀다 |
| 7.69 | 로마군이 착수한 포위선 둘레 **11마일**, 보루(castella) **23개** |
| 7.72 | 폭 **20피트** 수직호 1줄. 그 뒤 폭·깊이 **15피트** 참호 2줄, 안쪽 1줄에는 강물을 끌어 댔다. 높이 **12피트** 보루와 흉벽, **80피트**마다 망루 |
| 7.73 | **cippi** 5줄(사슴뿔 모양으로 깎아 참호 바닥에 고정), **lilia** 8줄(깊이 3피트 구덩이를 3피트 간격 바둑판으로, 넓적다리 굵기 말뚝을 박아 4인치만 내놓고 흙으로 1피트 덮은 뒤 잔가지로 위장), **stimuli**(길이 1피트 말뚝에 쇠갈고리를 달아 땅에 완전히 묻음) |
| 7.74 | 바깥을 향한 같은 규격의 시설, 둘레 **14마일**. 전원 **30일치** 군량과 마초 |
| 7.79 | 구원군이 포위선에서 **1마일** 못 미친 언덕에 진을 쳤다 |
| 7.83 | 북쪽 산은 둘레가 너무 커서 포위선에 넣지 못했고, 진영은 가파르고 불리한 비탈에 놓였다. **레기누스**와 **레빌루스** 두 부장이 **2개 군단**으로 지켰다. 베르킹게토릭스의 친척 **베르카시벨라우누스**가 정예 **6만**을 골라 산 뒤에 숨겼다가 정오에 쳤다 |

로마마일 1 = 약 1,480 m로 환산하면 안쪽 선 **16.3 km**, 바깥 선 **20.7 km**, 합계 약 37 km다.
생성된 링의 실측 둘레는 안쪽 **16.20 km**, 바깥 **20.64 km**로 각각 오차 0.5% 이내다.

> 발주 메모에는 안쪽 선이 `~15 km`로 적혀 있었으나 BG 7.69는 11마일, 즉 16.3 km다. 카이사르 수치를 따랐다.

## 지도 없이 읽히게 — 망루와 세 겹 함정

알레시아에는 깔 고지도가 없다(d'Anville 1755년 판은 지오레퍼런싱 실패, `MICROMAP-BASEMAP.md`
「실행 결과」). 그래서 바탕 도판 대신 **벡터 디테일**로 읽히게 만든다. 카이사르가 준 치수를
정본 포위선에서 파생시킨 것이 아래 두 절이다.

### 망루 — 좌표를 만들지 않았다

BG 7.72는 포위선 전체에 망루를 **80로마피트(약 24 m)마다** 세웠다고 적었다.
(80피트는 **망루 간격**이고, 12피트는 망루 높이가 아니라 **보루 높이**다. 이 팩과
`pack-callouts.json`이 한 번 정정한 구별이니 되돌리지 말 것 — 망루 자체 높이는 사료에 없다.)

**개별 망루의 위치를 특정한 자료를 찾지 못했다.** 카이사르는 간격만 적었다. 1991~1997년
조사와 고게의 항공사진은 포위선의 망루 기초를 실제로 잡아냈고 복원은 4주식 기초(약 3 m 정방)를
근거로 **간격을 18~20 m로** 잡지만, 개별 기초의 좌표는 3권짜리 발굴 보고서
(Reddé & von Schnurbein)에 있고 이 프로젝트는 그 원본을 열람하지 못했다. 지어낼 수 없으므로
이 팩에는 **망루 점 피처가 없다.** 대신 두 선 피처에 수치를 얹었다.

```
"tower_spacing_pedes": 80,  "tower_spacing_m": 23.68,
"tower_note_ko": "화면의 망루 개수는 표현이고 실제 간격은 80로마피트(약 24m)다."
```

렌더는 `symbol-placement: 'line'` + `symbol-spacing`으로 두 선 위에 기호를 반복시킨다.
**주석 문구는 위 `tower_note_ko` 한 줄을 그대로 쓴다.** 반드시 필요한 이유가 있다 —
`symbol-spacing`은 **미터가 아니라 픽셀** 단위라 화면에 찍히는 망루 개수가 줌에 따라 변하고,
어느 줌에서도 실제 24 m 간격과 일치하지 않는다. 실제 간격대로 깔면 두 선 합계 36.8 km ÷
23.68 m = **약 1,560개**이고, 발표 줌 z12.4에서 24 m는 2.4 px라 서로 뭉친다.

### 세 겹 함정과 해자 — 정본 정점에서 오프셋

BG 7.73의 순서는 라틴어 본문이 못 박아 준다. 킵피 다음이 **`ante quos`**(그 앞에) 릴리아,
그다음이 **`ante haec`**(이것들 앞에) 스티물루스다. 즉 벽에서 멀어지는 쪽으로
킵피 → 릴리아 → 스티물루스이고, 적이 만나는 순서는 그 반대다.

| id 접미 | kind | `offset_pedes` | 중심 오프셋 | 사료에서 나오는 것 | 지어낸 것 |
|---|---|---|---|---|---|
| `cippi` | `trap` | 60~90 | 22.2 m | 5줄, 깊이 5피트 참호 | 줄 간격·띠 폭·거리 |
| `lilia` | `trap` | 120~144 | 39.1 m | 8줄 × 간격 3피트 = **24피트**(폭이 전거인 유일한 띠), 깊이 3피트 | 벽에서의 거리 |
| `stimuli` | `trap` | 180~200 | 56.2 m | 존재, 말뚝 길이 1피트 | 줄 수·띠 폭·거리 |
| `fossa20` | `ditch` | 430~450 | 130.2 m | 폭 20피트, 수직벽, **400피트 후퇴** | 없음(400+30에서 나온다) |

- **환산**: 1 로마피트 = **0.296 m**. 표의 모든 미터값이 이 상수 한 개에서 나온다.
- **파생**: 기하는 `alesia:inner`·`alesia:outer` 정본 폴리곤 정점을 shapely로 오프셋한
  링이다. 손으로 찍은 좌표가 **하나도 없고**, 정점 수도 정본과 같다(49 / 51).
- **부호**: 「적 쪽이 양수」다. 안쪽 선은 적이 성안이라 오피둠 쪽으로, 바깥 선은 적이
  구원군이라 밖으로 오프셋했다.
- **폭은 속성으로 넘긴다**(`width_m`). 면으로 못 그린다 — MapLibre는 512px 타일이라 이
  위도에서 z12.4가 9.8 m/px, 최대 줌 z15가 1.6 m/px이고, 릴리아 띠의 실폭 7.1 m는
  각각 0.7 px · 4.4 px다.
- **폭 20피트인가 깊이 20피트인가**: `fossa pedum viginti`는 「20피트 깊이」로 옮기는
  번역이 많다. 이 프로젝트는 이미 `pack-callouts.json`에서 **폭**으로 읽었고
  (바닥 폭이 입구 폭과 같다는 뒷절이 근거다) 여기서도 그 결정을 따랐다. 깊이로 읽으면
  이 띠의 폭은 미지수가 된다.

#### 어느 선에 두었나 — 둘 다, 각자 자기 적을 향해

**두 선 모두**에 한 벌씩 두었다. 근거는 BG 7.74의 한 문장이다.

> quattuordecim milia passuum complexus **pares eiusdem generis munitiones, diversas ab
> his, contra exteriorem hostem**

「같은 규격의 시설을 방향만 반대로, 바깥의 적을 향해」. 그래서 안쪽 선의 함정은 오피둠 쪽,
바깥 선의 함정은 밖을 향한다. 한쪽에만 두면 이중 포위의 요점이 거꾸로 설명된다.

#### 링으로 내지 않은 것 — 폭·깊이 15피트 참호 두 줄

BG 7.72의 15피트 참호 두 줄은 벽에서 0~30 pedes(중심선 4.4 m)다. 발표 줌에서 0.45 px,
최대 줌 z15에서도 2.75 px라 포위선 선 자체의 굵기(`line-width` 3.4) 안에 들어가
어느 줌에서도 갈라 보이지 않는다. 다섯 띠 중 유일하게 그렇고, +15 KB 용량 예산에서
먼저 잘랐다(링 두 개 = 3.8 KB). 수치는 두 선의 `trench_pedes`·`trench_rows`에 남겼고
`note_ko`에도 평문으로 있다. 그려야 하면 `build-alesia-traps.py`의 `BANDS` 주석 자리에
`dict(key='fossae15', near=0, far=30, ...)`을 되살리면 된다.

#### 어디까지가 정설이 아닌가

20피트 수직호를 **함정보다 앞(적 쪽)** 에 둔 것은 「나머지 시설을 이 호에서 400피트
물렸다」(`reliquas omnes munitiones ab ea fossa pedes quadringentos reduxit`)와, 그 이유가
「적이 야간에 시설로 달려들거나 주간에 작업 중인 병사에게 투창하지 못하게」인 데서 나온
배치다. 다만 2차 문헌은 갈린다 — 큰 호를 함정 바깥에 두는 재구성과 함정 안쪽에 두는
재구성이 다 있다. 이 팩은 앞의 읽기를 택했고, 뒤집으려면 `BANDS`의 `fossa20` 숫자
두 개만 고치면 된다.

## 전거와 복원의 구분

| 피처 | 근거 |
|------|------|
| 오즈 강 · 오즈랭 강 | **실측**. OpenStreetMap Overpass에서 실제 하천 선형을 받아 전장 범위로 자르고 간략화 |
| 몽 레아 · 뷔시 산 · 펜느벨 산 · 플라비니 산 | **실측 좌표**(OSM 지명). 고도·둘레는 프랑스 지형 자료 |
| 오피둠 윤곽 | **근사**. 몽 옥수아 대지 형상과 약 97 ha라는 고고학 수치에 맞춘 타원 |
| 안쪽 · 바깥 포위선 | **근사**. 둘레만 카이사르 수치에 정확히 맞췄고 선형은 지형에 맞춘 복원. 측량 성과가 아니다 |
| 진영 A~K (8개) | **근사**. 나폴레옹 3세 도면의 진영 부호를 따르되 위치는 지형에 맞춤 |
| 보루 23개 | **개수만 전거**. 배치는 안쪽 선을 따라 등간격으로 배분한 교보재용 근사 |
| 망루 | **간격만 전거**(80피트). 개별 위치는 사료·고고학 어느 쪽도 특정하지 않아 **점을 만들지 않았다** |
| 함정 3종 · 수직호 | **치수는 전거, 벽에서의 거리는 근사**. 기하는 포위선 정점을 오프셋한 파생 |
| 베르킹게토릭스 진영 | **문헌 근거가 가장 직접적**(BG 7.69, 동쪽 사면 + 6피트 돌담). 범위는 근사 |
| 구원군 진영 | **근사**. 뮈시라포스(47.5205 N / 4.4376 E)를 기준으로 잡음 |
| 롬 평원 | **범위 자체가 논쟁 중**. Carcopino는 Pouillenay와 레아 사이, Le Gall은 플라비니 산과 오즈 사이 또는 플라비니~뷔시 호, Voisin은 오즈·오즈랭을 아울러 브렌까지 본다 |

### 고고학이 부정한 것도 같이 실었다

1991~1997년 조사는 나폴레옹 3세 도면을 여러 군데 무너뜨렸다. 데이터에 `attested` 플래그로 구분해 두었다.

- **확인됨**: 고지 진영 A(2.3 ha)·B(7.3 ha, 플라비니 산)·C(6.9 ha, 뷔시 산). 보루 11·15·18번.
  18번은 그레지니생트렌 남동쪽 밭에 흙돌 둔덕으로 남아 있는, 철수 때 파괴된 시설의 드문 잔존물이다.
- **부정 또는 논란**: D(몽 레아 사면 2개 군단 진영은 끝내 못 찾았다. 동쪽 경계로 본 참호는 근대 배수로였다),
  G(포위선 바깥이고 라뷔탱 개울이 가로지른다), H(레 롬 역 확장으로 매몰), I(카이사르 참호를 메운 뒤 판 후대 유구),
  K(미발굴, 갈로로만 토기 다량). 보루 16bis는 자연 균열(diaclase)이었다.

카이사르가 가장 극적으로 서술한 북쪽 진영이 고고학적으로는 가장 불확실하다는 점은 그 자체로 좋은 교보재라 지웠다.

## 용어 주의

`circumvallatio`와 `contravallatio`를 안팎 어느 쪽에 붙일지는 문헌마다 엇갈린다.
흔한 현대 관행은 contravallation = 안쪽(농성군을 향함), circumvallation = 바깥(구원군을 향함)인데 반대로 쓰는 자료도 많다.
그래서 이 파일은 라벨 대신 **`kind` 값**으로 못 박았다.

- `inner_line` = 안쪽 선, 베르킹게토릭스를 가둔 쪽, 11마일
- `outer_line` = 바깥 선, 구원군을 막은 쪽, 14마일

소비하는 코드는 `name_ko`/`name_la`가 아니라 `kind`를 읽어야 한다.

## 몽 레아의 굴곡

바깥 선은 북서쪽 몽 레아 방향에서 안쪽으로 최대 17% 당겨 그렸다.
BG 7.83의 "둘레가 너무 커서 산을 선 안에 넣을 수 없었다"를 눈에 보이게 만든 **의도적 변형**이고, 발굴된 선형이 아니다.
결전이 왜 하필 거기서 났는지를 지도 한 장으로 설명하려는 장치다.

## `kind` 값

`oppidum` · `inner_line` · `outer_line` · `camp` · `redoubt` · `gaul_camp` · `hill` · `river` · `plain` · `trap` · `ditch`

모든 피처에 `name_ko` · `name_la` · `kind` · `teaching: true` · `source`가 있고, 최상위에도 `teaching: true`와 `source`가 있다.
부가 속성: `attested`(불리언), `camp_letter`, `decisive`, `altitude_m`, `length_roman_miles`, `length_km`, `extent_roman_miles`, `side`.

`trap`·`ditch`(각 6 · 2)는 하위 종류를 별도 `kind`로 쪼개지 않고 `trap_type`
(`cippi`|`lilia`|`stimuli`) · `ditch_type`(`fossa_20`)로 구분한다 — `camp`이 `camp_letter`를
쓰는 것과 같은 관례다. 부가 속성 `line`(파생 원본 선 id) · `offset_pedes`[앞,뒤] ·
`width_m` · `rows`. 선 두 개에는 `tower_spacing_pedes` · `tower_spacing_m` ·
`tower_note_ko` · `trench_pedes` · `trench_rows`가 붙는다.

`test/present.test.ts`가 세는 네 값(`inner_line` 1 · `outer_line` 1 · `camp` 8 · `redoubt` 23)은
새 `kind`를 쓴 덕에 그대로다. `build-alesia-traps.py`의 `check()`가 그 네 값까지 같이 검사한다.

## 참고한 URL

- https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.02.0001:book=7:chapter=69 (및 72 · 73 · 74 · 83)
- https://en.wikipedia.org/wiki/Battle_of_Alesia
- https://fr.wikipedia.org/wiki/Bataille_d%27Al%C3%A9sia
- https://www.alesiaparc.fr/accueil/les-camps-romains/
- https://www.alesiaparc.fr/accueil/le-camp-sur-la-montagne-au-nord/
- https://www.alesiaparc.fr/accueil/topographie-et-tactique-%C3%A0-al%C3%A9sia/
- https://www.alesiaparc.fr/cartes/
- https://www.archeologie-alesia.fr/arch%C3%A9ologie/le-r%C3%A9a/
- https://www.archeologie-alesia.fr/addenda/plaine/
- https://musee-archeologienationale.fr/en/node/1592
- https://www.britannica.com/event/Battle-of-Alesia-52-BCE
- https://www.worldhistory.org/article/1734/battle-of-alesia/
- https://aibl.fr/collections/tome-22-alesia-fouilles-et-recherches-franco-allemandes-sur-les-travaux-militaires-romains-autour-du-mont-auxois-1991-1997/
- https://nominatim.openstreetmap.org / https://overpass-api.de (좌표·하천 선형)
- https://www.thelatinlibrary.com/caesar/gall7.shtml (7.73의 `ante quos` · `ante haec`, 7.74의 `pares eiusdem generis munitiones` 라틴어 원문 확인)
- https://alesia.com/en/archaeology/ (1991~1997 조사 개요, 망루 4주식 기초와 18~20 m 간격 복원)
- https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf · https://dataspace.copernicus.eu/news/2026-7-17-copernicus-dem-30m-view-service-license-acceptance (GLO-30 라이선스 조건과 2026-07-28 접근 제한)
- https://catalogue.open-datara.fr/geonetwork/srv/api/records/IGNF_RGEALTIr_2-0.xml (RGE ALTI 라이선스 = Licence Ouverte, ODC-BY·CC BY 2.0 호환)

정본 보고서는 M. Reddé · S. von Schnurbein, *Alésia. Fouilles et recherches franco-allemandes sur les travaux
militaires romains autour du Mont-Auxois (1991-1997)*, AIBL. 직접 열람하지 않았고 위 요약들을 거쳤다.

## 검증

생성 스크립트에 불변식 검사를 달아 통과시켰다. 링 폐합, `kind` 열거값, 필수 속성 5종, `id` 중복,
좌표 bbox(4.42~4.57 E / 47.50~47.58 N), 두 선의 둘레 오차 5% 이내, 오피둠이 안쪽 선 안에 들어갈 것,
안쪽 선이 바깥 선 안에 들어갈 것, 앵커 47.5392/4.5006이 오피둠 폴리곤 안에 있을 것,
오즈가 오피둠보다 북쪽이고 오즈랭이 남쪽일 것, D 진영이 북서쪽일 것, 보루 23개·진영 8개.

파생 8피처는 `scripts/build-alesia-traps.py`의 `check()`가 재실행마다 검사한다 — `kind` 개수
(정본 4종 + `trap` 6 · `ditch` 2), 링 폐합, 필수 속성 5종, 전장 bbox, 안쪽 띠가 안쪽 선 안이고
오피둠을 가로지르지 않을 것, 바깥 띠가 바깥 선 밖일 것, **링과 원본 선 사이 실측 거리가
`offset_pedes` 중심값과 1 m 이내로 일치할 것**, 두 선의 망루 간격 80. 스크립트는 멱등이다
(다시 돌리면 앞서 붙인 8개를 지우고 같은 것을 다시 붙인다).

## 말판 alesia-52 (전투 재생, 2026-09-17)

`data/boards/alesia-52.json`은 손으로 찍지 않았다. `scripts/build-alesia-board.py`가 이 미시지도의 피처에서 파생한다: 로마 진영 여덟(A·B·C·D·G·H·I·K 점), 오피둠 중심, 구원군 진영 중심, 몽 레아, 포위선의 가까운 정점. 세 페이즈는 『갈리아 전기』 7.79~89.

| t | 제목 | 사료 | 위치 규칙 |
|---|---|---|---|
| 0 | 구원군 도착 | 7.79 | 구원군 보병·기병 = 구원군 진영 중심. 베르킹게토릭스 = 오피둠 중심 |
| 1 | 정오의 총공격 | 7.83~85 | 구원군 → 진영에서 가장 가까운 바깥선 정점(평원). 베르카시벨라우누스(6만) → 몽 레아에서 가장 가까운 바깥선 정점(북쪽 진영 D 앞). 베르킹게토릭스 → 롬 평원에 가장 가까운 안쪽선 정점 |
| 2 | 기병의 우회 | 7.87~89 | 게르만 기병 = 진영 D에서 북쪽 접점 너머 같은 거리(「등」). 구원군·베르카시벨라우누스 `routed`, 베르킹게토릭스 오피둠으로 `routed` |

병력은 `data/boards/_alesia-strength.json`에 카이사르 본인의 수치만(7.71 농성군 8만 · 7.76 구원군 25만+8천 · 7.83 정예 6만). 로마 진영별 병력과 게르만 기병 수는 BG에 없어 비웠다(유닛 카드에 숫자가 안 뜬다). 인용 카드 「붉은 외투」는 7.88.

## 지형 — DEM 조사 결과

> **2026-09-17 실행됨.** `python3 scripts/bake-dem.py inset alesia`가 Copernicus GLO-30을 `public/datasets/rome/terrain-alesia/` z8~12(15 MB)로, `bake-landcover.py alesia`가 WorldCover를 `landcover-alesia/`로 구웠다(OVERHAUL §3.6b·§3.7, AGENTS.md 「기하 3D 지형」). 아래는 조사 당시의 기록이다.

알레시아의 문제는 건물이 아니라 지형이라 답은 음영기복이다. **아직 아무것도 받지 않았다.**
아래는 숫자와 라이선스 판정만이고, 집행은 River 판단 대기다.

### 후보와 라이선스 판정 (`AGENTS.md` 「카피레프트 재배포 금지」 기준)

| 소스 | 해상도 | 라이선스 | 판정 |
|---|---|---|---|
| **IGN RGE ALTI** (프랑스) | 1 m · 5 m | **Licence Ouverte / Etalab 2.0** (2021-01-01 개방, ODC-BY·CC BY 2.0 호환) | **통과.** 출처 표기만. 이 bbox에 가장 촘촘하고 조건이 가장 깨끗하다 |
| **SRTM** (NASA/USGS) | 30 m (SRTMGL1) | **퍼블릭 도메인** | 통과. 조건 없음. 다만 30 m는 이 축척에 모자라다 |
| **Copernicus DEM GLO-30** | 30 m | ESA 전용 라이선스 — 카피레프트는 아니지만 ① DLR·Airbus·EU·ESA 저작권 문구 ② 개작 시 "produced using" 문구 ③ **책임부인 조항을 하위 이용자에게 전파할 의무** | 조건부. 게다가 **2026-07-28부터 30 m 열람 서비스가 CCM 등록 사용자로 제한**됐다. RGE ALTI가 있는 마당에 쓸 이유가 없다 |
| **AWS Terrain Tiles**(이미 쓰는 것) | z14~15까지 존재 | PD/CC BY/ODbL **혼합** | 통과하되 확인 필요. 프랑스 구간은 SRTM·GMTED(PD) 파생일 것으로 보이나 타일 단위로 문서화된 출처가 없다 |

### bbox 12.0 × 10.0 km에서 음영기복 한 장을 구우면

| DEM 해상도 | 픽셀 | JPG 예상 |
|---|---|---|
| 30 m | 401 × 334 (0.13 Mpx) | **16~39 KB** |
| 10 m (RGE ALTI 리샘플) | 1,203 × 1,001 (1.2 Mpx) | **141~353 KB** |
| **5 m (RGE ALTI 그대로)** | 2,405 × 2,001 (4.8 Mpx) | **0.55~1.4 MB** |
| 1 m | 12,025 × 10,006 (120 Mpx) | 14~34 MB (제외) |

바이트는 이 레포가 이미 커밋한 래스터의 실측 압축률로 계산했다 — `relief.jpg` 0.122 B/px,
`basemap-roma.jpg` 0.324 B/px. **5 m 판이 1 MB 안쪽이라, 이미 커밋돼 있는
`relief.jpg`(1.4 MB)보다 작다.** 53 MB 타일 피라미드와 달리 레포 정책을 건드리지 않는다.

덤으로 확인한 것 둘:

- **재투영이 필요 없다.** plate carrée 이미지를 머케이터로 선형 스트레치할 때 이 bbox
  높이(0.09°)에서 생기는 최대 오차는 **2.1 m**다. `reproject-relief.py`는 지중해 전역용이고
  이 축척에서는 건너뛸 수 있다.
- **지오레퍼런싱 오차가 원리상 0이다.** 계산으로 구운 정북 정렬 래스터라 `corners` 네 값이
  정의상 정확하다. d'Anville 판을 죽인 RMS 938 m·26도 전단이 발생할 여지가 없다.
  `pack-basemaps.json`의 `maps[]` 슬롯(`file`·`size`·`corners`·`min_zoom`)에 그대로 들어간다.

### 기존 `terrain/`(z0~7)으로는 안 된다

z7 타일픽셀은 이 위도에서 **826 m/px**이고, 12 km bbox가 **14.6 px**다. 발표 줌 z12.4 화면이
9.78 m/px이므로 **84배 확대**다(MapLibre 512px 타일 기준 화면 해상도 =
40075017·cos φ/(512·2^z)). 오피둠 대지 1.6 km가 2 px이니 기복이 아니라 뭉개진 얼룩이 된다.
게다가 `public/datasets/*/terrain/`은 gitignore라 github.io에는 애초에 올라가지 않는다
(라이브에서 `meta.json` 404, `terrain: false`). z8~13을 새로 구우면 80 MB 이상이고
`relief` 레이어와의 전환 분기까지 따라온다 — `MICROMAP-BASEMAP.md` 「실측 정정」이 적은
그대로다. 알레시아는 타일 피라미드가 아니라 **이미지 한 장**으로 가는 편이 싸다.
