#!/usr/bin/env python3
"""bake-dem.py: DEM 원본(GeoTIFF)을 terrarium PNG 타일로 굽는다. GDAL 없이 numpy + tifffile. OVERHAUL §3.7 (R48·R56).

  python3 scripts/bake-dem.py --selftest
  python3 scripts/bake-dem.py continental [--maxzoom 8]     # ETOPO 2022 15초 → public/datasets/rome/terrain/ (BBOX는 scripts/extent.ts)
  python3 scripts/bake-dem.py inset <id> [--maxzoom 12]     # Copernicus GLO-30 → public/datasets/rome/terrain-<id>/ (범위는 미시지도 home 또는 data/insets.json)
  python3 scripts/bake-dem.py inset --all                   # dem 블록이 있는 미시지도 + insets.json 전부

원본은 data/external/dem/ 에 캐시(gitignore). 산출물은 커밋한다(ETOPO 자유 이용 · Copernicus 출처 표기).
ETOPO 15초 타일 이름은 **좌상단** 모서리(N60E000 = 북위 45~60 · 동경 0~15). Copernicus는 **좌하단**(N44_00_E012_00 = 북위 44~45 · 동경 12~13).
이름은 다운로드에만 쓰고 실제 범위는 GeoTIFF 태그(ModelTiepoint·ModelPixelScale)에서 읽는다.
"""
from __future__ import annotations
import argparse, json, math, re, sys, urllib.request, urllib.error
from pathlib import Path
import numpy as np
from PIL import Image
import tifffile

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'data' / 'external' / 'dem'
DS = ROOT / 'public' / 'datasets' / 'rome'
ETOPO = 'https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/15s/15s_surface_elev_gtif/ETOPO_2022_v1_15s_{lat}{lon}_surface.tif'
COP = 'https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_{lat}_00_{lon}_00_DEM/Copernicus_DSM_COG_10_{lat}_00_{lon}_00_DEM.tif'
ETOPO_CREDIT = 'ETOPO 2022 15 Arc-Second Global Relief Model (NOAA NCEI, DOI 10.25921/fd45-gt74)'
COP_CREDIT = 'Copernicus DEM GLO-30, produced using Copernicus WorldDEM-30 (c) DLR e.V. 2010-2014 and (c) Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA'


# ── 웹 메르카토르 ─────────────────────────────────────────────────────────────
def tile_bounds(z: int, x: int, y: int):
    """(w, s, e, n) 도 단위."""
    n = 2 ** z
    lat = lambda yy: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * yy / n))))
    return x / n * 360 - 180, lat(y + 1), (x + 1) / n * 360 - 180, lat(y)


def lonlat_to_tile(lon: float, lat: float, z: int):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
    return min(max(x, 0), n - 1), min(max(y, 0), n - 1)


def tile_pixel_lonlat(z: int, x: int, y: int, size: int = 256):
    """픽셀 **중심**의 경도(size,)·위도(size, 위→아래)."""
    n = 2 ** z
    p = (np.arange(size) + 0.5) / size
    lon = (x + p) / n * 360 - 180
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * (y + p) / n))))
    return lon, lat


# ── terrarium ─────────────────────────────────────────────────────────────────
def encode(h: np.ndarray, quant_m: float = 1.0, sea: bool = True) -> np.ndarray:
    """quant_m 미터 단위로 양자화하고(B 채널이 0으로 눌려 PNG가 3~4배 줄어든다) 바다는 0으로 편평하게(수심은 지형이 아니라 색이다, OVERHAUL §3.7).
    원 정밀도(1/256 m)로 구우면 z8 한 장이 128 kB, 대륙 4,780장이 600 MB였다. 2 m·바다 0 이면 28 kB."""
    h = np.floor(h.astype(np.float64) / quant_m) * quant_m
    if sea:
        h = np.maximum(h, 0.0)
    v = np.clip(h + 32768.0, 0, 65535.996)
    r = np.floor(v / 256)
    g = np.floor(v) - r * 256
    b = np.floor((v - np.floor(v)) * 256)
    return np.dstack([r, g, b]).astype(np.uint8)


def decode(rgb: np.ndarray) -> np.ndarray:
    a = rgb.astype(np.float64)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768


# ── 소스 격자 ─────────────────────────────────────────────────────────────────
class Grid:
    """north-up 위경도 정규 격자 GeoTIFF 한 장. 원점은 좌상단 모서리(PixelIsArea)."""
    def __init__(self, path: Path):
        with tifffile.TiffFile(path) as tf:
            page = tf.pages[0]
            tp = page.tags['ModelTiepointTag'].value
            sc = page.tags['ModelPixelScaleTag'].value
            self.arr = page.asarray().astype(np.float32)
            nd = page.tags.get('GDAL_NODATA')
            nodata = float(nd.value) if nd is not None else None
        self.sx, self.sy = float(sc[0]), float(sc[1])
        self.x0 = float(tp[3]) - float(tp[0]) * self.sx
        self.y0 = float(tp[4]) + float(tp[1]) * self.sy
        self.h, self.w = self.arr.shape
        if nodata is not None:
            self.arr[self.arr == nodata] = 0.0
        self.arr[~np.isfinite(self.arr)] = 0.0

    @property
    def bounds(self):
        return (self.x0, self.y0 - self.h * self.sy, self.x0 + self.w * self.sx, self.y0)

    def sample(self, lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
        """이중선형. lon (W,), lat (H,) → (H, W). 격자 밖은 가장자리 값."""
        fx = (lon - self.x0) / self.sx - 0.5
        fy = (self.y0 - lat) / self.sy - 0.5
        x0 = np.clip(np.floor(fx).astype(int), 0, self.w - 2)
        y0 = np.clip(np.floor(fy).astype(int), 0, self.h - 2)
        tx = np.clip(fx - x0, 0, 1)[None, :]
        ty = np.clip(fy - y0, 0, 1)[:, None]
        a = self.arr[np.ix_(y0, x0)]; b = self.arr[np.ix_(y0, x0 + 1)]
        c = self.arr[np.ix_(y0 + 1, x0)]; d = self.arr[np.ix_(y0 + 1, x0 + 1)]
        return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


class Mosaic:
    def __init__(self, grids: list[Grid]):
        self.grids = grids

    def sample(self, lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
        out = np.zeros((lat.size, lon.size), np.float32)
        for g in self.grids:
            w, s, e, n = g.bounds
            mx = (lon >= w) & (lon < e)
            my = (lat > s) & (lat <= n)
            if not (mx.any() and my.any()):
                continue
            v = g.sample(lon, lat)
            m = my[:, None] & mx[None, :]
            out[m] = v[m]
        return out


# ── 다운로드 ──────────────────────────────────────────────────────────────────
def fetch(url: str, dest: Path) -> bool:
    if dest.exists():
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix('.part')
    try:
        with urllib.request.urlopen(url, timeout=180) as r, open(tmp, 'wb') as f:
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
            print('없음(바다)', url.rsplit('/', 1)[-1])
            return False
        raise


def etopo_tiles(W, S, E, N) -> list[Path]:
    out = []
    for top in range(90, -90, -15):            # 타일 이름 = 좌상단 위도
        if top <= S or top - 15 >= N:
            continue
        for left in range(-180, 180, 15):
            if left >= E or left + 15 <= W:
                continue
            name = f"{'N' if top >= 0 else 'S'}{abs(top):02d}", f"{'E' if left >= 0 else 'W'}{abs(left):03d}"
            url = ETOPO.format(lat=name[0], lon=name[1])
            dest = CACHE / 'etopo' / url.rsplit('/', 1)[-1]
            if fetch(url, dest):
                out.append(dest)
    return out


def copernicus_tiles(W, S, E, N) -> list[Path]:
    out = []
    for lat in range(math.floor(S), math.ceil(N)):   # 타일 이름 = 좌하단
        for lon in range(math.floor(W), math.ceil(E)):
            name = f"{'N' if lat >= 0 else 'S'}{abs(lat):02d}", f"{'E' if lon >= 0 else 'W'}{abs(lon):03d}"
            url = COP.format(lat=name[0], lon=name[1])
            dest = CACHE / 'copernicus' / url.rsplit('/', 1)[-1]
            if fetch(url, dest):
                out.append(dest)
    return out


# ── 굽기 ──────────────────────────────────────────────────────────────────────
def bake(mosaic: Mosaic, bbox, zmin: int, zmax: int, outdir: Path, quant_m: float = 1.0) -> int:
    W, S, E, N = bbox
    n = 0
    for z in range(zmin, zmax + 1):
        x0, y0 = lonlat_to_tile(W, N, z)
        x1, y1 = lonlat_to_tile(E, S, z)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                lon, lat = tile_pixel_lonlat(z, x, y)
                png = outdir / str(z) / str(x) / f'{y}.png'
                png.parent.mkdir(parents=True, exist_ok=True)
                Image.fromarray(encode(mosaic.sample(lon, lat), quant_m), 'RGB').save(png, optimize=True)
                n += 1
        print(f'z{z} 끝, 누적 {n}장')
    return n


def bbox_from_extent():
    m = re.search(r'BBOX\s*=\s*\[([^\]]+)\]', (ROOT / 'scripts' / 'extent.ts').read_text())
    return [float(v) for v in m.group(1).split(',')]


def cmd_continental(maxzoom: int, quant_m: float = 2.0):
    bbox = bbox_from_extent()
    grids = [Grid(p) for p in etopo_tiles(*bbox)]
    if not grids:
        sys.exit('ETOPO 타일 0장')
    out = DS / 'terrain'
    n = bake(Mosaic(grids), bbox, 0, maxzoom, out, quant_m)   # 15초(약 460 m) 화소에 2 m 계단은 경사 0.25도, 음영에 안 보인다
    (out / 'meta.json').write_text(json.dumps({'encoding': 'terrarium', 'minzoom': 0, 'maxzoom': maxzoom, 'exaggeration': 1.4, 'quant_m': quant_m, 'sea': 0, 'credit': ETOPO_CREDIT}, ensure_ascii=False))
    print('대륙', n, '장 →', out)


def inset_spec(mid: str) -> dict:
    """미시지도(home ± span, dem 블록) 또는 data/insets.json 한 줄. 둘 다 같은 꼴로 돌려준다(OVERHAUL §3.6b ③)."""
    mm_path = ROOT / 'data' / 'micromaps' / f'{mid}.json'
    if mm_path.exists():
        mm = json.loads(mm_path.read_text())
        if not mm.get('dem'):
            sys.exit(f'{mid}: dem 블록이 없다')
        (lon, lat), span = mm['home']['at'], mm['home']['span']
        return {'bbox': [lon - span, lat - span, lon + span, lat + span], 'dir': mm['dem']['dir'], 'minzoom': mm['dem'].get('minzoom', 8), 'maxzoom': mm['dem'].get('maxzoom', 12)}
    for ins in json.loads((ROOT / 'data' / 'insets.json').read_text()):
        if ins['id'] == mid:
            (lon, lat), span = ins['at'], ins['span']
            return {'bbox': [lon - span, lat - span, lon + span, lat + span], 'dir': f'terrain-{mid}', 'minzoom': ins.get('minzoom', 8), 'maxzoom': ins.get('maxzoom', 12)}
    sys.exit(f'{mid}: 미시지도에도 insets.json에도 없다')


def all_inset_ids() -> list[str]:
    ids = [f.stem for f in sorted((ROOT / 'data' / 'micromaps').glob('*.json')) if f.name != 'index.json' and json.loads(f.read_text()).get('dem')]
    return ids + [ins['id'] for ins in json.loads((ROOT / 'data' / 'insets.json').read_text())]


def cmd_inset(mid: str, maxzoom: int):
    spec = inset_spec(mid)
    bbox = spec['bbox']
    grids = [Grid(p) for p in copernicus_tiles(*bbox)]
    if not grids:
        sys.exit('Copernicus 타일 0장')
    out = DS / spec['dir']
    zmax = min(maxzoom, spec['maxzoom'])
    n = bake(Mosaic(grids), bbox, spec['minzoom'], zmax, out, 1.0)   # 30 m 화소는 1 m 그대로
    (out / 'meta.json').write_text(json.dumps({'encoding': 'terrarium', 'minzoom': spec['minzoom'], 'maxzoom': zmax, 'quant_m': 1.0, 'sea': 0, 'credit': COP_CREDIT}, ensure_ascii=False))
    print('인셋', mid, n, '장 →', out)

def selftest():
    h = np.array([[-11000.0, 0.0], [8848.5, 1.25]])
    assert np.allclose(decode(encode(h, 1.0, sea=False)), np.floor(h), atol=1 / 256), 'terrarium 왕복'
    assert decode(encode(np.array([[-11000.0, 7.9]]), 2.0)).tolist() == [[0.0, 6.0]], '바다 0 · 2 m 양자화'
    w, s, e, n = tile_bounds(0, 0, 0)
    assert (round(w), round(e)) == (-180, 180) and abs(n - 85.0511) < 1e-3, 'z0 경계'
    assert lonlat_to_tile(0.0, 0.0, 1) == (1, 1), 'z1 원점 타일'
    assert lonlat_to_tile(12.36, 44.07, 8) == (136, 93), 'z8 루비콘 타일'
    g = Grid.__new__(Grid)
    g.arr = np.array([[0, 10], [20, 30]], np.float32)
    g.x0, g.y0, g.sx, g.sy, g.h, g.w = 0.0, 2.0, 1.0, 1.0, 2, 2
    v = g.sample(np.array([0.5, 1.5]), np.array([1.5, 0.5]))
    assert np.allclose(v, [[0, 10], [20, 30]]), f'픽셀 중심 표본 {v}'
    assert abs(float(g.sample(np.array([1.0]), np.array([1.0]))[0, 0]) - 15.0) < 1e-6, '이중선형 중앙'
    print('selftest ok')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', nargs='?', choices=['continental', 'inset'])
    ap.add_argument('id', nargs='?')
    ap.add_argument('--maxzoom', type=int)
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        selftest()
    elif a.cmd == 'continental':
        cmd_continental(a.maxzoom or 8)
    elif a.cmd == 'inset':
        if a.all:
            for mid in all_inset_ids():
                cmd_inset(mid, a.maxzoom or 12)
        else:
            cmd_inset(a.id, a.maxzoom or 12)
    else:
        ap.print_help()
