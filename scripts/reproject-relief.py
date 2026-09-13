#!/usr/bin/env python3
"""relief.jpg를 평사도법에서 웹 메르카토르로 다시 투영한다.

## 무슨 문제였나

River: **"색깔 영역 위치가 왜 이렇게 안 맞지?"**

색 영역이 틀린 게 아니었다. **지형 그림이 밀려 있었다.**

MapLibre의 `type: 'image'` 소스는 네 귀퉁이를 **메르카토르 평면**에 고정하고 그 안에
이미지를 선형으로 늘인다(`src/map/style.ts`의 `sources.relief`). 그런데 `relief.jpg`는
평사도법(plate carrée, 위도가 세로에 선형)이었다. 둘을 겹치면 위도가 어긋난다 —
bbox가 위도 20~60°일 때 **중위도에서 최대 3.2°, 약 350 km** 북쪽으로 밀린다.

벡터(영토 폴리곤·해안선·도시 점)는 전부 옳았다. 그래서 「영역이 지형과 안 맞는」 것으로 보였다.

## 어떻게 확인했나 (추측이 아니다)

산맥은 음영이 거칠고 바다는 평평하다. 같은 경위도를 두 가설로 픽셀에 옮겨 국소 표준편차를 쟀다.

    지점            평사도법   메르카토르
    알프스            34.0        2.1
    피레네            33.1        1.3
    아펜니노           23.0        1.8
    트로오도스          15.4        0.9
    아틀라스            8.0        1.3

산맥 다섯 곳 전부 평사도법 좌표에서만 거칠다. 흑해는 반대로 메르카토르 쪽이 거친데(14.5),
그건 지형이 북으로 밀려 그 자리에 **캅카스**가 와 있기 때문이라 같은 결론이다.

## 무엇을 하나

세로만 다시 샘플링한다. 경도는 두 투영에서 모두 선형이라 가로는 그대로다.
출력 행 y가 메르카토르에서 균등하도록, 그 y에 해당하는 위도를 구해 원본의 평사도법 행에서 읽는다.

**원본은 `relief.plate-carree.jpg`로 남긴다.** 두 번 돌려도 원본에서 다시 만들므로 안전하다.

    python3 scripts/reproject-relief.py            # 데이터셋 rome
    python3 scripts/reproject-relief.py --검증만    # 고치지 않고 진단만
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parent.parent


def merc_y(lat: float) -> float:
    return math.log(math.tan(math.radians(45 + lat / 2)))


def roughness(a: np.ndarray, bbox, lon: float, lat: float, mode: str, k: int = 9) -> float:
    """그 좌표 둘레의 밝기 표준편차. 산이면 크고 바다·평야면 0에 가깝다."""
    w, s, e, n = bbox
    H, W = a.shape
    x = int(round((lon - w) / (e - w) * W))
    if mode == "equi":
        y = int(round((n - lat) / (n - s) * H))
    else:
        ys, yn = merc_y(s), merc_y(n)
        y = int(round((yn - merc_y(lat)) / (yn - ys) * H))
    patch = a[max(0, y - k):y + k, max(0, x - k):x + k]
    return float(patch.std()) if patch.size else -1.0


# 산맥은 거칠고 바다는 평평하다 — 어느 투영이 맞는지 가르는 표본
PROBES = [("알프스", 10.0, 46.5, 1), ("피레네", 0.5, 42.6, 1), ("아펜니노", 13.5, 42.4, 1),
          ("트로오도스", 32.9, 34.9, 1), ("아틀라스", -5.0, 31.5, 1),
          ("지중해 심해", 17.0, 34.5, -1), ("이오니아해", 19.5, 37.0, -1)]


def diagnose(a: np.ndarray, bbox) -> tuple[float, float]:
    se = sm = 0.0
    for _, lon, lat, sign in PROBES:
        se += sign * roughness(a, bbox, lon, lat, "equi")
        sm += sign * roughness(a, bbox, lon, lat, "merc")
    return se, sm


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ds", default="rome")
    ap.add_argument("--검증만", action="store_true")
    args = ap.parse_args()

    base = REPO / "public/datasets" / args.ds
    manifest = json.loads((base / "manifest.json").read_text(encoding="utf8"))
    bbox = manifest.get("bbox")
    if not bbox:
        print(f"manifest에 bbox가 없다: {base/'manifest.json'}")
        return 2
    w, s, e, n = bbox

    cur = base / "rasters/relief.jpg"
    orig = base / "rasters/relief.plate-carree.jpg"
    if not cur.exists():
        print(f"relief.jpg가 없다: {cur}")
        return 2

    # 원본을 한 번만 떠 둔다. 이미 있으면 그게 진짜 원본이다(두 번 돌려도 안전).
    if not orig.exists():
        orig.write_bytes(cur.read_bytes())
        print(f"  원본 보존 → {orig.name}")

    src = Image.open(orig).convert("RGB")
    g = np.asarray(src.convert("L")).astype(float)
    se, sm = diagnose(g, bbox)
    print(f"  원본 진단 — 거칠기 점수: 평사도법 {se:.1f} · 메르카토르 {sm:.1f}")
    print(f"  → 원본은 {'평사도법' if se > sm else '메르카토르'}")
    if se <= sm:
        print("  이미 메르카토르다. 건드리지 않는다.")
        return 0

    off = max(abs(math.degrees(2 * math.atan(math.exp(
        merc_y(s) + (lat - s) / (n - s) * (merc_y(n) - merc_y(s)))) - math.pi / 2) - lat)
        for lat in np.linspace(s, n, 41))
    print(f"  고치지 않으면 최대 어긋남 {off:.2f}° ≈ {off*111:.0f} km")
    if args.검증만:
        return 0

    a = np.asarray(src)
    H, W = a.shape[:2]
    ys, yn = merc_y(s), merc_y(n)
    # 출력 행 → 메르카토르 y → 위도 → 원본(평사도법) 행. 가로는 그대로.
    my = yn + (np.arange(H) + 0.5) / H * (ys - yn)
    lat = np.degrees(2 * np.arctan(np.exp(my)) - math.pi / 2)
    srow = (n - lat) / (n - s) * H - 0.5
    lo = np.clip(np.floor(srow).astype(int), 0, H - 1)
    hi = np.clip(lo + 1, 0, H - 1)
    t = (srow - lo)[:, None, None]
    out = (a[lo].astype(np.float32) * (1 - t) + a[hi].astype(np.float32) * t)
    Image.fromarray(out.round().astype(np.uint8), "RGB").save(cur, quality=88, optimize=True)

    chk = np.asarray(Image.open(cur).convert("L")).astype(float)
    se2, sm2 = diagnose(chk, bbox)
    print(f"  다시 투영함 → 거칠기 점수: 평사도법 {se2:.1f} · 메르카토르 {sm2:.1f}")
    print(f"  → 이제 {'메르카토르 ✓' if sm2 > se2 else '⚠ 아직 평사도법으로 읽힌다'}")
    return 0 if sm2 > se2 else 1


if __name__ == "__main__":
    sys.exit(main())
