# 홍보 모션그래픽 영상 (2판)

기획서: 볼트 `Works/크로노아틀라스/20260927_홍보영상_기획서.md`(대상·메시지·하지 않는 것)와 `20260927_자료실_홍보영상_기획서.md`(두 영상 공통 규칙·샷 리스트). 업로드팩(제목·설명·태그)은 같은 폴더 `20260927_유튜브_업로드팩.md`.

```
bash scripts/serve.sh                                   # 로컬 빌드(npm run build 뒤). vite build만 하면 워커가 없어 지도가 안 뜬다
python3 scripts/record-promo.py atlas                   # 녹화 → 3D 덱(블렌더) → 음악 → promo/out/atlas/final.mp4
python3 scripts/record-promo.py library                 # 자료실 영상 → promo/out/library/final.mp4
python3 scripts/record-promo.py atlas --only search,board   # 일부 샷만 다시 찍고 다시 잇기
```

- 박자: 132 BPM · 32마디 = 58.2초. 모든 컷이 마디 첫 박. 샷 길이(마디)는 `record-promo.py`의 `FILMS`.
	- 아틀라스: hook 2 · deck 4 · year 6 · present 6 · board 5 · search 4 · link 3 · end 2
	- 자료실: hook 2 · deck 4 · read 6 · object 5 · family 4 · ai 5 · map 4 · end 2
- 캡처: Playwright + CDP `Page.startScreencast`, 1280×720 뷰포트를 DPR 2(2560×1440)로 받아 1080p로 줄인다. 프레임 수신 시각으로 30fps CFR을 만들고 마디 길이에 맞춰 자르거나 늘린다.
- 모션그래픽: `overlay.js`가 페이지 위에 얹는 `#pm` 층(1920 설계 격자, `S = innerWidth/1920`). 앱 DOM은 건드리지 않는다. 강조색은 아틀라스 앰버, 자료실 시안.
- 3D 덱: `deck_tex.py`(PIL, 카드 앞면 = 실제 화면 캡처 + 라벨 띠) → `deck.py`(Blender 5.2 EEVEE 헤드리스, 광택 카드 넷이 부채꼴로, 투명 PNG 시퀀스) → 2D에 합성. 블렌더는 `brew install --cask blender`.
- 소리: `music.py`가 numpy로 새로 합성(아틀라스 Am–F–C–G, 자료실 C–Am–F–G) + 컷의 휙·클릭·도장 효과음, ffmpeg loudnorm I=-16. 외부 음원 없음.
- 사양: 1920×1080 · 30fps · H.264 yuv420p + AAC · 58.2초 · 11~14 MB.
- 배치: `public/promo/atlas.mp4`·포스터(첫 방문 팝업 `src/app/Promo.tsx`, 소개 `public/about.html`). 자료실 영상은 자료실 레포 `site/public/promo/`. 유튜브: 아틀라스 https://youtu.be/aZ5N3bqi4Tw · 자료실 https://youtu.be/GbSREkowpN0
- 함정: 연도 막대는 초당 8번, 벽시계 기준으로 옮긴다(`slide`, 프레임마다 바꾸면 지도 층이 옛 해에 멈춘다). 대기는 `time.sleep`이 아니라 `page.wait_for_timeout`(CDP 이벤트가 돌아야 프레임이 온다). 넓은 화면은 탐색 목록을 `fold()`로 접는다. 자료실의 실제 스크롤러는 `div.astryx-layout-content`.
- 1판의 세로 9:16 컷(`VERTICAL=1`)은 2판 재작성에서 빠졌다. 다시 만들지는 River 결정.
- 영상 파일은 git에 넣지 않는다(`promo/out/` gitignore). `public/promo/`의 배포본만 커밋한다.
