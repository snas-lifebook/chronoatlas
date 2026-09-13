# 알레시아 포위전 오버레이 (`data/overlays/pack-alesia.json`)

BC 52년 알레시아 포위전의 상세 지도용 교보재 오버레이. 43개 피처, 약 39 KB.
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

## 전거와 복원의 구분

| 피처 | 근거 |
|------|------|
| 오즈 강 · 오즈랭 강 | **실측**. OpenStreetMap Overpass에서 실제 하천 선형을 받아 전장 범위로 자르고 간략화 |
| 몽 레아 · 뷔시 산 · 펜느벨 산 · 플라비니 산 | **실측 좌표**(OSM 지명). 고도·둘레는 프랑스 지형 자료 |
| 오피둠 윤곽 | **근사**. 몽 옥수아 대지 형상과 약 97 ha라는 고고학 수치에 맞춘 타원 |
| 안쪽 · 바깥 포위선 | **근사**. 둘레만 카이사르 수치에 정확히 맞췄고 선형은 지형에 맞춘 복원. 측량 성과가 아니다 |
| 진영 A~K (8개) | **근사**. 나폴레옹 3세 도면의 진영 부호를 따르되 위치는 지형에 맞춤 |
| 보루 23개 | **개수만 전거**. 배치는 안쪽 선을 따라 등간격으로 배분한 교보재용 근사 |
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

`oppidum` · `inner_line` · `outer_line` · `camp` · `redoubt` · `gaul_camp` · `hill` · `river` · `plain`

모든 피처에 `name_ko` · `name_la` · `kind` · `teaching: true` · `source`가 있고, 최상위에도 `teaching: true`와 `source`가 있다.
부가 속성: `attested`(불리언), `camp_letter`, `decisive`, `altitude_m`, `length_roman_miles`, `length_km`, `extent_roman_miles`, `side`.

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

정본 보고서는 M. Reddé · S. von Schnurbein, *Alésia. Fouilles et recherches franco-allemandes sur les travaux
militaires romains autour du Mont-Auxois (1991-1997)*, AIBL. 직접 열람하지 않았고 위 요약들을 거쳤다.

## 검증

생성 스크립트에 불변식 검사를 달아 통과시켰다. 링 폐합, `kind` 열거값, 필수 속성 5종, `id` 중복,
좌표 bbox(4.42~4.57 E / 47.50~47.58 N), 두 선의 둘레 오차 5% 이내, 오피둠이 안쪽 선 안에 들어갈 것,
안쪽 선이 바깥 선 안에 들어갈 것, 앵커 47.5392/4.5006이 오피둠 폴리곤 안에 있을 것,
오즈가 오피둠보다 북쪽이고 오즈랭이 남쪽일 것, D 진영이 북서쪽일 것, 보루 23개·진영 8개.
