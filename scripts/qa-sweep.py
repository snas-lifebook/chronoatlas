#!/usr/bin/env python3
"""qa-sweep.py: 발표 모드로 모든 장면(또는 인자로 준 장면)을 돌며 UX 방해를 잰다: 설명창·알약 밑에 깔린 말, 콜아웃 카드와 재생 바·알약·설명창의 겹침, 화면 밖 카드, 페이지 오류.
    python3 scripts/qa-sweep.py [scene…]     # 캡처 /tmp/qa/<scene>.png
serve.sh의 디버그 Chrome(9222). 2026-09-17 QA에서 갈리아·최대 판도 51의 카이사르가 설명창 밑에, 알레시아·로마·알렉산드리아 카드가 화면 밖에 있던 것을 잡았다."""
import json, os, sys
os.makedirs('/tmp/qa', exist_ok=True)
from playwright.sync_api import sync_playwright
scenes = sys.argv[1:] or [s['id'] for s in json.load(open('data/scenes/rome.json'))]
JS = """() => {
  const box = s => { const el = document.querySelector(s); if (!el || !el.offsetParent) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const inside = (p, b) => b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  const ov = (a, b) => a && b && !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  const m = window.__ca.map; const hud = box('.shell-present-hud'), nav = box('.shell-scene-nav'), board = box('.shell-board');
  const toks = m.queryRenderedFeatures({ layers: ['people-dot'] }).map(f => ({ name: f.properties.name, p: m.project(f.geometry.coordinates) }));
  const cards = [...document.querySelectorAll('.ca-card')].map(e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const labels = m.queryRenderedFeatures({ layers: ['territory-label'] }).length;
  const named = new Set(m.queryRenderedFeatures({ layers: ['people-label'] }).map(f => f.properties.name));
  const namesDropped = toks.map(t => t.name).filter(n => !named.has(n));   // 인물 이름이 네 방향 다 막혀 빠진 것(2026-09-18 도시 우선 뒤)
  return { z: +m.getZoom().toFixed(1), tokensUnderHud: toks.filter(t => inside(t.p, hud)).map(t => t.name), tokensUnderNav: toks.filter(t => inside(t.p, nav)).map(t => t.name),
    cardsOverBoard: cards.filter(c => ov(c, board)).length, cardsOverNav: cards.filter(c => ov(c, nav)).length, cardsOverHud: cards.filter(c => ov(c, hud)).length, cards: cards.length,
    cardsOffscreen: cards.filter(c => c.y + c.h > innerHeight || c.y < 0).length, labels, namesDropped, micro: window.__ca.micro()?.id ?? null, board: !!board };
}"""
with sync_playwright() as p:
    br = p.chromium.connect_over_cdp('http://127.0.0.1:9222'); ctx = br.contexts[0]; page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.set_viewport_size({'width': 1600, 'height': 900})
    errs = []; page.on('pageerror', lambda e: errs.append(str(e)[:120]))
    for sc in scenes:
        page.goto(f'http://127.0.0.1:4180/chronoatlas/?present=1&scene={sc}')
        try: page.wait_for_function('window.__ca && window.__ca.map && window.__ca.map.loaded()', timeout=40000)
        except Exception as e: print(sc, 'LOAD TIMEOUT'); continue
        page.wait_for_timeout(5500)
        out = page.evaluate(JS); print(sc, json.dumps(out, ensure_ascii=False))
        page.screenshot(path=f'/tmp/qa/{sc}.png')
    print('pageerrors', errs[:5])
