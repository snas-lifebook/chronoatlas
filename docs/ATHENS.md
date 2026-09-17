# 아테네 아크로폴리스 미시지도 (BC 60)

작성 2026-09-17. 산출물은 `data/micromaps/athens.json` 한 파일이다. 연도는 발표 축(기원전 60년)에 고정하고 **그 해 서 있던 것만** 그렸다. 이 지도의 존재 이유는 마지막 콜아웃 하나다, 그리스가 로마보다 먼저, 더 오래 정치 기술을 실험했다는 것.

`src/`·`schema/`·`scripts/`는 건드리지 않았다.

## 0. 30초

- 9개 feature, 6개 콜아웃. 권장 화면: center `[23.7266, 37.9715]`, zoom `14.0`.
- **도판(basemap) 채택 실패.** 위키미디어 커먼즈에서 PD 19세기 지도(Curtius·Kaupert 「Karten von Attika」 1881 계열)를 조사했으나, 이번 세션에서는 접근 가능한 이미지 파일과 지오레퍼런싱 제어점을 확보하지 못해 시도를 완료하지 못했다. 알레시아 사례처럼 `basemap: null`로 남기고 벡터로만 간다. 후속 세션에서 재시도할 것.
- 아그리파 오데온(BC 15)·하드리아누스 도서관(AD 132)은 이 연대에 없어서 뺐다. §3 참고.

## 1. 무엇이 들어 있나

| kind | feature | 개수 |
|---|---|---|
| `hill` | 아크로폴리스 · 아레오파고스 | 2 |
| `temple` | 파르테논 · 에레크테이온 | 2 |
| `gate` | 프로필라이아 | 1 |
| `theatre` | 디오니소스 극장 | 1 |
| `forum` | 아고라 | 1 |
| `field` | 프닉스 | 1 |
| `river` | 일리소스 강 | 1 |

## 2. 확정 · 근사 · 복원 · 논쟁

**확정** (7개): 아크로폴리스 · 파르테논 · 프로필라이아 · 에레크테이온 · 디오니소스 극장 · 아고라 · 아레오파고스. 전부 위키백과 좌표 필드 또는 정본 landmarks.geojson의 Pleiades 점에서 왔다(§4). 아고라·프닉스는 폴리곤 경계가 근사이지만 위치 자체는 확정이라 `roma.json` 선례(카피톨리누스·포룸 로마눔 처리)를 따라 `grade: 확정` + `source` 접두어로 그 사실을 적었다.

**근사** (1개): 일리소스 강. 정본 Pleiades 점 하나뿐이라 선형 없이 Point로 두었다.

**복원**: 없다. 테미스토클레스 성벽은 그리지 않았다. 측량 좌표를 가진 문서가 없고(「Themistoclean wall」·「Walls of Athens」 모두 좌표 필드 없음), 안쪽 지점 다섯을 이은 폐곡선은 성벽이 아니라 발명한 선이라 뺐다(2026-09-17 검토). 노선 자료가 생기면 `wall`로 넣는다.

**논쟁**: 이 지도에는 논쟁 등급 feature가 없다. 논쟁은 콜아웃 6번(로마의 정치체제 수용 전승)에서 사료 층위로만 다룬다.

## 3. BC 60에 있었나

| 것 | 연대 | 처리 |
|---|---|---|
| 아크로폴리스 | 선사시대부터 | 있음 |
| 파르테논 | 기원전 447~438(봉헌) | 있음, 약 380년째 서 있다 |
| 프로필라이아 | 기원전 437~432 | 있음 |
| 에레크테이온 | 기원전 421~406 | 있음 |
| 디오니소스 극장(석조) | 기원전 4세기(리쿠르고스 개축) | 있음, 목조 시절부터면 훨씬 이전 |
| 아고라 | 기원전 6세기부터 기능 | 있음 |
| 프닉스 | 기원전 5세기부터 민회 장소 | 있음 |
| 아레오파고스(제도) | 정치 권한은 기원전 462년 에피알테스 개혁으로 축소, 재판 기능은 존속 | 있음(권한 축소된 채로) |
| 일리소스 강 | 자연 지형 | 있음 |
| **아그리파 오데온** | 기원전 15년 완공 | **없음.** BC 60보다 45년 뒤. 제외 |
| **하드리아누스 도서관** | 서기 132년 | **없음.** BC 60보다 192년 뒤. 제외 |

## 4. 출처

**정본 조회** (`public/datasets/rome/layers/{settlements,landmarks}.geojson`, 키워드 `['아테네','Athenae','Pnyx','Piraeus','Acropolis','Areopagus','Ilissos','Eridanos','Kerameikos','Agora']`):

```
S place:아테네 아테네 Athenae 아테네, 그리스 [23.7275, 37.9838]
L Eridanos river Point [23.722, 37.9773]
L Ilissos river Point [23.7237, 37.9658]
L Areopagus hill Point [23.7234, 37.9724]
L Pnyx hill Point [23.7195, 37.9714]
L Kolonos Agoraios hill Point [23.7212, 37.9754]
```

**위키백과 좌표 필드** (2026-09-17 조회):

- [Acropolis of Athens](https://en.wikipedia.org/wiki/Acropolis_of_Athens) 37.97167, 23.72611
- [Parthenon](https://en.wikipedia.org/wiki/Parthenon) 37.9715, 23.7266
- [Propylaea (Acropolis of Athens)](https://en.wikipedia.org/wiki/Propylaea_(Acropolis_of_Athens)) 37.97169, 23.72511
- [Erechtheion](https://en.wikipedia.org/wiki/Erechtheion) 37.9721, 23.7265
- [Theatre of Dionysus](https://en.wikipedia.org/wiki/Theatre_of_Dionysus) 37.97034, 23.727784
- [Ancient Agora of Athens](https://en.wikipedia.org/wiki/Ancient_Agora_of_Athens) 37.975, 23.7225 (정본 Kolonos Agoraios 점과 150m 이내로 교차 확인)
- [Areopagus](https://en.wikipedia.org/wiki/Areopagus) 37.97222, 23.72361 (정본 landmarks 점과 30m 이내, 정본 값을 채택)
- [Pnyx](https://en.wikipedia.org/wiki/Pnyx) 37.97167, 23.71944 (정본 landmarks 점과 거의 일치, 정본 값을 채택)
- [Kerameikos](https://en.wikipedia.org/wiki/Kerameikos) 37.97833, 23.71889 (성벽 앵커로 쓰려 했으나 성벽은 그리지 않았다. 미사용)

**찾았지만 좌표가 없던 문서**: 「Themistoclean wall」(문서 없음), 「Walls of Athens」(문서 없음), 「Dipylon」(좌표 필드 없음).

**사료**

- 플루타르코스, 『아리스티데스』 7 (도편추방 정족수 6,000표)
- 아리스토텔레스, 『시학』 4 (비극·희극의 기원)
- 플루타르코스, 『페리클레스』 12~14 (파르테논 건축 자금 논쟁)
- 아리스토텔레스, 『아테네인의 국제』 25(아레오파고스 권한 축소), 43(불레·법정)
- 리비우스, 『로마사』 3.31~33 (12표법 이전 그리스 사절단 전승, 사실성 논쟁)

## 5. 마지막 콜아웃에 대하여

`athens:call-rome`은 반박이 아니라 증명이다. 리비우스가 전하는 「로마가 12표법을 만들기 전 그리스에 사절단을 보내 법을 살폈다」는 이야기는 역사학계에서 후대에 만들어진 전승으로 보는 시각이 우세하고, 로마 공화정 자체의 기원은 그리스와 무관하게 독자적으로 형성됐다는 것이 통설이다. 이 콜아웃이 말하려는 것은 그 전승의 사실 여부가 아니라, 이 언덕 위에 서 있는 실물들(민회·법정·평의회·재판소)이 로마의 그것들보다 앞서 굴러가고 있었다는 사실 자체다.
