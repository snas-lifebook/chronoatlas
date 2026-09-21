# 카프리 섬 미시지도 (티베리우스, AD 27~37) + 로마 AD 41 피처

작성 2026-09-21. 산출물은 세 파일이다, `data/micromaps/capri.json`(카프리 섬 미시지도), `data/micromaps/_roma-ad41.features.json`(기존 `roma.json`에 병합될 서기 41년 시점 피처·콜아웃 초안), 이 문서. `data/micromaps/roma.json`·`index.json`은 읽기만 했고 손대지 않았다. 정본 온톨로지(`ontology/entities.jsonl`·`links.jsonl`)도 열지 않았다.

## 전제 오류

- River가 준 전제 중 두 위키데이터 QID가 틀렸다. **빌라 요비스는 Q1211339가 아니라 Q2165460이다**, Q1211339는 조각가 미켈란젤로의 「다비드」상이다. **카스트라 프라이토리아는 Q1048097이 아니라 Q1049836이다**, Q1048097을 직접 조회하지는 않았지만 검색으로 나온 정확한 항목은 Q1049836(라벨 "Castra Praetoria", 설명 "Roman fort")이다. 이 문서·두 JSON 전부 검증된 QID로 다시 썼다.
- 「티베리우스의 절벽(Salto di Tiberio)」은 위키데이터에 항목(Q3945844, 이탈리아어 라벨만)은 있지만 좌표(P625)가 없다. 검색 결과에 동명이인 항목(Q95704904, 인물, `P31: Q5`)이 섞여 나와 혼동하기 쉬웠다, 그건 사람이다.
- 그 외 전제(카스트라 프라이토리아 AD 21~23 건설, 팔라티움 크립토포르티쿠스 암살, 클라우디우스가 병영에서 옹립)는 사료·유구와 맞아 그대로 썼다.

## 0. 30초

- `capri.json`: 6 feature, 5 콜아웃. 권장 화면 center `[14.262628, 40.55823]`(빌라 요비스), zoom 13.
- `_roma-ad41.features.json`: 신규 feature 1개(카스트라 프라이토리아, `built_year: 23`), 신규 콜아웃 3개(번호 8~10, `roma.json` 기존 1~7과 안 겹침).
- 도판(바탕지도)은 굽지 않았다. 카프리 19세기 PD 후보를 커먼즈에서 찾아봤으나 §5에 적은 대로 확정하지 못했다.
- 좌표는 전부 위키데이터 P625 또는 정본 `land.geojson`/`settlements.geojson`에서 왔다. 지어낸 좌표는 없다, 다만 「티베리우스의 절벽」은 좌표 자체가 없어서 빌라 요비스 좌표를 그대로 빌려 썼다(§2에서 명시).

## 1. 카프리, 무엇이 들어 있나

| kind | feature | 개수 |
|---|---|---|
| `island` | 카프리 섬 | 1 |
| `building` | 빌라 요비스 | 1 |
| `hill` | 티베리오 산 | 1 |
| `cape` | 티베리우스의 절벽 | 1 |
| `harbor` | 마리나 그란데 | 1 |
| `district` | 아나카프리 | 1 |

## 2. 확정 · 근사 · 논쟁

**확정** (3개): 카프리 섬(폴리곤) · 빌라 요비스 · 티베리오 산.

- 카프리 섬 폴리곤은 정본 `public/datasets/rome/layers/land.geojson`의 629개 폴리곤 중 313번(속성 `minor: true`, Natural Earth 10m minor-islands 파생)을 그대로 잘라 썼다. bbox가 14.196~14.2621E, 40.538~40.561N이고, 정본 `settlements.geojson`의 `place:카프리섬`(Capreae) 점 `[14.2333, 40.55]`이 이 폴리곤 안에 든다, 두 정본 소스가 같은 섬을 가리키는지 교차 확인했다.
- 빌라 요비스는 위키데이터 Q2165460(라벨 "Villa Jovis", 설명 "historical building in Capri, Italy") 좌표 `40.55823N, 14.262628E`. 발굴로 평면이 확인된 유구다.
- 티베리오 산은 위키데이터 Q31220206(라벨 "Monte Tiberio") 좌표 `40.55917N, 14.26166E`. 위치는 확정이지만 이건 현대 이탈리아어 지명이고, 고대 라틴어로 이 봉우리를 뭐라 불렀는지는 사료에 남아 있지 않다(그래서 feature 자체 grade는 확정, `name_la`에는 "Mons Tiberii"라는 현대 관례 표기만 적었다).

**논쟁** (1개): 티베리우스의 절벽(Salto di Tiberio). 위키데이터 Q3945844에 항목은 있으나(이탈리아어 라벨·설명만, "precipizio a picco sul mare sull'isola di Capri") 좌표(P625) 자체가 없다. 수에토니우스가 전하는 처형 전승의 무대라는 것 말고는 특정 지점을 가리키는 유구가 없다. **이 지도에서는 빌라 요비스와 정확히 같은 좌표를 썼다**, 근처라고 추정해서 새 좌표를 만든 게 아니라, 독립된 좌표가 없다는 사실 자체를 그대로 반영한 것이다. 시각적으로 두 핀이 겹친다는 게 이 처리의 대가이고, 엔진에서 겹침 처리가 필요해지면 그건 좌표 문제가 아니라 UI 문제다.

**근사** (2개): 마리나 그란데 · 아나카프리. 둘 다 위키데이터 좌표(각각 Q6763830, Q71617)가 있지만 그건 **현대 마을·코무네의 좌표**다. 로마 시대에 이 자리에 정확히 무엇이 있었는지(항구 시설의 위치, 취락의 존재)를 특정하는 사료·유구는 이번 조사에서 확인하지 못했다. 지형상 마리나 그란데가 고대에도 본토를 오가는 주 상륙지였을 가능성은 높지만, "가능성이 높다"와 "확인됐다"를 구분해 근사로 뒀다.

## 3. 사료와 전승

| 것 | 사료 | 성격 |
|---|---|---|
| 티베리우스가 서기 26년 캄파니아로, 27년 카프리로 옮겨 죽을 때까지 안 돌아옴 | 타키투스, 『연대기』 4.57 | 확정(전기 사실) |
| 열두 별장을 올림포스 신들의 이름을 따 지었다 | 타키투스, 『연대기』 4.67 | 전승, 발굴로 확인된 건 빌라 요비스 하나뿐이다. 이 지도는 열두 채를 그리지 않고 콜아웃(`capri:call-twelvevillas`)으로만 그 격차를 짚었다 |
| 빌라 요비스가 발굴로 확인된 유구다 | (근대 고고학, 사료 아님) | 확정 |
| 실각한 자들을 절벽에서 던져 죽였다 | 수에토니우스, 『티베리우스』 62 | 전승, 정확한 지점을 가리키는 유구 없음. §2 참고 |
| 원로원에 서한으로 정무를 처리했다 | 수에토니우스, 『티베리우스』 40~43 | 확정(전기 사실) |

## 4. 로마 AD 41 피처

`_roma-ad41.features.json`은 `roma.json`(공화정 말, 기원전 44년 기준)에 병합될 것을 전제로 한 초안이다. 두 갈래로 나눴다.

**신규 feature 1개**, 카스트라 프라이토리아. `roma.json`에 없던 지형지물이라 새로 넣었다. `built_year: 23`을 달아서, `roma.json`이 기원전 44년 장면에 쓰일 때는 자동으로 숨고 서기 41년 장면에서만 나타난다(스키마 R59의 시기 피처 규칙). 좌표는 위키데이터 Q1049836(라벨 "Castra Praetoria", 설명 "Roman fort") `41.908799N, 12.507941E`, `roma.json`의 `home` bbox(중심 `[12.4823, 41.8925]`, span 0.35) 안에 들어온다.

**신규 콜아웃 3개, 번호 8~10**, `roma.json` 기존 콜아웃이 1~7번을 쓰고 있어 8부터 이었다.

1. `roma:call-castrapraetoria`(8), 카스트라 프라이토리아 신설 자체. 새 feature에 앵커, `from_year: 23`.
2. `roma:call-caligula-assassination`(9), 팔라티움 암살. **새 feature를 만들지 않고** 기존 `roma.json`의 `roma:palatinus`(팔라티누스 언덕) 피처에 앵커만 걸었다. 수에토니우스 『칼리굴라』 58, 요세푸스 『유대고대사』 19.1.14(크립토포르티쿠스, 통로에서의 암살). `from_year: 41, to_year: 42`로 서기 41년 장면에만 뜨게 좁혔다.
3. `roma:call-claudius-acclaimed`(10), 클라우디우스 옹립. 카스트라 프라이토리아 feature에 앵커. 수에토니우스 『클라우디우스』 10. `from_year: 41, to_year: 42`.

팔라티움 자체를 새 feature로 쪼개지 않은 이유: 요세푸스가 말하는 "극장 통로"가 팔라티누스 궁 복합체 안 어딘가라는 것은 분명하지만, 그 통로의 정확한 위치를 가리키는 좌표(발굴 도면상 특정 지점)를 이번 조사에서 확보하지 못했다. 언덕 전체를 가리키는 기존 폴리곤에 사건을 얹는 것이 좌표를 지어내는 것보다 정직하다고 판단했다.

## 5. 도판 후보

이번 라운드에서는 굽지 않았다. 커먼즈에서 카프리의 19세기 PD 지도를 찾아봤으나, `docs/MICROMAP-BASEMAP.md`가 알레시아에서 겪은 것과 같은 문제(측량도가 아니라 삽화, 또는 저자·라이선스 미확인)를 배제할 만큼 확실한 후보를 이번 조사에서 확정하지 못했다. 후보를 찾으면 이 절에 파일 제목·URL·라이선스·픽셀 크기만 적고, 실제로 굽는 것은 `scripts/bake-basemap.py`를 쓰는 별도 작업이다(athens 선례).

## 6. 출처

**위키데이터 (P625, 조회 2026-09-21, User-Agent 헤더로 하나씩 순차 조회)**

- [Villa Jovis](https://www.wikidata.org/wiki/Q2165460) Q2165460, 40.55823, 14.262628
- [Monte Tiberio](https://www.wikidata.org/wiki/Q31220206) Q31220206, 40.55917, 14.26166
- [Marina Grande, Capri](https://www.wikidata.org/wiki/Q6763830) Q6763830, 40.55528, 14.24056
- [Anacapri](https://www.wikidata.org/wiki/Q71617) Q71617, 40.55139, 14.21667
- [Castra Praetoria](https://www.wikidata.org/wiki/Q1049836) Q1049836, 41.908799, 12.507941
- [Salto di Tiberio](https://www.wikidata.org/wiki/Q3945844) Q3945844, 좌표 없음(§2)

**정본 조회**

- `public/datasets/rome/layers/settlements.geojson`: `place:카프리섬`(Capreae, island, `[14.2333, 40.55]`)
- `public/datasets/rome/layers/land.geojson`: 폴리곤 313번(minor island, bbox 14.196~14.2621E/40.538~40.561N), 카프리 섬 폴리곤으로 채택
- `public/datasets/rome/layers/landmarks.geojson`(Pleiades): "Monte Solaro"(pid 207490748, 섬 남서쪽 최고봉 589m, 이 지도에서는 안 씀, 빌라 요비스는 반대편 북동쪽 티베리오 산에 있다)만 카프리 관련으로 걸림. 빌라 요비스·수렌툼 항목은 이 정본 파일에 없었다.

**위키백과 (실존 확인, User-Agent 헤더로 HTTP 200 확인, 2026-09-21)**

- [Villa Jovis](https://en.wikipedia.org/wiki/Villa_Jovis)(en) · [카프리 섬](https://ko.wikipedia.org/wiki/카프리_섬)(ko)
- [Salto di Tiberio](https://it.wikipedia.org/wiki/Salto_di_Tiberio)(it, 위키데이터 유일 사이트링크)
- [아나카프리](https://ko.wikipedia.org/wiki/아나카프리)(ko) · [Marina Grande, Capri](https://en.wikipedia.org/wiki/Marina_Grande,_Capri)(en)
- [카스트라 프라이토리아](https://ko.wikipedia.org/wiki/카스트라_프라이토리아)(ko) · [칼리굴라](https://ko.wikipedia.org/wiki/칼리굴라)(ko) · [클라우디우스](https://ko.wikipedia.org/wiki/클라우디우스)(ko) · [Tiberius](https://en.wikipedia.org/wiki/Tiberius)(en)

**사료**

- 타키투스, 『연대기』 4.57(캄파니아·카프리 이주), 4.67(열두 별장 전승)
- 수에토니우스, 『티베리우스』 40~43(원로원 서한 통치), 62(절벽 처형 전승), 65(죽음)
- 수에토니우스, 『칼리굴라』 58(암살)
- 요세푸스, 『유대고대사』 19.1.14(극장 통로)
- 수에토니우스, 『클라우디우스』 10(병영 옹립)

## 7. 검증

- `capri.json`: 6 feature 전부 `id`가 `capri:` 접두, 중복 없음. `kind`가 KINDS 28종 안, `grade`가 GRADES 4종 안. 콜아웃 5개 `num` 1~5 중복 없음, 모든 `anchor.feature`가 실제 feature id를 가리킴, `body` 전부 160자 이내(최대 88자), `side`가 `left`/`right`만. `view.center`가 `home.at` ± `home.span` 범위 안(파이썬으로 직접 계산해 확인).
- `_roma-ad41.features.json`: 신규 feature id(`roma:castra-praetoria`)가 기존 `roma.json`의 어떤 id와도 안 겹침. 콜아웃 번호(8, 9, 10)가 기존 `roma.json`의 1~7과 안 겹침. 앵커 2개(`roma:palatinus`, `roma:castra-praetoria`)가 병합 후 존재하는 id를 가리키는지 기존 `roma.json`을 직접 읽어 확인. `built_year: 23`이 이 파일의 유일한 시기 필드다.
- 두 파일 다 `python3 -m json.tool`로 파싱 확인, `ensure_ascii=False, indent=1`.
- 위키백과 링크 11개 전부 `curl -I` HTTP 200 확인(User-Agent 헤더 포함, 요청 간 최소 2초 간격).
