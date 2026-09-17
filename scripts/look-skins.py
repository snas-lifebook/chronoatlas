#!/usr/bin/env python3
"""look-skins.py: 다섯 스킨 × 두 테마로 장면 하나를 떠서 좌상단 연도 글자의 명암비(WCAG)를 잰다(OVERHAUL-II §3.6, BACKLOG §E).
    python3 scripts/look-skins.py [scene]     # 기본 pack-intro-med
serve.sh 의 디버그 Chrome(9222). 캡처 /tmp/skin-<skin>-<theme>.png. 명암비 4.5 미만이면 실패."""
import json, sys
from playwright.sync_api import sync_playwright
SKINS = ['light', 'dark', 'oldmap', 'press', 'campaign']
scene = sys.argv[1] if len(sys.argv) > 1 else 'pack-intro-med'
JS = """() => {
  const el = document.querySelector('.shell-year'); if (!el) return null;
  const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
  const lum = c => { const m = c.match(/\\d+(\\.\\d+)?/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  // 바탕: 판이 있으면(리본) 그 배경색, 없으면 지도 캔버스 픽셀
  const bg = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && !cs.backgroundImage.includes('gradient') ? cs.backgroundColor : null;
  let bgLum;
  if (bg) bgLum = lum(bg);
  else if (cs.backgroundImage.includes('gradient')) bgLum = lum('rgb(235,229,210)');
  else { const cv = document.querySelector('canvas'); const gl = cv.getContext('webgl2') || cv.getContext('webgl'); const px = new Uint8Array(4); gl.readPixels(Math.round(r.left + r.width / 2), Math.round(cv.height - (r.top + r.height / 2)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); bgLum = lum(`rgb(${px[0]},${px[1]},${px[2]})`); }
  const fg = lum(cs.color); const ratio = (Math.max(fg, bgLum) + 0.05) / (Math.min(fg, bgLum) + 0.05);
  return { color: cs.color, ratio: +ratio.toFixed(2), font: cs.fontFamily.split(',')[0] };
}"""
bad = 0
with sync_playwright() as p:
    br = p.chromium.connect_over_cdp('http://127.0.0.1:9222'); ctx = br.contexts[0]; page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.set_viewport_size({'width': 1600, 'height': 900})
    for theme in ['light', 'dark']:
        for skin in SKINS:
            page.goto(f'http://127.0.0.1:4180/chronoatlas/?scene={scene}&skin={skin}'); page.wait_for_function('window.__ca && window.__ca.map && window.__ca.map.loaded()')
            page.evaluate(f"() => {{ localStorage.setItem('theme', '{theme}'); }}"); page.reload(); page.wait_for_function('window.__ca && window.__ca.map && window.__ca.map.loaded()'); page.wait_for_timeout(2500)
            out = page.evaluate(JS); print(skin, theme, json.dumps(out, ensure_ascii=False))
            page.screenshot(path=f'/tmp/skin-{skin}-{theme}.png')
            if not out or out['ratio'] < 4.5: bad += 1
    page.evaluate("() => localStorage.removeItem('theme')")
sys.exit(f'명암비 미달 {bad}' if bad else 0)
