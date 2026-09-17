# 전면 개선 슬라이스 I · 계획 5/5: 영역 마감 (P-B, R57 · R33 흡수)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 영역 폴리곤의 톱니를 없애고, 해안선에 맞추고, 작은 섬을 가까운 정치체에 붙이고, 겹침을 정리한 뒤, 렌더에 안쪽 후광과 해안선 잉크를 얹어 「디자이너가 마감한」 영역으로 만든다.

**Architecture:** 빌드타임 파이프라인 `scripts/finish-territory.py`(shapely)가 `public/datasets/rome/layers/territory/<버킷>.geojson`을 제자리에서 다시 쓴다(정본 JSONL과 Cliopatria 원본은 안 건드린다. 재현 가능). 렌더 마감은 `src/map/engine.ts`의 territory 층 셋과 해안 잉크 층 하나.

> **2026-09-17 실행 기록(이 계획은 실행됐다, 스펙 §3.6c 갱신판이 정본).** Task B1의 「해안 스냅(교집합)」은 정점이 6배로 뛰어 버렸다. 대신 `layers/ocean.geojson` 바다 마스크를 영역 위에 덮는 방식으로 바꿨고, 상수는 Chaikin 1회·상한 4 km, 버퍼 2 km, 최종 simplify 600 m, 섬 후보 4,000 km² 이하다. 아래 코드 블록은 최초안이며 실제 파일이 이긴다.

**Tech Stack:** Python 3.13 · shapely 2 · numpy · MapLibre GL 6.3 · vitest

**Spec:** `docs/OVERHAUL.md` §3.6c. 요구 원장 R57(R33). 선행: 계획 1/4 Task A2(범위 재베이크. 버킷 파일이 새 범위로 구워진 뒤에 돈다).

## Global Constraints

- 정본 JSONL·Cliopatria 원본을 고치지 않는다. 파이프라인 출력은 `layers/territory/*.geojson`뿐이고 언제든 `npm run fetch-external && npm run finish`로 재현된다.
- 섬 귀속은 **렌더 규칙**이지 사실 주장이 아니다. 피처 속성 `island_rule`과 `docs/verify/overhaul/islands.csv`로 드러낸다. 거리 상한 40 km, 규칙을 바꾸면 스펙 §3.6c와 여기를 같이 고친다.
- 좌표 정밀도는 지금 산출물과 같다(소수 4자리, precision 0.0005 근처). 정점 수가 두 배를 넘으면 안 된다(테스트).
- 작대기·이모지 금지. `git add` 경로 명시. push는 River가 말할 때만.

---

## 모델링 (이 계획이 정하는 모델)

| 모델 | 정의 | 요지 |
|---|---|---|
| 마감 파이프라인 | `scripts/finish-territory.py` | 폴리곤 → 부드럽게(Chaikin 2회 + simplify 50 m) → 300 m 버퍼 → 육지 마스크 교집합 → 섬 귀속(≤ 40 km, 시간 겹치는 정치체 중 최근접) → 겹침 정리(면적 큰 쪽 양보) |
| 육지 마스크 | NE 10m `land` + `minor_islands` (PD) | `data/external/`의 원본(단순화 전). BBOX로 자른 `unary_union`, `prep()`로 빠르게 |
| 피처 속성 추가 | `finish: "chaikin2+s50m+buf300m+clip"` · `islands: n` · `island_rule: "nearest<=40km"` | 파이프라인이 돌았다는 증거. 테스트가 본다 |
| 렌더 마감 | `territory-fill`(0.55) · `territory-glow`(신설, 안쪽 후광) · `territory-outline`(1 px) · `coast-ink`(신설, 맨 위 1 px) | 색이 바다로 새 보이지 않는다 |

---

### Task B1: `scripts/finish-territory.py` 와 자체 검사

**Files:**
- Create: `scripts/finish-territory.py`
- Modify: `package.json` (`"finish": "python3 scripts/finish-territory.py"`, `fetch-external` 뒤에 사람이 돌린다. RUNBOOK에 적는다)
- Modify: `docs/RUNBOOK-extent.md` §2 (재베이크 뒤 `npm run finish` 한 줄)
- Test: 스크립트 `--selftest` + `test/territory-finish.test.ts`

**Interfaces:**
- Produces: 버킷 파일 재작성 + `docs/verify/overhaul/islands.csv` + 표준출력에 버킷별 「정점 수 전/후 · 예각 비율 전/후 · 섬 귀속 수」.
- Consumes: `public/datasets/rome/layers/territory/*.geojson` · `data/external/ne_10m_land.geojson` · `data/external/ne_10m_minor_islands.geojson`(없으면 받는다. `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_minor_islands.geojson`, PD) · `scripts/extent.ts`의 BBOX.

- [ ] **Step 1: 스크립트**

```python
#!/usr/bin/env python3
"""finish-territory.py: 영역 폴리곤 마감. OVERHAUL §3.6c.

  python3 scripts/finish-territory.py --selftest
  python3 scripts/finish-territory.py            # layers/territory/*.geojson 을 제자리에서 다시 쓴다 (재현 가능)
  python3 scripts/finish-territory.py --dry-run  # 수치만 찍는다

순서: 부드럽게(Chaikin 2회 + simplify 50 m) → 300 m 버퍼 → 육지 마스크(NE 10m land + minor_islands) 교집합
      → 섬 귀속(어느 정치체도 안 덮은 섬을 시간이 겹치는 정치체 중 40 km 이내 최근접에 붙인다) → 겹침 정리(면적 큰 쪽이 양보).
사실 주장이 아니라 렌더 규칙이다. 속성 finish·islands·island_rule 로 드러낸다.
"""
from __future__ import annotations
import csv, json, math, re, sys, urllib.request
from pathlib import Path
import numpy as np
from shapely.geometry import shape, mapping, Polygon, MultiPolygon, box
from shapely.ops import unary_union
from shapely.prepared import prep
from shapely import set_precision

ROOT = Path(__file__).resolve().parent.parent
TDIR = ROOT / 'public/datasets/rome/layers/territory'
EXT = ROOT / 'data/external'
ISLANDS_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_minor_islands.geojson'
DEG_M = 111320.0                      # 위도 1도 ≈ 111.32 km. 경도는 cos(lat)로 보정
SMOOTH_M, BUF_M, ISLAND_KM = 50.0, 300.0, 40.0
FINISH_TAG = 'chaikin2+s50m+buf300m+clip'

def bbox_from_extent():
    m = re.search(r'BBOX\s*=\s*\[([^\]]+)\]', (ROOT / 'scripts/extent.ts').read_text())
    return [float(v) for v in m.group(1).split(',')]

# ── 기하 ──────────────────────────────────────────────────────────────────────
def chaikin(ring: np.ndarray, passes: int = 2) -> np.ndarray:
    """닫힌 고리(첫 점 = 끝 점)를 Chaikin 모서리 자르기로 부드럽게. 정점 수는 회당 2배가 되므로 뒤에 simplify로 되돌린다."""
    pts = ring[:-1]
    for _ in range(passes):
        nxt = np.roll(pts, -1, axis=0)
        q = 0.75 * pts + 0.25 * nxt; r = 0.25 * pts + 0.75 * nxt
        pts = np.empty((len(pts) * 2, 2)); pts[0::2] = q; pts[1::2] = r
    return np.vstack([pts, pts[:1]])

def smooth_polygon(p: Polygon, tol_deg: float) -> Polygon:
    ext = chaikin(np.asarray(p.exterior.coords))
    ints = [chaikin(np.asarray(i.coords)) for i in p.interiors if len(i.coords) > 4]
    out = Polygon(ext, ints)
    return out.simplify(tol_deg, preserve_topology=True).buffer(0)

def smooth(g, lat: float):
    tol = SMOOTH_M / DEG_M
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    return unary_union([smooth_polygon(p, tol) for p in polys if p.area > 0])

def acute_ratio(g) -> float:
    """정점 내각 45° 미만 비율. 「삐죽삐죽」의 척도."""
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    n = a = 0
    for p in polys:
        c = np.asarray(p.exterior.coords)[:-1]
        if len(c) < 3: continue
        v1 = np.roll(c, 1, axis=0) - c; v2 = np.roll(c, -1, axis=0) - c
        cosang = (v1 * v2).sum(1) / (np.linalg.norm(v1, axis=1) * np.linalg.norm(v2, axis=1) + 1e-12)
        ang = np.degrees(np.arccos(np.clip(cosang, -1, 1)))
        n += len(ang); a += int((ang < 45).sum())
    return a / n if n else 0.0

def nverts(g) -> int:
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    return sum(len(p.exterior.coords) + sum(len(i.coords) for i in p.interiors) for p in polys)

# ── 마스크 ────────────────────────────────────────────────────────────────────
def load_fc(path: Path):
    return json.loads(path.read_text())['features']

def land_mask(bbox):
    if not (EXT / 'ne_10m_minor_islands.geojson').exists():
        urllib.request.urlretrieve(ISLANDS_URL, EXT / 'ne_10m_minor_islands.geojson')
    clip = box(*bbox)
    land = [shape(f['geometry']).intersection(clip) for f in load_fc(EXT / 'ne_10m_land.geojson')]
    islands = [shape(f['geometry']) for f in load_fc(EXT / 'ne_10m_minor_islands.geojson') if shape(f['geometry']).intersects(clip)]
    mask = unary_union([g for g in land + islands if not g.is_empty])
    return mask, islands

# ── 버킷 처리 ─────────────────────────────────────────────────────────────────
def overlap(a, b) -> bool:
    return not (a['valid_to'] <= b['valid_from'] or b['valid_to'] <= a['valid_from'])

def process_bucket(path: Path, mask, mask_p, islands, dry: bool, rows: list):
    fc = json.loads(path.read_text()); feats = fc['features']
    polys = [f for f in feats if f['geometry']['type'] in ('Polygon', 'MultiPolygon')]
    before_v = sum(nverts(shape(f['geometry'])) for f in polys); before_a = np.mean([acute_ratio(shape(f['geometry'])) for f in polys]) if polys else 0
    geoms = {}
    for f in polys:
        g = shape(f['geometry']).buffer(0)
        lat = g.centroid.y
        g = smooth(g, lat)
        g = g.buffer(BUF_M / DEG_M).intersection(mask)                 # 곶·반도를 300 m까지 채운 뒤 육지로 자른다
        geoms[f['properties']['id']] = g
    # 섬 귀속: 어느 폴리곤도 안 덮은 섬 → 시간 겹치는 정치체 중 40 km 이내 최근접
    counts = {k: 0 for k in geoms}
    for isl in islands:
        c = isl.representative_point()
        for f in polys:
            pid = f['properties']['id']; g = geoms[pid]
            if g.is_empty or g.contains(c): continue
            d_km = g.distance(c) * DEG_M / 1000 * math.cos(math.radians(c.y))
            if d_km > ISLAND_KM: continue
            closer = [h for h in polys if h['properties']['id'] != pid and overlap(h['properties'], f['properties'])
                      and not geoms[h['properties']['id']].is_empty and geoms[h['properties']['id']].distance(c) < g.distance(c)]
            if closer: continue
            geoms[pid] = unary_union([g, isl]); counts[pid] += 1
            rows.append([path.stem, pid, f['properties'].get('name', ''), round(d_km, 1), round(c.x, 4), round(c.y, 4)])
    # 겹침 정리: 시간이 겹치고 기하가 겹치면 면적 큰 쪽이 양보
    order = sorted(polys, key=lambda f: -geoms[f['properties']['id']].area)
    for i, big in enumerate(order):
        for small in order[i + 1:]:
            if not overlap(big['properties'], small['properties']): continue
            gb, gs = geoms[big['properties']['id']], geoms[small['properties']['id']]
            if gb.intersects(gs): geoms[big['properties']['id']] = gb.difference(gs)
    for f in polys:
        g = set_precision(geoms[f['properties']['id']], 0.0001)
        if g.is_empty: continue
        f['geometry'] = mapping(g)
        f['properties']['finish'] = FINISH_TAG; f['properties']['islands'] = counts[f['properties']['id']]
        if counts[f['properties']['id']]: f['properties']['island_rule'] = f'nearest<={int(ISLAND_KM)}km'
    after_v = sum(nverts(shape(f['geometry'])) for f in polys); after_a = np.mean([acute_ratio(shape(f['geometry'])) for f in polys]) if polys else 0
    print(f'{path.name}: 정점 {before_v}→{after_v} · 예각 {before_a:.3f}→{after_a:.3f} · 섬 {sum(counts.values())}')
    if not dry: path.write_text(json.dumps(fc, ensure_ascii=False, separators=(',', ':')))

def main(dry: bool):
    bbox = bbox_from_extent(); mask, islands = land_mask(bbox); mask_p = prep(mask)
    rows = []
    for path in sorted(TDIR.glob('*.geojson')):
        process_bucket(path, mask, mask_p, islands, dry, rows)
    out = ROOT / 'docs/verify/overhaul/islands.csv'; out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['bucket', 'polity_id', 'name', 'km', 'lon', 'lat']); w.writerows(rows)
    print('islands.csv', len(rows), '행')

def selftest():
    jag = Polygon([(0, 0), (1, 0), (1, 0.1), (1.05, 0.05), (1, 0.2), (1, 1), (0, 1)])       # 오른쪽 변에 가시 하나
    sm = smooth(jag, 0)
    assert acute_ratio(sm) < acute_ratio(jag), '예각이 줄어야 한다'
    assert abs(sm.area - jag.area) / jag.area < 0.05, '면적이 5% 넘게 바뀌면 안 된다'
    land = box(0, 0, 1, 1); sea_poly = box(0.5, 0.5, 1.5, 1.5)
    clipped = sea_poly.buffer(BUF_M / DEG_M).intersection(land)
    assert clipped.bounds[2] <= 1.0 + 1e-9, '육지 밖으로 나가면 안 된다'
    near = box(1.05, 0.5, 1.06, 0.51); far = box(1.6, 0.5, 1.61, 0.51)
    d_near = land.distance(near.representative_point()) * DEG_M / 1000; d_far = land.distance(far.representative_point()) * DEG_M / 1000
    assert d_near <= ISLAND_KM < d_far, f'섬 거리 판정 {d_near:.1f} {d_far:.1f}'
    print('selftest ok')

if __name__ == '__main__':
    if '--selftest' in sys.argv: selftest()
    else: main('--dry-run' in sys.argv)
```

- [ ] **Step 2: 자체 검사와 dry-run**

```bash
python3 scripts/finish-territory.py --selftest
python3 scripts/finish-territory.py --dry-run | tail -25
```
Expected: `selftest ok`. dry-run에서 버킷마다 예각 비율이 **절반 이하**로 떨어지고 정점 수가 2배를 넘지 않는다. 섬 귀속 수가 0이면 `minor_islands`를 못 받은 것이다.

- [ ] **Step 3: 테스트**

```ts
// test/territory-finish.test.ts
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'public/datasets/rome/layers/territory');
describe('영역 마감 (OVERHAUL §3.6c)', () => {
  it('모든 버킷의 폴리곤에 finish 표가 있다 (파이프라인이 돌았다)', () => {
    for (const f of readdirSync(DIR).filter(x => x.endsWith('.geojson'))) {
      const fc = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
      const polys = fc.features.filter((x: any) => /Polygon/.test(x.geometry.type));
      expect(polys.length, f).toBeGreaterThan(0);
      for (const p of polys) expect(p.properties.finish, `${f} ${p.properties.id}`).toBe('chaikin2+s50m+buf300m+clip');
    }
  });
  it('섬 귀속 표가 있고 거리 상한을 지킨다', () => {
    const csv = join(ROOT, 'docs/verify/overhaul/islands.csv');
    expect(existsSync(csv)).toBe(true);
    const rows = readFileSync(csv, 'utf8').trim().split('\n').slice(1).map(l => l.split(','));
    for (const r of rows) expect(Number(r[3])).toBeLessThanOrEqual(40);
  });
});
```

- [ ] **Step 4: 실행·검증·커밋**

```bash
python3 scripts/finish-territory.py | tee /tmp/finish.log && npm run validate
```
`package.json` scripts에 `"finish": "python3 scripts/finish-territory.py"`. `docs/RUNBOOK-extent.md` §2 끝에 「재베이크 뒤 `npm run finish`(영역 마감, OVERHAUL §3.6c). 안 돌리면 `test/territory-finish.test.ts`가 빨개진다」.
```bash
git add scripts/finish-territory.py package.json docs/RUNBOOK-extent.md test/territory-finish.test.ts public/datasets/rome/layers/territory docs/verify/overhaul/islands.csv
git commit -m "feat(영역): 마감 파이프라인 (부드럽게·해안 스냅·섬 귀속·겹침 정리) (R57)"
```
커밋 메시지 본문에 `/tmp/finish.log`의 버킷별 수치(정점·예각·섬)를 붙인다.

---

### Task B2: 렌더 마감

**Files:**
- Modify: `src/map/engine.ts` (`territory-fill` 불투명도 · `territory-glow` 신설 · `coast-ink` 신설 · `LAYER_GROUPS.territory`에 둘 추가 · 미시 축척 숨김 목록에 `territory-glow`)
- Test: `test/style.test.ts` 또는 기존 층 목록 테스트에 두 층 추가

- [ ] **Step 1: 층 추가**

`territory-outline`을 추가하는 자리 바로 뒤에:
```ts
    // 안쪽 후광: 경계 안쪽 8 px를 같은 색으로 흐리게. 「색이 바다로 샌다」는 인상을 지운다(OVERHAUL §3.6c).
    map.addLayer({ id: 'territory-glow', type: 'line', source: 'territory', filter: territoryFilter, // 기존 outline과 같은 필터 변수명을 쓴다
      layout: { 'line-join': 'round' },
      paint: { 'line-color': polityColor, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 4, 8, 12], 'line-offset': ['interpolate', ['linear'], ['zoom'], 3, -2, 8, -6], 'line-blur': ['interpolate', ['linear'], ['zoom'], 3, 3, 8, 8], 'line-opacity': 0.35 } }, before);
```
(`polityColor`·`territoryFilter`는 `territory-fill`이 쓰는 표현식·필터의 실제 변수명으로 맞춘다.) `territory-fill`의 `fill-opacity`를 0.55로(지금 값이 다르면). 해안 잉크는 데이터 층 **전부 위**, `label-marine` 바로 아래에:
```ts
    map.addLayer({ id: 'coast-ink', type: 'line', source: 'coast', paint: { 'line-color': MAP[activeSkin].coast, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 9, 1.4], 'line-opacity': 0.9 } }, before);
```
(`coast` 소스가 basemap 스타일에 있는지 `style.ts`에서 확인하고, 없으면 `layers/coast.geojson`을 geojson 소스로 더한다.) `LAYER_GROUPS.territory`에 `'territory-glow'`, `syncDetailMaps`의 미시 숨김 목록에 `'territory-glow'`.

- [ ] **Step 2: 검증**

```bash
npm run validate && npm run build && bash scripts/serve.sh
python3 scripts/look.py pack-rubicon && python3 scripts/look.py pack-augustan-27 --zoom 6 --center 24,37
python3 scripts/look.py pack-augustan-27 --zoom 4.2 --center 14,40
```
Expected: 에게해 z6 캡처에 키클라데스 섬들이 칠해지고(BC 27 로마), 이탈리아 장화 끝·펠로폰네소스가 채워지고, 경계 안쪽에 후광이 보이며 해안선이 잉크로 선다. 캡처를 `docs/verify/overhaul/territory-{bc49,ad117,aegean}.png`로.

- [ ] **Step 3: 근거·커밋**

`docs/BACKLOG.md` R57·R33 행에 예각 비율 전후·섬 귀속 수·캡처 경로. `docs/DESIGN.md` P3 행 뒤에 「2026-09-17 마감 규칙: OVERHAUL §3.6c」 한 줄.
```bash
git add src/map/engine.ts test docs/verify/overhaul docs/BACKLOG.md docs/DESIGN.md
git commit -m "feat(영역): 안쪽 후광·해안 잉크 렌더 마감 (R57)"
```

---

## Self-review

- 스펙 §3.6c 파이프라인 4단계: Step 1 함수 `smooth`·버퍼+교집합·섬 귀속·겹침 정리. 렌더 마감 4요소: Task B2. 완료 조건(두 시점 캡처·예각 절반·islands.csv): Task B1 Step 2·4, B2 Step 2.
- 좌표를 손으로 적은 곳 없음. 규칙 상수(50 m · 300 m · 40 km)는 스펙과 같다.
- 타입: 속성 이름 `finish`·`islands`·`island_rule`을 스크립트·테스트·스펙이 같이 쓴다.
