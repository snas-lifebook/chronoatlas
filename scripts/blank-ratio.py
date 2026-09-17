#!/usr/bin/env python3
"""blank-ratio.py: 「확대하면 빈 화면」(OVERHAUL §3.6b, R56)의 완료 조건을 잰다. 장면을 주어진 줌으로 띄워 캡처하고,
바다색(스킨의 sea) 픽셀을 뺀 나머지에서 스킨의 land 색 그대로인 **맨땅 픽셀**의 비율을 「육지 단색 비율」로 본다. 10% 미만이면 통과.
    python3 scripts/blank-ratio.py pack-roma-urbs pack-alesia-52 rubicon-49 --zoom 11
serve.sh 의 디버그 Chrome(9222)에 CDP로 붙는다. 캡처는 /tmp/blank-<scene>-z<zoom>.png"""
import argparse, sys
from collections import Counter
from PIL import Image
from playwright.sync_api import sync_playwright

SEA = {'light': (0xD6, 0xE4, 0xEF), 'dark': (0x1B, 0x21, 0x29), 'oldmap': (0xCF, 0xDC, 0xD3), 'press': (0xE8, 0xE8, 0xE8), 'campaign': (0xC7, 0xD2, 0xCB)}   # src/map/style.ts MAP.*.sea
LAND = {'light': (0xEE, 0xF0, 0xEC), 'dark': (0x2A, 0x2E, 0x33), 'oldmap': (0xE9, 0xDF, 0xC7), 'press': (0xF7, 0xF7, 0xF7), 'campaign': (0xE2, 0xDF, 0xCF)}   # MAP.*.land = 아무것도 안 그려진 맨 땅

def blank_ratio(path: str, sea: tuple[int, int, int], land_base: tuple[int, int, int]) -> tuple[float, float, float]:
    """(맨땅 비율, 편평 비율, 바다 비율). **맨땅** = 스킨의 land 색 그대로인 픽셀(채널별 ±6). 「빈 화면」이 문자 그대로 이것이다: DEM도 토지피복도 데이터도 안 얹힌 땅.
    편평 비율(이웃과 같은 색)은 참고로만 찍는다. 평야는 실제로 편평해서(하란 평원·알레시아 고원) 그것으로 판정하면 좋은 지도도 떨어진다. 처음 잰 「가장 흔한 색 통」도 같은 이유로 틀렸다."""
    im = Image.open(path).convert('RGB'); w, h = im.size
    px = im.load()
    land = flat = bare = 0
    for y in range(0, h - 1, 2):            # 표본 격자
        for x in range(0, w - 1, 2):
            p = px[x, y]
            if sum(abs(p[i] - sea[i]) for i in range(3)) <= 24:
                continue
            land += 1
            if all(abs(p[i] - land_base[i]) <= 6 for i in range(3)):
                bare += 1
            r, d = px[x + 1, y], px[x, y + 1]
            if all(abs(p[i] - r[i]) <= 2 and abs(p[i] - d[i]) <= 2 for i in range(3)):
                flat += 1
    total = ((h - 1) // 2 + 1) * ((w - 1) // 2 + 1)
    return (bare / land if land else 1.0), (flat / land if land else 1.0), 1 - land / total

ap = argparse.ArgumentParser(); ap.add_argument('scenes', nargs='+'); ap.add_argument('--zoom', type=float, default=11); ap.add_argument('--limit', type=float, default=0.10)
a = ap.parse_args()
bad = 0
with sync_playwright() as p:
    br = p.chromium.connect_over_cdp('http://127.0.0.1:9222'); ctx = br.contexts[0]; page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.set_viewport_size({'width': 1600, 'height': 900})
    for scene in a.scenes:
        page.goto(f'http://127.0.0.1:4180/chronoatlas/?present=1&scene={scene}&z={a.zoom}')
        page.wait_for_function('window.__ca && window.__ca.map && window.__ca.map.loaded()'); page.wait_for_timeout(3000)
        page.keyboard.press('h'); page.keyboard.press('h'); page.keyboard.press('c'); page.wait_for_timeout(300)   # 설명창·콜아웃을 걷고 지도만
        skin = page.evaluate("() => window.__ca.store.get().skin")
        out = f'/tmp/blank-{scene}-z{a.zoom}.png'; page.screenshot(path=out)
        bare, flat, sea_share = blank_ratio(out, SEA.get(skin, SEA['campaign']), LAND.get(skin, LAND['campaign']))
        ok = bare < a.limit
        print(f'{scene} z{a.zoom} {skin}: 맨땅 {bare:.1%} (편평 {flat:.0%} · 바다 {sea_share:.0%}) {"ok" if ok else "FAIL"}')
        bad += 0 if ok else 1
sys.exit(f'단색 비율 초과 {bad}' if bad else 0)
