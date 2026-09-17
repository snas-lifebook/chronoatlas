#!/usr/bin/env python3
"""lod-count.py: 줌별로 화면에 실제 그려진 이름표 수를 센다 (OVERHAUL-III III-3, R34 완료 조건).

    python3 scripts/lod-count.py [--year -60] [--center 18,40] [--skin light]

serve.sh 의 디버그 Chrome(9222) + 스모크 서버(4180). 줌 3~9에서 `queryRenderedFeatures`로 정착지·바다·지역·폴리티 이름표 층을
세어 표로 찍는다(이름 기준 중복 제거). 판정: z3에 로마·카르타고·알렉산드리아·안티오키아·콘스탄티노플이 있고,
줌 한 단 올릴 때 정착지 이름표 수가 2.5배를 넘지 않는다."""
import argparse, json, sys
from playwright.sync_api import sync_playwright

# 이야기 장소(PACK_PLACES: 로마·카르타고·알렉산드리아…)는 engine이 label-settle-*에서 빼고 story-place-label이 크게 쓴다. 정착지 수에 같이 센다
LAYERS = ['label-settle-1', 'label-settle-2', 'label-settle-3', 'label-settle-4', 'label-settle-5', 'story-place-label', 'label-sea', 'region-name', 'territory-label']
MUST = ['로마', '카르타고', '알렉산드리아', '안티오키아', '콘스탄티노플']
JS = """(layers) => {
  const m = window.__ca.map; const out = {};
  for (const l of layers) {
    if (!m.getLayer(l)) { out[l] = null; continue; }
    const names = new Set(m.queryRenderedFeatures({ layers: [l] }).map(f => f.properties.name_ko ?? f.properties.name));
    out[l] = [...names];
  }
  return out;
}"""


def main() -> int:
    ap = argparse.ArgumentParser()
    # 기본 해는 발표의 해 BC 60. 콘스탄티노플은 AD 330 전에는 교보재(pack-anachronisms)가 가리므로 그 해엔 정답이 넷이다.
    # AD 400으로 돌리면 다섯이 다 있지만 z3는 「로마 제국」 이름표에 밀려 z4부터 다섯이 선다(2026-09-17 실측).
    ap.add_argument('--year', type=int, default=-60); ap.add_argument('--center', default='18,40'); ap.add_argument('--skin', default='light')
    a = ap.parse_args()
    rows = []; bad = []
    with sync_playwright() as p:
        br = p.chromium.connect_over_cdp('http://127.0.0.1:9222'); ctx = br.contexts[0]; page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.set_viewport_size({'width': 1600, 'height': 900})
        page.goto(f'http://127.0.0.1:4180/chronoatlas/?y={a.year}&skin={a.skin}&c={a.center}&z=3&view=2d')
        page.wait_for_function("window.__ca && window.__ca.map && window.__ca.map.loaded() && window.__ca.map.getLayer('territory-label')")
        prev = None
        for z in [3, 4, 5, 6, 7, 8, 9]:
            page.evaluate(f"() => window.__ca.map.jumpTo({{ zoom: {z} }})")
            page.evaluate("() => new Promise(r => { const m = window.__ca.map; const t = setTimeout(() => r('t'), 8000); m.once('idle', () => { clearTimeout(t); r('idle'); }); })")
            page.wait_for_timeout(600)
            got = page.evaluate(JS, LAYERS)
            settle = sum(len(got[l] or []) for l in LAYERS if l.startswith('label-settle') or l == 'story-place-label')
            rows.append((z, settle, len(got['label-sea'] or []), len(got['region-name'] or []), len(got['territory-label'] or [])))
            if z == 3:
                have = set(got['label-settle-1'] or []) | set(got['story-place-label'] or []); miss = [n for n in MUST if n not in have and not (n == '콘스탄티노플' and a.year < 330)]
                if miss: bad.append(f'z3 정착지 1급에 없음: {miss}')
                print('z3 1급(+이야기 장소):', sorted(have))
            if prev and prev > 0 and settle / prev > 2.5: bad.append(f'z{z - 1}→z{z} 정착지 이름표 {prev}→{settle} ({settle / prev:.1f}배)')
            prev = settle
    print('\n| 줌 | 정착지 | 바다 | 지역 | 폴리티 |\n|---|---|---|---|---|')
    for z, s, sea, reg, ter in rows: print(f'| {z} | {s} | {sea} | {reg} | {ter} |')
    if bad: print('\n'.join(bad)); return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
