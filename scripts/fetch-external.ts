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

// 지형지물(TASKS 1.7): Pleiades GIS CSV(isawnyu/pleiades-datasets, CC BY 3.0) → 물리 유형만 bbox 클립 → layers/landmarks.geojson (Point, 클릭 객체 P5).
// 본진 pleiades.stoa.org는 컨테이너에서 차단 — GitHub 미러를 쓴다. 이름은 Pleiades 제목(라틴/그리스 표기) 그대로 — 한글화는 정본 place 제안으로(proposals/).
const PLEIADES = 'https://raw.githubusercontent.com/isawnyu/pleiades-datasets/main/data/gis';
const PL = join(CACHE, 'pleiades'); mkdirSync(PL, { recursive: true });
for (const f of ['places', 'places_place_types']) await fetchTo(`${PLEIADES}/${f}.csv`, join(PL, `${f}.csv`));
// lod: 1 = z5부터(산·고개·해협·반도·숲…), 2 = z6(강·호수·곶·섬·만·평원), 3 = z8(나머지)
export const LANDMARK_TYPES: Record<string, { ko: string; lod: 1 | 2 | 3 }> = {
  mountain: { ko: '산', lod: 1 }, pass: { ko: '고개', lod: 1 }, strait: { ko: '해협', lod: 1 }, gulf: { ko: '만', lod: 1 }, isthmus: { ko: '지협', lod: 1 }, peninsula: { ko: '반도', lod: 1 },
  volcano: { ko: '화산', lod: 1 }, forest: { ko: '숲', lod: 1 }, desert: { ko: '사막', lod: 1 }, plateau: { ko: '고원', lod: 1 }, oasis: { ko: '오아시스', lod: 1 },
  river: { ko: '강', lod: 2 }, lake: { ko: '호수', lod: 2 }, cape: { ko: '곶', lod: 2 }, island: { ko: '섬', lod: 2 }, bay: { ko: '만', lod: 2 }, plain: { ko: '평원', lod: 2 }, valley: { ko: '계곡', lod: 2 },
  estuary: { ko: '하구', lod: 2 }, lagoon: { ko: '석호', lod: 2 }, archipelago: { ko: '군도', lod: 2 }, delta: { ko: '삼각주', lod: 2 },
  'water-open': { ko: '해역', lod: 3 }, cave: { ko: '동굴', lod: 3 }, hill: { ko: '언덕', lod: 3 }, spring: { ko: '샘', lod: 3 }, coast: { ko: '해안', lod: 3 }, gorge: { ko: '협곡', lod: 3 },
  rapid: { ko: '여울', lod: 3 }, 'salt-marsh': { ko: '염습지', lod: 3 }, watercourse: { ko: '물길', lod: 3 }, escarpment: { ko: '절벽', lod: 3 },
};
execFileSync('python3', ['-c', `
import csv, json, re
T = ${JSON.stringify(LANDMARK_TYPES)}
types = {}
for r in csv.DictReader(open(${JSON.stringify(join(PL, 'places_place_types.csv'))}, encoding='utf-8-sig')): types.setdefault(r['place_id'], []).append(r['place_type'])
feats = []
for r in csv.DictReader(open(${JSON.stringify(join(PL, 'places.csv'))}, encoding='utf-8-sig')):
    try: lon, lat = float(r['representative_longitude']), float(r['representative_latitude'])
    except ValueError: continue
    if not (${BBOX[0]} <= lon <= ${BBOX[2]} and ${BBOX[1]} <= lat <= ${BBOX[3]}): continue
    ts = [t for t in types.get(r['id'], []) if t in T]
    if not ts: continue
    kind = min(ts, key=lambda t: T[t]['lod'])
    desc = r['description'].strip()
    feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [round(lon, 4), round(lat, 4)]},
      'properties': {'pid': int(r['id']), 'name': re.sub(r'\\s*\\([^)]*\\)\\s*$', '', r['title']), 'kind': kind, 'kind_ko': T[kind]['ko'], 'lod': T[kind]['lod'], 'precision': r['location_precision'],
                     'desc': desc[:240] + ('…' if len(desc) > 240 else ''), 'uri': r['uri']}})
feats.sort(key=lambda f: (f['properties']['lod'], f['properties']['name']))
json.dump({'type': 'FeatureCollection', 'features': feats}, open(${JSON.stringify(join(OUT, 'layers', 'landmarks.geojson'))}, 'w'), ensure_ascii=False, separators=(',', ':'))
print('layer landmarks', len(feats), 'features')
`], { stdio: 'inherit' });

// 영토(TASKS 1.3 · F16 · D5a): Cliopatria(Seshat, CC BY 4.0) 정치체 폴리곤 → 100년 버킷 파일 layers/territory/<from>.geojson (엔진이 연도에 맞춰 지연 로드).
// 전 구간 한 파일은 26MB라 초기 예산(1MB)을 깬다. 버킷당 200~900KB. 정본 팔레트의 세력(actor)으로 매핑, 나머지는 기타중립(회색).
const CLIO_ZIP = join(CACHE, 'cliopatria.geojson.zip');
await fetchTo('https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/main/cliopatria.geojson.zip', CLIO_ZIP);
if (!existsSync(join(CACHE, 'cliopatria.geojson'))) { execFileSync('unzip', ['-o', '-q', '-j', CLIO_ZIP, 'cliopatria_polities_only.geojson', '-d', CACHE]); execFileSync('mv', [join(CACHE, 'cliopatria_polities_only.geojson'), join(CACHE, 'cliopatria.geojson')]); }
// 정치체 이름 → 정본 팔레트 세력. 정규식은 앞에서부터 첫 일치. 없으면 기타중립.
export const ACTOR_OF: [RegExp, string][] = [
  [/^(Roman (Kingdom|Republic|Empire)|Western Roman Empire|Eastern Roman Empire|Byzantine Empire)$/, '로마'],
  [/^Carthage$/, '카르타고'],
  [/Macedon|Seleucid|Ptolemaic|Pontus|Pergam|Epirus|Achaean|Aetolian|Sparta|Athens|Syracuse|Bosporan|Greco-Bactrian|Bithynia|Cappadocia/, '그리스계'],
  [/Numidia|Mauretania/, '누미디아'],
  [/Gaul|Gallic Empire|Arverni|Aedui|Celt|Galatia|Britons/, '갈리아'],
  [/Vandal|Visigoth|Ostrogoth|Frank|Suebi|Burgund|Lombard|Alemanni|Saxon|Goth|Gepid|Thuringi|Bavarii|Angles|Jutes/, '게르만'],
  [/Palmyrene|Britannic Empire|Sertorius|Spartacus/, '반란세력'],
  [/Etrusc|Samnite|Latin League|Sabine|Volsci|Umbri|Lucani|Bruttii/, '이탈리아세력'],
];
export const TERRITORY_BUCKET = 100;
execFileSync('python3', ['-c', `
import json, re, os
A = ${JSON.stringify(ACTOR_OF.map(([re, a]) => [re.source, a]))}
W, S, E, N = ${BBOX.join(', ')}
def bbox(g):
    xs = []; ys = []
    def walk(c):
        if isinstance(c[0], (int, float)): xs.append(c[0]); ys.append(c[1])
        else:
            for x in c: walk(x)
    walk(g['coordinates']); return min(xs), min(ys), max(xs), max(ys)
def actor(name):
    for rx, a in A:
        if re.search(rx, name): return a
    return '기타중립'
keep = []
for f in json.load(open(${JSON.stringify(join(CACHE, 'cliopatria.geojson'))}))['features']:
    p = f['properties']
    if p['Type'] != 'POLITY' or p['Name'].startswith('(') or p['ToYear'] < -800 or p['FromYear'] > 1500 or p['Area'] < 30000: continue
    x0, y0, x1, y1 = bbox(f['geometry'])
    if x1 < W or x0 > E or y1 < S or y0 > N: continue
    def rnd(c):
        return [round(c[0], 2), round(c[1], 2)] if isinstance(c[0], (int, float)) else [rnd(x) for x in c]
    keep.append({'type': 'Feature', 'geometry': {'type': f['geometry']['type'], 'coordinates': rnd(f['geometry']['coordinates'])},
      'properties': {'id': f"territory:{p['Name']}:{p['FromYear']}", 'name': p['Name'], 'actor': actor(p['Name']), 'valid_from': p['FromYear'], 'valid_to': p['ToYear'] + 1,
                     'wikidata': p['Wikidata'], 'area': int(p['Area']), 'src': 'cliopatria', 'confidence': 'medium'}})
out = ${JSON.stringify(join(OUT, 'layers', 'territory'))}; os.makedirs(out, exist_ok=True)
B = ${TERRITORY_BUCKET}; total = 0
for b in range(-800, 1500, B):
    fs = [f for f in keep if f['properties']['valid_from'] < b + B and f['properties']['valid_to'] > b]
    # 큰 나라가 아래, 작은 나라가 위(가려지지 않게)
    fs.sort(key=lambda f: -f['properties']['area'])
    s = json.dumps({'type': 'FeatureCollection', 'features': fs}, ensure_ascii=False, separators=(',', ':'))
    open(f'{out}/{b}.geojson', 'w').write(s); total += len(s)
print('layer territory buckets', len(range(-800, 1500, B)), 'features', len(keep), 'total KB', total // 1024)
`], { stdio: 'inherit' });

// 글리프 PBF: 라벨에 실제 쓰인 문자 범위만 내려받아 public/glyphs/에 둔다(런타임 외부 호출 0).
// ponytail: Pretendard 글리프 자체 빌드(fontnik)는 컨테이너에서 네이티브 빌드 불가 → KlokanTech Noto Sans CJK(OFL)로 시작. DESIGN §1 "Pretendard 글리프"는 River 맥에서 font-maker로 교체.
const GLYPH_SRC = 'https://raw.githubusercontent.com/klokantech/klokantech-gl-fonts/master';
const FONTS = ['KlokanTech Noto Sans CJK Regular', 'KlokanTech Noto Sans CJK Bold'];
const chars = new Set<number>();
for (const f of readdirSync(join(OUT, 'layers')).filter(f => f.endsWith('.geojson'))) {
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
| pleiades/places.csv, places_place_types.csv | Pleiades GIS package (isawnyu/pleiades-datasets, Bagnall·Talbert 외) | CC BY 3.0 — 크레딧 "Pleiades" 필수 | → layers/landmarks.geojson (물리 유형 ${Object.keys(LANDMARK_TYPES).length}종, bbox) |
| cliopatria.geojson.zip | Cliopatria — Seshat Global History Databank (정치체 폴리곤 3400BCE–2024CE) | CC BY 4.0 — 크레딧 "Cliopatria (Seshat)" 필수 | → layers/territory/<100년>.geojson (bbox·면적 3만km² 이상·팔레트 세력 매핑) |
| KlokanTech Noto Sans CJK glyphs | klokantech/klokantech-gl-fonts | OFL | → public/glyphs/ (라벨 사용 범위만) |

생성: scripts/fetch-external.ts · ${new Date().toISOString().slice(0, 10)}
`);
console.log('done');
