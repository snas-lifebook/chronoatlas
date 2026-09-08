// 정본 온톨로지(JSONL) → datasets/rome/ (F1). 실행: ONTOLOGY_DIR=<볼트 ontology 경로> node --experimental-strip-types scripts/adapt.ts
// 산출물은 커밋한다(정적 배포·CI는 볼트를 못 읽는다). 손으로 고치지 않는다 — CONSTITUTION 0-1.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Entity, Link, idType } from '../schema/ontology.ts';

const SRC = process.env.ONTOLOGY_DIR;
if (!SRC) throw new Error('ONTOLOGY_DIR 필요 (정본 ontology/ 폴더)');
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

const parseYear = (s: unknown): number | null => {
  if (typeof s === 'number') return s;
  if (typeof s !== 'string') return null;
  if (/^-?\d{1,4}$/.test(s.trim())) return Number(s);
  const m = s.match(/(기원전\s*|BC\s*)?(\d{1,4})/); if (!m) return null;
  return m[1] ? -Number(m[2]) : Number(m[2]);
};

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

// ---- layers/settlements.geojson: 좌표 있는 place 전부. rank = 등장 포인트 수로 LOD.
const settlements = nodes.filter(n => n.type === 'place' && n.lonlat).map(n => {
  const g = geo.get(n.name.normalize('NFC')) ?? {};
  const rank = n.points.length >= 6 ? 1 : n.points.length >= 3 ? 2 : 3;
  return { type: 'Feature', properties: { id: n.id, layer: 'settlements', name_ko: n.name, name_ancient: g.ancient ?? null, name_modern: g.modern ?? null,
    kind: g.kind ?? null, rank, minzoom: rank === 1 ? 0 : rank === 2 ? 4 : 6, source: 'book+web', confidence: n.confidence ?? 'medium', src: n.src },
    geometry: { type: 'Point', coordinates: n.lonlat } };
});
writeFileSync(join(OUT, 'layers', 'settlements.geojson'), JSON.stringify({ type: 'FeatureCollection', features: settlements }));

// ---- layers/battles.geojson: event → occurred_at → place 좌표. 연도는 링크 from_year > event.year.
const battles = links.filter(l => l.rel === 'occurred_at').flatMap(l => {
  const ev = byId.get(l.from), pl = nodes.find(n => n.id === l.to);
  const year = l.from_year ?? (ev && parseYear(ev.attrs.year ?? ev.attrs.date ?? ev.attrs.period));
  if (!ev || ev.type !== 'event' || !pl?.lonlat || year == null) return [];
  return [{ type: 'Feature', properties: { id: ev.id, layer: 'battles', name_ko: ev.name, year, valid_from: year, place: pl.id,
    source: 'book', confidence: l.confidence ?? 'medium', src: l.src }, geometry: { type: 'Point', coordinates: pl.lonlat } }];
});
writeFileSync(join(OUT, 'layers', 'battles.geojson'), JSON.stringify({ type: 'FeatureCollection', features: battles }));

// territory·admin_regions·movements: Phase 0에선 빈 컬렉션(1.3·0.5에서 Cliopatria·_routes로 채운다). 파일이 있어야 main.ts가 뜬다.
for (const l of ['territory', 'admin_regions', 'movements'])
  if (!existsSync(join(OUT, 'layers', `${l}.geojson`))) writeFileSync(join(OUT, 'layers', `${l}.geojson`), JSON.stringify({ type: 'FeatureCollection', features: [] }));

// ---- 베이스맵 레이어는 scripts/fetch-external.ts가 만든다(NE 10m·relief). 여기선 있는지 확인만 — manifest.basemap.
const BASEMAP = ['land', 'coast', 'rivers', 'lakes', 'glaciers', 'bathy', 'marine_labels', 'region_labels'];
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
  layers: ['territory', 'admin_regions', 'settlements', 'battles', 'movements'], skins: ['neutral'],
  eras, // 타임라인 시대 띠(1.5)
  scenes, // data/scenes/rome.json — 사람이 쓰는 장면 프리셋(state.ts Scene)
  library: 'https://roma-library.pages.dev', source: '정본 entities.jsonl/links.jsonl → scripts/adapt.ts', generated: new Date().toISOString().slice(0, 10),
  counts: { entities: entities.length, links: links.length, settlements: settlements.length, battles: battles.length },
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log('adapt:', manifest.counts, 'time', manifest.time);
