#!/usr/bin/env bash
# 정본(볼트) → 미러 리포 → 로마자료실(roma-library.pages.dev) 한 번에.
#   bash scripts/publish-library.sh            # 복사 + 빌드 + 배포 + 라이브 확인
#   bash scripts/publish-library.sh --no-deploy
# 런북(운영_온톨로지_리포_동기화.md) 순서 그대로: 원격에 안 당긴 PR이 있으면 멈춘다 · 바뀐 파일만 복사(--delete 없음) ·
# 커밋·푸시는 하지 않는다(공개 리포, 사람이 파일을 보고 한다). 2026-09-22 병합 뒤 자료실만 17일에 멈춰 22개가 404였던 것을 막는다.
set -euo pipefail
cd "$(dirname "$0")/.."
ONT="${ONTOLOGY_DIR:-$(cat data/ontology-dir.txt)}"; BOOK="$(dirname "$ONT")"
MIR="${MIRROR_DIR:-$(cat data/mirror-dir.txt 2>/dev/null || true)}"
[ -d "$MIR/.git" ] || { echo "미러 경로 없음: MIRROR_DIR 또는 data/mirror-dir.txt(gitignore)"; exit 1; }

git -C "$MIR" fetch -q origin
behind=$(git -C "$MIR" rev-list --count HEAD..origin/main)
[ "$behind" = 0 ] || { echo "원격에 안 당긴 커밋 $behind개(PR일 수 있다). 볼트로 먼저 당길 것. 멈춤"; exit 1; }

echo "== 복사(바뀐 것만)"
rsync -a --checksum --itemize-changes --include='*.jsonl' --include='_geo/' --include='_geo/*.jsonl' --exclude='*' "$ONT/" "$MIR/ontology/" | grep -v '^\.' || true
rsync -a --checksum --itemize-changes --include='*/' --include='*.md' --exclude='*' "$BOOK/entities/" "$MIR/entities/" | grep -v '^\.' || true

echo "== 빌드(검사 포함)"
( cd "$MIR/site" && { [ -d node_modules ] || npm ci --silent; } && npm run build >/tmp/publish-library.log 2>&1 ) || { tail -30 /tmp/publish-library.log; exit 1; }
ents=$(grep -c . "$MIR/ontology/entities.jsonl"); pages=$(find "$MIR/site/out/objects" -mindepth 2 -name '*.html' | wc -l | tr -d ' ')
echo "객체 $ents · 객체 페이지 $pages"; [ "$pages" -ge "$ents" ] || { echo "페이지가 모자란다"; exit 1; }

[ "${1:-}" = --no-deploy ] && { git -C "$MIR" status -s | head; exit 0; }
echo "== 배포"
url=$(cd "$MIR/site" && npx wrangler@4 pages deploy out --project-name=roma-library --commit-dirty=true 2>&1 | tee -a /tmp/publish-library.log | grep -o 'https://[a-z0-9]*\.roma-library\.pages\.dev' | tail -1)
[ -n "$url" ] || { echo "배포 실패(업로드 스톨이면 몇 분 뒤 재실행)"; tail -5 /tmp/publish-library.log; exit 1; }
last=$(tail -1 "$MIR/ontology/entities.jsonl" | python3 -c "import sys,json,urllib.parse as u;e=json.load(sys.stdin);print(e['type']+'/'+u.quote(e['name'].replace(' ','_').replace('(','').replace(')','')))")
code=$(curl -sL -o /dev/null -w '%{http_code}' "$url/objects/$last")
echo "$url · 마지막 객체 $last → $code"; [ "$code" = 200 ] || exit 1
echo "== 미러 변경(커밋·푸시는 사람이)"; git -C "$MIR" status -s | head -20
