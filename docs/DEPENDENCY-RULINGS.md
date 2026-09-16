# 의존성 기각 근거 (구 「이식안」, 2026-08-18)

> **2026-09-16 재분류 + 실측 정정.** 이 문서를 `docs/history/`(끝난 기록)에 넣었다가 되돌렸다. 기록이 아니라 **살아 있는 기각 근거**다. 아래는 코드를 직접 찍어 확인한 결과다.
>
> **채택된 셋은 제안 그대로 들어오지 않았다.**
>
> | # | 후보 | 실제 |
> |---|---|---|
> | 1 | 클릭 시 flyTo | 구현됐으나 **트리거가 다르다.** 제안은 *피처 클릭*, 실제는 *장면 전환*(`App.tsx:157` `goScene` → `engine.ts:1373` `flyTo`). **피처 클릭 연출은 여전히 없다** |
> | 2 | hover 프리뷰 | **제안 그대로.** `feature-state hover` + 지연 팝업, 이름·연도 한 줄 |
> | 3 | 원정로 순차 행군 | 구현됐으나 **메커니즘이 다르다.** 제안은 *서브틱 연도*, 실제는 `schema.ts:68` `routeGeometry()`가 연도순 `stops[]`로 연속 경로를 만들고 `engine.ts:1119`가 토큰에 물린다. 구 `positionAtYear`는 `schema.ts:53`에 남아 다른 용도로 쓰인다 |
> | 4 | 스크롤리텔링 | **절반, 다른 UX.** 발표 모드(`src/present.ts`, `?present=1`)는 생겼지만 스크롤이 아니라 `[`·`]` 키 순환이다 |
> | 5 | CSS scroll-driven | 4번이 스크롤 기반이 아니라 **적용 대상 자체가 없다** |
>
> **아직 살아 있는 것은 둘이다.** ① **6번 family-chart 계보**는 미도입이고, 제안 당시와 같은 이유로 막혀 있다(person 축이 스키마에 없다). ② **7·8·9번의 기각 근거는 지금도 유효하다.** `package.json`에 `deck.gl`·`d3`·`scrollama`·`family-chart`가 **전부 없고**, 8번의 사유(GL 컨텍스트 공유 충돌)는 `token3d.ts:142` `new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl })`로 지금도 그대로 성립한다.
>
> **d3 기각은 여기 말고 코드에도 한 번 더 있다.** `src/app/GraphPanel.tsx:2`가 이렇게 적고 있다: *"d3-force 대신 60줄 시뮬레이션(반발·스프링·중심 인력). 노드 ≤ ~60이라 O(n²) 충분. **라이브러리는 200 노드 넘을 때.**"* 이 문서가 「왜 안 쓰나」를 들고 있고 그 주석이 「언제 다시 볼 것인가」를 들고 있다. 둘을 같이 읽어라.
>
> **코드 라인 인용은 전부 무효다.** `main.ts`·`panel.ts`·`export.ts`는 **파일째 사라졌다.** 8/18 이후 바닐라 TS 단일 파일에서 React 구조(`src/main.tsx` + `src/app/*.tsx` + `src/map/*.ts`)로 전면 리팩터됐다. 살아남은 파일도 줄 번호가 밀렸다(`token3d.ts` 63-64 → 142-143, `schema.ts` 46-57 → 53-63, 156 → 226). **판단 근거만 유효하고 수치·경로·줄번호는 낡았다고 읽어라.**
>
> **이 후보들은 대부분 `BACKLOG.md`를 거치지 않았다.** 1·2·5·6·7·8번은 대응 R이 **없다**. 3번은 R21(군단 이동)과 문제의식이 같지만 R21의 해소 경로는 R37(보드게임형 유닛 배치)로 갔고, 실제 개선(`routeGeometry`)은 **R21에도 R37에도 번호가 안 붙은 채 조용히 들어갔다.** 4번은 R43(발표 모드)에 가깝지만 방식이 다르다. 9번의 결정은 `BACKLOG`가 아니라 **`BLUEPRINT.md` D4**(2026-09-08)에 있다. 원장이 「요구 정본」이라고 선언돼 있지만 **실제로 만들어진 것 전부를 담고 있지는 않다.**

## 비주얼파이프라인 현재 상태

- 스택: MapLibre GL JS ^6.3.0 + Vite ^8.2.0 + TypeScript ~6.0.2 + Vitest ^4.1.10, 단일 커스텀 Three.js ^0.185.1 레이어(src/token3d.ts). 새 의존성 없음.
- 완료: territory·admin_regions·settlements·battles·movements 5개 시간가변 GeoJSON 레이어를 setFilter(schema.ts의 dateWindow)로 연도 필터. 한니발 토큰(Three.js CustomLayerInterface, 세그먼트 끝점 500ms 이징). 클릭 상세 사이드 패널(panel.ts). 타임슬라이스 GeoJSON 다운로드(export.ts).
- 데이터 규모: 정착지 9, 전투 6, 원정로 세그먼트 11(한니발 1개 루트). 로드맵상 다음 우선순위 1번이 "토큰 행군 애니메이션"이다.
- 알려진 격차: movements.geojson은 waypoint에 정수 연도만 부여한다(_gen_movements.mjs). 같은 해에 여러 세그먼트가 있으면(예: 기원전 218년의 에브로 도하·피레네 통과·론강 도하 3개 세그먼트가 모두 valid_from: -218) positionAtYear(schema.ts:46-57)가 마지막 매치로 즉시 스냅해 중간 구간을 건너뛴다. 카메라는 생성자에서 center/zoom을 1회 설정한 뒤 flyTo를 전혀 쓰지 않는다(main.ts:41).

## 이식 후보

### 1. 클릭 시 flyTo 카메라 연출

- 무엇을: 피처 클릭 시 그 지점으로 카메라가 부드럽게 이동·줌인.
- 어느 사례에서: MapLibre GL JS 공식 예제(flyTo, FlyToOptions — center/zoom/pitch/bearing/duration/curve/easing 파라미터, essential:true로 prefers-reduced-motion 처리).
- 어디에 어떻게: main.ts:102-106의 클릭 핸들러(map.on('click', layerId, e => panel.show(...)))에 한 줄 추가. e.lngLat을 map.flyTo({ center: e.lngLat, zoom: Math.max(map.getZoom(), 6), essential: true })에 넘기면 된다. 새 의존성 없음, MapLibre가 이미 가진 기능.
- 난이도/우선순위: 낮음(1줄~5줄) / 높음.
- 주의: 이벤트 틱(main.ts:146-156, d.events)은 좌표가 없어 같은 방식으로 확장하려면 HistEvent에 lng/lat을 추가해야 한다(스키마 변경, 별도 작업).

### 2. Mapping the Fall식 hover 프리뷰

- 무엇을: 정착지·전투 지점에 마우스를 올리면 이름을 미리 보여주고, 클릭해야 상세 패널이 열리는 2단계 인터랙션.
- 어느 사례에서: Mapping the Fall(mappingthefall.gla.ac.uk) — 지도 핀을 통해 지역별 붕괴 과정을 추적하는 패턴(타임라인 드래그/화살표/재생은 비주얼파이프라인이 이미 동등하게 구현돼 있어 그 부분은 이식 불필요).
- 어디에 어떻게: main.ts에 이미 import된 maplibregl.Popup을 재사용. settle-major/settle-minor/battle 레이어에 mousemove로 new maplibregl.Popup({closeButton:false, closeOnClick:false}).setLngLat(e.lngLat).setHTML(props.name_ko).addTo(map), mouseleave에서 remove(). 기존 mouseenter/mouseleave cursor 토글(main.ts:104-105) 바로 옆에 붙일 수 있다.
- 난이도/우선순위: 낮음 / 중간.
- 주의: Mapping the Fall 자체 소스는 접근 제한(개발 상세 비공개, 관련 논문도 2027년까지 비공개)이라 정확한 구현 방식은 확인 불가 — 위 제안은 사이트의 공개된 UX 설명(핀+타임라인)에서 유추한 것이고 기술은 MapLibre 자체 기능.

### 3. 원정로 순차 행군 — 기존 토큰 로직 확장 (deck.gl TripsLayer 아님)

- 무엇을: 로드맵 "다음 증분 1순위"인 행군 애니메이션. 같은 해의 여러 세그먼트를 건너뛰지 않고 순서대로 짧은 간격을 두고 통과시킨다.
- 어느 사례에서: deck.gl TripsLayer(타임스탬프 기반 궤적 애니메이션)를 검토했으나 채택 비권장 — 아래 주의 참조. 실제로는 token3d.ts에 이미 있는 이징 로직(ANIM_MS 노브, setPosition)을 그대로 재사용하는 게 더 싸다.
- 어디에 어떻게: (a) _gen_movements.mjs가 waypoint에 정수 연도만 쓰므로, 같은 해 세그먼트 순서를 보존할 소수 서브틱(예: -218.1, -218.2, -218.3)을 부여하거나 배열 순서를 그대로 신뢰하도록 positionAtYear를 "해당 연도에 새로 valid_from된 세그먼트 전부"를 순서대로 반환하게 바꾼다. (b) main.ts의 applyYear(main.ts:135-143)에서 그 배열을 순회하며 hannibal.setPosition(...)을 짧은 지연을 두고 여러 번 호출 — token3d.ts의 setPosition이 이미 이전 위치→다음 위치 이징을 처리하므로 호출만 여러 번 하면 된다.
- 난이도/우선순위: 중간(데이터 생성 스크립트 + positionAtYear/applyYear 로직 확장) / 높음 — 로드맵과 정확히 일치.
- 주의: deck.gl TripsLayer는 연속 타임스탬프를 전제로 한다. 지금 데이터는 정수 연도이고 같은 해에 여러 세그먼트가 겹치므로 TripsLayer를 쓰려면 어차피 데이터에 세밀한 시간값을 새로 부여해야 한다 — 그럴 거면 새 WebGL 의존성(TripsLayer)을 추가할 이유가 없다. 기존 Three.js 커스텀 레이어 확장이 스택에도 맞고 더 싸다.

### 4. Scrollama 스크롤리텔링 발표 모드

- 무엇을: 지도를 화면에 고정(sticky)하고 옆/위로 스크롤되는 내러티브 텍스트가 연도 이동과 카메라 이동을 트리거하는 발표용 별도 뷰.
- 어느 사례에서: The Pudding 스타일 스크롤리텔링, 라이브러리는 scrollama(IntersectionObserver 기반, onStepEnter/onStepExit/onStepProgress, npm install scrollama).
- 어디에 어떻게: index.html에 #map을 position: sticky로 두고 그 옆에 d.events(현재 4개, main.ts가 이미 순회하며 틱을 그리는 그 배열)로부터 자동 생성한 .step div들을 배치. scroller.setup({ step: '.step' }).onStepEnter(({element}) => { applyYear(Number(element.dataset.year)); map.flyTo(...) }) — applyYear는 이미 main.ts에 있는 함수라 그대로 호출.
- 난이도/우선순위: 중간~높음(페이지 구조 추가, 기존 슬라이더 모드와 공존시켜야 함) / 중간 — 산업스터디 발표용으로 가치는 있지만 핵심 지도 엔진 작업은 아니다.
- 주의: 이벤트가 4개뿐이라 scrollama 없이도 ~15줄 IntersectionObserver로 동일 효과를 낼 수 있다(사다리 3번 "이미 있으면 재사용" 관점에서는 신규 의존성 없이 직접 구현이 더 가볍다). 발표 콘텐츠가 늘어나 스텝이 많아지고 resize·양방향 트리거 등 엣지케이스가 문제될 때 scrollama로 넘어가는 게 순서다.

### 5. CSS scroll-driven animations로 스텝 텍스트 페이드인

- 무엇을: 스크롤리텔링(위 4번) 채택 시, 텍스트 스텝이 뷰에 들어올 때 자연스럽게 페이드인.
- 어느 사례에서: CSS 네이티브 scroll-timeline/view-timeline/animation-timeline (MDN CSS Scroll-driven Animations).
- 어디에 어떻게: JS 없이 순수 CSS로 .step { view-timeline: --step-tl inline; animation: fadeIn linear; animation-timeline: --step-tl; } + @keyframes fadeIn { from{opacity:0; transform:translateY(20px)} to{opacity:1; transform:translateY(0)} }. 4번의 scrollama(또는 자체 IntersectionObserver)와 역할 분리 — CSS는 순수 시각 연출만, 지도 상태(연도·카메라) 변경 같은 JS 부수효과는 CSS가 못 하므로 여전히 JS 트리거가 필요하다.
- 난이도/우선순위: 낮음(CSS만) / 낮음~중간, 4번 채택할 때만 의미 있음.
- 주의: 브라우저 지원이 아직 고르지 않다(Chrome/Edge 115+, Safari 17.2+ 일부, Firefox 제한적). @supports not (scroll-timeline: --x) 폴백을 걸거나, 지원 안 되는 브라우저에선 그냥 페이드 없이 보이게(opacity:1 기본값) 두면 그레이스풀 디그레이드된다.

### 6. family-chart로 장군 가문 계보

- 무엇을: 한니발(바르카 가문: 하밀카르 바르카·하스드루발·마고)이나 스키피오 가문 같은 장군들의 혈연관계를 클릭 시 계보도로 보여주는 기능.
- 어느 사례에서: family-chart(github.com/donatso/family-chart) — D3 기반, npm 패키지명 family-chart, JSON 데이터 포맷, SVG/HTML 카드 커스터마이징 가능, MIT.
- 어디에 어떻게: 지금 스키마엔 "인물" 엔티티가 없다 — battles.geojson의 general_a/general_b는 단순 문자열이고(schema.ts Dataset 타입에 person 개념 자체가 없음), actors는 세력(로마·카르타고) 단위다. 새 entities/people.json(부모·배우자·자녀 관계)을 만들고, panel.ts의 battle case(panel.ts:92-98)에 "가문 보기" 버튼을 추가해 클릭 시 family-chart로 그린 모달을 띄우는 구조가 필요하다.
- 난이도/우선순위: 중간높음(신규 데이터 축 — 콘텐츠 리서치 + 스키마 확장 + validateDataset 검증 규칙 추가) / 낮음중간 — 로드맵 6축(지배·도시·전투·이동·토큰·3D지형) 어디에도 없는 7번째 축이라 지금 당장보다는 "2번째 데이터셋(삼국지/초한지)" 단계에서 계보가 자연스러운 도메인이면 그때 같이 검토.
- 주의: 라이브러리 자체는 가볍고 준비돼 있다(D3만 의존) — 병목은 코드가 아니라 인물 관계 데이터 리서치다.

### 7. MapLibre 클러스터링 — 지금은 보류

- 무엇을: GeoJSON source에 cluster:true, clusterRadius, clusterMaxZoom을 주고 포인트가 많을 때 원으로 뭉쳐 보여주는 기능.
- 어느 사례에서: MapLibre GL JS 공식 "Create and style clusters" 예제(clusterRadius 기본 50, step expression으로 포인트 수에 따라 원 크기·색 단계화).
- 어디에 어떻게: 적용한다면 settlements source(main.ts:77)에 옵션 추가 + settle-major/settle-minor 대신 클러스터 원 레이어.
- 난이도/우선순위: 낮음(적용 자체는 쉬움) / 낮음, 지금은 불필요.
- 주의: 정착지 9개·전투 6개 규모에서 클러스터링은 과설계다. 지금은 minzoom 기반 LOD(main.ts:79-83, major는 zoom 3부터, minor는 zoom 5부터)로 이미 충분히 덜 붐빈다. 로드맵 3번 "2번째 데이터셋"으로 포인트가 수백 개로 늘어나는 시점에 재검토.

### 8. deck.gl (ArcLayer/HeatmapLayer) — 지금은 보류

- 무엇을: 원정로를 애니메이션 아크로, 전투 밀도를 히트맵으로 그리는 대규모 지리 오버레이.
- 어느 사례에서: MapboxOverlay(@deck.gl/mapbox)로 MapLibre와 연동(interleaved:true 옵션, map.addControl(deckOverlay), npm install @deck.gl/core @deck.gl/mapbox @deck.gl/layers).
- 어디에 어떻게: 적용한다면 main.ts에서 map.addControl(new MapboxOverlay({interleaved:true, layers:[...]})).
- 난이도/우선순위: 높음(새 대형 의존성, WebGL2 컨텍스트 공유) / 낮음, 지금은 불필요.
- 주의: token3d.ts가 이미 renderer = new THREE.WebGLRenderer({canvas: m.getCanvas(), context: gl, ...}); renderer.autoClear = false;로 MapLibre의 WebGL2 컨텍스트를 직접 공유하고 있다(token3d.ts:63-64). deck.gl의 interleaved 모드도 같은 컨텍스트를 공유하려 하므로, 두 라이브러리가 동시에 resetState()/autoClear 등 GL 상태를 건드리면 렌더 충돌 위험이 실제로 있다. 지금 데이터 규모(전투 6개, 세그먼트 11개)에서는 히트맵·아크가 과설계이기도 하다 — Three.js 토큰 하나로 이미 표현되는 걸 굳이 다른 렌더러로 중복할 필요가 없다.

### 9. D3 관계 그래프 — 보류

- 무엇을: 진영 간 교전 관계(누가 누구와 싸웠는지)를 노드-엣지 네트워크로 보여주는 별도 시각화.
- 어느 사례에서: D3 force-directed graph / arc diagram 일반 패턴.
- 어디에 어떻게: battles.geojson의 belligerents 배열(schema.ts 검증 로직 schema.ts:156)에서 진영 쌍을 뽑아 그래프 데이터로 변환 가능.
- 난이도/우선순위: 낮음~중간 / 낮음.
- 주의: 지도가 이미 공간적으로 같은 정보(어느 세력이 어디서 싸웠는지)를 보여주고 있어 별도 네트워크 뷰는 지금은 추측성 수요다. 구체적으로 요청받으면 그때 스키마 없이도 클라이언트에서 바로 뽑아 그릴 수 있다(새 데이터 불필요).

## 지금 당장 1~2개 권장

1번(클릭 시 flyTo)과 3번(원정로 순차 행군 — 기존 토큰 로직 확장)을 권장한다. 둘 다 새 의존성이 없고, 1번은 몇 줄짜리 수정으로 바로 체감되는 개선이며, 3번은 로드맵이 이미 "다음 증분 1순위"로 못박은 항목을 정확히 어떻게 구현할지(그리고 왜 deck.gl TripsLayer를 쓰면 안 되는지)까지 구체화한다. 2번(hover 프리뷰)도 비슷하게 가볍지만 우선순위는 1·3보다 낮다.
