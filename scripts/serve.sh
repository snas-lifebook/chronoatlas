#!/usr/bin/env bash
# 발표용 스모크 서버 + 검증 창을 한 명령으로 띄운다.
#
# 왜 이 스크립트가 있나: 지도는 `dist/`를 `/chronoatlas/` 경로에 마운트해야 뜬다(빌드가
# 그 base로 굽는다). 그래서 dist를 그냥 서비스하면 안 되고 심링크를 한 겹 둬야 한다.
# 그리고 **검증 창은 반드시 화면에 보이는 창이어야 한다** — 자동화·백그라운드 탭에서는
# document.hidden이 참이라 rAF가 멈춰 지도가 영영 안 뜬다. 셸과 데이터는 다 뜨고 JS
# 에러도 0이라 코드 버그로 오진하기 쉬운 자리다.
#
#   bash scripts/serve.sh          # 서버 + 창
#   bash scripts/serve.sh --no-ui  # 서버만
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT=4180
DBG=9222
MOUNT=/tmp/smoke
PROFILE=/tmp/ca-chrome
URL="http://127.0.0.1:${PORT}/chronoatlas/?present=1&scene=pack-intro-med"

[ -d "$REPO/dist" ] || { echo "dist/가 없다. 먼저 'npm run build'."; exit 1; }

mkdir -p "$MOUNT"
ln -sfn "$REPO/dist" "$MOUNT/chronoatlas"

if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/chronoatlas/"; then
  echo "서버 이미 떠 있다 :${PORT}"
else
  ( cd "$MOUNT" && nohup python3 -m http.server "$PORT" >/tmp/ca-serve.log 2>&1 & )
  for _ in $(seq 20); do
    curl -sf -o /dev/null "http://127.0.0.1:${PORT}/chronoatlas/" && break
    sleep 0.3
  done
  echo "서버 띄웠다 :${PORT}  (로그 /tmp/ca-serve.log)"
fi

if [ "${1:-}" = "--no-ui" ]; then
  echo "$URL"
  exit 0
fi

if curl -sf -o /dev/null "http://127.0.0.1:${DBG}/json/version"; then
  echo "디버그 Chrome 이미 떠 있다 :${DBG}"
else
  # --user-data-dir을 따로 주는 이유: River의 평소 Chrome 프로필과 안 섞이게.
  open -na "Google Chrome" --args \
    --remote-debugging-port="$DBG" --user-data-dir="$PROFILE" \
    --no-first-run --lang=ko "$URL"
  for _ in $(seq 30); do
    curl -sf -o /dev/null "http://127.0.0.1:${DBG}/json/version" && break
    sleep 0.4
  done
  echo "디버그 Chrome 띄웠다 :${DBG}"
fi

cat <<EOF

  발표    $URL
  키      F 발표 · [ ] 장면 · V 입체
          스페이스는 연도 재생이라 발표 중엔 누르지 말 것 (해가 5년씩 뛴다)
  캡처    python3 scripts/shoot-pack.py
EOF
