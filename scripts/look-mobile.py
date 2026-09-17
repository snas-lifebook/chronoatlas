#!/usr/bin/env python3
"""look-mobile.py: 390×844 로 장면을 떠서 HUD·알약·시트의 경계 상자가 안 겹치는지, 탭 타깃이 44px 이상인지, 핀 수 = 시트 목록 수인지 잰다(OVERHAUL §3.8, R50).
    python3 scripts/look-mobile.py pack-rubicon rubicon-49 pharsalus-48 athens-acropolis cannae-board pack-alesia-52
serve.sh 의 디버그 Chrome(9222)에 CDP로 붙는다. 캡처는 /tmp/mobile-<scene>.png."""
import json, sys
from playwright.sync_api import sync_playwright
JS = """() => {
  const box = s => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const overlap = (a, b) => a && b && !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  const hud = box('.shell-present-hud'), nav = box('.shell-scene-nav'), sheet = box('.mobile-sheet');
  const small = [...document.querySelectorAll('.mobile-sheet .ms-tabs button, .shell-scene-nav button')].map(b => b.getBoundingClientRect()).filter(r => r.width > 0 && (r.height < 44 || r.width < 44)).length;
  const pins = document.querySelectorAll('.ca-pin').length, items = document.querySelectorAll('.ms-callouts li').length;
  return { hud, nav, sheet, overlaps: { hudNav: !!overlap(hud, nav), hudSheet: !!overlap(hud, sheet), navSheet: !!overlap(nav, sheet) }, smallTargets: small, pins, items,
           visible: ['.shell-explorer', '.shell-right', '.shell-board', '.shell-toolbar', '.shell-timeline'].filter(s => { const el = document.querySelector(s); return el && getComputedStyle(el).display !== 'none'; }) };
}"""
bad = 0
with sync_playwright() as p:
    br = p.chromium.connect_over_cdp('http://127.0.0.1:9222'); ctx = br.contexts[0]; page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.set_viewport_size({'width': 390, 'height': 844})
    for scene in sys.argv[1:]:
        page.goto(f'http://127.0.0.1:4180/chronoatlas/?present=1&scene={scene}'); page.wait_for_function('window.__ca && window.__ca.map && window.__ca.map.loaded()'); page.wait_for_timeout(3000)
        page.click('.ms-tabs button:nth-child(2)'); page.wait_for_timeout(400)   # 콜아웃 탭 → half
        out = page.evaluate(JS); print(scene, json.dumps(out, ensure_ascii=False))
        page.screenshot(path=f'/tmp/mobile-{scene}.png')
        if any(out['overlaps'].values()) or out['smallTargets'] or out['visible'] or (out['pins'] and out['pins'] != out['items']): bad += 1
sys.exit(f'문제 장면 {bad}' if bad else 0)
