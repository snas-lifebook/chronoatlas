# 전면 개선 슬라이스 I · 계획 2/4: DEM 두 층 · 새 미시지도 셋

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 입체 보기가 라이브에서 서게 DEM을 레포에 굽고(대륙 ETOPO 2022 z0~7, 인셋 Copernicus GLO-30 z8~12), 루비콘 · 아테네 아크로폴리스 · 파르살루스 미시지도를 데이터와 근거 문서로 만든다.

**Architecture:** `scripts/bake-dem.py`(numpy + tifffile, GDAL 없음)가 terrarium PNG를 굽고, 엔진은 미시지도 진입 때 `setTerrain`을 인셋 소스로 바꾼다. 미시지도는 계획 1/4의 레지스트리(`data/micromaps/<id>.json`)에 JSON 한 장으로 들어간다.

**Tech Stack:** Python 3.13 · numpy · tifffile · imagecodecs · Pillow · MapLibre GL 6.3 raster-dem · vitest

**Spec:** `docs/OVERHAUL.md` §3.5 · §3.6b · §3.7 (P2 · P3). 요구 원장 R47 · R48 · R56. 선행: 계획 1/4 전부.

> **2026-09-17 실행 기록.** Task 2.1의 스크립트는 `scripts/bake-dem.py`로 들어갔고(대륙 기본 maxzoom 8, `inset --all`), 확대 시 자연 환경(R56, 스펙 §3.6b)을 위해 **Task 2.4가 늘었다**: `scripts/bake-landcover.py`가 ESA WorldCover(CC BY 4.0)를 zarr 창 읽기로 `landcover-<id>/` z8~12에 굽고, 미시지도 파일의 `landcover` 블록(`schema/micromap.ts`)과 엔진 진입 훅이 그것을 음영 밑에 깐다. 타일 총량 상한은 200 MB. 인셋 범위는 `home.at ± span`.
>
> **2026-09-17 실행 기록 2.** 첫 대륙 굽기가 697 MB로 나왔다. 원인은 terrarium의 1/256 m 정밀도와 수심이 PNG 압축을 죽이는 것. `encode(h, quant_m, sea)`로 대륙 2 m·인셋 1 m 양자화 + 바다 0을 넣어 다시 구웠다: 대륙 144 MB, 인셋 일곱(알레시아 15·로마 5.1·루비콘 7.4·칸나이 3.6·아테네 2.9·알렉산드리아 1.3·파르살루스 3.6) 합 179 MB. 증거 `docs/verify/overhaul/dem-alps-z6.png`(z6.2 알프스 음영, 계단 없음). Task 3.1~3.3의 세 미시지도는 에이전트(micromaps-3)가 초안을 냈고 검토에서 셋을 고쳤다: 아테네 「테미스토클레스 성벽」 폴리곤(안쪽 지점 다섯을 이은 발명 선)을 뺐고, 파르살루스 `source`의 자기수정 찌꺼기 문구를 지웠고, 제목·본문의 작대기를 콜론·쉼표로 바꿨다.
>
> **2026-09-17 실행 기록 3 (R56 마무리).** 고도색은 MapLibre 6의 `color-relief` 층(`elev-tint`, hillshade 밑, 0.15, `style.ts ELEV_RAMP` 7단). 인셋 부착은 `attachInset/detachInset` 하나로 합쳤고 미시지도 onEnter와 `data/insets.json`(`src/insets.ts insetAt`) 둘 다 그 길을 쓴다. 굽기 스크립트 둘은 `inset_spec(id)`로 미시지도·insets.json을 같은 꼴로 읽는다. 카르하이 인셋(117장 + 토지피복)이 첫 예. 완료 조건 잣대는 세 번 바꿨다(BACKLOG R56·OVERHAUL §3.6b).

## Global Constraints

- 초기 JS ≤ 400 kB gz (계획 1/4의 게이트가 postbuild에서 지킨다).
- 좌표를 지어내지 않는다. 우선순위 ① `public/datasets/rome/layers/{settlements,landmarks}.geojson`(정본·Pleiades) ② 발굴 보고·학술 지도 ③ 위키백과 좌표 필드. 면·선은 근사이고 `grade`로 말한다. OSM(ODbL)·CC BY-SA 기하는 복사하지 않는다.
- DEM 소스는 둘뿐: ETOPO 2022(NOAA, 자유 이용, DOI 10.25921/fd45-gt74) · Copernicus GLO-30(출처 표기). AWS Terrain Tiles는 쓰지 않는다.
- 타일 총량 ≤ 130 MB(`test/terrain.test.ts`). 런타임 외부 호출 0.
- 개인 절대경로 커밋 금지. `git add` 경로 명시. push는 River가 말할 때만.
- 렌더 확인은 `bash scripts/serve.sh` + `python3 scripts/look.py <scene>`.
- 문서 카피는 한국어, 작대기·이모지 금지.

---

## 모델링 (이 계획이 정하는 모델)

| 모델 | 정의 | 요지 |
|---|---|---|
| terrarium 타일 | `scripts/bake-dem.py` | `h = R·256 + G + B/256 − 32768`. 256px PNG, `{z}/{x}/{y}.png` |
| 대륙 DEM | `public/datasets/rome/terrain/` + `meta.json` | z0~7, BBOX(`scripts/extent.ts`) 안. `meta.json = { encoding, minzoom, maxzoom, exaggeration, credit }` |
| 인셋 DEM | `public/datasets/rome/terrain-<id>/` | z8~12, 범위 = 미시지도 `home.at ± home.span`. 메타는 미시지도 파일의 `dem` 블록 |
| 지형 소스 전환 | `src/map/engine.ts` | 미시 진입 `setTerrain({source:'dem-<id>'})`, 이탈 `setTerrain({source:'dem'})`. 음영 층은 소스를 바꿔 다시 얹는다 |
| 미시지도 근거 문서 | `docs/<ID>.md` | ROMA-URBS와 같은 짜임: 30초 · 무엇이 들어 있나 · 확정/근사/복원/논쟁 · 안 넣은 것 · 출처 |

---

### Task 2.1: `scripts/bake-dem.py` 와 자체 검사

**Files:**
- Create: `scripts/bake-dem.py`
- Modify: `.gitignore` (`data/external/dem/` 추가)

**Interfaces:**
- Produces: CLI `python3 scripts/bake-dem.py --selftest | continental [--maxzoom 7] | inset <id> [--maxzoom 12]`. 함수 `tile_bounds(z,x,y)` · `lonlat_to_tile(lon,lat,z)` · `encode(h)` · `decode(rgb)` · `Grid` · `Mosaic`.
- Consumes: `scripts/extent.ts`의 `BBOX` · `data/micromaps/<id>.json`의 `home`·`dem`.

- [ ] **Step 1: 스크립트 전체**

```python
#!/usr/bin/env python3
"""bake-dem.py: DEM 원본(GeoTIFF)을 terrarium PNG 타일로 굽는다. GDAL 없이 numpy + tifffile.

  python3 scripts/bake-dem.py --selftest
  python3 scripts/bake-dem.py continental              # ETOPO 2022 15초 → public/datasets/rome/terrain/ z0~7 (BBOX는 scripts/extent.ts)
  python3 scripts/bake-dem.py inset rubicon            # Copernicus GLO-30 → public/datasets/rome/terrain-rubicon/ z8~12 (범위는 data/micromaps/rubicon.json)

원본은 data/external/dem/ 에 캐시(gitignore). 산출물은 커밋한다(라이선스: ETOPO 자유 이용 · Copernicus 출처 표기).
ETOPO 타일 이름은 **좌상단** 모서리(N60E000 = 북위 45~60 · 동경 0~15). Copernicus는 **좌하단**(N44_00_E012_00 = 북위 44~45 · 동경 12~13).
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
COP_CREDIT = 'Copernicus DEM GLO-30 (© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA)'

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
def encode(h: np.ndarray) -> np.ndarray:
    v = np.clip(h.astype(np.float64) + 32768.0, 0, 65535.996)
    r = np.floor(v / 256); g = np.floor(v) - r * 256; b = np.floor((v - np.floor(v)) * 256)
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
        if nodata is not None: self.arr[self.arr == nodata] = 0.0
        self.arr[~np.isfinite(self.arr)] = 0.0
    @property
    def bounds(self): return (self.x0, self.y0 - self.h * self.sy, self.x0 + self.w * self.sx, self.y0)
    def sample(self, lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
        """이중선형. lon (W,), lat (H,) → (H, W). 격자 밖은 가장자리 값."""
        fx = (lon - self.x0) / self.sx - 0.5; fy = (self.y0 - lat) / self.sy - 0.5
        x0 = np.clip(np.floor(fx).astype(int), 0, self.w - 2); y0 = np.clip(np.floor(fy).astype(int), 0, self.h - 2)
        tx = np.clip(fx - x0, 0, 1)[None, :]; ty = np.clip(fy - y0, 0, 1)[:, None]
        a = self.arr[np.ix_(y0, x0)]; b = self.arr[np.ix_(y0, x0 + 1)]; c = self.arr[np.ix_(y0 + 1, x0)]; d = self.arr[np.ix_(y0 + 1, x0 + 1)]
        return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty

class Mosaic:
    def __init__(self, grids: list[Grid]): self.grids = grids
    def sample(self, lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
        out = np.zeros((lat.size, lon.size), np.float32)
        for g in self.grids:
            w, s, e, n = g.bounds
            mx = (lon >= w) & (lon < e); my = (lat > s) & (lat <= n)
            if not (mx.any() and my.any()): continue
            v = g.sample(lon, lat)
            m = my[:, None] & mx[None, :]
            out[m] = v[m]
        return out

# ── 다운로드 ──────────────────────────────────────────────────────────────────
def fetch(url: str, dest: Path) -> bool:
    if dest.exists(): return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        with urllib.request.urlopen(url, timeout=120) as r, open(dest, 'wb') as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk: break
                f.write(chunk)
        print('받음', dest.name, f'{dest.stat().st_size/1e6:.1f}MB'); return True
    except urllib.error.HTTPError as e:
        if e.code == 404: print('없음(바다)', url.rsplit('/', 1)[-1]); return False
        raise

def etopo_tiles(W, S, E, N) -> list[Path]:
    out = []
    for top in range(90, -90, -15):            # 타일 이름 = 좌상단 위도
        if top <= S or top - 15 >= N: continue
        for left in range(-180, 180, 15):
            if left >= E or left + 15 <= W: continue
            name = f"{'N' if top >= 0 else 'S'}{abs(top):02d}", f"{'E' if left >= 0 else 'W'}{abs(left):03d}"
            url = ETOPO.format(lat=name[0], lon=name[1]); dest = CACHE / 'etopo' / url.rsplit('/', 1)[-1]
            if fetch(url, dest): out.append(dest)
    return out

def copernicus_tiles(W, S, E, N) -> list[Path]:
    out = []
    for lat in range(math.floor(S), math.ceil(N)):   # 타일 이름 = 좌하단
        for lon in range(math.floor(W), math.ceil(E)):
            name = f"{'N' if lat >= 0 else 'S'}{abs(lat):02d}", f"{'E' if lon >= 0 else 'W'}{abs(lon):03d}"
            url = COP.format(lat=name[0], lon=name[1]); dest = CACHE / 'copernicus' / url.rsplit('/', 1)[-1]
            if fetch(url, dest): out.append(dest)
    return out

# ── 굽기 ──────────────────────────────────────────────────────────────────────
def bake(mosaic: Mosaic, bbox, zmin: int, zmax: int, outdir: Path) -> int:
    W, S, E, N = bbox; n = 0
    for z in range(zmin, zmax + 1):
        x0, y0 = lonlat_to_tile(W, N, z); x1, y1 = lonlat_to_tile(E, S, z)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                lon, lat = tile_pixel_lonlat(z, x, y)
                png = outdir / str(z) / str(x) / f'{y}.png'
                png.parent.mkdir(parents=True, exist_ok=True)
                Image.fromarray(encode(mosaic.sample(lon, lat)), 'RGB').save(png, optimize=True)
                n += 1
        print(f'z{z} 끝, 누적 {n}장')
    return n

def bbox_from_extent():
    m = re.search(r'BBOX\s*=\s*\[([^\]]+)\]', (ROOT / 'scripts' / 'extent.ts').read_text())
    return [float(v) for v in m.group(1).split(',')]

def cmd_continental(maxzoom: int):
    bbox = bbox_from_extent()
    grids = [Grid(p) for p in etopo_tiles(*bbox)]
    if not grids: sys.exit('ETOPO 타일 0장')
    out = DS / 'terrain'
    n = bake(Mosaic(grids), bbox, 0, maxzoom, out)
    (out / 'meta.json').write_text(json.dumps({'encoding': 'terrarium', 'minzoom': 0, 'maxzoom': maxzoom, 'exaggeration': 1.4, 'credit': ETOPO_CREDIT}, ensure_ascii=False))
    print('대륙', n, '장 →', out)

def cmd_inset(mid: str, maxzoom: int):
    mm = json.loads((ROOT / 'data' / 'micromaps' / f'{mid}.json').read_text())
    if not mm.get('dem'): sys.exit(f'{mid}: dem 블록이 없다')
    (lon, lat), span = mm['home']['at'], mm['home']['span']
    bbox = [lon - span, lat - span, lon + span, lat + span]
    grids = [Grid(p) for p in copernicus_tiles(*bbox)]
    if not grids: sys.exit('Copernicus 타일 0장')
    out = DS / mm['dem']['dir']
    n = bake(Mosaic(grids), bbox, mm['dem'].get('minzoom', 8), min(maxzoom, mm['dem'].get('maxzoom', 12)), out)
    print('인셋', mid, n, '장 →', out)

def selftest():
    h = np.array([[-11000.0, 0.0], [8848.5, 1.25]])
    assert np.allclose(decode(encode(h)), h, atol=1 / 256), 'terrarium 왕복'
    w, s, e, n = tile_bounds(0, 0, 0); assert (round(w), round(e)) == (-180, 180) and abs(n - 85.0511) < 1e-3, 'z0 경계'
    assert lonlat_to_tile(0.0, 0.0, 1) == (1, 1), 'z1 원점 타일'
    assert lonlat_to_tile(12.36, 44.07, 8) == (136, 93), 'z8 루비콘 타일'
    g = Grid.__new__(Grid); g.arr = np.array([[0, 10], [20, 30]], np.float32); g.x0, g.y0, g.sx, g.sy, g.h, g.w = 0.0, 2.0, 1.0, 1.0, 2, 2
    v = g.sample(np.array([0.5, 1.5]), np.array([1.5, 0.5]))
    assert np.allclose(v, [[0, 10], [20, 30]]), f'픽셀 중심 표본 {v}'
    assert abs(float(g.sample(np.array([1.0]), np.array([1.0]))[0, 0]) - 15.0) < 1e-6, '이중선형 중앙'
    print('selftest ok')

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('cmd', nargs='?', choices=['continental', 'inset']); ap.add_argument('id', nargs='?')
    ap.add_argument('--maxzoom', type=int); ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest: selftest()
    elif a.cmd == 'continental': cmd_continental(a.maxzoom or 7)
    elif a.cmd == 'inset': cmd_inset(a.id, a.maxzoom or 12)
    else: ap.print_help()
```

- [ ] **Step 2: 자체 검사 실행**

Run: `python3 -m pip install -q tifffile imagecodecs && python3 scripts/bake-dem.py --selftest`
Expected: `selftest ok`. 단언이 하나라도 깨지면 수학이 틀린 것이니 굽기 전에 고친다.

- [ ] **Step 3: gitignore와 커밋**

`.gitignore`에 `data/external/dem/` 한 줄을 더한다(`data/external/*.tif` 줄 아래).
```bash
git add scripts/bake-dem.py .gitignore
git commit -m "feat(지형): DEM 베이크 스크립트 (ETOPO 2022 · Copernicus GLO-30, GDAL 없이)"
```

---

### Task 2.2: 대륙 DEM 굽고 커밋

**Files:**
- Create: `public/datasets/rome/terrain/**` (z0~7, 약 1,250장) · `terrain/meta.json`
- Modify: `.gitignore` (`public/datasets/*/terrain/` 줄 삭제)
- Modify: `data/external/LICENSES.md` · `public/assets/CREDITS.md` (출처 행)
- Modify: `src/map/engine.ts:465-468` (주석 「타일은 레포에 없다」를 실측으로)
- Test: `test/terrain.test.ts`

**Interfaces:**
- Produces: 라이브 `datasets/rome/terrain/meta.json` 200. 엔진 코드는 안 바꿔도 켜진다(이미 meta.json을 보고 켠다).

- [ ] **Step 1: 테스트 먼저**

```ts
// test/terrain.test.ts
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DS = join(ROOT, 'public', 'datasets', 'rome');
const walk = (d: string): number => readdirSync(d).reduce((s, f) => { const p = join(d, f); const st = statSync(p); return s + (st.isDirectory() ? walk(p) : st.size); }, 0);

describe('DEM 타일 (OVERHAUL §3.7)', () => {
  it('대륙 meta.json 이 terrarium z0~7 이고 출처가 ETOPO다', () => {
    const m = JSON.parse(readFileSync(join(DS, 'terrain', 'meta.json'), 'utf8'));
    expect(m).toMatchObject({ encoding: 'terrarium', minzoom: 0, maxzoom: 7 });
    expect(m.credit).toContain('ETOPO 2022');
    expect(existsSync(join(DS, 'terrain', '7'))).toBe(true);
  });
  it('미시지도의 dem 블록마다 타일 폴더가 있고 minzoom 층이 존재한다', () => {
    const dir = join(ROOT, 'data', 'micromaps');
    for (const f of readdirSync(dir).filter(x => x.endsWith('.json') && x !== 'index.json')) {
      const mm = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      if (!mm.dem) continue;
      expect(existsSync(join(DS, mm.dem.dir, String(mm.dem.minzoom))), `${mm.id} ${mm.dem.dir}`).toBe(true);
    }
  });
  it('타일 총량이 130 MB 이하다', () => {
    const dirs = readdirSync(DS).filter(d => /^terrain(-|$)/.test(d));
    const total = dirs.reduce((s, d) => s + walk(join(DS, d)), 0);
    expect(total, `${(total / 1e6).toFixed(1)} MB`).toBeLessThanOrEqual(130e6);
  });
});
```
Run: `npx vitest run test/terrain.test.ts` → FAIL (meta.json 없음. Task A2에서 지웠다).

- [ ] **Step 2: 굽는다 (35장 다운로드 약 1.2 GB, 수십 분)**

```bash
python3 scripts/bake-dem.py continental 2>&1 | tail -15
find public/datasets/rome/terrain -name '*.png' | wc -l; du -sh public/datasets/rome/terrain
```
Expected: `z7 끝` 뒤 약 1,250장 · 30~45 MB. 장수가 800 밑이면 BBOX를 못 읽은 것이다(`bbox_from_extent`).

- [ ] **Step 3: 눈으로 한 장, 숫자로 한 장**

```bash
python3 - <<'EOF'
import numpy as np; from PIL import Image; import sys
sys.path.insert(0, 'scripts'); from importlib import import_module; b = import_module('bake-dem')
t = np.asarray(Image.open('public/datasets/rome/terrain/7/68/47.png'))     # 알프스 부근 (z7 x68 y47 ≈ 동경 11~14 · 북위 45~47)
h = b.decode(t); print('알프스 타일 min/max m', h.min().round(), h.max().round())
t2 = np.asarray(Image.open('public/datasets/rome/terrain/7/70/49.png'))    # 지중해 한가운데
print('바다 타일 min m', b.decode(t2).min().round())
EOF
```
Expected: 알프스 max가 3,000 이상, 바다 min이 음수(수심이 살아 있다). 둘 중 하나라도 아니면 타일 색인 y가 뒤집힌 것이다.

- [ ] **Step 4: gitignore·출처·주석**

- `.gitignore`에서 `public/datasets/*/terrain/` 줄과 그 위 주석 두 줄을 지운다.
- `data/external/LICENSES.md` 표에 두 행: `ETOPO_2022_v1_15s_*_surface.tif | NOAA NCEI ETOPO 2022 15초 | 자유 이용(인용 DOI 10.25921/fd45-gt74) | → terrain/ z0~7 terrarium` · `Copernicus_DSM_COG_10_*_DEM.tif | Copernicus GLO-30 | 출처 표기 조건 | → terrain-<id>/ z8~12`.
- `public/assets/CREDITS.md` 끝에 「## 지형(DEM)」 절을 더하고 같은 두 줄 + 「AWS Terrain Tiles는 2026-09-17에 걷어냈다(라이선스 혼합)」.
- `src/map/engine.ts` 465~466행 주석을 「타일은 레포에 커밋돼 있다(2026-09-17, ETOPO 2022 z0~7). meta.json이 있으면 켠다」로.

- [ ] **Step 5: 테스트·빌드·렌더**

```bash
npx vitest run test/terrain.test.ts && npm run build && bash scripts/serve.sh
python3 scripts/look.py pack-gaul-52 --zoom 6 --center 8,46
```
검증 창에서 `V`로 입체를 켜고 `window.__ca.map.getTerrain()`이 `{source:'dem', …}`인지, 알프스 능선이 서는지 본다. 캡처를 `docs/verify/overhaul/dem-alps-z6.png`로.

- [ ] **Step 6: 커밋 (타일은 한 커밋에)**

```bash
git add .gitignore public/datasets/rome/terrain data/external/LICENSES.md public/assets/CREDITS.md src/map/engine.ts test/terrain.test.ts docs/verify/overhaul/dem-alps-z6.png
git commit -m "feat(지형): ETOPO 2022 대륙 DEM z0~7 커밋 · 입체 보기가 라이브에서 선다 (R48)"
```

---

### Task 2.3: 인셋 DEM과 지형 소스 전환

**Files:**
- Modify: `data/micromaps/{alesia,roma,alexandria,cannae}.json` (`dem` 블록)
- Create: `public/datasets/rome/terrain-{alesia,roma,alexandria,cannae}/**`
- Modify: `src/map/engine.ts` (`addTerrain`·`syncTerrain`를 소스 id 매개변수로, `micro` onEnter/onLeave에서 전환)
- Test: `test/terrain.test.ts` (Task 2.2의 둘째 케이스가 자동으로 검사)

**Interfaces:**
- Produces: 엔진 내부 `useTerrain(sourceId: string)`. 미시 진입 시 `map.getTerrain().source === 'dem-<id>'`.

- [ ] **Step 1: dem 블록**

네 파일에 `"dem": { "dir": "terrain-<id>", "minzoom": 8, "maxzoom": 12 }` (알레시아 `terrain-alesia` …). `npx vitest run test/micromap.test.ts` 통과 확인.

- [ ] **Step 2: 굽는다**

```bash
for m in alesia roma alexandria cannae; do python3 scripts/bake-dem.py inset $m 2>&1 | tail -3; done
du -sh public/datasets/rome/terrain-*; npx vitest run test/terrain.test.ts
```
Expected: 지도당 200~700장. 총량 테스트 통과. 넘으면 `maxzoom`을 11로 내린다(스펙 상한 130 MB가 우선).

- [ ] **Step 3: 엔진 전환 코드**

`src/map/engine.ts`에서 지형 관련 부분을 이렇게 바꾼다.
```ts
  let terrainSrc = 'dem';
  const syncTerrain = () => {
    if (!map.getSource(terrainSrc)) return;
    const base = terrainMeta?.exaggeration ?? 1.4;
    const ex = Math.round(base * Math.min(11, Math.max(1, 2 ** ((9 - map.getZoom()) * 0.62))) * 10) / 10;
    if (ex === lastEx && map.getTerrain()?.source === terrainSrc) return;
    lastEx = ex; map.setTerrain({ source: terrainSrc, exaggeration: ex });
  };
  function hillshadeTo(src: string, before?: string) {
    if (map.getLayer('hillshade')) map.removeLayer('hillshade');
    map.addLayer({ id: 'hillshade', type: 'hillshade', source: src, paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': activeSkin === 'dark' ? '#0B0F14' : '#5C6157', 'hillshade-highlight-color': activeSkin === 'dark' ? '#3A424C' : '#FFFFFF' } }, before);
  }
  /** 지형 소스를 바꾼다. 미시지도 진입은 인셋, 이탈은 대륙. */
  function useTerrain(src: string) {
    if (!map.getSource(src)) return;
    terrainSrc = src; lastEx = 0;
    hillshadeTo(src, map.getLayer('label-marine') ? 'label-marine' : undefined);
    syncTerrain();
  }
  function addTerrain(before?: string) {
    const t = terrainMeta; if (!t) return;
    if (!map.getSource('dem')) map.addSource('dem', { type: 'raster-dem', tiles: [`${root}datasets/${ds}/terrain/{z}/{x}/{y}.png`], encoding: t.encoding ?? 'terrarium', tileSize: 256, minzoom: t.minzoom ?? 0, maxzoom: t.maxzoom ?? 7 });
    if (map.getLayer('relief')) map.removeLayer('relief');
    useTerrain(micro?.active()?.dem ? `dem-${micro.active()!.id}` : 'dem');
  }
```
`createMicro(...)`의 `onEnter`에 이렇게 더한다.
```ts
    onEnter: def => {
      hideContinental(true, def.hide);
      if (def.dem) {
        const id = `dem-${def.id}`, [lon, lat] = def.home.at, sp = def.home.span;
        if (!map.getSource(id)) map.addSource(id, { type: 'raster-dem', tiles: [`${root}datasets/${ds}/${def.dem.dir}/{z}/{x}/{y}.png`], encoding: 'terrarium', tileSize: 256, minzoom: def.dem.minzoom, maxzoom: def.dem.maxzoom, bounds: [lon - sp, lat - sp, lon + sp, lat + sp] });
        useTerrain(id);
      }
    },
    onLeave: () => { hideContinental(false); if (map.getSource('dem')) useTerrain('dem'); },
```
`setSkin`·`setDark`가 `setStyle`로 소스를 지우므로 `addData` 끝에서 활성 미시지도가 있으면 `micro.enter(def)`를 다시 부른다(이미 `micro.active()`가 같은 id면 `enter`가 조기 반환하니 `active`를 먼저 null로 돌리는 `micro.reset()`을 `createMicro`에 더한다: `reset(){ active = null; }`).

- [ ] **Step 4: 검증**

```bash
npm run validate && npm run build && bash scripts/serve.sh
python3 scripts/look.py pack-alesia-52
```
검증 창 콘솔에서 `__ca.map.getTerrain().source` → `"dem-alesia"`. 지도를 z6으로 빼면 `"dem"`. 알레시아 캡처에 몽 오수아 언덕 음영이 보인다. 캡처를 `docs/verify/overhaul/dem-inset-alesia.png`로.

- [ ] **Step 5: 커밋**

```bash
git add data/micromaps public/datasets/rome/terrain-alesia public/datasets/rome/terrain-roma public/datasets/rome/terrain-alexandria public/datasets/rome/terrain-cannae src/map/engine.ts src/map/micro.ts docs/verify/overhaul/dem-inset-alesia.png
git commit -m "feat(지형): 미시지도 인셋 DEM (Copernicus GLO-30 z8~12) · 진입 시 지형 소스 전환"
```

---

### Task 3.1: 루비콘 미시지도

**Files:**
- Create: `data/micromaps/rubicon.json` · `docs/RUBICON.md` · `public/datasets/rome/terrain-rubicon/**`
- Modify: `data/micromaps/index.json` · `data/scenes/rome.json` (세부 지도 그룹에 `rubicon-49`) · `data/overlays/pack-scene-text.json`(설명 한 항목)

**Interfaces:**
- Consumes: 정본 좌표(아래 명령으로 읽는다) · 계획 1/4의 스키마.
- Produces: 장면 `rubicon-49` (`micro: "rubicon"`, year -49, camera = view).

- [ ] **Step 1: 정본에서 좌표를 읽는다 (지어내지 않는다)**

```bash
python3 - <<'EOF'
import json
S=json.load(open('public/datasets/rome/layers/settlements.geojson'))['features']
L=json.load(open('public/datasets/rome/layers/landmarks.geojson'))['features']
for f in S:
    p=f['properties']
    if any(k in (p.get('name_ko','')+p.get('name_ancient','')+p.get('name_modern','')) for k in ['라벤나','리미니','아리미눔','루비콘','체세나','Ariminum','Ravenna']): print('S', p.get('id'), p.get('name_ko'), p.get('name_ancient'), f['geometry']['coordinates'])
for f in L:
    n=str(f['properties'].get('name',''))
    if any(k in n for k in ['Rubico','Ariminum','Ravenna','Sapis','Pisaurum','Caesena','Via Aemilia','Via Flaminia']): print('L', n, f['properties'].get('kind'), f['geometry']['type'], f['geometry']['coordinates'] if f['geometry']['type']=='Point' else '')
EOF
```
결과를 `docs/RUBICON.md` 「출처」 절에 그대로 붙인다. 강의 선형은 정본에 점 하나(`Rubico [12.3607, 44.0722]`)뿐이다. 선을 그리려면 위키백과 「Rubicon」·「Savignano sul Rubicone」·「Gatteo」 문서의 좌표 필드(하구·마을 세 점)를 잇는 3~4점 LineString으로 하고 `grade: "논쟁"`, `source`에 「현대 루비코네(피우미치노) 비정 통설, 우소·피사텔로 대안」과 좌표 출처를 적는다.

- [ ] **Step 2: 파일**

`data/micromaps/rubicon.json` 골격. 좌표 자리에는 Step 1의 값만 넣는다.
```jsonc
{
 "id": "rubicon", "title": "루비콘 강 · BC 49", "year": -49, "teaching": true,
 "source": "정본 place(라벤나·아리미눔)와 Pleiades Rubico 점, 위키백과 좌표 필드(하구·사비냐노)를 썼다. 강의 비정 자체가 논쟁이라(현대 루비코네 통설 대 우소·피사텔로 대안) 강은 논쟁 태그다. 진군 경로는 수에토니우스 『카이사르』 31~33 · 플루타르코스 『카이사르』 32의 서술(라벤나 → 강 → 아리미눔)을 세 점으로 이은 근사이며 측량이 아니다.",
 "home": { "at": [12.36, 44.07], "minZoom": 10, "span": 0.45 },
 "view": { "center": [12.40, 44.10], "zoom": 10.8, "pitch": 0, "bearing": 0 },
 "hide": ["movements"], "basemap": null,
 "dem": { "dir": "terrain-rubicon", "minzoom": 8, "maxzoom": 12 }, "board": null,
 "features": [
  { "type": "Feature", "properties": { "id": "rubicon:river", "name_ko": "루비콘 강", "name_la": "Rubico", "kind": "river", "grade": "논쟁", "source": "…", "note_ko": "갈리아 키살피나와 이탈리아 본토의 경계. 폭 수 미터의 개천이다", "wiki": "https://ko.wikipedia.org/wiki/루비콘_강" }, "geometry": { "type": "LineString", "coordinates": [] } },
  { "type": "Feature", "properties": { "id": "rubicon:ravenna", "name_ko": "라벤나", "name_la": "Ravenna", "kind": "building", "grade": "확정", "source": "정본 place:라벤나", "note_ko": "카이사르가 BC 49년 1월 원로원의 최후통첩을 받은 곳" }, "geometry": { "type": "Point", "coordinates": [] } },
  { "type": "Feature", "properties": { "id": "rubicon:ariminum", "name_ko": "아리미눔(리미니)", "name_la": "Ariminum", "kind": "building", "grade": "확정", "source": "정본 place 또는 Pleiades Ariminum", "note_ko": "강을 건넌 뒤 첫 점령 도시" }, "geometry": { "type": "Point", "coordinates": [] } },
  { "type": "Feature", "properties": { "id": "rubicon:march", "name_ko": "카이사르의 진군", "name_la": "", "kind": "road", "grade": "근사", "source": "수에토니우스 『카이사르』 31~33, 플루타르코스 『카이사르』 32. 라벤나 → 강 → 아리미눔 세 점을 이었다" }, "geometry": { "type": "LineString", "coordinates": [] } },
  { "type": "Feature", "properties": { "id": "rubicon:boundary", "name_ko": "속주 경계", "name_la": "", "kind": "boundary", "grade": "복원", "source": "강을 따라 그은 학설선. 경계가 강이었다는 것은 확정, 어느 물줄기냐가 논쟁" }, "geometry": { "type": "Polygon", "coordinates": [] } }
 ],
 "callouts": [
  { "id": "rubicon:call-size", "topic": "terrain", "anchor": { "feature": "rubicon:river" }, "side": "left", "num": 1, "title": "얼마나 작은 강인가", "body": "…", "cite": "…", "links": [] },
  { "id": "rubicon:call-boundary", "topic": "event", "anchor": { "feature": "rubicon:boundary" }, "side": "left", "num": 2, "title": "무장한 채 넘으면 반란", "body": "…", "cite": "…", "links": [] },
  { "id": "rubicon:call-dice", "topic": "event", "anchor": { "feature": "rubicon:march" }, "side": "right", "num": 3, "title": "주사위는 던져졌다", "body": "…", "cite": "수에토니우스 『카이사르』 32", "links": [] },
  { "id": "rubicon:call-ravenna", "topic": "event", "anchor": { "feature": "rubicon:ravenna" }, "side": "right", "num": 4, "title": "라벤나의 밤", "body": "…", "cite": "…", "links": [] },
  { "id": "rubicon:call-sulla", "topic": "event", "anchor": { "feature": "rubicon:ariminum" }, "side": "right", "num": 5, "title": "처음이 아니다: 술라의 선례", "body": "…", "cite": "아피아노스 『내전기』 1.57~58", "links": [] }
 ]
}
```
`body`는 160자 이내, 각 `cite`는 실제 사료 절 번호. `wiki` 링크는 `curl -sI`로 200 확인.

- [ ] **Step 3: 근거 문서 `docs/RUBICON.md`**

ROMA-URBS.md의 짜임을 따른다: `# 루비콘 미시지도 (BC 49)` → `## 0. 30초`(피처 수·권장 화면·무엇이 논쟁인가) → `## 1. 무엇이 들어 있나`(표) → `## 2. 확정 · 근사 · 복원 · 논쟁`(피처별 근거) → `## 3. 안 넣은 것`(카이사르의 정확한 도하 지점, 군단 배치) → `## 4. 출처`(Step 1 출력 그대로 + 위키백과 문서 제목 + 사료).

- [ ] **Step 4: 색인·장면·인셋 DEM**

- `index.json`에 행 추가. `data/scenes/rome.json`의 `세부 지도` 그룹 끝에:
```json
{ "id": "rubicon-49", "title": "루비콘 강 · BC 49", "year": -49, "micro": "rubicon", "center": [12.40, 44.10], "zoom": 10.8, "pitch": 0, "bearing": 0, "view": "2d", "skin": "campaign",
  "layers": ["territory", "admin_regions", "settlements", "people", "relief", "rivers", "labels"], "group": "세부 지도",
  "note": "속주 경계였던 개천 하나. 무장한 채 이 선을 넘는 순간 총독은 반란자가 된다." }
```
- `python3 scripts/bake-dem.py inset rubicon`.

- [ ] **Step 5: 검증·렌더·커밋**

```bash
npm run validate && npm run build && bash scripts/serve.sh && python3 scripts/look.py rubicon-49
```
Expected: 미시 층 개수 > 0, 콜아웃 핀 5, `getTerrain().source === 'dem-rubicon'`. 캡처 → `docs/verify/overhaul/rubicon-49.png`.
```bash
git add data/micromaps/rubicon.json data/micromaps/index.json data/scenes/rome.json docs/RUBICON.md public/datasets/rome/terrain-rubicon docs/verify/overhaul/rubicon-49.png
git commit -m "feat(미시지도): 루비콘 강 BC 49 (R47)"
```

---

### Task 3.2: 아테네 아크로폴리스 미시지도

**Files:**
- Create: `data/micromaps/athens.json` · `docs/ATHENS.md` · `public/datasets/rome/rasters/basemap-athens.jpg`(PD 도판, 지오레퍼런싱 성공 시) · `public/datasets/rome/terrain-athens/**`
- Modify: `index.json` · `data/scenes/rome.json` (`athens-acropolis`)

**Interfaces:**
- Produces: 장면 `athens-acropolis` (`micro: "athens"`, year -60).

- [ ] **Step 1: 좌표 수집**

정본 먼저: 위 Step 1 명령의 키워드를 `['아테네','Athenae','Pnyx','Piraeus','Acropolis','Areopagus','Ilissos','Eridanos','Kerameikos']`로 바꿔 돌린다(Pleiades `Pnyx [23.7195, 37.9714]`는 있다). 없는 것은 위키백과 문서(파르테논 · 프로필라이아 · 에레크테이온 · 디오니소스 극장 · 아고라 · 아레오파고스 · 테미스토클레스 성벽 · 일리소스 강)의 좌표 필드를 쓰고 `docs/ATHENS.md` 「출처」에 문서 제목과 읽은 날짜를 적는다. 면(아크로폴리스·아고라)은 현대 지형에 맞춘 근사, 성벽은 복원.

- [ ] **Step 2: 도판 (PD) 시도**

위키미디어 커먼즈에서 「Karten von Attika」(Curtius·Kaupert 1881) 또는 Kiepert 『Atlas Antiquus』 아테네 인셋을 찾아 라이선스가 PD(저자 사후 100년 이상)임을 파일 페이지에서 확인하고 받는다. `docs/MICROMAP-BASEMAP.md` §2의 방법(제어점 ≥ 4: 파르테논·헤파이스토스 신전·올림피에이온·프닉스, 최소제곱으로 `corners` w/e/n/s, 메르카토르 Y 기준)으로 RMS를 잰다. **RMS ≤ 500 m면 채택**해 `basemap` 블록에 넣고, 넘으면 알레시아처럼 「실패」로 문서에 기록하고 `basemap: null`. 파일은 2000px 폭 JPEG로 줄인다.

- [ ] **Step 3: 파일과 콜아웃**

`data/micromaps/athens.json`: `year: -60`, `home { at: [23.7266, 37.9715], minZoom: 12, span: 0.3 }`(아크로폴리스 위키 좌표로 대체), 피처 10(아크로폴리스 hill · 파르테논 temple · 프로필라이아 gate · 에레크테이온 temple · 디오니소스 극장 theatre · 아고라 forum · 프닉스 field · 아레오파고스 hill · 테미스토클레스 성벽 wall · 일리소스 river), 각 `note_ko`에 **BC 60에 서 있었는가**를 한 줄. 아그리파 오데온·하드리아누스 도서관은 넣지 않고 문서 「안 넣은 것」에 이유.
콜아웃 6: 프닉스 민회(정족수와 사료는 문서에서 확인한 것만) · 디오니소스 극장 · 파르테논 · 아고라(불레·법정) · 아레오파고스 · **「로마가 그리스 정치체제를 받아들였다」 사료 대조**(topic `event`, cite 리비우스 3.31~33, 본문은 「전승은 논쟁이고 공화정 기원은 독자적이다. 다만 …」 결로. 반박이 아니라 한 번 더 증명).

- [ ] **Step 4: 문서·색인·장면·DEM·검증·커밋**

`docs/ATHENS.md`(짜임은 Task 3.1 Step 3과 같다. 도판 절에 RMS 표). 장면:
```json
{ "id": "athens-acropolis", "title": "아테네 아크로폴리스 · 민회의 현장", "year": -60, "micro": "athens", "center": [23.7266, 37.9715], "zoom": 14.0, "pitch": 0, "bearing": 0, "view": "2d", "skin": "campaign",
  "layers": ["territory", "admin_regions", "settlements", "people", "relief", "rivers", "labels"], "group": "세부 지도",
  "note": "밑에서 말해도 들리는 언덕. 그리스는 왜 제국이 못 됐고 로마는 왜 공화정으로 시작했나의 현장이다." }
```
```bash
python3 scripts/bake-dem.py inset athens && npm run validate && npm run build && bash scripts/serve.sh && python3 scripts/look.py athens-acropolis
git add data/micromaps/athens.json data/micromaps/index.json data/scenes/rome.json docs/ATHENS.md public/datasets/rome/terrain-athens docs/verify/overhaul/athens-acropolis.png
# 도판을 채택했으면 public/datasets/rome/rasters/basemap-athens.jpg 도 함께
git commit -m "feat(미시지도): 아테네 아크로폴리스 (R47)"
```

---

### Task 3.3: 파르살루스 미시지도 (말판을 그릇에 담는다)

**Files:**
- Create: `data/micromaps/pharsalus.json` · `docs/PHARSALUS.md` · `public/datasets/rome/terrain-pharsalus/**`
- Modify: `index.json` · `data/scenes/rome.json` (`pharsalus-48` 장면, `micro: "pharsalus"`, `board: "pharsalus-48"`, `phase: 0`, group `세부 지도`)

**Interfaces:**
- Consumes: `data/boards/pharsalus-48.json`(중심 `[22.3833, 39.3]`, zoom 11) · Pleiades `Enipeus [22.3585, 39.3195]` · 정본 `place:파르살루스`.
- Produces: 계획 3/4(전투 재생)가 이 지도 위에 재생 UI를 얹는다.

- [ ] **Step 1: 좌표**

Task 3.1 Step 1의 명령을 키워드 `['파르살','Pharsal','Enipeus','Larisa','라리사','Cynoscephal']`로. `Enipeus`는 점 둘이 나온다(하나는 펠로폰네소스). 테살리아 쪽 `[22.3585, 39.3195]`를 쓴다.

- [ ] **Step 2: 파일**

피처 5: 파르살루스 시(building, 확정, 정본 place) · 에니페우스 강(river, 논쟁: 점 하나뿐이라 Point로 두고 `note_ko`에 「선형은 정본에 없다. 북안·남안 논쟁」) · 폼페이우스 진영(camp, 복원, 『내전기』 3.85 「언덕 기슭」) · 카이사르 진영(camp, 복원, 3.85) · 전장 평원(plain, 복원, 말판 유닛 범위를 감싸는 다각형). `board: "pharsalus-48"`, `dem` 블록, `home { at: [22.3833, 39.3], minZoom: 10, span: 0.3 }`, `view`는 말판 center·zoom 11.
콜아웃 5: 병력(『내전기』 3.88, 당사자 수치 주의, topic unit, anchor `{ "unit": "<카이사르 우익 유닛 id>" }`는 계획 3/4에서 유닛 앵커가 살아난 뒤 넣고 지금은 `feature` 앵커로) · 넷째 줄(3.89) · 「하루 만에 도망자」(3.96) · 위치 논쟁(Morgan 1983 대 Pelling 1973, topic terrain, anchor 강) · 진영 거리(3.85).

- [ ] **Step 3: 문서·장면·DEM·검증·커밋**

`docs/PHARSALUS.md`(같은 짜임 + 「말판과의 관계」 절: 유닛 좌표는 말판 파일이 정본이고 이 지도는 지형만). 장면:
```json
{ "id": "pharsalus-48", "title": "파르살루스 · BC 48", "year": -48, "micro": "pharsalus", "board": "pharsalus-48", "phase": 0, "center": [22.3833, 39.3], "zoom": 11, "pitch": 0, "bearing": 0, "view": "2d", "skin": "campaign",
  "layers": ["territory", "admin_regions", "settlements", "people", "relief", "rivers", "labels"], "group": "세부 지도",
  "note": "8개 군단 대 11개 군단. 하루 만에 로마 제일의 장군이 도망자가 된다." }
```
```bash
python3 scripts/bake-dem.py inset pharsalus && npm run validate && npm run build && bash scripts/serve.sh && python3 scripts/look.py pharsalus-48
git add data/micromaps/pharsalus.json data/micromaps/index.json data/scenes/rome.json docs/PHARSALUS.md public/datasets/rome/terrain-pharsalus docs/verify/overhaul/pharsalus-48.png
git commit -m "feat(미시지도): 파르살루스 BC 48 (말판 pharsalus-48 결합) (R47)"
```

---

### Task 3.4: 문서 마감 (P2·P3 완료 판정)

**Files:**
- Modify: `docs/BACKLOG.md` (R47 ● · R48 ● 근거) · `docs/MICROMAP-UX.md` §3 표(7개 지도)·§8 파일 표 · `docs/HANDOFF.md` §1(테스트 수·번들 수치) · `docs/PACK-CAESAR.md` §0.3 표(알레시아 DEM 행을 「Copernicus 인셋으로 대체」)

- [ ] **Step 1: 수치는 실측에서만**

`node scripts/check-bundle.mjs` · `npx vitest run 2>&1 | tail -3` · `du -sh public/datasets/rome/terrain*` 값을 각 문서에 적는다.

- [ ] **Step 2: 커밋**

```bash
git add docs/BACKLOG.md docs/MICROMAP-UX.md docs/HANDOFF.md docs/PACK-CAESAR.md
git commit -m "docs: R47·R48 닫힘 근거 · 미시지도 일곱 장 표 갱신"
```

---

## Self-review

- 스펙 P2(대륙·인셋·전환·130 MB·크레딧): Task 2.1~2.3. P3(셋 + 문서 + 장면): Task 3.1~3.3. 완료 판정 문서: Task 3.4.
- 좌표는 전부 「정본·Pleiades → 위키백과 좌표 필드」 순으로 읽어 오게 했고 계획 본문에는 검증된 값(Rubico·Enipeus·Pnyx·칸나이·말판 중심)만 적었다. 나머지 좌표 자리는 빈 배열이고 Step 1 명령이 채운다.
- 타입: `MicroMapDef.dem = { dir, minzoom, maxzoom }`, 엔진 소스 id `dem-<id>`, 스크립트 출력 폴더 `dem.dir`. 세 곳이 같은 이름을 쓴다.
