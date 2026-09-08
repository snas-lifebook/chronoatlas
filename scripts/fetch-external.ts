// 외부 공개 데이터 → data/external/(원본 캐시, 커밋) → public/datasets/rome/{layers,rasters}/ (bbox 클립·단순화). TASKS 1.6.
// 실행: node --experimental-strip-types scripts/fetch-external.ts   (캐시 있으면 다운로드 생략. 강제: FORCE=1)
// 런타임 외부 호출 0(CONSTITUTION 6-2) — 여기서 구운 파일만 배포된다. 전부 Public Domain(Natural Earth). 라이선스 대장은 LICENSES.md로 같이 생성.
import { existsSync, mkdirSync, writeFileSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..');
const CACHE = join(ROOT, 'data', 'external');
const OUT = join(ROOT, 'public', 'datasets', 'rome');
// DESIGN v3 §1: 서경 15° ~ 동경 65°, 북위 20° ~ 60°
export const BBOX = [-15, 20, 65, 60] as const;

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const NER = 'https://raw.githubusercontent.com/nvkelso/natural-earth-raster/master/50m_rasters';

// out: layers/<out>.geojson. simplify: mapshaper 비율(작을수록 단순). props: 남길 속성.
const VECTORS: { id: string; out: string; simplify: string; props: string; dissolve?: string }[] = [
  { id: 'ne_10m_land', out: 'land', simplify: '12%', props: '' },
  { id: 'ne_10m_coastline', out: 'coast', simplify: '12%', props: '' },
  { id: 'ne_10m_rivers_lake_centerlines', out: 'rivers', simplify: '25%', props: 'name,scalerank,min_zoom' },
  { id: 'ne_10m_lakes', out: 'lakes', simplify: '25%', props: 'name,scalerank,min_zoom' },
  { id: 'ne_10m_glaciated_areas', out: 'glaciers', simplify: '25%', props: '' },
  { id: 'ne_10m_geography_marine_polys', out: 'marine_labels', simplify: '10%', props: 'name,scalerank,featurecla', dissolve: 'name' },
  { id: 'ne_10m_geography_regions_polys', out: 'region_labels', simplify: '10%', props: 'NAME,SCALERANK,FEATURECLA,REGION', dissolve: 'NAME' },
];
// 수심 다각형(NE 10m bathymetry): 글자 = 등심선. 지중해 최대 ~5,000m.
const BATHY = [['L', 0], ['K', 200], ['J', 1000], ['I', 2000], ['H', 3000], ['G', 4000], ['F', 5000]] as const;

mkdirSync(CACHE, { recursive: true }); mkdirSync(join(OUT, 'layers'), { recursive: true }); mkdirSync(join(OUT, 'rasters'), { recursive: true });

async function fetchTo(url: string, file: string) {
  if (existsSync(file) && !process.env.FORCE) return;
  const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  console.log('fetched', file.split('/').pop(), Math.round(statSync(file).size / 1024), 'KB');
}
const bbox = BBOX.join(',');
const mapshaper = (args: string[]) => execFileSync('npx', ['--yes', 'mapshaper', ...args], { stdio: ['ignore', 'ignore', 'inherit'] });

for (const v of VECTORS) {
  const src = join(CACHE, `${v.id}.geojson`);
  await fetchTo(`${NE}/${v.id}.geojson`, src);
  const out = join(OUT, 'layers', `${v.out}.geojson`);
  // 속성명은 파일마다 대소문자가 다르다(regions는 대문자). 소문자로 통일해 내보낸다.
  const rename = v.props ? ['-rename-fields', v.props.split(',').map(f => `${f.toLowerCase()}=${f}`).filter(x => !/^(\w+)=\1$/.test(x)).join(',')].filter(a => a !== '') : [];
  // dissolve: 클립으로 조각난 같은 이름(ALPS×2)을 하나로 — 라벨 중복 방지
  const dissolve = v.dissolve ? ['-dissolve', v.dissolve, `copy-fields=${v.props.split(',').filter(f => f !== v.dissolve).join(',')}`] : [];
  mapshaper([src, '-clip', `bbox=${bbox}`, '-simplify', v.simplify, 'keep-shapes', ...(v.props ? ['-filter-fields', v.props] : ['-drop', 'fields=*', '-each', 'k=1'] /* 속성 0이면 GeometryCollection으로 나와서 더미 1개 */), ...dissolve, ...(rename.length === 2 && rename[1] ? rename : []), '-o', out, 'precision=0.0005', 'format=geojson']);
  console.log('layer', v.out, Math.round(statSync(out).size / 1024), 'KB');
}

// 수심: 7개 파일 → depth 속성 붙여 한 컬렉션
const bathyParts: string[] = [];
for (const [letter, depth] of BATHY) {
  const id = `ne_10m_bathymetry_${letter}_${depth}`;
  const src = join(CACHE, `${id}.geojson`);
  await fetchTo(`${NE}/${id}.geojson`, src);
  const part = join(CACHE, `_bathy_${depth}.geojson`);
  mapshaper([src, '-clip', `bbox=${bbox}`, '-simplify', '10%', 'keep-shapes', '-each', `depth=${depth}`, '-filter-fields', 'depth', '-o', part, 'precision=0.001', 'format=geojson']);
  bathyParts.push(part);
}
mapshaper(['-i', ...bathyParts, 'combine-files', '-merge-layers', '-o', join(OUT, 'layers', 'bathy.geojson'), 'format=geojson']);
console.log('layer bathy', Math.round(statSync(join(OUT, 'layers', 'bathy.geojson')).size / 1024), 'KB');

// 음영기복: NE SR_50M(수동 shaded relief, PD) 전지구 등장방형 TIF → bbox 크롭 PNG. MapLibre image 소스 4모서리 = BBOX.
// ponytail: Mapterhorn DEM 타일(hillshade 실계산·지형 과장)은 컨테이너에서 못 받는다 — River 맥에서 pmtiles extract 후 교체(TASKS 1.6 후반).
const tif = join(CACHE, 'SR_50M.tif');
await fetchTo(`${NER}/SR_50M/SR_50M.tif`, tif);
execFileSync('python3', ['-c', `
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
im=Image.open(${JSON.stringify(tif)}); W,H=im.size
x0=int((${BBOX[0]}+180)/360*W); x1=int((${BBOX[2]}+180)/360*W); y0=int((90-${BBOX[3]})/180*H); y1=int((90-${BBOX[1]})/180*H)
from PIL import ImageOps
# 육지 톤으로 착색(DESIGN --map-land #EEF0EC 기준: 밝은 곳 #F1F2EE, 그늘 #7A7E76). 바다는 bathy 폴리곤이 위에서 덮는다.
ImageOps.colorize(im.crop((x0,y0,x1,y1)).convert('L'), black='#7A7E76', white='#F1F2EE').save(${JSON.stringify(join(OUT, 'rasters', 'relief.jpg'))}, quality=82, optimize=True)
print('raster relief', x1-x0, 'x', y1-y0)
`], { stdio: 'inherit' });

// 글리프 PBF: 라벨에 실제 쓰인 문자 범위만 내려받아 public/glyphs/에 둔다(런타임 외부 호출 0).
// ponytail: Pretendard 글리프 자체 빌드(fontnik)는 컨테이너에서 네이티브 빌드 불가 → KlokanTech Noto Sans CJK(OFL)로 시작. DESIGN §1 "Pretendard 글리프"는 River 맥에서 font-maker로 교체.
const GLYPH_SRC = 'https://raw.githubusercontent.com/klokantech/klokantech-gl-fonts/master';
const FONTS = ['KlokanTech Noto Sans CJK Regular', 'KlokanTech Noto Sans CJK Bold'];
const chars = new Set<number>();
for (const f of readdirSync(join(OUT, 'layers'))) {
  const g = JSON.parse(readFileSync(join(OUT, 'layers', f), 'utf8'));
  for (const ft of g.features ?? []) for (const [k, v] of Object.entries(ft.properties ?? {})) if (/name/.test(k) && typeof v === 'string') for (const ch of v) chars.add(ch.codePointAt(0)!);
}
for (const ch of ' 0123456789BCAD기원전서년·—-–,.()\'') chars.add(ch.codePointAt(0)!);
const ranges = [...new Set([...chars].map(c => Math.floor(c / 256) * 256))].sort((a, b) => a - b);
for (const font of FONTS) {
  const dir = join(ROOT, 'public', 'glyphs', font); mkdirSync(dir, { recursive: true });
  for (const r of ranges) await fetchTo(`${GLYPH_SRC}/${encodeURIComponent(font)}/${r}-${r + 255}.pbf`, join(dir, `${r}-${r + 255}.pbf`));
}
console.log('glyphs', ranges.length, 'ranges ×', FONTS.length);

writeFileSync(join(CACHE, 'LICENSES.md'), `# data/external — 출처·라이선스 대장

| 파일 | 출처 | 라이선스 | 비고 |
|---|---|---|---|
${VECTORS.map(v => `| ${v.id}.geojson | Natural Earth 10m (nvkelso/natural-earth-vector) | Public Domain | → layers/${v.out}.geojson, bbox ${bbox} |`).join('\n')}
${BATHY.map(([l, d]) => `| ne_10m_bathymetry_${l}_${d}.geojson | Natural Earth 10m | Public Domain | → layers/bathy.geojson depth=${d} |`).join('\n')}
| SR_50M.tif | Natural Earth 50m Shaded Relief (nvkelso/natural-earth-raster) | Public Domain | → rasters/relief.jpg (image 소스). Mapterhorn 교체 예정 |

생성: scripts/fetch-external.ts · ${new Date().toISOString().slice(0, 10)}
`);
console.log('done');
