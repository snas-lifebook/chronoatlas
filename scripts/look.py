#!/usr/bin/env python3
"""장면 하나를 그대로 떠서 /tmp에 저장한다. 납품본을 안 건드리는 검수용.

shoot-pack.py는 볼트와 docs/verify/shot에 바로 쓴다 — 작업 중에 돌리면 납품본이
반쯤 고친 상태로 덮인다. 이건 같은 경로로 캔버스만 읽고 /tmp에 떨군다.

    python3 scripts/look.py pack-greece-48
    python3 scripts/look.py pack-greece-48 --zoom 6 --center 20,39
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import sys
from pathlib import Path


CDP = "http://127.0.0.1:9222"
BASE = "http://127.0.0.1:4180/chronoatlas/"
VIEW_W, VIEW_H = 1920, 1080

COUNT = """
() => {
  const m = window.__ca.map;
  const vis = id => m.getLayer(id) && m.getLayoutProperty(id, 'visibility') !== 'none';
  const n = (src) => { try { return m.querySourceFeatures(src).length; } catch { return -1; } };
  const W = m.getCanvas().clientWidth, H = m.getCanvas().clientHeight;
  const people = [], seen = new Set();
  for (const f of m.querySourceFeatures('people')) {
    const id = f.properties.id; if (seen.has(id)) continue; seen.add(id);
    const p = m.project(f.geometry.coordinates);
    people.push({ 이름: f.properties.name, 주역: !!f.properties.principal,
                  배율: f.properties.scale, 군단: f.properties.legions,
                  x: +(100*p.x/W).toFixed(1), y: +(100*p.y/H).toFixed(1) });
  }
  return {
    영역: vis('territory-fill') ? n('territory') : 0,
    도시: vis('settle-major') ? n('settlements') : 0,
    경로: vis('movement') ? n('movements') : 0,
    화살표: vis('movement-arrow') ? 1 : 0,
    전투: (vis('battle') ? n('battles') : 0) + (vis('pack-battle') ? n('pack-battles') : 0),
    // 주변 민족 면(pack-peoples + 묶음 peoples). 2026-09-21 배포본에서 0이었는데(FeatureCollection type 누락) 어느 계측도 이 층을 안 세고 있었다.
    주변민족: vis('peoples-fill') ? m.queryRenderedFeatures({ layers: ['peoples-fill'] }).length : 0,
    갈리아자유: vis('gallia-free') ? 1 : 0, 갈리아로마: vis('gallia-roman') ? 1 : 0,
    말: people, 줌: +m.getZoom().toFixed(2),
    안전영역밖: people.filter(p => p.y < 18 || p.y > 62 || p.x < 20 || p.x > 80).map(p => `${p['이름']}(${p.x},${p.y})`),
  };
}
"""

# 글자 키우기는 shoot-pack.py의 PREP 그대로 쓴다 — 두 벌로 갈리면 검수 화면과 납품본이 달라진다.
def _prep() -> str:
    import importlib.util
    spec = importlib.util.spec_from_file_location("shootpack", Path(__file__).with_name("shoot-pack.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)          # type: ignore[union-attr]
    return mod.PREP


BUMP = _prep()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("scene")
    ap.add_argument("--scale", type=float, default=1.5)
    ap.add_argument("--zoom", type=float)
    ap.add_argument("--center")
    ap.add_argument("--out", default=None)
    ap.add_argument("--skin", default="campaign")
    a = ap.parse_args()

    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(CDP)
        ctx = browser.contexts[0]
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        cdp = ctx.new_cdp_session(page)
        cdp.send("Emulation.setDeviceMetricsOverride",
                 {"width": VIEW_W, "height": VIEW_H, "deviceScaleFactor": 2, "mobile": False})
        url = f"{BASE}?present=1&scene={a.scene}&skin={a.skin}"
        if a.zoom:
            url += f"&z={a.zoom}"
        if a.center:
            url += f"&c={a.center}"
        page.goto(url, wait_until="load")
        page.wait_for_function(
            "() => { const m = window.__ca && window.__ca.map;"
            " return !!(m && m.getLayer && m.getLayer('territory-label') && m.getLayer('people-label')); }",
            timeout=30000)
        prep = page.evaluate(BUMP, {"scale": a.scale, "halo": 1.4})
        print("글자배율 적용", prep)
        page.evaluate("(ms) => new Promise(r => { const m = window.__ca.map;"
                      " const t = setTimeout(() => r('timeout'), ms);"
                      " m.once('idle', () => { clearTimeout(t); r('idle'); }); })", 25000)
        page.wait_for_timeout(1400)
        info = page.evaluate(COUNT)
        data = page.evaluate("() => document.querySelector('canvas.maplibregl-canvas').toDataURL('image/png')")
        cdp.send("Emulation.clearDeviceMetricsOverride")

    from PIL import Image
    im = Image.open(io.BytesIO(base64.b64decode(data.split(",", 1)[1])))
    flat = Image.new("RGB", im.size, (0xC7, 0xD2, 0xCB))
    flat.paste(im, (0, 0), im if im.mode == "RGBA" else None)
    flat.thumbnail((1500, 1500))
    out = a.out or f"/tmp/look_{a.scene}.png"
    flat.save(out)
    print(json.dumps(info, ensure_ascii=False, indent=1))
    print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
