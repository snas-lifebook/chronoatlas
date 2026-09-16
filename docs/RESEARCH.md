# RESEARCH — 무엇을 알아내야 하나

> 볼트 `Works/비주얼파이프라인/`에서 이관 (2026-09-16). 원본 작성 2026-08-14 · 최종 ?

SDD에서 빠졌던 조사 과정을 명시한다. [PLAN](PLAN.md)의 위험(R1~R4)과 열어둔 것을 **무엇을·어떻게 조사해 무엇으로 결론내는가**. 결론은 [CLARIFY](CLARIFY.md)·[PLAN](PLAN.md)으로 승격하고 여기서 지운다.

초기 조사 원문은 `research/`([로마제국쇠망사_레퍼런스_모음](research/로마제국쇠망사_레퍼런스_모음.md)·[AI플랫폼_기술조사](research/AI플랫폼_기술조사.md)). 이 문서는 그걸 **트랙으로 나눠 확장·검증**하는 설계다.

## 리서치 트랙

| 트랙 | 질문 | 방법 | 산출 | 상태 |
|---|---|---|---|---|
| **A 기술 검증** | 하이브리드 좌표 동기화(MapLibre↔오버레이, 3D 틸트)? WebGL+2D **export 합성**? Konva vs deck.gl? | 웹서치(사례·베스트프랙티스) → **코드 스파이크(POC)** | 접근 결정 + 스파이크 결과 | **서치 완료** — Konva 권고(아래), 스파이크로 확정 |
| **B 데이터 소싱** | 시대별 국경 GeoJSON(한니발 BC218~), 로마 도시·도로 좌표, 라이선스 | 병렬 에이전트 서치 + 데이터 검증 | 소스 표 + 채택 데이터셋 | **완료(2026-08-14)** — NE+bc300+AWMC+Pleiades, [SCHEMA](SCHEMA.md) 반영 |
| **C 에셋 소싱** | 군단·인물·자원 토큰 SVG, 라이선스(상업·표기 조건) | 에이전트 서치 | 아이콘 소스 표 | **완료(2026-08-14)** — game-icons+milsymbol+Twemoji, [SCHEMA](SCHEMA.md) 반영 |
| **D 벤치마크 UX** | 우수사례의 레이어토글·타임라인·내보내기 UX를 어떻게 차용하나 · **어디까지 재사용/어디부터 자체제작** | 병렬 에이전트 3각(데이터백본·앱UX·렌더패턴) | 재사용 vs 자체제작 경계표 + 차용 부품 | **완료(2026-08-14)** — 아래 결론 |
| **E 스타일** | 양피지/고지도 미감, MapLibre 스타일 제작 도구 | 서치 + Maputnik 스타일 실험 | 스타일 레퍼런스 + 실험 | **진행중** |

## 트랙 A 결론 — 하이브리드 기술 (2026-08-14)

서치로 접근을 좁혔다. 최종은 스파이크가 확정하지만 방향은 섰다.

- **좌표 동기화 → Konva 오버레이 + `render` 이벤트마다 `map.project(lngLat)` 재투영.** `project()`는 pitch/tilt까지 반영하므로 "3D에서 깨진다"는 건 오해였다 — 진짜 문제는 재계산 *시점*이라 `moveend`가 아니라 `render`마다 재투영해 `batchDraw()` 해야 랙 없이 붙는다. Konva `Stage`를 `map.getCanvasContainer()`에 얹는다.
- **deck.gl interleaved는 유보** — 토큰이 지형에 눕는 3D 오브젝트가 아니라 카메라를 보는 평면 마커라 3D 오클루전이 불필요하고, deck.gl은 지형(DEM) 결합 시 z=0 정렬 한계가 있다. 드래그 편집도 Konva `draggable`이 훨씬 적은 코드. 진짜 3D 지형/건물 오클루전이 필요해지면 그때 옵션.
- **export PNG → 직접 합성**: `map.getCanvas()` + `konvaStage.toCanvas()`를 오프스크린에 `drawImage` → `toDataURL`. `preserveDrawingBuffer:true` 필요(캡처 1회 50~100ms). **html2canvas 금지**(WebGL 못 읽어 검은 이미지).
- **export MP4 → captureStream + MediaRecorder(webm) → ffmpeg.wasm로 mp4**. MediaRecorder는 크로스브라우저 mp4 미지원(Chrome=webm). 녹화 중 `preserveDrawingBuffer:true` + 드래그가 특정 줌에서 렌더 깨지는 알려진 버그(#4055) 있으니 QA.
- **스파이크 체크리스트**: ① pitch 60°에서 다수 토큰 재투영 랙 ② `preserveDrawingBuffer:true`+드래그 #4055 재현 ③ PNG 합성 픽셀 정합(devicePixelRatio) ④ captureStream 10~30초 프레임레이트 ⑤ ffmpeg.wasm 변환 시간(길면 서버 전환).

근거는 deck.gl 공식(interleaved·지형 한계)·maplibre #4055·#2245·mapbox #5390·html2canvas #1631·MapTiler 성능 실측 등. PLAN 스택 절에 반영.

## 트랙 B·C 결론 — 데이터·에셋 (2026-08-14)

병렬 에이전트가 URL·라이선스를 실측 검증. 상세 표·처리는 [SCHEMA](SCHEMA.md)로 승격했다. 요지:

- **영토 데이터(B)**: Natural Earth(PD, 지형)를 하단에 깔고, 정치 경계는 `historical-basemaps world_bc300`을 **연도 근접성이 아니라 사실 정합성**으로 채택(카르타고 이베리아 포함 — bc200은 전쟁 후 판도라 오답). 도로·알프스 세부명은 AWMC, 지명 포인트는 Pleiades. DARE는 제외(다운로드 링크 death + 제정기 판도).
- **라이선스 함정**: bc300=**GPL-3.0**, AWMC=**ODbL(share-alike)** — 둘 다 카피레프트. → 우리 `territory.geojson`은 **자체 저작**, 이 데이터셋은 파일 재배포 없이 **보고 그리는 참조**로만 써서 전파 회피([CONSTITUTION](CONSTITUTION.md) 9 정합).
- **토큰(C)**: game-icons.net(CC BY 3.0, 작가별 표기) 본체 + milsymbol(MIT, 추상 마커 런타임 생성) + Twemoji(폴백). 크레딧 페이지로 표기 해결.

## 트랙 D 결론 — 재사용 vs 자체제작 경계선 (2026-08-14)

3각 벤치마크(시간버전 데이터백본 · 앱 UX·코드 · MapLibre 렌더패턴). **핵심: 엔진·메커니즘은 전부 기성 OSS로 안 짜도 되고, 로마 콘텐츠(정확한 국경)만 우리가 만든다.** 처음부터 다 만들 필요 없다 — 단 경계가 분명하다.

**재사용 (엔진·메커니즘 — 자체제작 금지)**

| 부품 | 기성품 | 라이선스 | 비고 |
|---|---|---|---|
| 지도 렌더 | MapLibre GL | BSD | 채택됨 |
| **시간 필터**(연도→피처 존재/소멸) | **OHM `@openhistoricalmap/maplibre-gl-dates`** + 공식 time-slider `setFilter` 패턴 | 공개 | **우리 `setData` 재계산 폐기 → `setFilter`.** 피처에 `start_date`/`end_date` 부여 |
| 타임라인 UI(도킹·재생·speed·`goTo`) | **`opengeos/maplibre-gl-time-slider`** | MIT | MapLibre 네이티브·활발. (OHM `mbgl-timeslider`는 2024 아카이브 死) |
| 이동경로 재생 | **deck.gl `TripsLayer`** (+MapLibreOverlay) | MIT | `path`+`timestamps`만 맞추면 꼬리 페이드 공짜. 카메라워크는 `hubble.gl` |
| 레이어 패널(토글·투명도·순서) | **kepler.gl** 패턴 | MIT | 도로·수로·교역로·자원·영토·행정 6종을 이 구조에 |
| 스킨 전환 | `mapbox/storytelling` style-switch + `setStyle(transformStyle)` | BSD | 커스텀 레이어는 콜백에서 재이식(known issue) |
| 지형/양피지 스킨 | `raster-dem`+`hillshade`+세피아 팔레트 | 네이티브 | 별도 텍스처보다 가벼움(OHM 실증) |
| 발표 스크롤 내러티브(옵션) | `mapbox/storytelling`(Scrollama) | BSD | 챕터 JSON→flyTo·레이어전환 |

**자체제작 (도메인 콘텐츠 — 오픈 데이터 부재/라이선스 함정)**

- **정확한 BC218 로마 국경 지오메트리** — 이 정밀도의 오픈 데이터가 물리적으로 없음. OHM은 로마 지오메트리 sparse(다운로드 불가), historical-basemaps는 100년 스냅샷+GPL, Chronas는 CC BY-SA 전파, Euratlas는 유료. → 손트레이싱/1차사료 기반 자체 저작. historical-basemaps -300/-200은 **라이선스 격리 참고**(좌표 복사 금지, 형태만).
- **territory 스냅샷·이벤트·인물·전투** (책 기반, 출처/신뢰도)
- **"팀원이 레이어 골라 다운로드" 포장 + 발표 연출** — 우리 고유 가치, OSS에 없음

**흡수 (모델·필드만 차용)**

- OHM: `start_date`/`end_date` + **EDTF**(불확실 날짜 표현) → SCHEMA 시간 모델에
- historical-basemaps: **BORDERPRECISION**(국경 확실성 등급) → SCHEMA `confidence`와 통합
- historic-country-borders-app: URL에 `year/lat/zoom` 인코딩 → 공유 링크 UX

**우리 스켈레톤에 즉시 반영할 변경**: ① `setData` 재계산 → `setFilter`/`maplibre-gl-dates` (피처에 valid_from/to = start_date/end_date) ② 타임라인은 자작 대신 `maplibre-gl-time-slider` 이식 ③ movements는 `TripsLayer`. → [TASKS](TASKS.md)로.

## 방법 (원칙)

- **웹 리서치는 하위 에이전트 병렬 위임**(소넷). 이름·URL·라이선스를 실제 검증, 지어내기 금지. 산출은 파이프 구분 행으로 받아 표로 합친다.
- **기술 검증(트랙 A)은 서치로 끝나지 않는다.** 좌표 동기화·export 합성은 실제 POC로만 확정된다 — [TASKS](TASKS.md) T1.1~T1.2·T4.1이 그 스파이크다. 서치는 접근 후보를 좁힐 뿐.
- 산출물은 **구글시트용 통합 표**(아래) + 트랙별 결론.

## 산출물

- **통합 레퍼런스 표** → `research/레퍼런스_통합표.md`(+ `.tsv` 구글시트 붙여넣기용). 초기 2문서 + 에이전트 확장 서치를 병합. 칼럼: 이름·분류·유형·설명·벤치마크포인트·우리적용·라이선스·URL
- 트랙 A 결론 → [PLAN](PLAN.md) 스택 절 갱신 + 스파이크 노트
- 채택 데이터셋·아이콘셋 → `assets/`로 승격, 출처·라이선스 기록

## 지금

- 트랙 A·B·C·D **완료** → 결론은 [SCHEMA](SCHEMA.md)·[PLAN](PLAN.md)로 승격
- 트랙 E(양피지 스타일 *디자인*)만 남음 — 스킨 *기법*(raster-dem+hillshade+세피아)은 D에서 나옴, Maputnik 실험만 뒤로
- 어떤 스킬·도구로 조사·구현하는지는 [TOOLING](TOOLING.md)

## 관련

- [PLAN](PLAN.md) · [CLARIFY](CLARIFY.md) · [TASKS](TASKS.md) · [TOOLING](TOOLING.md)
- `볼트 Context/비주얼파이프라인_레퍼런스_및_에셋` — 초기 통합 레퍼런스(표) (Context)
