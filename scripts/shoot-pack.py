#!/usr/bin/env python3
"""카이사르 팩 발표 장면 아홉 장을 정지 이미지로 뽑는다.

에셋 사양서 B절 「공통 내보내기 규약」을 그대로 지킨다 — 16:9 · 1920x1080 이상 ·
스킨 campaign 고정 · 한글 이름표 · 앱 크롬 없음 · 연도 숫자 없음.

## 왜 이렇게 짰는지 (함정 넷을 피한 결과다)

**1. URL에 `layers=`를 안 붙인다.** 이것이 9/12에 세 장을 죽인 원인이다.
`docs/PACK-CAESAR.md` §0의 경고 그대로 — `layers=`가 있으면 장면 레이어를 덮어써서
인물·경로·전투가 꺼진 채 열린다. `_못만든것/ca_02_갈리아원정BC52.jpeg`를 열어 보면
영역과 도시 점만 있고 말·경로선·전투점·한글 라벨이 전부 없다. 판도 네 장은
territory와 admin_regions만 필요해서 같은 URL로도 살았고, 말이 주인공인 장만 죽었다.
**URL은 `?present=1&scene=…&skin=campaign`까지만.**

**2. 떠 있는 포그라운드 Chrome에 붙는다(launch가 아니다).** 자동화 탭에서는
`document.hidden`이 참이라 rAF가 멈춰 **지도가 영영 안 뜬다.** 셸과 데이터는 다 뜨고
JS 에러도 0이라 코드 버그로 오진하기 쉽다. `scripts/serve.sh`가 띄운 창에 CDP로
붙으면 그 창은 화면에 보이는 창이라 이 문제가 없다.

**3. 캔버스만 읽는다.** 툴바의 PNG 버튼은 하단 띠를 합성해 굽는다(연도·부제·범례·
출처가 그림 안으로 들어온다 — `src/export/png.ts`). 대신 `maplibregl-canvas`를 직접
읽으면 HUD·인스펙터·범례가 **구조적으로** 안 들어온다. DOM이라서다. 지도가
`preserveDrawingBuffer: true`로 떠 있어(`src/map/engine.ts`) 캔버스를 그대로 읽을 수 있다.
장기말은 MapLibre custom layer(`token3d.ts`)라 같은 캔버스에 그려져 같이 담긴다.

**4. 선택을 해제한다.** 장면에 `sel: person:카이사르`가 박혀 있으면 관계 그래프
오버레이(`ego-edge`)가 켜져서 선택된 인물의 이웃까지 직선이 그어진다. 카이사르는
관계가 40개라 화면을 가로지르는 선이 한 다발 생긴다. 발표용 정지 이미지에 필요한
층은 다섯(영역·말·경로·도시·전투)이고 관계선은 그 다섯에 없다.

## 글자 크기

라벨 `text-size`가 원본은 줌 3~9에서 11~18px다. 3200x1800으로 뽑아 프로젝터로 쏘면
도시 이름이 안 읽힌다. 사양서에 pt 수치 요구는 없고 판정 기준은 「프로젝터에서
읽히는가」 하나뿐이라, 심볼 레이어의 text-size를 일괄로 SCALE배 한다.

**앱 소스를 안 고친다.** `window.__ca.map`(검수 스크립트용으로 이미 열려 있는 훅)에
스타일 속성만 얹으므로 River가 보는 라이브 화면은 그대로다. 표현식을
`['*', SCALE, 원본]`으로 감싸는 방식이라 interpolate든 상수든 다 통한다.

    python3 scripts/shoot-pack.py              # 아홉 장 전부
    python3 scripts/shoot-pack.py pack-rubicon # 한 장만 (카메라 조정 반복용)
    python3 scripts/shoot-pack.py --scale 1.8  # 글자를 더 키워 본다
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SHOT = REPO / "docs/verify/shot"
VAULT = Path(
    "/Users/river/Library/Mobile Documents/iCloud~md~obsidian/Documents/"
    "River's Second Brain/Efforts/Notes/산업스터디/Projects/인생책_읽기_편데/"
    "Production/2026-09_제작_로마쇠망사_카이사르팩/assets/지도"
)

CDP = "http://127.0.0.1:9222"
BASE = "http://127.0.0.1:4180/chronoatlas/"

# 1920x1080 @ dsf 2 = 3840x2160. 기존 납품본 넷이 3200x1800이라 그보다 크고 16:9가 정확하다.
VIEW_W, VIEW_H, DSF = 1920, 1080, 2
SCALE = 1.5        # 라벨 배율. ponytail: 상수 하나. 프로젝터에서 안 읽히면 --scale로 올린다
SEA = (0xC7, 0xD2, 0xCB)  # campaign 스킨의 바다색(src/map/style.ts). 투명 구멍을 이 색으로 받친다
HALO = 1.4         # 후광도 같이 키운다. 글자만 키우면 배경에 묻힌다
IDLE_MS = 25000    # 타일·글리프·영토 폴리곤까지. 지중해 전역 장은 느리다

# 장면 id → 납품 파일명. 사양서 B절 §「아홉 장」 표의 파일명이다.
SCENES = [
    ("pack-intro-med",   "intro_지도_지중해판도_BC60_v1"),
    ("pack-gaul-52",     "M2_지도_갈리아원정_BC52_v1"),
    ("pack-extent-60",   "M2_지도_판도_BC60_v1"),
    ("pack-extent-51",   "M2_지도_판도_BC51_v1"),
    ("pack-rubicon",     "M3_지도_루비콘_BC49_v1"),
    ("pack-greece-48",   "M3_지도_그리스내전_BC48_v1"),
    ("pack-egypt-47",    "M4_지도_이집트_BC47_v1"),
    ("pack-extent-44",   "M4_지도_판도_BC44_v1"),
    ("pack-augustan-27", "epilogue_지도_제정_BC27_v1"),
]

# 캡처 직전에 페이지에서 실행한다. 반환값이 리포트로 올라온다.
PREP = """
(args) => {
  const { scale, halo } = args;
  const ca = window.__ca;
  if (!ca || !ca.map) return { ok: false, why: '__ca 훅이 없다 — 앱이 아직 안 떴다' };
  const m = ca.map;

  // 관계 그래프 오버레이를 끈다. 카이사르가 선택돼 있으면 이웃까지 직선이 한 다발 그어진다.
  ca.store.set({ sel: null });

  // 심볼 레이어의 글자를 일괄로 키운다. 표현식을 곱으로 감싸므로 interpolate도 상수도 통한다.
  let bumped = 0;
  for (const l of m.getStyle().layers) {
    if (l.type !== 'symbol') continue;
    let ts;
    try { ts = m.getLayoutProperty(l.id, 'text-size'); } catch { continue; }
    if (ts == null) continue;
    try {
      m.setLayoutProperty(l.id, 'text-size', ['*', scale, ts]);
      const hw = m.getPaintProperty(l.id, 'text-halo-width');
      if (hw != null) m.setPaintProperty(l.id, 'text-halo-width', ['*', halo, hw]);
      bumped++;
    } catch (e) { /* 못 바꾸는 레이어는 건너간다 */ }
  }
  return { ok: true, bumped };
}
"""

# 지도가 멈출 때까지 기다린다. idle이 이미 지났을 수도 있어 loaded도 같이 본다.
SETTLE = """
(ms) => new Promise(res => {
  const m = window.__ca && window.__ca.map;
  if (!m) return res('no-map');
  const done = () => res('idle');
  const t = setTimeout(() => res('timeout'), ms);
  const fin = v => { clearTimeout(t); res(v); };
  if (m.loaded() && m.areTilesLoaded()) {
    // 이미 조용하면 한 프레임만 더 돌려 보낸다
    requestAnimationFrame(() => requestAnimationFrame(() => fin('already')));
  } else {
    m.once('idle', () => fin('idle'));
  }
})
"""

# 뽑은 판에 다섯 층이 실제로 있는지 센다. 「빈 지도는 실패」 판정을 눈보다 먼저 거른다.
COUNT = """
() => {
  const m = window.__ca.map;
  const vis = id => m.getLayer(id) && m.getLayoutProperty(id, 'visibility') !== 'none';
  const n = (src, filt) => { try { return m.querySourceFeatures(src, filt || {}).length; } catch { return -1; } };
  return {
    영역: vis('territory-fill') ? n('territory') : 0,
    도시: vis('settle-major') ? n('settlements') : 0,
    경로: vis('movement') ? n('movements') : 0,
    전투: (vis('battle') ? n('battles') : 0) + (vis('pack-battle') ? n('pack-battles') : 0),
    말:   vis('people-label') ? n('people') : 0,
    갈리아자유: vis('gallia-free') ? 1 : 0,
    갈리아로마: vis('gallia-roman') ? 1 : 0,
  };
}
"""


def shoot(page, cdp, scene: str, stem: str, scale: float) -> dict:
    url = f"{BASE}?present=1&scene={scene}&skin=campaign"   # layers= 절대 금지
    page.goto(url, wait_until="load")
    page.wait_for_function("() => !!(window.__ca && window.__ca.map)", timeout=30000)
    prep = page.evaluate(PREP, {"scale": scale, "halo": HALO})
    if not prep.get("ok"):
        raise RuntimeError(f"{scene}: {prep.get('why')}")
    settle = page.evaluate(SETTLE, IDLE_MS)
    page.wait_for_timeout(1200)          # 장기말 행군 보간 1.2s가 끝나고 제자리에 선다
    layers = page.evaluate(COUNT)

    data = page.evaluate(
        "() => document.querySelector('canvas.maplibregl-canvas').toDataURL('image/png')")
    raw = base64.b64decode(data.split(",", 1)[1])

    from PIL import Image
    im = Image.open(io.BytesIO(raw))

    # 바다색을 깔고 그 위에 합성한다. **투명 픽셀이 남으면 검은 얼룩이 된다.**
    # 지형(DEM) 타일이 없는 먼 대서양(경도 -15 서쪽)에는 아무것도 안 그려져 캔버스가
    # 투명하다. 화면에서는 페이지 배경이 받쳐 줘서 안 보이지만, 캔버스만 떠서 RGB로
    # 눕히면 그 자리가 검게 나온다 — 판도 다섯 장에서 1.5%가 그랬다. 바다이므로 바다색으로 받친다.
    alpha = im.getchannel("A") if im.mode == "RGBA" else None
    holes = 0 if alpha is None else sum(1 for v in alpha.getdata() if v == 0)
    flat = Image.new("RGB", im.size, SEA)
    flat.paste(im, (0, 0), im if im.mode == "RGBA" else None)

    SHOT.mkdir(parents=True, exist_ok=True)
    flat.save(SHOT / f"{stem}.png")
    flat.save(VAULT / f"{stem}.jpeg", quality=92, optimize=True)
    return {"scene": scene, "file": stem, "size": f"{im.size[0]}x{im.size[1]}",
            "settle": settle, "bumped": prep["bumped"], "투명메움": holes, **layers}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("only", nargs="*", help="장면 id. 비우면 아홉 장 전부")
    ap.add_argument("--scale", type=float, default=SCALE)
    a = ap.parse_args()

    todo = [(s, f) for s, f in SCENES if not a.only or s in a.only]
    if not todo:
        print(f"그런 장면이 없다. 있는 것: {', '.join(s for s, _ in SCENES)}")
        return 2
    if not VAULT.is_dir():
        print(f"볼트 지도 폴더가 없다: {VAULT}")
        return 2

    from playwright.sync_api import sync_playwright
    rows = []
    with sync_playwright() as p:
        try:
            browser = p.chromium.connect_over_cdp(CDP)
        except Exception as e:
            print(f"9222에 못 붙었다 — `bash scripts/serve.sh`로 검증 창을 먼저 띄운다.\n  {e}")
            return 1
        ctx = browser.contexts[0]
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        cdp = ctx.new_cdp_session(page)
        # 포그라운드 창의 실제 크기와 무관하게 16:9를 못 박는다. 창을 숨기지는 않는다.
        cdp.send("Emulation.setDeviceMetricsOverride", {
            "width": VIEW_W, "height": VIEW_H, "deviceScaleFactor": DSF, "mobile": False})
        try:
            for scene, stem in todo:
                print(f"  {scene:18s} → {stem} ...", end="", flush=True)
                try:
                    r = shoot(page, cdp, scene, stem, a.scale)
                    rows.append(r)
                    thin = [k for k in ("영역", "도시", "경로", "전투", "말") if r[k] == 0]
                    print(f" {r['size']}  {r['settle']}" + (f"  ⚠ 빈 층: {','.join(thin)}" if thin else "  ✓"))
                except Exception as e:
                    print(f" 실패 — {e}")
        finally:
            cdp.send("Emulation.clearDeviceMetricsOverride")
            # River가 볼 창이니 발표 첫 장으로 되돌려 둔다(스타일 변경도 리로드로 날아간다)
            page.goto(f"{BASE}?present=1&scene=pack-intro-med", wait_until="load")

    if rows:
        (SHOT / "_shot.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), "utf8")
        print(f"\n{len(rows)}/{len(todo)} 장. png는 {SHOT}, 납품 jpeg는 {VAULT}")
        print("층 개수는 docs/verify/shot/_shot.json. 빈 층이 있으면 그 장은 다시 뽑는다.")
    return 0 if len(rows) == len(todo) else 1


if __name__ == "__main__":
    sys.exit(main())
