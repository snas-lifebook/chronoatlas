#!/usr/bin/env python3
"""finish-territory.py: 영역 폴리곤 마감. OVERHAUL §3.6c (R57, R33 흡수).

  python3 scripts/finish-territory.py --selftest
  python3 scripts/finish-territory.py            # layers/territory/*.geojson 을 제자리에서 다시 쓴다 (재현 가능)
  python3 scripts/finish-territory.py --dry-run  # 수치만 찍는다
  python3 scripts/finish-territory.py --only -100

순서: 부드럽게(상한 있는 Chaikin 2회 + simplify 100 m) → 2 km 넉넉하게(곶·반도, R33) → 섬 귀속(어느 정치체도 안 덮은
작은 섬을 시간이 겹치는 정치체 중 40 km 이내 최근접에 붙인다) → 겹침 정리(면적 큰 쪽이 양보) → simplify 300 m.

**해안선 자르기는 데이터에서 하지 않는다.** 폴리곤마다 해안선을 복사하면 정점이 6배로 뛴다(실측: -100 버킷 35,778 → 207,713).
대신 `layers/ocean.geojson`(bbox − 육지)을 굽고 엔진이 그것을 영역 위에 바다색으로 덮는다(렌더 마스크). 어느 줌에서도 해안에 딱 맞는다.
작은 섬(NE minor_islands)은 `layers/land.geojson`에 덧붙여 육지로 그려지게 한다(마스크에 구멍이 생긴다).

사실 주장이 아니라 렌더 규칙이다. 속성 finish·islands·island_rule 로 드러낸다. 정본 JSONL과 Cliopatria 원본은 안 건드린다.
"""
from __future__ import annotations
import csv, json, math, re, sys, time, urllib.request
from pathlib import Path
import numpy as np
from shapely.geometry import shape, mapping, Polygon, MultiPolygon, box
from shapely.ops import unary_union
from shapely import set_precision, STRtree

ROOT = Path(__file__).resolve().parent.parent
LAYERS = ROOT / 'public/datasets/rome/layers'
TDIR = LAYERS / 'territory'
EXT = ROOT / 'data/external'
ISLANDS_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_minor_islands.geojson'
DEG_M = 111320.0                      # 위도 1도 ≈ 111.32 km. 경도는 cos(lat)로 보정
SMOOTH_M, GROW_M, ISLAND_KM, FINAL_M = 100.0, 2000.0, 40.0, 600.0
SMALL_ISLAND_KM2 = 2000.0             # 육지 파일의 이 면적 이하 조각도 「섬」 후보다(키클라데스 등)
FINISH_TAG = 'chaikin1cap4km+grow2km+islands+s600m'
CHAIKIN_CAP_M = (4000.0,)             # 1회, 상한 4 km. 2회·5 km는 정점이 3.8배로 뛰었다(실측). 톱니는 1회로도 사라진다


def bbox_from_extent():
    m = re.search(r'BBOX\s*=\s*\[([^\]]+)\]', (ROOT / 'scripts/extent.ts').read_text())
    return [float(v) for v in m.group(1).split(',')]


# ── 기하 ──────────────────────────────────────────────────────────────────────
def chaikin(ring: np.ndarray, passes: int = 1) -> np.ndarray:
    """닫힌 고리(첫 점 = 끝 점)를 **상한 있는** Chaikin 모서리 자르기로 부드럽게.

    보통 Chaikin은 변의 25%씩 잘라 긴 변(사막 국경 100 km)도 25 km씩 깎아 버린다. 여기서는 자르는 길이를
    변의 25%와 상한(5 km, 2.5 km) 중 작은 쪽으로 잡아 긴 변은 살리고 10 km 안팎 톱니만 둥글린다."""
    pts = ring[:-1]
    lat = float(np.mean(pts[:, 1])) if len(pts) else 0.0
    for k in range(passes):
        nxt = np.roll(pts, -1, axis=0)
        d = nxt - pts
        length_m = np.hypot(d[:, 0] * DEG_M * math.cos(math.radians(lat)), d[:, 1] * DEG_M)
        t = np.minimum(0.25, CHAIKIN_CAP_M[min(k, len(CHAIKIN_CAP_M) - 1)] / np.maximum(length_m, 1e-9))[:, None]
        q = pts + t * d
        r = nxt - t * d
        pts = np.empty((len(pts) * 2, 2))
        pts[0::2] = q
        pts[1::2] = r
    return np.vstack([pts, pts[:1]])


def polys_of(g):
    if isinstance(g, MultiPolygon):
        return list(g.geoms)
    if isinstance(g, Polygon):
        return [g]
    return [x for x in getattr(g, 'geoms', []) if isinstance(x, Polygon)]


def smooth_polygon(p: Polygon, tol_deg: float) -> Polygon:
    ext = chaikin(np.asarray(p.exterior.coords)[:, :2])
    ints = [chaikin(np.asarray(i.coords)[:, :2]) for i in p.interiors if len(i.coords) > 4]
    return Polygon(ext, ints).simplify(tol_deg, preserve_topology=True).buffer(0)


def smooth(g):
    parts = [smooth_polygon(p, SMOOTH_M / DEG_M) for p in polys_of(g) if p.area > 0]
    return unary_union(parts) if parts else g


def acute_ratio(g) -> float:
    """정점 내각 45° 미만 비율. 「삐죽삐죽」의 척도."""
    n = a = 0
    for p in polys_of(g):
        c = np.asarray(p.exterior.coords)[:-1, :2]
        if len(c) < 3:
            continue
        v1 = np.roll(c, 1, axis=0) - c
        v2 = np.roll(c, -1, axis=0) - c
        cosang = (v1 * v2).sum(1) / (np.linalg.norm(v1, axis=1) * np.linalg.norm(v2, axis=1) + 1e-12)
        ang = np.degrees(np.arccos(np.clip(cosang, -1, 1)))
        n += len(ang)
        a += int((ang < 45).sum())
    return a / n if n else 0.0


def nverts(g) -> int:
    return sum(len(p.exterior.coords) + sum(len(i.coords) for i in p.interiors) for p in polys_of(g))


def km2(g) -> float:
    lat = g.centroid.y if not g.is_empty else 0.0
    return g.area * (DEG_M / 1000) ** 2 * math.cos(math.radians(lat))


# ── 육지·섬·바다 ─────────────────────────────────────────────────────────────
def load_fc(path: Path):
    return json.loads(path.read_text())


def prepare_land(bbox):
    """렌더용 land.geojson에 작은 섬을 덧붙이고(멱등), 섬 후보와 바다 마스크를 만든다."""
    isl_path = EXT / 'ne_10m_minor_islands.geojson'
    if not isl_path.exists():
        print('minor_islands 받는 중 …')
        urllib.request.urlretrieve(ISLANDS_URL, isl_path)
    clip = box(*bbox)
    land_fc = load_fc(LAYERS / 'land.geojson')
    already = any(f.get('properties', {}).get('minor') for f in land_fc['features'])
    minor = [shape(f['geometry']) for f in load_fc(isl_path)['features']]
    minor = [g for g in minor if g.intersects(clip)]
    if not already:
        for g in minor:
            land_fc['features'].append({'type': 'Feature', 'properties': {'minor': True}, 'geometry': mapping(set_precision(g, 0.0001))})
    land_geoms = [shape(f['geometry']) for f in land_fc['features']]
    land_union = unary_union([g for g in land_geoms if not g.is_empty])
    ocean = clip.difference(land_union)
    # 섬 후보: minor_islands 전부 + 육지 파일의 작은 조각(키클라데스·달마티아 제도처럼 정본 폴리곤이 빼먹는 것)
    small_land = [p for p in polys_of(land_union) if km2(p) <= SMALL_ISLAND_KM2]
    islands = minor + small_land
    return land_fc, already, ocean, islands


# ── 버킷 처리 ─────────────────────────────────────────────────────────────────
def overlap(a, b) -> bool:
    af, at = a.get('valid_from', -1e9), a.get('valid_to', 1e9)
    bf, bt = b.get('valid_from', -1e9), b.get('valid_to', 1e9)
    return not (at <= bf or bt <= af)


def process_bucket(path: Path, islands, island_tree, dry: bool, rows: list):
    t0 = time.time()
    fc = load_fc(path)
    polys = [f for f in fc['features'] if f['geometry']['type'] in ('Polygon', 'MultiPolygon')]
    if not polys:
        print(f'{path.name}: 폴리곤 0')
        return
    before_v = sum(nverts(shape(f['geometry'])) for f in polys)
    before_a = float(np.mean([acute_ratio(shape(f['geometry'])) for f in polys]))
    ids = [f['properties']['id'] for f in polys]
    geoms = {}
    for f in polys:
        g = shape(f['geometry']).buffer(0)
        g = smooth(g).buffer(GROW_M / DEG_M, quad_segs=2)     # 넉넉하게: 곶·반도가 바다 마스크 밑까지 채워진다
        geoms[f['properties']['id']] = g
    # 섬 귀속
    counts = {k: 0 for k in geoms}
    poly_tree = STRtree([geoms[i] for i in ids])
    reach = ISLAND_KM * 1000 / DEG_M
    for isl in islands:
        c = isl.representative_point()
        near = [int(i) for i in poly_tree.query(c.buffer(reach))]
        if not near:
            continue
        if any(geoms[ids[i]].contains(c) for i in near):
            continue
        best = None
        for i in near:
            g = geoms[ids[i]]
            d_km = g.distance(c) * DEG_M / 1000 * math.cos(math.radians(c.y))
            if d_km <= ISLAND_KM and (best is None or d_km < best[0]):
                best = (d_km, ids[i])
        if best is None:
            continue
        d_km, pid = best
        geoms[pid] = unary_union([geoms[pid], isl])
        counts[pid] += 1
        name = next(f['properties'].get('name', '') for f in polys if f['properties']['id'] == pid)
        rows.append([path.stem, pid, name, round(d_km, 1), round(c.x, 4), round(c.y, 4)])
    # 겹침 정리: 시간이 겹치고 기하가 겹치면 면적 큰 쪽이 양보
    order = sorted(polys, key=lambda f: -geoms[f['properties']['id']].area)
    for i, big in enumerate(order):
        gb_id = big['properties']['id']
        for small in order[i + 1:]:
            if not overlap(big['properties'], small['properties']):
                continue
            gs = geoms[small['properties']['id']]
            if gs.is_empty or not geoms[gb_id].intersects(gs):
                continue
            geoms[gb_id] = geoms[gb_id].difference(gs)
    for f in polys:
        g = set_precision(geoms[f['properties']['id']].simplify(FINAL_M / DEG_M, preserve_topology=True), 0.0001).buffer(0)
        keep = [p for p in polys_of(g) if p.area > 0]
        if not keep:
            continue
        f['geometry'] = mapping(keep[0] if len(keep) == 1 else MultiPolygon(keep))
        f['properties']['finish'] = FINISH_TAG
        f['properties']['islands'] = counts[f['properties']['id']]
        if counts[f['properties']['id']]:
            f['properties']['island_rule'] = f'nearest<={int(ISLAND_KM)}km'
    after_v = sum(nverts(shape(f['geometry'])) for f in polys)
    after_a = float(np.mean([acute_ratio(shape(f['geometry'])) for f in polys]))
    out = json.dumps(fc, ensure_ascii=False, separators=(',', ':'))
    print(f'{path.name}: 정점 {before_v}→{after_v} · 예각 {before_a:.3f}→{after_a:.3f} · 섬 {sum(counts.values())} · {len(out)/1e6:.2f}MB · {time.time() - t0:.0f}s')
    if not dry:
        path.write_text(out)


def main(dry: bool, only: str | None):
    bbox = bbox_from_extent()
    t0 = time.time()
    land_fc, already, ocean, islands = prepare_land(bbox)
    island_tree = STRtree(islands)
    print(f'육지·섬·바다 준비 {time.time() - t0:.0f}s · 섬 후보 {len(islands)} · 바다 다각형 정점 {nverts(ocean)}')
    if not dry:
        if not already:
            (LAYERS / 'land.geojson').write_text(json.dumps(land_fc, ensure_ascii=False, separators=(',', ':')))
        (LAYERS / 'ocean.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': [
            {'type': 'Feature', 'properties': {'source': 'bbox minus land.geojson (NE 10m, PD)', 'finish': FINISH_TAG}, 'geometry': mapping(set_precision(ocean, 0.0001))}]},
            ensure_ascii=False, separators=(',', ':')))
    rows = []
    for path in sorted(TDIR.glob('*.geojson'), key=lambda p: int(p.stem)):
        if only is not None and path.stem != only:
            continue
        process_bucket(path, islands, island_tree, dry, rows)
    if only is None or not dry:
        out = ROOT / 'docs/verify/overhaul/islands.csv'
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, 'w', newline='') as f:
            w = csv.writer(f)
            w.writerow(['bucket', 'polity_id', 'name', 'km', 'lon', 'lat'])
            w.writerows(rows)
        print('islands.csv', len(rows), '행')


def selftest():
    jag = Polygon([(0, 0), (1, 0), (1, 0.1), (1.05, 0.05), (1, 0.2), (1, 1), (0, 1)])       # 오른쪽 변에 가시 하나
    sm = smooth(jag)
    assert acute_ratio(sm) < acute_ratio(jag), '예각이 줄어야 한다'
    assert abs(sm.area - jag.area) / jag.area < 0.05, '면적이 5% 넘게 바뀌면 안 된다'
    grown = sm.buffer(GROW_M / DEG_M, quad_segs=2)
    assert grown.contains(sm) and grown.area > sm.area, '넉넉하게'
    land = box(0, 0, 1, 1)
    near = box(1.05, 0.5, 1.06, 0.51)
    far = box(1.6, 0.5, 1.61, 0.51)
    d_near = land.distance(near.representative_point()) * DEG_M / 1000
    d_far = land.distance(far.representative_point()) * DEG_M / 1000
    assert d_near <= ISLAND_KM < d_far, f'섬 거리 판정 {d_near:.1f} {d_far:.1f}'
    ocean = box(-1, -1, 2, 2).difference(land)
    assert ocean.contains(near.representative_point()) and not ocean.contains(box(0.4, 0.4, 0.6, 0.6).representative_point()), '바다 마스크'
    print('selftest ok')


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        selftest()
    else:
        only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
        main('--dry-run' in sys.argv, only)
