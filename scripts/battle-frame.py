#!/usr/bin/env python3
"""battle-frame.py: 전투 재생의 중간 프레임을 숫자로 잰다(OVERHAUL §3.10). serve.sh의 디버그 Chrome(9222)에 CDP로 붙는다.
    python3 scripts/battle-frame.py cannae-board 0.5
유닛 좌표가 양 끝 페이즈 사이에 있는지 단언하고 /tmp/battle-<scene>-<t>.png 를 뜬다."""
import json, sys
from playwright.sync_api import sync_playwright

scene = sys.argv[1]
t = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
JS = """(t) => {
  const b = window.__ca.battle && window.__ca.battle(); if (!b) return { error: '말판 없음' };
  const st = window.__ca.store.get(); const board = window.__ca.boards.find(x => x.id === st.board);
  b.seek(t); const f = b.frame();
  const i = Math.floor(t), a = board.phases[i], c = board.phases[i + 1];
  const rows = f.units.map(u => { const ua = a.units.find(x => x.id === u.id), uc = c && c.units.find(x => x.id === u.id);
    const between = ua && uc ? (Math.min(ua.at[0], uc.at[0]) - 1e-9 <= u.at[0] && u.at[0] <= Math.max(ua.at[0], uc.at[0]) + 1e-9) : null;
    return { id: u.id, at: u.at.map(v => +v.toFixed(4)), opacity: +u.opacity.toFixed(2), between }; });
  return { t, phase: f.phase.title, caption: f.caption ?? null, cite: f.cite ?? null, arrows: f.arrows.length, clashes: f.clashes.length, units: rows,
           rendered: window.__ca.map.queryRenderedFeatures({ layers: ['battle-body'] }).length };
}"""
with sync_playwright() as p:
    br = p.chromium.connect_over_cdp('http://127.0.0.1:9222'); ctx = br.contexts[0]; page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.set_viewport_size({'width': 1920, 'height': 1080})
    page.goto(f'http://127.0.0.1:4180/chronoatlas/?present=1&scene={scene}')
    page.wait_for_function('window.__ca && window.__ca.map && window.__ca.map.loaded()'); page.wait_for_timeout(3500)
    out = page.evaluate(JS, t); page.wait_for_timeout(600)
    out2 = page.evaluate("() => ({ rendered: window.__ca.map.queryRenderedFeatures({ layers: ['battle-body'] }).length })")
    out['rendered'] = out2['rendered']
    print(json.dumps(out, ensure_ascii=False, indent=1))
    page.screenshot(path=f'/tmp/battle-{scene}-{t}.png')
    bad = [u for u in out.get('units', []) if u['between'] is False]
    sys.exit(f'양 끝 사이가 아닌 유닛 {len(bad)}' if bad else 0)
