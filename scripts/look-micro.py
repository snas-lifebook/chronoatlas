#!/usr/bin/env python3
"""look-micro.py: 미시지도 장면을 떠서 미시 층별 렌더 개수와 콜아웃 핀 수를 숫자로 잰다(OVERHAUL §3.10).
    python3 scripts/look-micro.py pack-alesia-52 pack-roma-urbs pack-alexandria-47
serve.sh의 디버그 Chrome(9222)에 CDP로 붙는다. 캡처는 /tmp/micro-<scene>.png."""
import json, sys
from playwright.sync_api import sync_playwright

JS = """() => {
  const m = window.__ca.map; const def = window.__ca.micro && window.__ca.micro();
  const layers = ['micro-basemap','micro-fill','micro-fill-outline','micro-line','micro-line-dash-short','micro-line-dash-long','micro-tower','micro-trap-label','micro-point','micro-mark','micro-label'];
  const counts = {};
  for (const id of layers) counts[id] = m.getLayer(id) ? m.queryRenderedFeatures({ layers: [id] }).length : null;
  return { micro: def ? def.id : null, features: def ? def.features.length : 0, zoom: +m.getZoom().toFixed(2), counts,
           pins: document.querySelectorAll('.ca-pin').length, cards: document.querySelectorAll('.ca-card').length,
           terrain: m.getTerrain() ? m.getTerrain().source : null, hidden: ['movement','territory-label','territory-outline'].map(id => m.getLayer(id) ? m.getLayoutProperty(id, 'visibility') : 'x') };
}"""
with sync_playwright() as p:
    br = p.chromium.connect_over_cdp('http://127.0.0.1:9222'); ctx = br.contexts[0]; page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.set_viewport_size({'width': 1920, 'height': 1080})
    for scene in sys.argv[1:]:
        page.goto(f'http://127.0.0.1:4180/chronoatlas/?present=1&scene={scene}')
        page.wait_for_function('window.__ca && window.__ca.map && window.__ca.map.loaded()'); page.wait_for_timeout(3500)
        out = page.evaluate(JS); print(scene, json.dumps(out, ensure_ascii=False))
        page.screenshot(path=f'/tmp/micro-{scene}.png')
