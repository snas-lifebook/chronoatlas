#!/usr/bin/env python3
"""bake-satellite.py: 위성 스킨 래스터 두 장 (OVERHAUL-III §3 III-1, R52·R19).

    python3 scripts/bake-satellite.py            # rasters/satellite.jpg + satellite-sea.png
    python3 scripts/bake-satellite.py --check    # 굽지 않고 원본·크기만 확인

원본: NASA Blue Marble Next Generation 2004-07 「topo + bathy」 21600×10800 (Public Domain, NASA Earth Observatory).
  data/external/satellite/world.topo.bathy.200407.3x21600x10800.png (gitignore, 190 MB).
  https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/world.topo.bathy.200407.3x21600x10800.png

무엇을 하나 (relief.jpg와 같은 방식, reproject-relief.py 참조):
  1. BBOX(scripts/extent.ts)를 평사도법 원본에서 크롭한다(60 px/°). [-25,12,75,62]면 6000×3000.
  2. 세로만 메르카토르로 다시 샘플링한다(MapLibre image 소스는 네 귀퉁이를 메르카토르 평면에 고정한다). 경도는 두 투영 모두 선형.
  3. satellite.jpg(q82) 저장.
  4. 바다 마스크 satellite-sea.png: 같은 그림을 절반 크기(3000×1500)로 줄이고 layers/ocean.geojson(bbox − 육지, 섬은 구멍)을
     알파로 굽는다. 엔진이 영역 폴리곤 위에 이것을 덮어 「색이 바다로 새는 것」을 막으면서 수심 음영은 남긴다.
     색 한 장(ocean-mask fill)으로 덮으면 위성 바다가 사라진다.

지어내지 않는다: 픽셀은 원본 그대로이고 재투영·크롭뿐이다. 라이선스 대장: data/external/LICENSES.md, public/assets/CREDITS.md.
"""
from __future__ import annotations
import argparse, json, math, re, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'data/external/satellite/world.topo.bathy.200407.3x21600x10800.png'
OUT = ROOT / 'public/datasets/rome/rasters'
OCEAN = ROOT / 'public/datasets/rome/layers/ocean.geojson'
PX_PER_DEG = 60  # 21600 / 360


def bbox_from_extent():
    m = re.search(r'BBOX\s*=\s*\[([^\]]+)\]', (ROOT / 'scripts/extent.ts').read_text())
    return [float(v) for v in m.group(1).split(',')]


def merc_y(lat: float) -> float:
    return math.log(math.tan(math.radians(45 + lat / 2)))


def inv_merc(y: float) -> float:
    return math.degrees(2 * math.atan(math.exp(y)) - math.pi / 2)


def to_mercator_rows(a: np.ndarray, s: float, n: float) -> np.ndarray:
    """평사도법(위도 선형) 행 → 메르카토르 균등 행. 두 행 사이 선형 보간."""
    H = a.shape[0]
    ys, yn = merc_y(s), merc_y(n)
    out_lat = np.array([inv_merc(yn - (i + 0.5) / H * (yn - ys)) for i in range(H)])
    src = (n - out_lat) / (n - s) * H - 0.5
    src = np.clip(src, 0, H - 1)
    r0 = np.floor(src).astype(int); r1 = np.minimum(r0 + 1, H - 1); t = (src - r0)[:, None, None].astype(np.float32)
    return (a[r0].astype(np.float32) * (1 - t) + a[r1].astype(np.float32) * t).round().astype(np.uint8)


def sea_alpha(w: float, s: float, e: float, n: float, W: int, H: int) -> Image.Image:
    """ocean.geojson을 메르카토르 격자에 래스터라이즈. 바깥 고리 255, 구멍(섬) 0."""
    ys, yn = merc_y(s), merc_y(n)
    def px(lon: float, lat: float):
        return ((lon - w) / (e - w) * W, (yn - merc_y(max(min(lat, 89.9), -89.9))) / (yn - ys) * H)
    img = Image.new('L', (W, H), 0); d = ImageDraw.Draw(img)
    fc = json.loads(OCEAN.read_text())
    for f in fc['features']:
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for poly in polys:
            for i, ring in enumerate(poly):
                pts = [px(c[0], c[1]) for c in ring]
                if len(pts) >= 3: d.polygon(pts, fill=255 if i == 0 else 0)
    return img.filter(ImageFilter.GaussianBlur(0.8))


def main() -> int:
    ap = argparse.ArgumentParser(); ap.add_argument('--check', action='store_true'); args = ap.parse_args()
    if not SRC.exists():
        print(f'원본이 없다: {SRC}\n  curl -o "{SRC}" <NASA URL은 파일 머리 주석>'); return 2
    w, s, e, n = bbox_from_extent()
    x0, x1 = int(round((w + 180) * PX_PER_DEG)), int(round((e + 180) * PX_PER_DEG))
    y0, y1 = int(round((90 - n) * PX_PER_DEG)), int(round((90 - s) * PX_PER_DEG))
    print(f'bbox {w},{s},{e},{n} → crop x {x0}..{x1} y {y0}..{y1} = {x1 - x0}×{y1 - y0}')
    if args.check: return 0
    im = Image.open(SRC); im = im.crop((x0, y0, x1, y1)).convert('RGB')
    a = to_mercator_rows(np.asarray(im), s, n)
    OUT.mkdir(parents=True, exist_ok=True)
    jpg = OUT / 'satellite.jpg'
    Image.fromarray(a).save(jpg, quality=82, optimize=True, progressive=True)
    # 바다 마스크: 절반 해상도. 육지는 투명이고 RGB도 0으로 눌러 PNG가 작아진다.
    half = Image.fromarray(a).resize((a.shape[1] // 2, a.shape[0] // 2), Image.LANCZOS)
    alpha = sea_alpha(w, s, e, n, half.width, half.height)
    rgb = np.asarray(half).copy(); al = np.asarray(alpha)
    rgb[al == 0] = 0
    png = OUT / 'satellite-sea.png'
    Image.merge('RGBA', (*Image.fromarray(rgb).split(), alpha)).save(png, optimize=True)
    sea_share = float((al > 127).mean())
    print(f'{jpg.name} {jpg.stat().st_size // 1024} KB · {png.name} {png.stat().st_size // 1024} KB · 바다 비율 {sea_share:.2f}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
