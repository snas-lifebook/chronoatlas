# ANALYZE — 문서끼리 어긋나지 않나

> 볼트 `Works/비주얼파이프라인/`에서 이관 (2026-09-16). 원본 작성 2026-08-14 · 최종 2026-09-07

구현 진입 전 점검. 2026-09-07 개정판 7종(CONSTITUTION·BLUEPRINT·SPEC·CLARIFY·SCHEMA·PLAN·DESIGN·TASKS)을 서로 대조했다.

## 통과

| 점검 | 결과 |
|---|---|
| SPEC F1~F12가 TASKS에 전부 있나 | ● 12/12. F1→0.3, F2→1.1, F3→1.3, F4→2.1, F5→1.5, F6→2.2, F7→2.3, F8→1.1, F9→3.1~3.3, F10→3.4, F11→0.4, F12→3.5 |
| SCHEMA 신설(faction·office·6 rel·src·ext)이 CONSTITUTION 3-3(새 rel은 SCHEMA 먼저)과 맞나 | ● SCHEMA가 정의하고 린트가 강제 |
| DESIGN P1(유채색=세력뿐)과 룬델 스타일가이드(적대선 붉음)의 충돌 | ◐ DESIGN에서 예외 명시(적대선 잉크 지그재그). 룬델 스타일가이드 역반영은 TASKS 4.3에 포함 |
| PLAN 의존성 8개가 CONSTITUTION 6(정적)과 맞나 | ● 전부 브라우저/빌드타임. 서버 0 |
| CLARIFY D1~D8(확정)이 SPEC·PLAN에 반영됐나 | ● D1→TASKS 0.0·PLAN 레포, D2→SPEC 첫 장면, D3·D4·D6→PLAN 스택, D5→TASKS 0.5, D7→PLAN 연동, D8→SPEC F12b·TASKS 3.7~3.8 |
| 라이선스 — 재배포 목록이 CONSTITUTION 8과 맞나 | ● Cliopatria CC BY·NE PD·Pleiades CC BY·0 A.D. CC BY-SA(조건 명시)·서체 OFL. historical-basemaps·AWMC는 참조만 |
| 자료실 딥링크 주소 형식이 양쪽 SPEC에 있나 | ◐ 이쪽은 PLAN에 있음. 자료실 쪽 `links.ts`에 `map` 항목 추가는 TASKS 3.6 |

## 남은 어긋남 (착수 전 고칠 것)

| # | 어긋남 | 처리 |
|---|---|---|
| A1 | 8월 RESEARCH.md·TOOLING.md가 "PNG 캔버스" 전제로 쓰여 있다 | RESEARCH는 상단에 「2026-09-07 청사진으로 대체, 트랙 A~C 결과만 유효」 한 줄. TOOLING은 그대로 유효(스킬 군 기준) |
| A2 | 레포 `docs/roadmap.md`(6축: 지배·도시/자원·전투·이동·Three.js 토큰·3D 시뮬)가 비전 SSOT라고 적혀 있다 | 볼트 BLUEPRINT가 SSOT. 레포 roadmap은 BLUEPRINT 링크 + 로드맵 표로 교체(TASKS 0.8) |
| A3 | 온톨로지 설계문서 수치(619/603) vs 실제(650/698) | 8/26 지적 그대로. TASKS 4.3 |
| A4 | 관계분석 `_registry.csv`의 `faction`(정체성)과 SCHEMA `faction` 타입(정치 세력)이 같은 단어 | SCHEMA에 구분 명시함. 레지스트리 열 이름을 `identity`로 바꿀지는 P1 F13 때 결정 |
| A5 | `held_office` rel이 정본 links에 이미 있는지 | 마이그레이션 0.1에서 확인. 있으면 `office.history`로 옮기고 삭제 |

## 위험 (RISK 대신 여기에)

| 위험 | 신호 | 대응 |
|---|---|---|
| Cliopatria 로마 폴리곤이 거칠어 발표에 못 씀 | Q2 육안 검사 실패 | 자체 트레이싱 비중↑(D5 뒤집힘), 시간 +1주 |
| Sigma+MapLibre 오버레이에서 줌·팬 동기화 지터 | 2.1에서 프레임 드롭 | 그래프를 지도 옆 패널로 분리(D4 뒤집힘) |
| 초상 카드·흉상 GLB가 "AI 같다" | 팀 반응 | 카드는 초상 비중 축소, 흉상은 3.7에서 1명 확인 후 진행. 반려되면 D8을 카드까지로 되돌림(9/3 결정 승계) |
| TRELLIS.2용 24GB GPU 부재 | 3.7 착수 시 | HF Space 또는 Meshy Pro 1개월($20)로 대체 — 결과 GLB만 쓰므로 도구 교체 자유 |
| 온톨로지 정본이 볼트라 CI가 못 읽음 | 0.3 CI 실패 | 어댑터 산출물을 커밋(PLAN대로). 정본 변경 시 로컬 빌드 → 커밋이 절차 |
| 연도 채움율 46% | 타임라인이 비어 보임 | 안 그린 개수 표시(DESIGN) + P1 QC 페이지로 채움 유도 |

## 판정

**구현 진입 가능.** A1·A2·A5는 Phase 0 첫 주에 처리하고, 나머지는 라운드 4.
