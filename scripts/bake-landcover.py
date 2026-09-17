#!/usr/bin/env python3
"""bake-landcover.py: ESA WorldCover 10 m(2021 v200, CC BY 4.0) 토지피복을 미시지도 인셋 래스터 타일로 굽는다. OVERHAUL §3.6b (R56).

  python3 scripts/bake-landcover.py --selftest
  python3 scripts/bake-landcover.py <micromap-id> [--maxzoom 12]
  python3 scripts/bake-landcover.py --all

River: "좀 더 현실 지형 지도가 마치 구글맵처럼 보이면 좋겠다 … 자연 환경이라도 말이야." 숲·경작·초지·나지·물을 우리 campaign 팔레트로
재색해 DEM 음영 밑에 깐다. 3°×3° 원본 타일(10~100 MB)은 data/external/landcover/ 에 캐시(gitignore)하고 zarr 창 읽기로 필요한 조각만 읽는다.
출력 public/datasets/rome/landcover-<id>/{z}/{x}/{y}.png (RGB, 256px). 출처 표기: (c) ESA WorldCover project 2021, CC BY 4.0.
"""
from __future__ import annotations
import argparse, json, math, sys, urllib.request, urllib.error
from pathlib import Path
import numpy as np
from PIL import Image
import tifffile
import zarr

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'data' / 'external' / 'landcover'
DS = ROOT / 'public' / 'datasets' / 'rome'
URL = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{lat}{lon}_Map.tif'
CREDIT = '(c) ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium. CC BY 4.0'

# WorldCover 클래스 → 우리 팔레트(campaign 톤). 10 나무 · 20 관목 · 30 초지 · 40 경작 · 50 건조지 · 60 나지 · 70 눈 · 80 물 · 90 습지 · 95 맹그로브 · 100 이끼
PALETTE: dict[int, tuple[int, int, int]] = {
    10: (0x8A, 0xA0, 0x74), 20: (0xA8, 0xB2, 0x7E), 30: (0xC8, 0xCC, 0x9E), 40: (0xD9, 0xC9, 0x8C), 50: (0xBA, 0xB0, 0xA0),
    60: (0xD8, 0xCB, 0xB0), 70: (0xF0, 0xEF, 0xE8), 80: (0xC7, 0xD2, 0xCB), 90: (0xA9, 0xBF, 0xA7), 95: (0x7E, 0x9A, 0x7A), 100: (0xBF, 0xC4, 0xA8),
}
LUT = np.tile(np.array([0xD8, 0xCB, 0xB0], np.uint8), (256, 1))   # 자료 없음·미정의 클래스 → 나지색
for k, v in PALETTE.items():
    LUT[k] = v


def lonlat_to_tile(lon: float, lat: float, z: int):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
    return min(max(x, 0), n - 1), min(max(y, 0), n - 1)


def tile_pixel_lonlat(z: int, x: int, y: int, size: int = 256):
    n = 2 ** z
    p = (np.arange(size) + 0.5) / size
    lon = (x + p) / n * 360 - 180
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * (y + p) / n))))
    return lon, lat


def fetch(url: str, dest: Path) -> bool:
    if dest.exists():
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix('.part')
    try:
        with urllib.request.urlopen(url, timeout=300) as r, open(tmp, 'wb') as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
        tmp.rename(dest)
        print('받음', dest.name, f'{dest.stat().st_size / 1e6:.1f}MB')
        return True
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print('없음', url.rsplit('/', 1)[-1])
            return False
        raise


class Window:
    """WorldCover 3° 타일에서 bbox 창만 메모리로. 원본은 36,000×36,000 uint8(1.3 GB)이라 통째로 못 연다."""
    def __init__(self, path: Path, bbox):
        W, S, E, N = bbox
        with tifffile.TiffFile(path) as tf:
            page = tf.pages[0]
            tp = page.tags['ModelTiepointTag'].value
            sc = page.tags['ModelPixelScaleTag'].value
            self.sx, self.sy = float(sc[0]), float(sc[1])
            self.x0 = float(tp[3]) - float(tp[0]) * self.sx
            self.y0 = float(tp[4]) + float(tp[1]) * self.sy
            h, w = page.shape[:2]
            c0 = max(0, int((W - self.x0) / self.sx) - 1); c1 = min(w, int((E - self.x0) / self.sx) + 2)
            r0 = max(0, int((self.y0 - N) / self.sy) - 1); r1 = min(h, int((self.y0 - S) / self.sy) + 2)
            if c1 <= c0 or r1 <= r0:
                self.arr = None; return
            store = tf.aszarr()
            z = zarr.open(store, mode='r')
            if isinstance(z, zarr.Group):      # COG 오버뷰가 있으면 다중 축척 그룹이다. '0'이 원 해상도(zarr 3)
                z = z['0']
            self.arr = np.asarray(z[r0:r1, c0:c1])
            store.close()
        self.c0, self.r0 = c0, r0

    @property
    def bounds(self):
        if self.arr is None:
            return None
        h, w = self.arr.shape
        return (self.x0 + self.c0 * self.sx, self.y0 - (self.r0 + h) * self.sy, self.x0 + (self.c0 + w) * self.sx, self.y0 - self.r0 * self.sy)

    def sample(self, lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
        """최근접. lon (W,), lat (H,) → 클래스 (H, W). 창 밖은 0."""
        out = np.zeros((lat.size, lon.size), np.uint8)
        if self.arr is None:
            return out
        cx = np.floor((lon - self.x0) / self.sx).astype(int) - self.c0
        ry = np.floor((self.y0 - lat) / self.sy).astype(int) - self.r0
        h, w = self.arr.shape
        mx = (cx >= 0) & (cx < w); my = (ry >= 0) & (ry < h)
        sub = self.arr[np.ix_(np.clip(ry, 0, h - 1), np.clip(cx, 0, w - 1))]
        m = my[:, None] & mx[None, :]
        out[m] = sub[m]
        return out


def windows_for(bbox) -> list[Window]:
    W, S, E, N = bbox
    out = []
    for lat in range(int(math.floor(S / 3)) * 3, int(math.ceil(N / 3)) * 3, 3):
        for lon in range(int(math.floor(W / 3)) * 3, int(math.ceil(E / 3)) * 3, 3):
            name = f"{'N' if lat >= 0 else 'S'}{abs(lat):02d}", f"{'E' if lon >= 0 else 'W'}{abs(lon):03d}"
            url = URL.format(lat=name[0], lon=name[1]); dest = CACHE / url.rsplit('/', 1)[-1]
            if fetch(url, dest):
                win = Window(dest, bbox)
                if win.arr is not None:
                    out.append(win)
    return out


def bake(mid: str, maxzoom: int):
    mm = json.loads((ROOT / 'data' / 'micromaps' / f'{mid}.json').read_text())
    lc = mm.get('landcover')
    if not lc:
        sys.exit(f'{mid}: landcover 블록이 없다')
    (lon, lat), span = mm['home']['at'], mm['home']['span']
    bbox = [lon - span, lat - span, lon + span, lat + span]
    wins = windows_for(bbox)
    if not wins:
        sys.exit('WorldCover 창 0')
    out = DS / lc['dir']
    n = 0
    for z in range(lc.get('minzoom', 8), min(maxzoom, lc.get('maxzoom', 12)) + 1):
        x0, y0 = lonlat_to_tile(bbox[0], bbox[3], z); x1, y1 = lonlat_to_tile(bbox[2], bbox[1], z)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                lo, la = tile_pixel_lonlat(z, x, y)
                cls = np.zeros((256, 256), np.uint8)
                for w in wins:
                    c = w.sample(lo, la); cls[c > 0] = c[c > 0]
                png = out / str(z) / str(x) / f'{y}.png'
                png.parent.mkdir(parents=True, exist_ok=True)
                Image.fromarray(LUT[cls], 'RGB').save(png, optimize=True)
                n += 1
        print(f'{mid} z{z} 끝, 누적 {n}장')
    (out / 'meta.json').write_text(json.dumps({'source': 'ESA WorldCover 10m 2021 v200', 'credit': CREDIT, 'minzoom': lc.get('minzoom', 8), 'maxzoom': min(maxzoom, lc.get('maxzoom', 12))}, ensure_ascii=False))
    print('토지피복', mid, n, '장 →', out)


def selftest():
    assert tuple(LUT[10]) == PALETTE[10] and tuple(LUT[80]) == PALETTE[80] and tuple(LUT[3]) == (0xD8, 0xCB, 0xB0), 'LUT'
    w = Window.__new__(Window); w.arr = np.array([[10, 40], [80, 0]], np.uint8); w.x0, w.y0, w.sx, w.sy, w.c0, w.r0 = 0.0, 2.0, 1.0, 1.0, 0, 0
    s = w.sample(np.array([0.5, 1.5]), np.array([1.5, 0.5]))
    assert s.tolist() == [[10, 40], [80, 0]], f'최근접 표본 {s.tolist()}'
    assert w.sample(np.array([5.0]), np.array([5.0])).tolist() == [[0]], '창 밖은 0'
    assert lonlat_to_tile(12.36, 44.07, 8) == (136, 93)
    print('selftest ok')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('id', nargs='?'); ap.add_argument('--maxzoom', type=int, default=12)
    ap.add_argument('--all', action='store_true'); ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        selftest()
    elif a.all:
        for f in sorted((ROOT / 'data' / 'micromaps').glob('*.json')):
            if f.name != 'index.json' and json.loads(f.read_text()).get('landcover'):
                bake(f.stem, a.maxzoom)
    elif a.id:
        bake(a.id, a.maxzoom)
    else:
        ap.print_help()
