# 로드맵 — 시계열 인터랙티브 역사 지도

비주얼파이프라인의 목적은 정적 지도가 아니다. **연도를 옮기면 지배·도시·전투·이동이 실시간으로 다시 그려지고, 그 시점에 필요한 데이터를 그대로 다운받아 쓰는** 인터랙티브 역사 지도다. 궁극적으로 장군을 세계지도 위 장기 말처럼 옮기고(Rome: Total War식), 지형·산지를 읽고, 한니발의 알프스 횡단 같은 장면을 시뮬레이션해 이해를 돕는다.

핵심은 **새 아키텍처가 아니라 기존 시간구동 엔진 위에 데이터 레이어를 얹는 것**이다. 엔진은 이미 있다: `schema.ts`의 `dateWindow(year)` + `main.ts`의 `setFilter`(연도 변경 = 필터, `setData` 재계산 아님), 클릭 팝업, 정적 GeoJSON 다운로드.

## 6개 축 — 스키마/엔진 매핑과 상태

| 축 | 무엇 | 데이터/엔진 | 상태 |
|----|------|------------|------|
| 지배 | 연도별 세력 판도 | `territory`(지역×통치구간, dated) + `actors` · `setFilter` | **완료** |
| 도시·자원 | 정착지, 클릭 시 자원·정보 | `settlements`(dated Point, `resource`/`terrain`) · 클릭 상세 패널(`panel.ts`) | **완료** |
| 전투 | 전투 아이콘 + 장군·승자·병력 | `battles`(dated Point) · 승자색 마커 · 클릭 팝업 | **완료(포에니 시드)** |
| 이동 | 인물·군단 이동 경로 | `movements`(dated LineString) · setFilter로 구간 누적 | **완료(한니발·스키피오 원정로)** |
| Three.js 토큰 | 장군을 장기 말처럼 이동 연출 | `src/token3d.ts` CustomLayerInterface+three, route별 토큰 + 경로 폴리라인 따라 행군 + pitch 30 | **완료(다중 토큰·행군)** |
| 3D 지형·시뮬 | 산지 파악, 한니발 알프스 횡단 | MapLibre `raster-dem`(terrarium) + `hillshade` + `setTerrain` · 고도 과장은 줌 연동 | **지형 완료**, 경로 고도 프로파일 시뮬은 할일 |

## 다운로드 (AI·팀원)
각 레이어는 정적 GeoJSON이라 URL·디스크로 그대로 받는다. 규약·fetch 경로·좌표 주의는 `public/datasets/rome-753-218/README.md` 참조. `manifest.json`이 데이터셋 목차.

## 소스·라이선스 (실측 검증)
"역사적으로 신빙성 높은 오픈 소스를 따라간다" — 단, 재배포 정책은 지킨다: **PD/자체 트레이싱만 재배포**, 카피레프트·NC·상용은 **참조만**.

| 소스 | 라이선스 | 용도 | 재배포 |
|------|----------|------|--------|
| Natural Earth 10m | PD | 해안선·강·호수·빙하·해저·지역명, Gray Earth 음영, **고도점(봉우리 132곳)** | O |
| Cliopatria (Seshat) | CC BY 4.0 | 연도별 정치체 폴리곤 3,276 → 100년 버킷 영토 | O (출처표기) |
| AWS Terrain Tiles (Mapzen/Tilezen) | 소스별(SRTM·GMTED2010·ETOPO1 등, PD 계열) | terrarium DEM 타일 → 기하 3D·hillshade | **재배포 안 함**(.gitignore) — 각자 로컬에서 받는다 |
| Pleiades | CC BY 3.0 | 고대 지명·전투 좌표, 지형지물 3,552 | O (출처표기) |
| AWMC | CC-BY-NC | 속주·도로 | 참조만 |
| DARE (imperium.ahlfeldt.se) | 미확인 | 속주·지명 | 참조만 |
| historical-basemaps | GPL-3.0 | 연도별 국경 | 참조만 |
| Polybius·Livy (고대사료) | PD | 전투·장군·병력 수치 | O |

## 다음 증분 (우선순위)
1. **경로 고도 프로파일** — 지형(DEM)은 붙었다. 남은 건 한니발 원정로를 따라 고도 단면을 그리는 것.
2. **내륙 국경 나머지** — 자연지물 앵커가 있는 주요 경계(에브로·피레네·알프스·아펜니노·포)는 정밀화 완료. 앵커 없는 러프 구간(에브로 상류·라티움/캄파니아)은 사료 확보 후.
3. **3번째 데이터셋 / 삼국지** — 초한지로 도메인 무관성 증명됨. 다음 도메인은 스키마 재사용만.

완료: 이동 경로(`movements`, 한니발 원정로 218→202) · Three.js 토큰(연도별 이징 + pitch 입체감) · 자원/지형 상세 패널(`panel.ts`, 팝업 대체) · 타임슬라이스 내보내기(`export.ts`, 현재 연도 GeoJSON 다운로드) · 콘텐츠 확장(주요 도시 9 + resource/terrain + 사건 4) · **다중 토큰·경로 행군**(한니발+스키피오, movements의 route별 토큰 자동 생성 — `routeGeometry`/`positionByRoute`) · **내륙 국경 정밀화**(에브로·피레네·알프스·아펜니노·포 자연지물 앵커) · **2번째 데이터셋 초한지**(스키마 무수정 재사용 증명, validateDataset 통과) · **데이터셋 스위처**(`?dataset=chuhan-206`).

## 현재 데이터셋
`rome-753-218` (폴더명은 초기 스코프 유지 · 실제 범위 기원전 753~201, 제2차 포에니 종전까지). 전투 시드: 트레비아·트라시메노·칸나이·메타우루스·일리파·자마.

`chuhan-206` (초한전쟁 기원전 206~202). 스키마 도메인 무관성 증명용 2번째 데이터셋 — `src/schema.ts` 무수정 재사용, `validateDataset` 통과. 楚(항우)·漢(유방), 전투 팽성·해하, 이동 유방·항우. `?dataset=chuhan-206`으로 로드.

## 기하 3D 지형 — 타일 받는 법

DEM 타일은 레포에 없다(용량·재배포). `public/datasets/<ds>/terrain/meta.json`이 있으면 엔진이 런타임에 감지해서 켠다 — `manifest`에 박지 않는 이유는 manifest는 커밋되는데 타일은 아니라서 없는 타일을 요청하게 되기 때문.

```
TERRAIN=1 npm run fetch-external
```

bbox 범위 z0~7 terrarium 타일 840장(약 20MB)을 AWS에서 받는다. **샌드박스·Cowork VM에서는 egress 차단이라 실패한다 — 로컬 터미널에서 돌려야 한다.** 받고 나면 `npm run adapt` 없이 브라우저 새로고침만 하면 켜진다.

타일이 있으면 베이크된 `rasters/relief.jpg`(NE Gray Earth)는 걷어낸다 — 음영 두 벌이 겹치면 능선이 뭉개진다. 타일이 없으면 relief.jpg가 그대로 폴백.

고도 과장은 줌에 연동한다(z3 12배 → z9 1.4배). 고정 1.4배면 낮은 줌에서 화면상 1~2px라 "3D인데 굴곡이 없다"가 된다. `setTerrain`은 표현식을 못 받아서 `zoom` 이벤트로 갱신한다.
