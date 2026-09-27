# 홍보 모션그래픽 영상

기획서: 볼트 `Works/크로노아틀라스/20260927_홍보영상_기획서.md` (대상·메시지·스토리보드·하지 않는 것).

```
python3 scripts/record-promo.py                 # 라이브 사이트를 조작하며 7구간 녹화 → promo/out/chronoatlas-promo.mp4
python3 scripts/record-promo.py board library   # 일부 구간만 다시 찍고 전체를 다시 잇는다
ATLAS=http://localhost:4180/chronoatlas/ python3 scripts/record-promo.py   # 로컬 빌드로(serve.sh)
```

- 구간: open(제목·연도 막대·숫자) · present(발표 모드 알프스→칸나이→자마) · board(자마 세부 지도) · search(⌘K 초성 → 카이사르) · library(자료실 → 「지도에서 보기」) · jump(지도에서 열림) · outro(벤토 · 끝 카드)
- 방식: 구간마다 새 페이지로 녹화하고 로딩 시간을 재서 잘라 잇는다(페이지 이동의 흰 화면을 안 싣는다). 모션그래픽은 `overlay.js`가 페이지 위에 얹는 HTML/CSS 층이고 앱 DOM은 건드리지 않는다(자료실 첫 방문 안내창만 영상에서 숨긴다).
- 사양: 1920×1080 · 30fps · H.264 yuv420p · 무음(음악은 라이선스 분명한 곡을 골라 편집에서).
- 필요: 시스템 Chrome(창이 뜬다, 지도 WebGL에 GPU가 필요), `python3 -m playwright install ffmpeg`, Homebrew ffmpeg.
- 함정: 연도 막대를 프레임마다 바꾸면 제목만 바뀌고 지도 층은 옛 해에 멈춘다 → 초당 8번으로 끊는다(`slide`). 넓은 화면은 왼쪽 탐색 목록이 열린 채 시작한다 → `clean()`이 접는다.
- 영상 파일은 git에 넣지 않는다(`promo/out/` gitignore).
