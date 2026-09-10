// 정본 온톨로지(JSONL) → datasets/rome/ (F1). 실행: ONTOLOGY_DIR=<볼트 ontology 경로> node --experimental-strip-types scripts/adapt.ts
// 산출물은 커밋한다(정적 배포·CI는 볼트를 못 읽는다). 손으로 고치지 않는다 — CONSTITUTION 0-1.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Entity, Link, idType } from '../schema/ontology.ts';
import { parseYear } from './year.ts';

const DIRFILE = join(import.meta.dirname, '..', 'data', 'ontology-dir.txt'); // 한 번 적어두면 매번 환경변수를 안 써도 된다(gitignore)
const SRC = process.env.ONTOLOGY_DIR ?? (existsSync(DIRFILE) ? readFileSync(DIRFILE, 'utf8').trim() : undefined);
if (!SRC) throw new Error('ONTOLOGY_DIR 필요 — 환경변수로 주거나 data/ontology-dir.txt 에 정본 ontology/ 폴더 경로 한 줄');
const OUT = join(import.meta.dirname, '..', 'public', 'datasets', 'rome');
mkdirSync(join(OUT, 'layers'), { recursive: true });
mkdirSync(join(OUT, 'entities'), { recursive: true });

const jsonl = (p: string) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const entities = jsonl(join(SRC, 'entities.jsonl')).map(e => Entity.parse(e));
const links = jsonl(join(SRC, 'links.jsonl')).map(l => Link.parse(l));
const byId = new Map(entities.map(e => [e.id, e]));

// 좌표: ontology/_geo/places_*.jsonl (name 키, [lat, lon]) → [lon, lat]로 뒤집는다. 최대 버그원.
const geo = new Map<string, any>();
const geoDir = join(SRC, '_geo');
if (existsSync(geoDir)) for (const f of readdirSync(geoDir).filter(f => /^places_.*\.jsonl$/.test(f)))
  for (const p of jsonl(join(geoDir, f))) geo.set(p.name.normalize('NFC'), p);

// 세력 팔레트(룬델 정본)와 레지스트리(엔티티→세력·에셋). 없으면 없는 대로.
const palette = existsSync(join(SRC, '팔레트.json')) ? JSON.parse(readFileSync(join(SRC, '팔레트.json'), 'utf8')).factions : {};
const registry = new Map<string, any>();
if (existsSync(join(SRC, '_registry.csv'))) {
  const [head, ...rows] = readFileSync(join(SRC, '_registry.csv'), 'utf8').split('\n').filter(Boolean);
  const cols = head.split(',');
  for (const r of rows) { const v = r.split(','); registry.set(v[0], Object.fromEntries(cols.map((c, i) => [c, v[i] ?? '']))); }
}

// 레지스트리 asset(관계분석 components 상대경로) → 웹 경로. 원본 PNG는 public/assets/{portraits,icons}/*.webp로 축소 복사돼 있다(0.6).
const webAsset = (a?: string) => !a ? null : a.includes('_초상_1x1/') ? `assets/portraits/${a.split('/').pop()!.replace(/\.png$/, '.webp')}` : `assets/icons/${a.split('/').pop()!.replace(/\.png$/, '.webp')}`;

// parseYear는 scripts/year.ts로 뺐다 — 테스트가 붙어야 하는 함수였다(정본이 멀쩡한데 연도를 지어내고 있었다).

// ---- graph.json: 노드·엣지 원본 그대로 + 인접 인덱스. Sigma/Graphology·MCP·린트가 읽는다.
const nodes = entities.map(e => {
  const g = geo.get(e.name.normalize('NFC'));
  const reg = registry.get(e.id);
  return {
    id: e.id, type: e.type, name: e.name, aliases: e.aliases, points: e.points, src: e.src, ext: e.ext, attrs: e.attrs, history: e.history ?? [],
    born: e.type === 'person' ? parseYear(e.attrs.born ?? e.attrs.birth) : null,
    died: e.type === 'person' ? parseYear(e.attrs.died ?? e.attrs.death) : null,
    year: e.type === 'event' ? parseYear(e.attrs.year ?? e.attrs.date ?? e.attrs.period) : null,
    lonlat: g ? [g.lon, g.lat] : (e.location ?? null),
    faction: reg?.faction || null, asset: webAsset(reg?.asset), tier: reg?.tier || null,
    confidence: e.confidence ?? g?.confidence ?? null,
    desc: e.desc ?? e.descs[0]?.desc ?? '',
  };
});
const adjacency: Record<string, number[]> = {};
links.forEach((l, i) => { (adjacency[l.from] ??= []).push(i); (adjacency[l.to] ??= []).push(i); });
writeFileSync(join(OUT, 'graph.json'), JSON.stringify({ nodes, edges: links, adjacency }));

// ---- QC(F18): 사람이 고칠 목록. 고아·연도 미상·좌표 없음·동명이인 후보. 앱 `?qc=1` 카드와 proposals 작성이 읽는다.
const norm = (v: string) => v.normalize('NFC').replace(/\s+/g, '').toLowerCase();
const byName = new Map<string, string[]>();
for (const n of nodes) for (const a of [n.name, ...n.aliases]) (byName.get(norm(a)) ?? byName.set(norm(a), []).get(norm(a))!).push(n.id);
const qc = {
  orphan: nodes.filter(n => !adjacency[n.id]?.length).map(n => n.id),
  undated: nodes.filter(n => (n.type === 'person' && n.born == null && n.died == null) || (n.type === 'event' && n.year == null)).map(n => n.id),
  nocoord: nodes.filter(n => n.type === 'place' && !n.lonlat).map(n => n.id),
  homonym: [...byName.entries()].filter(([, ids]) => new Set(ids).size > 1).map(([name, ids]) => ({ name, ids: [...new Set(ids)] })),
  low: nodes.filter(n => n.confidence === 'low').map(n => n.id),
};
writeFileSync(join(OUT, 'qc.json'), JSON.stringify(qc, null, 1));
console.log('qc:', Object.fromEntries(Object.entries(qc).map(([k, v]) => [k, v.length])));

// ---- layers/settlements.geojson: 좌표 있는 place 전부. rank = 등장 포인트 수로 LOD.
const settlements = nodes.filter(n => n.type === 'place' && n.lonlat).map(n => {
  const g = geo.get(n.name.normalize('NFC')) ?? {};
  const rank = n.points.length >= 6 ? 1 : n.points.length >= 3 ? 2 : 3;
  return { type: 'Feature', properties: { id: n.id, layer: 'settlements', name_ko: n.name, name_ancient: g.ancient ?? null, name_modern: g.modern ?? null,
    kind: g.kind ?? null, rank, minzoom: rank === 1 ? 0 : rank === 2 ? 4 : 6,
    // R25 회귀 복구: 자원·지형은 구 데이터셋(rome-753-218)의 10개 도시에만 있던 값이다. 정본엔 없었다 —
    // 어댑터 이식 누락이 아니라 애초에 손으로 넣은 값이었다. proposals/20260911_place_resource_terrain_7.jsonl로
    // 정본에 올리자고 제안했고, 승인되면 이 두 줄이 그대로 실어 나른다(없으면 null이라 지금은 무해하다).
    resource: (n.attrs?.resource as string | undefined) ?? null, terrain: (n.attrs?.terrain as string | undefined) ?? null,
    source: 'book+web', confidence: n.confidence ?? 'medium', src: n.src },
    geometry: { type: 'Point', coordinates: n.lonlat } };
});
writeFileSync(join(OUT, 'layers', 'settlements.geojson'), JSON.stringify({ type: 'FeatureCollection', features: settlements }));

// ---- layers/battles.geojson: event → occurred_at → place 좌표. 연도는 링크 from_year > event.year.
// 여러 해에 걸친 전쟁은 occurred_at 링크가 여럿이다(제2차포에니전쟁 = 로마 + 카르타고). 링크마다 점을 찍되
// 피처 id는 유일해야 한다 — 지도가 promoteId로 쓰기 때문에 id가 같으면 한쪽에 마우스를 올렸을 때
// 멀리 떨어진 다른 쪽도 같이 커진다(도시 레이어에서 한 번 터졌던 것과 같은 버그다).
// 선택·이웃 강조가 쓰는 사건 id는 entity로 따로 싣고, 두 번째 점부터 #n을 붙인다.
const evSeen = new Map<string, number>();
const battles = links.filter(l => l.rel === 'occurred_at').flatMap(l => {
  const ev = byId.get(l.from), pl = nodes.find(n => n.id === l.to);
  const year = l.from_year ?? (ev && parseYear(ev.attrs.year ?? ev.attrs.date ?? ev.attrs.period));
  if (!ev || ev.type !== 'event' || !pl?.lonlat || year == null) return [];
  const nth = (evSeen.get(ev.id) ?? 0) + 1; evSeen.set(ev.id, nth);
  // 사건 점은 발생 후 30년 창 안에서만 보인다(영구 표시하면 후대 지도가 옛 전투로 덮인다). 검색·인스펙터로는 언제나.
  return [{ type: 'Feature', properties: { id: nth === 1 ? ev.id : `${ev.id}#${nth}`, entity: ev.id, layer: 'battles', name_ko: ev.name, year, valid_from: year, valid_to: year + 30, place: pl.id,
    source: 'book', confidence: l.confidence ?? 'medium', src: l.src }, geometry: { type: 'Point', coordinates: pl.lonlat } }];
});
writeFileSync(join(OUT, 'layers', 'battles.geojson'), JSON.stringify({ type: 'FeatureCollection', features: battles }));

// ---- 이동경로·속주(0.5): 정본 ontology/_routes/*.geojson. 연도 있는 Point ≥ 2 + LineString → movements 세그먼트(도착 연도부터 보임, 토큰은 세그먼트 끝점).
// Polygon → admin_regions(설명의 '기원전 NNN년'이 valid_from). 세력은 경로 이름에 들어간 정본 객체의 faction. 강 같은 무연도 선은 베이스맵 몫 — 건너뛴다.
const movements: any[] = [], admin: any[] = [];
const routesDir = join(SRC, '_routes');
if (existsSync(routesDir)) for (const file of readdirSync(routesDir).filter(f => f.endsWith('.geojson'))) {
  const route = file.replace(/\.geojson$/, '');
  const fc = JSON.parse(readFileSync(join(routesDir, file), 'utf8'));
  const feats: any[] = fc.features ?? [];
  const title: string = feats.find(f => f.geometry.type === 'LineString')?.properties?.name ?? route;
  const owner = nodes.find(n => n.type === 'person' && title.startsWith(n.name)) ?? nodes.find(n => title.includes(n.name));
  const actor = owner?.faction ?? '기타중립';
  const stops = feats.filter(f => f.geometry.type === 'Point' && typeof f.properties?.year === 'number').sort((a, b) => a.properties.year - b.properties.year);
  // 원정이 끝나고 한 세대(10년) 뒤엔 지도에서 걷는다 — 안 그러면 AD 476 지도에 카이사르 행군로가 남는다.
  const routeEnd = (stops.at(-1)?.properties.year ?? 0) + 10;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i];
    movements.push({ type: 'Feature', properties: { id: `${route}@${i - 1}`, layer: 'movements', route, name_ko: title, actor, label: b.properties.name, from_year: a.properties.year, to_year: b.properties.year,
      valid_from: b.properties.year, valid_to: routeEnd, source: 'book', confidence: b.properties.confidence ?? 'medium', owner: owner?.id ?? null },
      geometry: { type: 'LineString', coordinates: [a.geometry.coordinates, b.geometry.coordinates] } });
  }
  const bc = (t: string) => { const m = /기원전\s*(\d+)/.exec(t ?? ''); return m ? -Number(m[1]) : null; };
  const routeFrom = stops[0]?.properties.year ?? null;
  for (const f of feats.filter(f => /Polygon/.test(f.geometry.type))) {
    const name: string = (f.properties?.name ?? '').split(' — ').pop();
    admin.push({ type: 'Feature', properties: { id: `admin:${route}:${name}`, layer: 'admin_regions', name_ko: name, name: name, actor, route,
      // 연도 근거가 없으면 열린 구간 + low — 지어내지 않는다(CONSTITUTION). 설명의 '[대략]'도 low.
      valid_from: bc(f.properties?.description) ?? routeFrom ?? null, valid_to: 1000000, confidence: bc(f.properties?.description) ? (f.properties?.confidence ?? 'medium') : 'low', source: 'book' }, geometry: f.geometry });
  }
}
writeFileSync(join(OUT, 'layers', 'movements.geojson'), JSON.stringify({ type: 'FeatureCollection', features: movements }));
writeFileSync(join(OUT, 'layers', 'admin_regions.geojson'), JSON.stringify({ type: 'FeatureCollection', features: admin }));
console.log('routes:', movements.length, 'segments,', admin.length, 'admin regions');
// territory: 버킷(fetch-external, Cliopatria)이 있으면 엔진이 지연 로드 — 한 파일은 빈 컬렉션 자리만.
if (!existsSync(join(OUT, 'layers', 'territory.geojson'))) writeFileSync(join(OUT, 'layers', 'territory.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [] }));

// ---- 베이스맵 레이어는 scripts/fetch-external.ts가 만든다(NE 10m·relief). 여기선 있는지 확인만 — manifest.basemap.
const BASEMAP = ['land', 'coast', 'rivers', 'lakes', 'glaciers', 'bathy', 'marine_labels', 'region_labels', 'landmarks'];
const basemap = BASEMAP.filter(l => existsSync(join(OUT, 'layers', `${l}.geojson`)));
const relief = existsSync(join(OUT, 'rasters', 'relief.jpg'));
if (basemap.length < BASEMAP.length) console.warn('basemap 누락:', BASEMAP.filter(l => !basemap.includes(l)).join(', '), '→ node --experimental-strip-types scripts/fetch-external.ts');

// ---- entities/*.json
const actors = Object.entries(palette).map(([label, color]) => ({ id: label, label, color, source: 'book', confidence: 'high' }));
writeFileSync(join(OUT, 'entities', 'actors.json'), JSON.stringify({ actors }, null, 1));
const chron = existsSync(join(SRC, 'chronology.csv'))
  ? readFileSync(join(SRC, 'chronology.csv'), 'utf8').split('\n').slice(1).filter(Boolean).map(r => {
      const i = r.indexOf(','), j = r.indexOf(',', i + 1); // year,year_label,"event, 쉼표 포함"
      return { year: Number(r.slice(0, i)), label: r.slice(j + 1).trim().replace(/^"|"$/g, ''), source: 'book', confidence: 'high' }; }).filter(e => Number.isFinite(e.year))
  : [];
writeFileSync(join(OUT, 'entities', 'events.json'), JSON.stringify({ events: chron }, null, 1));
writeFileSync(join(OUT, 'entities', 'people.json'), JSON.stringify(nodes.filter(n => n.type === 'person')));

const scenesPath = join(import.meta.dirname, '..', 'data', 'scenes', 'rome.json');
const scenes = existsSync(scenesPath) ? JSON.parse(readFileSync(scenesPath, 'utf8')) : [];
// 시대 띠: data/eras/rome.json(사람이 쓰는 큰 시대) + 정본 period 엔티티 중 years "96-180"처럼 범위가 있는 것
const erasPath = join(import.meta.dirname, '..', 'data', 'eras', 'rome.json');
const eras = [...(existsSync(erasPath) ? JSON.parse(readFileSync(erasPath, 'utf8')) : []),
  ...entities.filter(e => e.type === 'period' && typeof e.attrs.years === 'string' && /^-?\d+-\d+$/.test(e.attrs.years as string)).map(e => {
    const m = (e.attrs.years as string).match(/^(-?\d+)-(\d+)$/)!; return { id: e.id, label: e.name, from: Number(m[1]), to: Number(m[2]), sub: true }; })];
const years = [...chron.map(e => e!.year), ...links.flatMap(l => [l.from_year, l.to_year]).filter((y): y is number => typeof y === 'number')];
const manifest = {
  id: 'rome', title: '로마제국쇠망사 — 온톨로지 전체 (30포인트)', crs: 'EPSG:4326', center: [14, 40], zoom: 4,
  time: { from: Math.min(...years), to: Math.max(...years), unit: 'year' },
  basemap, relief, bbox: [-15, 20, 65, 60], // fetch-external.ts BBOX와 같아야 한다(relief.jpg 모서리)
  territory: existsSync(join(OUT, 'layers', 'territory')) ? { bucket: 100, from: -800, to: 1500 } : undefined, // fetch-external TERRITORY_BUCKET
  layers: ['territory', 'admin_regions', 'settlements', 'battles', 'movements'], skins: ['neutral'],
  eras, // 타임라인 시대 띠(1.5)
  scenes, // data/scenes/rome.json — 사람이 쓰는 장면 프리셋(state.ts Scene)
  library: 'https://roma-library.pages.dev', source: '정본 entities.jsonl/links.jsonl → scripts/adapt.ts', generated: new Date().toISOString().slice(0, 10),
  counts: { entities: entities.length, links: links.length, settlements: settlements.length, battles: battles.length },
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log('adapt:', manifest.counts, 'time', manifest.time);
