# 필리피 미시지도 (BC 42)

## 전제 오류

없음. 발주 메모의 사실 관계는 대체로 맞았다. 다만 사소한 정정 둘.

1. **카시우스 디오 인용 범위**. 발주는 "47.35~49"라 적었다. LacusCurtius의 Cassius Dio Book 47 목차는 "1~19장 삼두정 성립과 숙청 / 20~36장 필리피 이전 브루투스·카시우스 / **37~49장** 브루투스·카시우스의 패배와 죽음"으로 나눈다. 전투 서술은 37장부터다. 이 지도의 `source`·콜아웃은 47.37~49(또는 47.42 개별 인용)로 적었다.
2. **정본 place:필리피 좌표와 실제 GPS의 차이**. 이 프로젝트의 `public/datasets/rome/layers/settlements.geojson`은 필리피를 24.3387E/41.0251N(confidence: high)으로 잡아 두었는데, 위키백과가 주는 실제 유적 좌표는 41°00′47″N 24°17′11″E(41.01306/24.28639)다. 약 4~5km 차이다. 이 지도는 발주 지시대로 정본 좌표를 원점으로 썼고, 정본 파일은 고치지 않았다, 다만 어긋남이 있다는 사실은 여기 적어 둔다. `place:필리피`를 쓰는 다른 장면(p911-philippi-42 등)에도 같은 오차가 그대로 간다.

## 30초

- 8개 feature, 6개 콜아웃. 권장 화면: `center [24.3387, 41.0251]`, `zoom 11`. `board: null`(아래 "말판을 안 만든 이유" 참조).
- **확정**은 도시(성벽·아고라·극장, 2016년 유네스코 세계유산)뿐이다. 나머지 일곱은 근사·복원·논쟁이다.
- **가장 논쟁적인 것은 진영의 정확한 위치다.** 통설(도시 서쪽 약 3.5km, 브루투스 북쪽 언덕·카시우스 남쪽 언덕)을 따랐지만, 일부 연구는 도시에서 남동쪽 약 10km 카발라 방면 아미그달레오나스 부근으로 아예 다시 비정한다.

## 무엇이 들어 있나

| kind | feature | grade | 개수 |
|---|---|---|---|
| `wall` | 필리피 시(성벽·아고라·극장) | 확정 | 1 |
| `road` | 비아 에그나티아 | 근사 | 1 |
| `camp` | 브루투스·카시우스·삼두파 진영 | 복원 | 3 |
| `wall` | 보루선(두 진영 사이) | 복원 | 1 |
| `plain` | 필리피 늪(전장 인근) | 논쟁 | 1 |
| `hill` | 심볼론 산 | 근사 | 1 |

grade별 집계: 확정 1 · 근사 2 · 복원 4 · 논쟁 1.

## 좌표 원천

| 피처 | 원천 |
|---|---|
| `philippi:city` (앵커) | 정본 `place:필리피` = `[24.3387, 41.0251]` (`public/datasets/rome/layers/settlements.geojson`) |
| `philippi:hill:symbolon` | Pleiades pid `501631` "Mt. Symvolon" = `[24.1915, 40.8379]` (`public/datasets/rome/layers/landmarks.geojson`) |
| 나머지 6개(도로·진영 3·보루선·늪) | **손으로 찍은 좌표가 없다.** 위 두 확정점을 기준으로 사료의 방향·거리 서술(도시 서쪽 3.5km, 진영 간 약 1.5~1.8km, 암필리폴리스는 서쪽·네아폴리스는 동쪽)에 맞춘 교보재용 근사·복원이다. 발굴 좌표가 아니다 |

네아폴리스(카발라)·아미그달레오나스는 이 프로젝트 정본·Pleiades 어디에도 좌표가 없어 feature로 넣지 않았다. 지어내지 않는다는 원칙이 "일곱 항목 다 채운다"보다 우선한다.

## 사료

- 아피아노스, 『내전기』 4.105~131 (진영 배치 4.106, 삼두파 병력 4.108, 카시우스 진영 함락과 자결 4.113~114)
  - https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Appian/Civil_Wars/4*.html (LacusCurtius, 전권 한 페이지, Philippi 관련 서술 다수 포함 확인함)
- 플루타르코스, 『브루투스』 38~52
  - https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:2008.01.0011 (Perrin 역, chapter= 파라미터로 개별 장 접근)
- 카시우스 디오, 『로마사』 47.37~49 (§전제 오류 1 참조)
  - https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Cassius_Dio/47*.html
- Livius.org, "Philippi (42 BCE)", 진영 간 거리(1.5km)·삼두파 보급선(암필리폴리스 65km)·습지가 스트리몬까지 뻗었다는 서술의 출처
  - https://www.livius.org/articles/battle/philippi-42-bce/
- Society for Classical Studies, "The Site of the Battle of Philippi (42 BCE)", 진영 위치 논쟁, 아피아노스가 심볼론 산을 지형 서술에서 놓쳤다는 지적, 2002년 항공사진(Georgoula·Kaimaris) 판독
  - https://classicalstudies.org/site-battle-philippi-42-bce
- 위키백과 "Philippi", 성벽·유네스코 등재·실제 GPS·비아 에그나티아(암필리폴리스↔네아폴리스) 서술
  - https://en.wikipedia.org/wiki/Philippi
- 위키백과(한국어) "필리피 전투"
  - https://ko.wikipedia.org/wiki/%ED%95%84%EB%A6%AC%ED%94%BC_%EC%A0%84%ED%88%AC
- ResearchGate, "A Lost Macedonian Ecosystem: The Land Reclamation and Politicisation of the Philippi Marshes in Interwar Greece", 1920년대 그리스 간척 사업(늪 소멸의 근거)
  - https://www.researchgate.net/publication/373121142_A_Lost_Macedonian_Ecosystem_The_Land_Reclamation_and_Politicisation_of_the_Philippi_Marshes_in_Interwar_Greece

전부 실제 접근 확인(WebFetch·WebSearch)했다. 죽은 링크 없음.

## 말판을 안 만든 이유

아피아노스 4.108이 주는 것은 **양측 군단 총수**뿐이다, 해방자파·삼두파 각 19개 군단, 기병 삼두파 1만3천·해방자파 2만(트라키아 포함). 어느 군단이 어디 섰는지, 몇 차 공격의 정확한 기동선이 무엇인지는 사료가 특정하지 않는다(칸나이·파르살루스·알레시아처럼 당사자가 배치를 문단으로 서술한 경우와 다르다). 말판을 만들면 유닛 좌표·화살표를 지어내야 하고, 그 순간 "사료 수치만, 없으면 null"(POINTS-01-11 §1.1) 원칙을 넘어선다. `board: null`로 두었다. 만들 필요가 생기면 이 문서의 진영 세 점을 t=0 배치로 쓰고, 병력은 4.108의 총수만 얹고 나머지는 null로 두는 것이 다음 단계다.

## `kind` 값

`wall`(2) · `road`(1) · `camp`(3) · `plain`(1) · `hill`(1)

## 검증

- `python3 -m json.tool data/micromaps/philippi.json`, 유효 JSON 확인.
- `schema/micromap.ts`의 zod 제약(위 파이썬 스크립트로 대체 검증): id 접두사·중복, kind∈28종, grade∈4종, home/view zoom 범위, `view.center`가 `home` bbox 안, dem/landcover dir 정규식, 콜아웃 `num` 중복 없음·`cite` 필수·`body`≤160자·앵커 피처 존재. 전부 통과.
- 아직 안 함(엔진·빌드가 필요한 것): `npm run build`, `python3 scripts/qa-sweep.py`, `python3 scripts/look-micro.py philippi`, `data/micromaps/index.json`에 항목 추가(이 파일은 건드리지 않았다, 등록은 정본 관리자 몫).
- DEM·토지피복(`terrain-philippi`·`landcover-philippi`)은 아직 굽지 않았다. 굽기는 River 몫(브리프 원문).
