# public/assets: 초상·문장 출처 대장

여기 있는 이미지는 **전부 이 프로젝트가 만든 것**이다. 제3자 이미지를 재배포하지 않는다.
(PLAN 「레포 구조」의 `assets/ ... 출처 대장 동반` 요건. 외부 데이터 대장은 `data/external/LICENSES.md`에 따로 있다.)

## 무엇이 있나 (71개, webp)

| 폴더 | 개수 | 내역 |
|---|---|---|
| `portraits/` | 50 | 인물 초상 1:1. hero 3 (한니발·스키피오·마시니사) + AI 생성 47 |
| `icons/` | 21 | 세력 문장·집단상징·건물·사건·제도 아이콘. hero 2 (문장 로마·카르타고) + AI 생성 13 + 팔레트용 세력 문장 6 (갈리아·게르만·그리스계·누미디아·반란세력·이탈리아세력) |

## 어떻게 만들었나 (3티어)

관계분석 컴포넌트 시스템의 티어를 그대로 따른다.

- **hero (수작업, 5)**: 손으로 만든 것.
- **생성 (AI, 60)**: 인물 초상은 위키백과 흉상 사진을 **스타일 레퍼런스로 업로드**해 Google Flow(characters)로 우리 톤에 맞춰 생성했다. 고대 흉상이 없는 인물은 사료의 인상 단서로 서술 생성했다. 아이콘·문장류는 Gemini 프롬프트 + 무드보드 레퍼런스로 생성한 뒤 `컴포넌트_처리.py`로 원형 크롭·투명화했다.
- **절차적 (파일 없음)**: 세력색 프레임 + 타입 글리프 + 한글 이니셜을 코드가 그린다. 에셋이 없는 엔티티 100%를 덮는 폴백이라 **여기 파일로 들어오지 않는다.**

## 레퍼런스 정책

위키백과·위키미디어의 흉상 사진은 **생성 단계의 시각 참조로만** 썼다. 원본 사진은 이 레포에 없고 배포물에도 들어가지 않는다.
프로젝트 전반의 규칙과 같다: 카피레프트·NC·상용 소스는 참조만 하고 재배포하지 않는다 (CONSTITUTION 라이선스 절, `data/external/LICENSES.md`).

참조로 쓴 고대 흉상 자체는 고대의 조각이고, 인물별 흉상 확실성 등급(◎ 확실 / △ 코인·귀속 불확실 / ○ 고대 초상 없음)은 볼트 로스터에 기록돼 있다. **초상은 사료가 아니라 삽화다.** 얼굴을 근거로 쓰지 말 것.

## 정본

이 파일은 사본이다. 제작 규칙·티어 정의·인물별 흉상 등급의 정본은 볼트에 있다.

```
Works/관계분석_방법론/
├── .Agent.md                        설계 원칙·3티어 폴백 체인
├── components/_README.md            조립 규칙
├── components/_registry.csv         엔티티 → 세력·티어·에셋 매핑 (138행)
└── components/02_인물초상/인물_초상_로스터.md   생성 방식·흉상 등급
```

에셋을 새로 넣을 때는 레지스트리에 티어를 적고 이 표의 개수를 갱신한다. 출처가 불분명한 이미지는 넣지 않는다.

## 지형·토지피복 (public/datasets/rome/terrain*, landcover-*) — 2026-09-17

여기부터는 **제3자 공개 데이터**를 빌드타임에 구운 타일이다(OVERHAUL §3.6b·§3.7). 재배포 조건을 지킨다.

| 폴더 | 원본 | 라이선스·표기 |
|---|---|---|
| `terrain/` z0~8 | ETOPO 2022 15 Arc-Second Global Relief Model, NOAA NCEI. DOI 10.25921/fd45-gt74 | 자유 이용(공공). 인용: "NOAA National Centers for Environmental Information. 2022: ETOPO 2022 15 Arc-Second Global Relief Model" |
| `terrain-<id>/` z8~12 | Copernicus DEM GLO-30 (AWS Open Data `copernicus-dem-30m`) | "Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA; all rights reserved" |
| `landcover-<id>/` z8~12 | ESA WorldCover 10 m 2021 v200 (Zenodo 7254221) | CC BY 4.0. "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium" |
| `rasters/basemap-athens.jpg` | 「Athenae, in usum scholarum edidit Herm. Rheinhard」(Stuttgart, Carl Hoffmann, ca. 1880) 벽지도 스캔, Wikimedia Commons `File:Athenae in usum scholarum edidit.jpg` | CC0(소장 기관 공개)·저자 만료. 통제점 12 RMS 35 m로 정북 리샘플(`scripts/bake-basemap.py`). 아테네 미시지도 밑 0.6 |
| `rasters/satellite.jpg` · `satellite-sea.png` | NASA Blue Marble Next Generation, 2004년 7월, 지형 음영 + 수심 판(NASA Earth Observatory, Reto Stöckli 외) | Public Domain(NASA). 표기: "NASA Earth Observatory, Blue Marble Next Generation". 위성 스킨 전용, bbox 크롭·메르카토르 재투영만(`scripts/bake-satellite.py`) |

AWS Terrain Tiles(라이선스 혼합)는 2026-09-17에 걷어냈다. 굽는 절차는 `scripts/bake-dem.py`·`scripts/bake-landcover.py`.

## 글꼴·문장 (2026-09-17, 슬라이스 II)

| 자산 | 원본 | 라이선스 |
|---|---|---|
| `public/glyphs/Cinzel Regular/` · `public/fonts/Cinzel.ttf` | Cinzel (Natanael Gama), google/fonts `ofl/cinzel` | SIL OFL 1.1 (`public/fonts/OFL-Cinzel.txt`). 글리프는 `scripts/build-glyphs.mjs`(fontnik) |
| `public/assets/emblems/*.png` | 볼트 `Works/관계분석_방법론/components/01_세력/`(River 자산, AI 생성 문장) | 프로젝트 자체 자산. `scripts/build-emblems.py`가 128px로 |
