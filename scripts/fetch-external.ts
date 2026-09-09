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

// 음영기복: NE 10m GRAY_HR_SR_OB_DR(Gray Earth — 음영 + 하계망 각인 + 해저, PD). 21600×10800 → bbox 크롭 4800×2400(≈1.85km/px).
// SR_50M(10800×5400)에서 올렸다 — 알프스·아펜니노 능선과 강 골짜기가 실제로 읽힌다. 해저 부분은 위의 bathy 폴리곤이 덮는다.
// ponytail: 진짜 기하 3D(raster-dem + setTerrain)는 DEM 타일이 필요한데 샌드박스·맥 둘 다 egress 차단 — public/terrain/ 에 타일을 두면 엔진이 자동으로 켠다(engine.ts TERRAIN).
const tif = join(CACHE, 'GRAY_HR_SR_OB_DR.tif');
await fetchTo(`${NER.replace('50m_rasters', '10m_rasters')}/GRAY_HR_SR_OB_DR/GRAY_HR_SR_OB_DR.tif`, tif);
execFileSync('python3', ['-c', `
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
im=Image.open(${JSON.stringify(tif)}); W,H=im.size
x0=int((${BBOX[0]}+180)/360*W); x1=int((${BBOX[2]}+180)/360*W); y0=int((90-${BBOX[3]})/180*H); y1=int((90-${BBOX[1]})/180*H)
from PIL import ImageOps, ImageChops, ImageFilter
# 육지 톤으로 착색. 바다는 bathy 폴리곤이 위에서 덮는다.
# Gray Earth엔 저지대를 어둡게 칠하는 계조가 섞여 있다(이탈리아가 시커멓게 나온다) — 넓은 계조(가우시안 24px)를 빼고
# 고주파만 1.6배 남긴다. 능선·하계망 각인은 살고 바탕은 균일해진다.
g = im.crop((x0,y0,x1,y1)).convert('L')
g = ImageChops.subtract(g, g.filter(ImageFilter.GaussianBlur(24)), 0.625, 205)
ImageOps.colorize(g, black='#6E7268', white='#F6F7F3').save(${JSON.stringify(join(OUT, 'rasters', 'relief.jpg'))}, quality=80, optimize=True, progressive=True)
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
// 정치체 한글 이름(라벨용). 없으면 원문(라틴·영문) 그대로 — 지어내지 않는다. 상위 130개 + 쇠망사 관련.
export const TERRITORY_KO: Record<string, string> = {
 "Roman Kingdom": "로마 왕정",
 "Roman Republic": "로마 공화정",
 "Roman Empire": "로마 제국",
 "Western Roman Empire": "서로마 제국",
 "Eastern Roman Empire": "동로마 제국",
 "Byzantine Empire": "비잔티움 제국",
 "Gallic Empire": "갈리아 제국",
 "Palmyrene Empire": "팔미라 제국",
 "Carthage": "카르타고",
 "Kingdom of Numidia": "누미디아 왕국",
 "Mauretania": "마우레타니아",
 "Macedonian Empire": "마케도니아 제국",
 "Antigonid Macedonia": "안티고노스 마케도니아",
 "Seleucid Empire": "셀레우코스 제국",
 "Ptolemaic Kingdom": "프톨레마이오스 왕국",
 "Kingdom of Pontus": "폰토스 왕국",
 "Kingdom of Cappadocia": "카파도키아 왕국",
 "Kingdom of Armenia": "아르메니아 왕국",
 "Galatia": "갈라티아",
 "Thracian Kingdom": "트라키아 왕국",
 "Judea": "유대",
 "Nabataeans": "나바테아",
 "Kingdom of Lysimachus": "리시마코스 왕국",
 "Greco-Bactrian Kingdom": "그레코박트리아 왕국",
 "Indo-Greeks": "인도그리스",
 "Bosporan Kingdom": "보스포로스 왕국",
 "Achaemenid Empire": "아케메네스 페르시아",
 "Median Kingdom": "메디아 왕국",
 "Parthian Empire": "파르티아 제국",
 "Sasanian Empire": "사산조 페르시아",
 "Indo-Sasanian Empire": "인도사산",
 "Kushan Empire": "쿠샨 제국",
 "Neo-Assyrian Empire": "신아시리아 제국",
 "Neo-Babylonian Empire": "신바빌로니아 제국",
 "Assyrian Egypt": "아시리아령 이집트",
 "Kingdom of Kush": "쿠시 왕국",
 "Scythia": "스키타이",
 "Indo-Scythians": "인도스키타이",
 "Yuezhi": "월지",
 "Huns": "훈족",
 "Hunnic Empire": "훈 제국",
 "White Huns": "백훈(에프탈)",
 "Xionites": "키오니타이",
 "Kidarites": "키다라",
 "Avar Khaganate": "아바르 칸국",
 "Magyars": "마자르",
 "Vandals": "반달족",
 "Vandal Kingdom": "반달 왕국",
 "Visigoths": "서고트족",
 "Visigothic Kingdom": "서고트 왕국",
 "Ostrogoths": "동고트족",
 "Ostrogothic Kingdom": "동고트 왕국",
 "Gothia": "고티아",
 "Burgundian Kingdom": "부르군트 왕국",
 "Kingdom of Alamannia": "알라마니아 왕국",
 "Kingdom of Soissons": "수아송 왕국",
 "Kingdom of the Franks": "프랑크 왕국",
 "West Franks": "서프랑크",
 "East Franks": "동프랑크",
 "Middle Franks": "중프랑크",
 "Ripuarian Franks": "리푸아리아 프랑크",
 "Salian Franks": "살리 프랑크",
 "Carolingian Empire": "카롤루스 제국",
 "Kingdom of Germany": "독일 왕국",
 "Holy Roman Empire": "신성로마제국",
 "Holy Roman Empire Minor States": "신성로마제국 소국",
 "Rashidun Caliphate": "정통 칼리프국",
 "Umayyad Caliphate": "우마이야 칼리프국",
 "Abbasid Caliphate": "아바스 칼리프국",
 "Fatimid Caliphate": "파티마 칼리프국",
 "Emirate of Córdoba": "코르도바 토후국",
 "Caliphate of Córdoba": "코르도바 칼리프국",
 "Almoravid Dynasty": "무라비트 왕조",
 "Almohad Caliphate": "무와히드 칼리프국",
 "Marinid Sultanate": "마린 술탄국",
 "Wattasid dynasty": "와타스 왕조",
 "Rustamid dynasty": "루스탐 왕조",
 "Tulunids": "툴룬 왕조",
 "Hamdanid Emirates": "함단 토후국",
 "Ayyubid Sultanate": "아이유브 술탄국",
 "Mamluk Sultanate": "맘루크 술탄국",
 "Zengid dynasty": "장기 왕조",
 "Buyid Dynasty": "부와이 왕조",
 "Samanid Empire": "사만 왕조",
 "Saffarid Dynasty": "사파르 왕조",
 "Ghaznavid Empire": "가즈나 왕조",
 "Ghurid Dynasty": "구르 왕조",
 "Great Seljuk Empire": "셀주크 제국",
 "Seljuk Dynasty": "셀주크 왕조",
 "Khwarezmid Empire": "호라즘 제국",
 "Khwarezmid Dynasty": "호라즘 왕조",
 "Ottoman Empire": "오스만 제국",
 "Aq Qoyunlu": "백양 왕조",
 "Qara Qoyunlu": "흑양 왕조",
 "Timurid Empire": "티무르 제국",
 "Mongol Empire": "몽골 제국",
 "Golden Horde": "킵차크 칸국",
 "Ilkhanate": "일 칸국",
 "Chagatai Khanate": "차가타이 칸국",
 "White Horde": "백장 칸국",
 "Blue Horde": "청장 칸국",
 "Nogai Horde": "노가이 칸국",
 "Khanate of Sibir": "시비르 칸국",
 "Kazakh Khanate": "카자흐 칸국",
 "Göktürk Khaganate": "돌궐",
 "Western Göktürks": "서돌궐",
 "Türgesh": "튀르기시",
 "Khazaria": "하자르",
 "Kimek-Kipchak confederation": "키메크·킵차크",
 "Kara-Khitans": "서요(카라키타이)",
 "Kara-Khanids": "카라한",
 "Western Karakhanid Khanate": "서카라한",
 "Kievan Rus'": "키예프 루스",
 "Rus'": "루스",
 "Novgorod Republic": "노브고로드 공화국",
 "Grand Principality of Moscow": "모스크바 대공국",
 "Grand Duchy of Lithuania": "리투아니아 대공국",
 "Halych-Volhynia occupation": "할리치·볼히니아",
 "First Bulgarian Empire": "제1차 불가리아 제국",
 "Kingdom of Hungary": "헝가리 왕국",
 "Principality of Hungary": "헝가리 공국",
 "Kingdom of Poland": "폴란드 왕국",
 "Kalmar Union": "칼마르 동맹",
 "North Sea Empire": "북해 제국",
 "Kingdom of France": "프랑스 왕국",
 "Kingdom of Sweden": "스웨덴 왕국",
 "Old Kingdom of Norway": "노르웨이 왕국",
 "Norway-Denmark": "노르웨이·덴마크",
 "Crown of Castile": "카스티야 왕국",
 "Angevin Empire": "앙주 제국",
 "Aquitaine": "아키텐",
 "House of Habsburg": "합스부르크가",
 "House of Jagiellon": "야기에우워가",
 "House of Oldenburg": "올덴부르크가",
 "Jalayirid Sultanate": "잘라이르 술탄국",
 "Muzaffarids": "무자파르 왕조",
 "Sarbadars": "사르베다르",
 "Kartids": "카르트 왕조",
 "Shaybanids": "샤이반 왕조",
 "Maurya Empire": "마우리아 제국",
 "Tang Dynasty": "당",
 "Turks": "투르크",
 "Oghuz Turks": "오구즈 투르크",
 "Western Kushans": "서쿠샨",
 "Scandinavian minor kingdoms": "스칸디나비아 소왕국",
 "Thirtieth Dynasty of Egypt": "이집트 제30왕조",
 "Twenty-sixth Dynasty of Egypt": "이집트 제26왕조",
 "Abbasid Caliphate/Buyid Dynasty": "아바스·부와이"
};
export const TERRITORY_BUCKET = 100;
execFileSync('python3', ['-c', `
import json, re, os
A = ${JSON.stringify(ACTOR_OF.map(([re, a]) => [re.source, a]))}
KO = ${JSON.stringify(TERRITORY_KO)}
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
    geom = {'type': f['geometry']['type'], 'coordinates': rnd(f['geometry']['coordinates'])}
    keep.append({'type': 'Feature', 'geometry': geom,
      'properties': {'id': f"territory:{p['Name']}:{p['FromYear']}", 'name': KO.get(p['Name'], p['Name']), 'name_en': p['Name'], 'actor': actor(p['Name']), 'valid_from': p['FromYear'], 'valid_to': p['ToYear'] + 1,
                     'wikidata': p['Wikidata'], 'area': int(p['Area']), 'src': 'cliopatria', 'confidence': 'medium'}})
# 라벨 앵커: MultiPolygon이면 부분마다 라벨이 붙는다 — 가장 큰 부분의 무게중심 Point 하나를 같은 파일에 넣고 심볼 레이어는 Point만 그린다.
def ring_centroid(ring):
    a = cx = cy = 0.0
    for i in range(len(ring) - 1):
        x0, y0 = ring[i][0], ring[i][1]; x1, y1 = ring[i + 1][0], ring[i + 1][1]
        cr = x0 * y1 - x1 * y0; a += cr; cx += (x0 + x1) * cr; cy += (y0 + y1) * cr
    if abs(a) < 1e-12:
        xs = [c[0] for c in ring]; ys = [c[1] for c in ring]; return [sum(xs) / len(xs), sum(ys) / len(ys)], 0.0
    return [cx / (3 * a), cy / (3 * a)], abs(a) / 2
def anchor(g):
    parts = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    best = None
    for poly in parts:
        c, a = ring_centroid(poly[0])
        if best is None or a > best[1]: best = (c, a)
    return best[0]
labels = [{'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [round(v, 3) for v in anchor(f['geometry'])]},
           'properties': {**f['properties'], 'id': f['properties']['id'] + ':label'}} for f in keep]
keep = keep + labels
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

// 기하 3D 지형(선택): TERRAIN=1 로 켠다. AWS Terrain Tiles(terrarium, ODbL/PD 혼합 — SRTM·GMTED·ETOPO 등)를 bbox·z0~7만 받아
// public/datasets/rome/terrain/{z}/{x}/{y}.png 로 둔다(런타임 외부 호출 0). 샌드박스에선 egress가 막혀 있어 실패한다 — 로컬 터미널에서 돌릴 것.
// 예: TERRAIN=1 npm run fetch-external     (~730타일 · 약 20MB · z8+는 MapLibre가 오버줌)
if (process.env.TERRAIN) {
  const TERRAIN_MAX = Number(process.env.TERRAIN_MAX ?? 7);
  const TDIR = join(OUT, 'terrain');
  const lat2y = (lat: number, n: number) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  let got = 0, miss = 0;
  for (let z = 0; z <= TERRAIN_MAX; z++) {
    const n = 2 ** z;
    const x0 = Math.floor((BBOX[0] + 180) / 360 * n), x1 = Math.floor((BBOX[2] + 180) / 360 * n);
    const y0 = lat2y(BBOX[3], n), y1 = lat2y(BBOX[1], n);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const f = join(TDIR, String(z), String(x), `${y}.png`);
      if (existsSync(f)) { got++; continue; }
      mkdirSync(join(TDIR, String(z), String(x)), { recursive: true });
      try {
        const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`);
        if (!r.ok) { miss++; continue; }
        writeFileSync(f, Buffer.from(await r.arrayBuffer())); got++;
      } catch { miss++; }
    }
    console.log('terrain z', z, 'ok', got, 'miss', miss);
  }
  writeFileSync(join(TDIR, 'meta.json'), JSON.stringify({ encoding: 'terrarium', maxzoom: TERRAIN_MAX, exaggeration: 1.4, credit: 'AWS Terrain Tiles (Mapzen/Tilezen) — SRTM·GMTED2010·ETOPO1 외' }));
  console.log('terrain tiles', got, 'missing', miss, '→ npm run adapt 로 manifest.terrain 갱신');
}

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
| GRAY_HR_SR_OB_DR.tif | Natural Earth 10m Gray Earth — 음영·하계망·해저 (nvkelso/natural-earth-raster) | Public Domain | → rasters/relief.jpg 4800×2400 (image 소스). 기하 3D DEM은 미확보 |
| pleiades/places.csv, places_place_types.csv | Pleiades GIS package (isawnyu/pleiades-datasets, Bagnall·Talbert 외) | CC BY 3.0 — 크레딧 "Pleiades" 필수 | → layers/landmarks.geojson (물리 유형 ${Object.keys(LANDMARK_TYPES).length}종, bbox) |
| cliopatria.geojson.zip | Cliopatria — Seshat Global History Databank (정치체 폴리곤 3400BCE–2024CE) | CC BY 4.0 — 크레딧 "Cliopatria (Seshat)" 필수 | → layers/territory/<100년>.geojson (bbox·면적 3만km² 이상·팔레트 세력 매핑) |
| terrarium 타일(선택, TERRAIN=1) | AWS Terrain Tiles — Mapzen/Tilezen (SRTM·GMTED2010·ETOPO1 등) | 출처별 상이(PD·CC BY·ODbL) — 크레딧 표기 | → public/datasets/rome/terrain/ (기하 3D). 커밋 전 라이선스 확인 |
| KlokanTech Noto Sans CJK glyphs | klokantech/klokantech-gl-fonts | OFL | → public/glyphs/ (라벨 사용 범위만) |

생성: scripts/fetch-external.ts · ${new Date().toISOString().slice(0, 10)}
`);
console.log('done');
