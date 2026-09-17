# 전면 개선 · 슬라이스 II 스펙: 시각 문법(대륙 축척) (R51)

작성 2026-09-17 저녁. 슬라이스 I(`OVERHAUL.md` §3)이 닫힌 뒤 쓴다. 2026-09-17 저녁 River 승인(§5). 계획은 `docs/plans/2026-09-17-overhaul-II-visual.md`.

River의 원문(REQUESTS 9차): 「지도 스킨, 더 다양한 국가 영토 시각화 … 사용자가 원한 장기말(토탈워 장군말 이동말 같은 느낌) 시스템과 군단 표시」. 레퍼런스는 볼트 `references/캡처라이브러리/A_공간지도/영토판도_*`(Kings and Generals · Epic History)와 `B_인물/인물장소_03_HistoryMarche`. 스크린샷은 참조만, 재배포·번들 반입 없음(CONSTITUTION).

## 1. 무엇을 닫나

| # | 항목 | 레퍼런스가 하는 것 | 우리가 하는 것 |
|---|---|---|---|
| ① | 국경 점선 사슬 · 사선 세력권 | K&G: 채도 높은 채움 + 한 톤 어두운 굵은 테. Epic History: 세력권은 사선 해칭 | `campaign` 스킨에서만: 영토 테를 **케이싱(어두운 굵은 선) + 밝은 점선**의 두 겹으로. 속국·동맹 사선(있음)과 주변 민족 점선(있음)은 유지. 다른 스킨은 안 바뀐다 |
| ② | 연도 리본 | K&G·HistoryMarche: 화면 위 양피지 리본에 연도 | 발표 모드 + `campaign`·`oldmap` 스킨에서 좌상단 연도(`.shell-year`, HUD `.ph-y`)를 **리본 띠**(제비꼬리 양 끝, 세리프 숫자)로. CSS만. 다른 스킨은 지금 글자 |
| ③ | 세리프 자간 라벨 | K&G·Epic: 라틴 대문자 세리프, 자간 넓게, 그림자 | 폴리티 이름표를 **두 줄**로: 윗줄 `name_en` 대문자 세리프 자간 0.25, 아랫줄 `name_ko` 산세리프 0.8배. `format` 표현식이 줄마다 글꼴을 준다. 세리프 글리프는 빌드타임 자체 생성(§3) |
| ④ | 장군 배너 카드 | HistoryMarche 10: 액자 초상 + 이름판 + 작은 군기(깃발) | 말을 **가리키거나 고르면** 말 옆에 DOM 카드: 방패꼴 초상 + 세리프 이름판(라틴/한글) + 세력색 군기 + 「N군단 · 병력」. 콜아웃과 같은 DOM 방식(지도 좌표 밖 배치, 내보내기엔 안 담김) |
| ⑤ | 장기말 v2 | 토탈워: 받침 + 장군 몸통 + 뒤에 깃발, 부대 수 | 지금 말(팔각 받침 + 세력색 몸통 + 초상 윗면)에 **군기 깃대**(뒤쪽, 세력색 깃발 + 문장 텍스처가 있으면 얹음)와 **군단 수 명패**(로마 숫자, `pack-legions`) |
| ⑥ | 군단 무리 | 토탈워: 군대 스택은 깃발 하나에 부대 수 | 장군 말 뒤에 **작은 말 무리**(군단 하나 = 작은 말 하나, 최대 12, 4열 대형, 세력색, 초상 없음). z6 미만에서는 무리를 접고 명패만(LOD). 군단 수는 `legionsAt(id, year).legions` (사료 수치, docs/LEGIONS.md 「곱하지 마라」) |
| ⑦ | 스킨·UI 테마 어긋남(BACKLOG §E) | | `chromeTone(skin)`이 2026-09-13에 크롬 글자색을 스킨에 묶었다(②후광 방식). 이 슬라이스에서 다섯 스킨 × 두 테마 캡처로 **확인하고 §E를 닫는다**. 새 코드 없음 |

**안 하는 것.** 미시 축척 문법(R54로 닫힘) · 위성 스킨·수심 색(III) · 인물 초상 새로 만들기(River가 Flow에서) · 토탈워 자산 사용(상용) · 폰트 런타임 외부 호출(글리프는 레포) · 3D 지형 위 말 배치 정확도(지금대로 지표에 붙인다).

## 2. 데이터 계약

- **군단 수·병력**: `data/overlays/pack-legions.json` `by_person[id][]`(year·legions·men_low·men_high·source·confidence). 이미 있다. 없는 사람은 무리도 명패도 없다. 지어내지 않는다.
- **세력 문장**: 볼트 `Works/관계분석_방법론/components/01_세력/문장_<세력>.png`(River 자산. 로마·갈리아·게르만·그리스계·누미디아·카르타고·반란세력·이탈리아세력이 있다. 이집트는 발주 중). `adapt.ts`가 팔레트를 읽는 그 폴더다. 있는 것만 `public/assets/emblems/<actor>.png`로 복사(adapt 단계, 커밋). 없으면 깃발은 세력색 단색. **문장을 만들어 넣지 않는다.**
- **폴리티 라틴 이름**: 정본 `territory` 피처의 `name_en`(Cliopatria 영문). 아랫줄은 지금 이름표가 쓰는 `name`(한글 이름이 붙은 폴리티는 한글, 아니면 영문 그대로라 그때는 한 줄만). `name_ko` 필드는 영토 피처에 없다(2026-09-17 실측).
- **세리프 글꼴**: OFL만. 후보 ① Cinzel(비문 대문자, OFL) 라틴 전용 + 한글은 지금 Noto Sans CJK ② Noto Serif CJK KR(OFL, 한글 세리프까지) — 글리프 PBF 크기는 라벨에 실제 쓰인 문자 범위만 굽는 지금 규칙(`fetch-external.ts`)으로 억제. 빌드는 `fontnik`(npm 0.7.7, 네이티브 빌드). **이 환경에서 빌드가 되는지가 첫 계획 태스크다.** 안 되면 후퇴: 폴리티 라틴 이름표만 DOM 라벨(웹폰트 woff2를 레포에)로 그리고 충돌 관리는 포기(폴리티 이름은 15개 이내라 감당 가능).
- **장면**: 바뀌지 않는다. 스킨 v2는 `campaign`이 이미 발표 장면의 스킨이라 자동으로 적용된다.

## 3. 설계

### 3.1 campaign 스킨 v2 (①)
`engine.ts addData`의 `territory-outline`을 스킨 조건으로 두 겹: `territory-casing`(line-width 3.2, 색 = polityColor를 0.55배 어둡게, opacity 0.9) 위에 `territory-outline`(line-width 1.2, 색 = 스킨 halo, `line-dasharray [2, 2]`). 다른 스킨은 지금 한 겹 그대로. `setSkin` 재빌드 경로가 이미 있어 스킨 전환 때 같이 바뀐다. 채움 채도는 건드리지 않는다(팔레트는 River 승인 사항).

### 3.2 연도 리본 (②)
`.shell-year`와 `.ph-y`에 `html[data-skin="campaign"] .shell.is-present` 조건 CSS: 양피지색 띠(`--color`는 스킨 halo), 좌우 제비꼬리는 `clip-path: polygon(...)`, 숫자는 세리프(`font-family: 'Cinzel', serif` 웹폰트 woff2를 `public/fonts/`에. 글리프 PBF와 별개로 UI용). `data-skin`은 App이 `documentElement`에 적는다(지금은 `data-theme`만).

### 3.3 세리프 자간 라벨 (③)
`territory-label`의 `text-field`를 `['format', ['upcase', ['coalesce', ['get', 'name_en'], '']], { 'text-font': ['literal', ['Cinzel Regular']], 'font-scale': 1.0 }, '\n', {}, ['get', 'name'], { 'text-font': ['literal', ['KlokanTech Noto Sans CJK Regular']], 'font-scale': 0.8 }]`, `text-letter-spacing 0.25`(윗줄만 적용되도록 `format` 섹션 옵션이 없으니 전체 0.15로 타협하거나 두 층으로 나눈다: 결정은 계획에서 실측 후). 그림자는 `text-halo`(스킨 halo, 1.8). `campaign`·`oldmap`에서만; `light`·`dark`·`press`는 지금 한글 한 줄.

### 3.4 장군 배너 카드 (④)
`src/app/BannerCard.tsx`(지연 청크). 트리거: 말 hover(데스크톱) 또는 선택(`sel`이 person이고 그 말이 화면에 있을 때). 위치: 말의 화면 좌표에서 오른쪽 위로 지시선 없이 붙인다(콜아웃처럼 여백까지 끌지 않는다. 말 하나에 카드 하나). 내용: 방패꼴(`clip-path`) 초상(`assets/portraits`, 없으면 세력색 방패) · 이름판(윗줄 라틴 세리프 대문자 `name_la`가 있으면, 아랫줄 한글) · 군기(세력색 + 문장) · `N군단 · 병력 low~high`(pack-legions, 없으면 줄 없음) · 「그 해」 한 줄(`year.ts` happenings 중 그 사람 것 하나). 발표 모드에서는 선택에만 뜬다(hover 카드가 화면을 돌아다니면 발표가 산만하다).

### 3.5 장기말 v2 + 군단 무리 (⑤ ⑥)
`token3d.ts pieceMesh`에 더한다(모델링은 프로시저럴, 자산 없음, River 결정 「프로시저럴 스타일라이즈」):
- **깃대**: 얇은 원기둥(높이 1.1, 반지름 0.03, 먹색) 말 뒤쪽(-z) 받침 가장자리. **깃발**: 사각 평면(0.5×0.34) 세력색, 문장 텍스처가 있으면 `map`으로 얹는다(`emblems/<actor>.png`). 살짝 기운다(rotation.z 0.12).
- **명패**: 깃발 아래 작은 판(0.3×0.12) 밝은색에 로마 숫자 텍스트(캔버스 텍스처, `legions`). 0이면 없음.
- **무리**: `createToken(..., legions)` → `legions`개(최대 12) 작은 말(받침+몸통만, 반지름 0.22, 세력색)을 장군 뒤 4열 대형(간격 0.55)으로. 장군 `scale`을 따른다. z6 미만에서는 `visible=false`(LOD: 무리가 지중해 줌에서 얼룩이 된다). 행군할 때 대형째 따라간다(같은 group).
- 크기 상한은 지금 `MAX_M 145km` 그대로. 무리는 상한에서 장군 받침 46px 뒤로 4열 25px씩이라 판을 안 덮는다(계획에서 캡처로 확인).

### 3.6 §E 확인 (⑦)
`scripts/look-skins.py`: 다섯 스킨 × 두 테마 × 장면 하나(pack-intro-med) 캡처 10장, 좌상단 연도 글자와 바탕의 명암비를 잰다(WCAG 4.5 이상). 통과하면 BACKLOG §E를 ●로.

## 4. 단계와 완료 조건

| 단계 | 무엇 | 완료 조건 |
|---|---|---|
| II-0 | 글리프 빌드 가능성 | `fontnik`으로 Cinzel(또는 Noto Serif CJK) PBF가 이 환경에서 생성되고 `public/glyphs/<font>/`에 들어간다. 안 되면 §2 후퇴 경로로 확정 |
| II-1 | 스킨 v2 ①②③ | campaign 장면 8장 캡처에서 두 겹 테·리본·두 줄 이름표. `look.py` 라벨 충돌 수가 지금과 같거나 적다. 초기 JS ≤ 400 유지(글리프는 번들이 아니다) |
| II-2 | 장기말 v2 ⑤⑥ | pack-gaul-52(카이사르 10군단)·pack-greece-48(카이사르 8 · 폼페이우스 11)에서 무리 수 = `legions`, 깃발·명패가 보인다. token3d 청크 크기 +10 kB 이내 |
| II-3 | 배너 카드 ④ | 선택 시 카드가 말 옆에, 발표 모드 hover 없음, 카드가 HUD·알약과 안 겹친다(계측) |
| II-4 | §E 닫기 ⑦ + 문서 | 캡처 10장 명암비 ≥ 4.5. BACKLOG R51 ●, MODELS.md 갱신, HANDOFF |

**진행(2026-09-17 밤)**: II-0 ● (fontnik 프리빌트, Cinzel 136 kB) · II-1 ● · II-2 ● · II-3 ● · II-4 ● (명암비 10.2~13.2, §E 닫힘). 증거는 BACKLOG R51 행. 계획과 다른 점은 `plans/2026-09-17-overhaul-II-visual.md` 실행 기록.

## 5. River가 정한 것 (2026-09-17 저녁 승인)

네 물음 전부 권장안으로 답했다: ① Cinzel 라틴 대문자 + 한글 산세리프 두 줄 ② 작은 말 무리 + 로마 숫자 명패 ③ 배너 카드는 선택했을 때만 ④ 채움 채도는 지금 그대로. 이 스펙은 **승인됨**. 계획: `docs/plans/2026-09-17-overhaul-II-visual.md`.

원래 물음(기록):

1. **세리프 글꼴**: ① Cinzel 라틴 대문자 + 한글 산세리프 두 줄(권장: 레퍼런스 그대로이고 글리프가 가볍다) ② Noto Serif CJK로 한글까지 세리프 ③ 지금 산세리프 유지, 자간·대문자만.
2. **군단 무리**: ① 작은 말 무리 + 명패(권장: 「군단 표시」를 눈으로 센다) ② 명패(로마 숫자)만 ③ 깃발 크기로 병력 표시.
3. **배너 카드 트리거**: ① 선택에만(권장: 발표 중 산만하지 않다) ② hover + 선택 ③ 발표 모드에서 화면의 모든 말에 상시.
4. **채움 채도**: 레퍼런스처럼 올릴지(팔레트 변경은 River 승인 사항). 이 스펙은 **안 올린다**로 두었다.
