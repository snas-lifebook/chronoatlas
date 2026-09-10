// 경로 고도 단면(로드맵 다음 증분): terrarium DEM 타일을 직접 읽는다.
// MapLibre 6의 queryTerrainElevation은 여기서 늘 0을 돌려줘서 못 쓴다 — 렌더러가 그 순간 들고 있는 타일에 의존한다.
// 타일을 직접 읽으면 2D에서도, 화면 밖 구간도 나온다.

export interface TerrainMeta { encoding?: 'terrarium' | 'mapbox'; maxzoom?: number }

/** terrarium 픽셀 → 해발 m. mapbox 인코딩은 식이 다르다. */
export const decodeElev = (r: number, g: number, b: number, enc: 'terrarium' | 'mapbox' = 'terrarium') =>
  enc === 'mapbox' ? -10000 + (r * 65536 + g * 256 + b) * 0.1 : r * 256 + g + b / 256 - 32768;

/** 경위도 → 타일 좌표(정수부 + 타일 안 0~1 소수부). 웹메르카토르. */
export function tileOf(lon: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const s = Math.sin((lat * Math.PI) / 180);
  const y = ((1 - Math.log((1 + s) / (1 - s)) / (2 * Math.PI)) / 2) * n;
  return { z, x: Math.floor(x), y: Math.floor(y), fx: x - Math.floor(x), fy: y - Math.floor(y) };
}

/** 폴리라인을 등간격 n점으로 리샘플. 반환 dist는 시작점부터의 km(대원거리 근사). 순수. */
export function resample(path: [number, number][], n: number): { lon: number; lat: number; km: number }[] {
  if (path.length < 2) return path.map(([lon, lat]) => ({ lon, lat, km: 0 }));
  const KM = (a: [number, number], b: [number, number]) => {
    const dLat = (b[1] - a[1]) * 111.32;
    const dLon = (b[0] - a[0]) * 111.32 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
    return Math.hypot(dLat, dLon);
  };
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + KM(path[i - 1], path[i]));
  const total = cum[cum.length - 1];
  const out: { lon: number; lat: number; km: number }[] = [];
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < target) i++;
    const t = cum[i] === cum[i - 1] ? 0 : (target - cum[i - 1]) / (cum[i] - cum[i - 1]);
    out.push({
      lon: path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t,
      lat: path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t,
      km: target,
    });
  }
  return out;
}

const tileCache = new Map<string, Promise<ImageData | null>>();

async function loadTile(base: string, z: number, x: number, y: number): Promise<ImageData | null> {
  const key = `${z}/${x}/${y}`;
  if (!tileCache.has(key)) {
    tileCache.set(
      key,
      fetch(`${base}${key}.png`)
        .then(r => (r.ok ? r.blob() : Promise.reject(new Error('404'))))
        .then(createImageBitmap)
        .then(bmp => {
          const c = new OffscreenCanvas(bmp.width, bmp.height);
          const ctx = c.getContext('2d')!;
          ctx.drawImage(bmp, 0, 0);
          return ctx.getImageData(0, 0, bmp.width, bmp.height);
        })
        .catch(() => null),
    );
  }
  return tileCache.get(key)!;
}

/** 경로 고도 단면. 타일이 없는 구간은 null. base는 `.../terrain/` 로 끝나야 한다. */
export async function profile(base: string, meta: TerrainMeta, path: [number, number][], n = 96) {
  const z = Math.min(meta.maxzoom ?? 7, 7);
  const enc = meta.encoding ?? 'terrarium';
  const pts = resample(path, n);
  const tiles = new Map<string, ImageData | null>();
  await Promise.all(
    [...new Set(pts.map(p => { const t = tileOf(p.lon, p.lat, z); return `${t.x},${t.y}`; }))].map(async k => {
      const [x, y] = k.split(',').map(Number);
      tiles.set(k, await loadTile(base, z, x, y));
    }),
  );
  return pts.map(p => {
    const t = tileOf(p.lon, p.lat, z);
    const img = tiles.get(`${t.x},${t.y}`);
    if (!img) return { km: p.km, m: null as number | null };
    const px = Math.min(img.width - 1, Math.floor(t.fx * img.width));
    const py = Math.min(img.height - 1, Math.floor(t.fy * img.height));
    const i = (py * img.width + px) * 4;
    return { km: p.km, m: decodeElev(img.data[i], img.data[i + 1], img.data[i + 2], enc) };
  });
}
