#!/usr/bin/env python3
"""bake-basemap.py: 미시지도 도판(옛 지도 스캔)을 통제점으로 지오레퍼런싱해 정북 이미지 소스 한 장으로 굽는다.

    python3 scripts/bake-basemap.py athens            # 수치만 찍는다(RMS·축·범위)
    python3 scripts/bake-basemap.py athens --write    # rasters/basemap-athens.jpg 저장 + data/micromaps/athens.json basemap 갱신

입력은 data/basemaps/<id>.json 한 장: 원본 파일(data/external/basemaps/, gitignore) · 통제점(도판 px ↔ 경위도, 출처) · 뺄 점 · 출력 해상도.
방법(docs/MICROMAP-BASEMAP.md §2, 로마·알렉산드리아 선례): 통제점으로 **완전 아핀**(도판 px → 웹 메르카토르 m)을 최소제곱으로 풀고,
정북 격자를 잡아 그 역변환으로 도판을 다시 샘플링한다(리샘플 1회). 회전·전단·비등방이 다 흡수되고, MapLibre `image` 소스는 정북 사각형만 받으므로
결과는 `corners`(w·e·n·s)로 그대로 실린다. 잔차는 지표 m(메르카토르 m ÷ 1/cos φ)로 찍는다. 도판이 안 덮는 곳이 안 생기게
출력 범위 기본값은 도판 사각형에 내접하는 정북 직사각형이다(bbox를 주면 그것을 쓴다).
지어내지 않는다: 통제점 좌표는 전부 출처가 있는 값이고, 픽셀은 도판에서 읽은 것이다. 잔차가 크면 그 점을 exclude에 적고 이유를 남긴다."""
from __future__ import annotations
import argparse, json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parent.parent
R = 6378137.0
merc = lambda lat: R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
inv_merc = lambda y: math.degrees(2 * math.atan(math.exp(y / R)) - math.pi / 2)
lon_m = lambda lon: math.radians(lon) * R


def fit(ctrl):
    """아핀 최소제곱. 반환 A(2×3): [X;Y] = A @ [1, px, py]."""
    P = np.array([[1, c['px'], c['py']] for c in ctrl], float)
    X = np.array([lon_m(c['lon']) for c in ctrl]); Y = np.array([merc(c['lat']) for c in ctrl])
    ax = np.linalg.lstsq(P, X, rcond=None)[0]; ay = np.linalg.lstsq(P, Y, rcond=None)[0]
    return np.vstack([ax, ay])


def main() -> int:
    ap = argparse.ArgumentParser(); ap.add_argument('id'); ap.add_argument('--write', action='store_true'); a = ap.parse_args()
    spec = json.loads((ROOT / 'data/basemaps' / f'{a.id}.json').read_text())
    src = ROOT / spec['source']
    if not src.exists(): print(f'원본이 없다: {src}\n  {spec["url"]}'); return 2
    ctrl = [c for c in spec['control'] if c['name'] not in set(spec.get('exclude', []))]
    A = fit(ctrl)
    lat0 = sum(c['lat'] for c in ctrl) / len(ctrl); k = 1 / math.cos(math.radians(lat0))
    res = []
    for c in ctrl:
        X, Y = A @ np.array([1, c['px'], c['py']]); res.append((c['name'], math.hypot(X - lon_m(c['lon']), Y - merc(c['lat'])) / k))
    rms = math.sqrt(sum(r * r for _, r in res) / len(res)); mx = max(r for _, r in res)
    xaxis = math.degrees(math.atan2(A[1, 1], A[0, 1])); up = math.degrees(math.atan2(-A[0, 2], -A[1, 2]))
    sx, sy = math.hypot(A[0, 1], A[1, 1]) / k, math.hypot(A[0, 2], A[1, 2]) / k
    print(f'통제점 {len(ctrl)} (뺀 것 {spec.get("exclude", [])}) · RMS {rms:.1f} m · 최대 {mx:.1f} m · x축 동에서 {xaxis:+.2f}° · 위쪽 북에서 {up:+.2f}° · 척도 {sx:.4f}/{sy:.4f} m/px')
    for n, r in sorted(res, key=lambda t: -t[1]): print(f'  {n:18s} {r:6.1f} m')
    im = Image.open(src); W, H = im.size
    corners = [A @ np.array([1, x, y]) for x, y in [(0, 0), (W, 0), (0, H), (W, H)]]
    if spec.get('bbox'):
        w, s, e, n = spec['bbox']
    else:  # 내접 정북 직사각형: 왼쪽 두 모서리의 큰 X, 오른쪽 둘의 작은 X, 위 둘의 작은 Y, 아래 둘의 큰 Y
        w = inv_x = max(corners[0][0], corners[2][0]) / (math.radians(1) * R); e = min(corners[1][0], corners[3][0]) / (math.radians(1) * R)
        n = inv_merc(min(corners[0][1], corners[1][1])); s = inv_merc(max(corners[2][1], corners[3][1]))
    print(f'범위 w {w:.5f} e {e:.5f} n {n:.5f} s {s:.5f}  ({(lon_m(e) - lon_m(w)) / k / 1000:.2f} × {(merc(n) - merc(s)) / k / 1000:.2f} km)')
    mpp = spec.get('m_per_px', 1.5) * k     # 메르카토르 m/px
    OW, OH = round((lon_m(e) - lon_m(w)) / mpp), round((merc(n) - merc(s)) / mpp)
    print(f'출력 {OW}×{OH} px @ {spec.get("m_per_px", 1.5)} m/px')
    if not a.write: return 0
    # 출력 (ox, oy) → 세계 (X, Y) → 도판 (px, py). PIL AFFINE은 출력→입력 계수 (a, b, c, d, e, f)를 받는다.
    M = A[:, 1:]; Minv = np.linalg.inv(M); t = A[:, 0]
    # X = X0 + ox·mpp, Y = Ytop − oy·mpp;  [px,py] = Minv @ ([X,Y] − t)
    X0, Ytop = lon_m(w), merc(n)
    base = Minv @ (np.array([X0, Ytop]) - t)
    dx = Minv @ np.array([mpp, 0]); dy = Minv @ np.array([0, -mpp])
    # 리샘플 전에 원본을 목표 해상도의 두 배쯤으로 줄인다(17778px RGB 760 MB를 그대로 변환하지 않게)
    shrink = max(1, int(min(abs(dx[0]), abs(dy[1])) / 2)) if min(abs(dx[0]), abs(dy[1])) > 2 else 1
    if shrink > 1:
        im = im.reduce(shrink); base /= shrink; dx /= shrink; dy /= shrink
    coeffs = (dx[0], dy[0], base[0], dx[1], dy[1], base[1])
    out = im.convert('RGB').transform((OW, OH), Image.AFFINE, coeffs, resample=Image.BICUBIC)
    dst = ROOT / 'public/datasets/rome/rasters' / f'basemap-{a.id}.jpg'
    out.save(dst, quality=spec.get('quality', 82), optimize=True, progressive=True)
    bm = { 'id': a.id, 'file': dst.name, 'size': [OW, OH], 'corners': { 'w': round(w, 5), 'e': round(e, 5), 'n': round(n, 5), 's': round(s, 5) },
           'opacity': spec.get('opacity', 0.6), 'min_zoom': spec.get('min_zoom', 12), 'rotation_deg': 0, 'title': spec['title'], 'source': spec['url'],
           'rms_m': round(rms, 1), 'caveat': spec.get('note', ''), 'short_caveat': f'통제점 {len(ctrl)} RMS {rms:.0f} m' }
    mm = ROOT / 'data/micromaps' / f'{a.id}.json'
    if mm.exists():
        d = json.loads(mm.read_text()); d['basemap'] = bm; mm.write_text(json.dumps(d, ensure_ascii=False, indent=1) + '\n')
        print(f'{dst.name} {dst.stat().st_size // 1024} KB · {mm.name} basemap 갱신')
    else:
        print(json.dumps(bm, ensure_ascii=False, indent=1))
    return 0


if __name__ == '__main__':
    sys.exit(main())
