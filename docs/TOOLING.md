# TOOLING — 어떤 스킬·도구로 만드나

> 볼트 `Works/비주얼파이프라인/`에서 이관 (2026-09-16). 원본 작성 2026-08-14 · 최종 ?

Claude에 깔린 스킬·플러그인을 **개별 지정 대신 군(群)으로** 정한다. 매 작업마다 해당 군에서 하나를 의식적으로 고른다 — 이름을 외우지 않는다.

## 스킬 군 → 언제 쓰나

| 군 | 언제 | 대표 스킬·도구 |
|---|---|---|
| **에이전트·오케스트레이션** | 설계·구현 루프 전반 | superpowers(brainstorming → writing-plans → executing-plans / subagent-driven-development), test-driven-development, systematic-debugging, workflows, codex(다단계 코딩 위임) |
| **리서치** | RESEARCH 트랙 B~E 조사 | 병렬 하위에이전트(소넷), WebSearch/WebFetch, perplexity, obsidian:defuddle(웹 정제) |
| **토큰 전략** | 비용 관리 | ponytail(게으른 최소구현), token-efficient-ops, deepseek-worker(값싼 병렬 배치), 병렬 dispatch |
| **디자인** | 캔버스 UI·지도 스타일·범례 | frontend-design, ui-ux-pro-max, taste-skill, figma:*, dataviz(색·범례·차트) |
| **툴·검증** | 테스트·전달 | claude-in-chrome / playwright(E2E·시각회귀), web-demo-video(시연영상), obsidian:*(볼트 연동), notion-publish(공유) |
| **품질·문안** | 사이트·발표 카피 | anti-ai-writing, humanize-korean |

## 운영 원칙

- **군에서 고른다.** 애매하면 ponytail(최소 구현)로 기운다. 스킬을 위해 스킬 쓰지 않는다.
- **모델 배분** — 반복·서치·배치는 값싼 모델(하이쿠 / deepseek) **병렬**, 판단·설계·문체는 상위 모델. (`AIOS/agent-ops` 배분 원칙)
- **코드 다단계는 codex 위임 후 Claude 검수** — 가이드웹 방침과 동일. 위임 결과를 그대로 믿지 않고 테스트·리뷰로 닫는다.
- **볼트=왜, 레포=코드.** 스킬로 만든 산출물도 코드는 레포, 맥락·결정은 볼트.
- **TDD 자동화 6층**(러너 워치·빌드 게이트·CI·pre-commit·시각회귀·에이전트 주도)은 `볼트 가이드웹 방법론`과 같은 방침을 따른다.

## 이 프로젝트에서 특히

- **리서치(RESEARCH B~E)**: 병렬 에이전트 + WebSearch로 이름·URL·라이선스 검증. 표로 병합.
- **디자인**: MapLibre 양피지 스타일은 Maputnik + dataviz(색 절제)·frontend-design로. 토큰 아이콘은 taste/figma.
- **캔버스 구현**: superpowers TDD로 좌표 변환·경로 보간·export 합성부터 테스트 먼저.
- **시연**: 완성 후 web-demo-video로 자막형 데모, notion-publish로 팀 공유.

## 관련

- [RESEARCH](RESEARCH.md) · [PLAN](PLAN.md) · [TASKS](TASKS.md) · [CONSTITUTION](CONSTITUTION.md)
- `볼트 가이드웹 방법론` — SDD·TDD 도구 선택 근거·명령 (Context, 가이드웹)
