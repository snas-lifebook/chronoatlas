# 전면 개선 슬라이스 I · 계획 1/4: 정본 마이그레이션 · 범위 재베이크 · 번들 분할 · 미시지도 레지스트리

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정본 마이그레이션과 지도 범위 확대를 끝내고, 초기 번들을 예산 아래로 내리고, 미시지도 셋을 코드에서 데이터(레지스트리)로 옮긴다. 이 계획이 끝나면 새 미시지도는 JSON 한 장으로 추가된다.

**Architecture:** 단일 연도 상태 + 네 뷰(`AGENTS.md`)는 그대로. 미시지도는 `data/micromaps/<id>.json` 한 장이 정본이고 `src/micromaps.ts`가 가벼운 색인과 `import()` 로더를, `src/map/micro.ts`가 kind 표 기반 범용 렌더러를 맡는다. 엔진의 알레시아·로마·알렉산드리아 하드코딩 31층은 사라진다.

**Tech Stack:** TypeScript · React 19 · MapLibre GL 6.3 · Vite 8(rolldown) · vitest 4 · zod 4(`schema/`에서만) · Node 22 · Python 3.13

**Spec:** `docs/OVERHAUL.md` §3 (P-A · P0 · P1). 요구 원장 `docs/BACKLOG.md` R46 · R47.

## Global Constraints

- 초기 JS `dist/assets/index-*.js` gz **≤ 340 kB** (이 계획 끝, Task 1.6에서 잰다). P0 단계 자체의 게이트는 360 kB.
- zod는 `schema/`에만. `src/`는 `import type`으로만 스키마를 본다.
- 좌표는 GeoJSON `[lng, lat]`. 좌표·연도·병력·이름을 지어내지 않는다.
- `public/datasets/`는 손으로 고치지 않는다(어댑터 산출물). 미시지도·말판·장면은 사람이 쓰는 파일이라 예외.
- 런타임 외부 호출 0. 새 데이터는 빌드타임에 굽는다.
- 카피레프트(ODbL·CC BY-SA)·NC 데이터는 재배포하지 않는다.
- 개인 절대경로(사용자명·볼트 경로)를 커밋하지 않는다. 볼트 경로는 `data/ontology-dir.txt`(gitignore)와 환경변수로만.
- push는 River가 배포를 말할 때만. 커밋은 한다. `git add -A` 금지, 경로를 명시한다. Co-Authored-By 없음.
- UI 카피는 한국어, 작대기(em-dash) 금지, 이모지 금지.
- 지도 렌더 확인은 자동화 탭에서 불가(`document.hidden`). `bash scripts/serve.sh` → `python3 scripts/look.py <scene>`.
- `npm run validate` = gen → lint → typecheck → vitest. 커밋 전에 초록이어야 한다.

---

## 모델링 (이 계획이 정하는 모델)

| 모델 | 정의 위치 | 요지 |
|---|---|---|
| `MicroMapDef` | `schema/micromap.ts` (zod) · `src/micromaps.ts`(type import) | 미시지도 한 장: `id title year teaching source home view hide basemap dem board features callouts` |
| `MicroHome` | `data/micromaps/index.json` · `src/micromaps.ts` | 색인 한 줄: `id title at minZoom span`. 초기 번들에 실리는 유일한 미시지도 정보 |
| `MicroFeature.properties` | `schema/micromap.ts` | `id name_ko name_la? kind grade source note_ko? wiki?` + 통과(passthrough). `grade`는 확정·근사·복원·논쟁 |
| `Callout` | `schema/micromap.ts` | `id topic anchor side num title body cite links image`. `anchor`는 `feature` · `lnglat` · `unit` 중 하나 |
| `KIND_PAINT` | `src/map/micro.ts` | kind 28종 → 채움·선·점·이름표 규칙. 스키마의 `KINDS`와 키가 같아야 한다(테스트) |
| `Scene.micro` | `src/state.ts` | 장면이 미시지도를 직접 부른다 |

---

### Task A1: 정본 마이그레이션 + adapt 팔레트 경로

**Files:**
- Modify: `scripts/adapt.ts:26-33` (팔레트·레지스트리 경로)
- Create: `data/ontology-dir.txt` (gitignore, 볼트 ontology 절대경로 한 줄)
- Modify(산출물): `public/datasets/rome/**` (adapt이 다시 굽는다)
- Test: `test/year.test.ts` · `test/ontology.test.ts` (지뢰가 뒤집힌다. 새 참값으로 고친다)

**Interfaces:**
- Consumes: 볼트 `Books/로마제국쇠망사/ontology/` (entities.jsonl · links.jsonl · _geo · _routes) · `Works/관계분석_방법론/components/{팔레트.json,_registry.csv}`
- Produces: `public/datasets/rome/{manifest.json,graph.json,entities/*,layers/*}` 최신 산출물. 이후 모든 태스크가 이 산출물을 읽는다.

- [ ] **Step 1: 백업 존재 확인과 dry-run**

```bash
O="<볼트>/Efforts/Notes/산업스터디/Projects/인생책_읽기_편데/Books/로마제국쇠망사/ontology"
ls -la "$O"/*.bak_* 
python3 "$O/_scripts/migrate_v2.py" "$O"        # dry-run. {"entities.jsonl": {"rows": N, "changed": M}, ...} 가 찍힌다
wc -l "$O/entities.jsonl" "$O/links.jsonl"
```
Expected: 기존 `.bak_20260901`·`.bak_20260903`이 보이고, dry-run 보고의 `rows` 합이 1,348 근처(정본 행수)다. 행수가 크게 다르면 멈추고 River에게.

- [ ] **Step 2: --write 실행과 백업 확인**

```bash
python3 "$O/_scripts/migrate_v2.py" "$O" --write
ls -la "$O"/*.bak_20260917*
wc -l "$O/entities.jsonl" "$O/links.jsonl"     # 행수는 Step 1과 같아야 한다
python3 -c "import json,sys;[json.loads(l) for l in open(sys.argv[1]) if l.strip()];print('json ok')" "$O/entities.jsonl"
```
Expected: `.bak_20260917` 둘 생성, 행수 동일, JSON 파싱 OK.

- [ ] **Step 3: adapt.ts 팔레트 경로를 정본 옆 폴더로**

`scripts/adapt.ts` 26~33행을 이렇게 바꾼다(`SRC` 정의 아래).

```ts
// 세력 팔레트(룬델 정본)와 레지스트리는 정본 ontology/ 안이 아니라 옆 폴더에 산다
// (<편데>/Works/관계분석_방법론/components). 그대로 두면 어댑터가 조용히 열화됐다 :
// actors.json이 비고 138개 노드의 세력·티어, 80개 노드의 초상이 null이 됐다(RUNBOOK-extent §3).
// PALETTE_DIR 환경변수가 이기고, 없으면 정본 기준 상대경로, 그것도 없으면 정본 폴더 자체를 본다.
const PALETTE_DIR = process.env.PALETTE_DIR
  ?? [join(SRC, '..', '..', '..', 'Works', '관계분석_방법론', 'components'), SRC].find(p => existsSync(join(p, '팔레트.json')))
  ?? SRC;
if (!existsSync(join(PALETTE_DIR, '팔레트.json'))) console.warn('팔레트.json을 못 찾았다: actors.json이 빈다. PALETTE_DIR을 주라');
const palette = existsSync(join(PALETTE_DIR, '팔레트.json')) ? JSON.parse(readFileSync(join(PALETTE_DIR, '팔레트.json'), 'utf8')).factions : {};
const registry = new Map<string, any>();
if (existsSync(join(PALETTE_DIR, '_registry.csv'))) {
  const [head, ...rows] = readFileSync(join(PALETTE_DIR, '_registry.csv'), 'utf8').split('\n').filter(Boolean);
  const cols = head.split(',');
  for (const r of rows) { const v = r.split(','); registry.set(v[0], Object.fromEntries(cols.map((c, i) => [c, v[i] ?? '']))); }
}
```

- [ ] **Step 4: adapt 실행과 산출물 검사**

```bash
cd ~/Projects/chronoatlas
echo "$O" > data/ontology-dir.txt          # gitignore 대상. 커밋하지 않는다
npm run adapt
python3 - <<'EOF'
import json
a=json.load(open('public/datasets/rome/entities/actors.json'))['actors']
g=json.load(open('public/datasets/rome/graph.json'))
print('actors', len(a), 'with color', sum(1 for x in a if x.get('color')))
print('nodes', len(g['nodes']), 'edges', len(g['edges']))
print('portraits', sum(1 for n in g['nodes'] if n.get('asset')))
EOF
```
Expected: `actors`가 8 이상이고 전원 색이 있다. `nodes`가 정본 엔티티 수(650)와 같다. `portraits`가 0이 아니다(80 근처). 0이면 Step 3의 경로가 틀린 것이다.

- [ ] **Step 5: 지뢰 테스트를 새 참값으로**

```bash
npx vitest run test/year.test.ts test/ontology.test.ts
```
Expected: 빨강. 각 테스트 파일의 주석이 「adapt이 성공하면 빨개진다」고 적은 단언을 찾아, 산출물의 **지금 값**으로 뒤집는다(자마·삼니움·기독교박해 `year`는 파서가 거절해 `null`, `battles` id 중복 0). 값을 지어내지 말고 산출물에서 읽은 값을 넣는다.

- [ ] **Step 6: 전체 검증과 커밋**

```bash
npm run validate
git add scripts/adapt.ts test/year.test.ts test/ontology.test.ts public/datasets/rome
git commit -m "feat(정본): migrate_v2 --write 반영 · adapt 팔레트 경로를 정본 옆 폴더로 · 산출물 재생성"
```
Expected: validate 초록. `git status`에 `data/ontology-dir.txt`가 안 보인다(gitignore).

---

### Task A2: 지도 범위 확대 재베이크 (R31, RUNBOOK-extent)

**Files:**
- Modify: `scripts/extent.ts` (`BBOX` 한 줄)
- Modify(산출물): `data/external/**`(gitignore) · `public/datasets/rome/{layers,rasters,manifest.json}`
- Modify: `docs/RUNBOOK-extent.md` (「River 터미널」 문구를 실측으로)
- Test: `test/extent.test.ts` (기존 5건)

**Interfaces:**
- Consumes: Task A1의 adapt 파이프라인.
- Produces: `manifest.bbox = [-25,12,75,62]`, NE 벡터·relief·Cliopatria·Pleiades 산출물이 새 범위. 이후 DEM(계획 2/4)이 같은 BBOX를 읽는다.

- [ ] **Step 1: BBOX 한 줄**

`scripts/extent.ts`에서 `export const BBOX = [-15, 20, 65, 60] as const;`를 `export const BBOX = [-25, 12, 75, 62] as const;`로.

- [ ] **Step 2: 테스트가 빨개지는 것을 확인**

Run: `npx vitest run test/extent.test.ts`
Expected: FAIL (`manifest.bbox`가 BBOX와 다르다). 이게 재베이크를 잊지 못하게 하는 지뢰다.

- [ ] **Step 3: 외부 원본 재다운로드**

```bash
cd ~/Projects/chronoatlas && npm run fetch-external 2>&1 | tee /tmp/fetch-external.log | tail -20
du -sh data/external
```
Expected: 에러 없이 끝난다(수 분~수십 분, NE 7종 + Gray Earth GeoTIFF + 수심 + Cliopatria + Pleiades). `data/external/`이 150MB 이상. **`TERRAIN=1`은 주지 않는다**(AWS 타일은 안 쓴다. DEM은 계획 2/4).

- [ ] **Step 4: adapt 다시 + 검증**

```bash
npm run adapt && npm run validate
python3 -c "import json;m=json.load(open('public/datasets/rome/manifest.json'));print(m['bbox'])"
```
Expected: validate 초록, bbox `[-25, 12, 75, 62]`.

- [ ] **Step 5: 렌더 확인(완료 조건 RUNBOOK §6)**

```bash
npm run build && bash scripts/serve.sh
for s in pack-intro-med pack-extent-44 pack-augustan-27; do python3 scripts/look.py $s; done
python3 scripts/look.py pack-intro-med --zoom 3.4 --center 25,38      # 콘스탄티노플·안티오키아·크테시폰·알렉산드리아 한 화면
```
Expected: 각 캡처(/tmp)에 빈 파란 여백·클립 경계가 없다. z3.4 캡처에 네 도시 라벨이 들어 있다(라벨이 없으면 LOD 문제이지 범위 문제가 아니다. 그건 슬라이스 III). 캡처를 `docs/verify/overhaul/extent-*.png`로 복사한다.

- [ ] **Step 6: 옛 AWS 지형 타일 제거 (로컬, 라이선스 혼합)**

```bash
rm -rf public/datasets/rome/terrain
```

- [ ] **Step 7: RUNBOOK 문구 정정과 커밋**

`docs/RUNBOOK-extent.md` 3행의 「egress가 필요한 부분이 있어 River 터미널에서 돌린다」를 「2026-09-17 실측: 이 작업 환경은 egress가 열려 있어 에이전트가 돌렸다. 막힌 환경이면 River 터미널」로 고친다. §0에 「최종 범위 `[-25,12,75,62]` (2026-09-17 적용)」 한 줄.

```bash
git add scripts/extent.ts public/datasets/rome docs/RUNBOOK-extent.md docs/verify/overhaul
git commit -m "feat(지도): 범위 [-25,12,75,62]로 재베이크 (R31 라운드 A)"
```

---

### Task 0.1: 번들 예산 게이트

**Files:**
- Create: `scripts/check-bundle.mjs`
- Modify: `package.json` (`postbuild`)

**Interfaces:**
- Produces: `node scripts/check-bundle.mjs` 가 `dist/assets/index-*.js` gz를 재서 상한을 넘으면 exit 1. 상한은 `BUNDLE_LIMIT` 환경변수(kB)로 덮어쓴다. 기본 340.

- [ ] **Step 1: 스크립트**

```js
// scripts/check-bundle.mjs: 초기 JS 예산 게이트. postbuild에서 돈다.
// 예산을 넘으면 빌드가 실패한다. 동적 청크(token3d·mediabunny·미시지도)는 별개다.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'assets');
const LIMIT = Number(process.env.BUNDLE_LIMIT ?? 340) * 1000;
const files = readdirSync(DIR).filter(f => f.endsWith('.js'));
const rows = files.map(f => [f, gzipSync(readFileSync(join(DIR, f))).length]).sort((a, b) => b[1] - a[1]);
for (const [f, gz] of rows) console.log(`${(gz / 1000).toFixed(1).padStart(7)} kB gz  ${f}`);
const initial = rows.find(([f]) => /^index-/.test(f));
if (!initial) { console.error('index-*.js 가 없다'); process.exit(1); }
if (initial[1] > LIMIT) { console.error(`초기 JS ${(initial[1] / 1000).toFixed(1)} kB gz > 예산 ${LIMIT / 1000} kB`); process.exit(1); }
console.log(`초기 JS ${(initial[1] / 1000).toFixed(1)} kB gz ≤ ${LIMIT / 1000} kB  ok`);
```

- [ ] **Step 2: postbuild에 건다**

`package.json`의 `"postbuild"`를 이렇게:
```json
"postbuild": "cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs dist/assets/ && node scripts/check-bundle.mjs"
```

- [ ] **Step 3: 지금 값으로 한 번 실패시켜 본다**

Run: `npm run build`
Expected: postbuild가 `초기 JS 399.x kB gz > 예산 340 kB`로 **실패**한다. 게이트가 산 것이다. `BUNDLE_LIMIT=400 npm run build`는 통과.

- [ ] **Step 4: 커밋**

```bash
git add scripts/check-bundle.mjs package.json
git commit -m "chore(빌드): 초기 JS 340 kB gz 예산 게이트 (postbuild)"
```

---

### Task 0.2: UI · 내보내기 · 검색을 늦게 싣는다

**Files:**
- Modify: `src/app/App.tsx` (Callouts · GraphPanel · Qc · Profile을 `React.lazy`, 내보내기 셋을 호출 시 `import()`)
- Modify: `src/app/Search.tsx` (검색 색인 모듈을 첫 열림에 `import()`)

**Interfaces:**
- Produces: `dist/assets/` 에 `Callouts-*.js` · `GraphPanel-*.js` · `search-*.js` 등 별도 청크. 초기 JS ≤ 360 kB gz.

- [ ] **Step 1: 어디가 무거운지 잰다**

```bash
BUNDLE_LIMIT=400 npm run build && npx vite build --mode production -- --report 2>/dev/null || true
grep -c "es-hangul\|GraphPanel\|Callouts\|export/png\|export/card\|export/data" dist/assets/index-*.js
```
Expected: 문자열이 초기 청크 안에 있다(0이 아니다). 이 넷이 옮길 대상이다.

- [ ] **Step 2: React.lazy 로 패널을 뗀다**

`src/app/App.tsx` 상단 import를 바꾼다.
```tsx
import { lazy, Suspense } from 'react';
const Callouts = lazy(() => import('./Callouts').then(m => ({ default: m.Callouts })));
const GraphPanel = lazy(() => import('./GraphPanel').then(m => ({ default: m.GraphPanel })));
const Qc = lazy(() => import('./Qc').then(m => ({ default: m.Qc })));
```
각 사용처를 `<Suspense fallback={null}><Callouts … /></Suspense>` 로 감싼다. 내보내기 단추 셋의 onClick은
```tsx
onClick={async () => { const { exportPng } = await import('../export/png'); await exportPng(/* 기존 인수 그대로 */); }}
```
꼴로 바꾼다(`card`·`data`도 같은 꼴). 기존 상단 `import … from '../export/png'` 줄은 지운다.

- [ ] **Step 3: 검색 색인은 팔레트가 처음 열릴 때**

`src/app/Search.tsx`에서 `import { … } from '../search'`를 지우고, 열릴 때 한 번:
```tsx
const [idx, setIdx] = useState<null | typeof import('../search')>(null);
useEffect(() => { if (open && !idx) import('../search').then(setIdx); }, [open, idx]);
```
`idx`가 null이면 입력창만 보이고 결과는 빈 상태 카피 「색인을 불러오는 중」.

- [ ] **Step 4: 빌드 게이트 360으로 확인**

Run: `BUNDLE_LIMIT=360 npm run build`
Expected: 통과. `index-*.js`가 360 kB gz 이하이고 `Callouts-*`·`GraphPanel-*`·`search-*` 청크가 생겼다. 안 되면 Step 1의 grep으로 초기 청크에 남은 것을 찾아 같은 꼴로 뗀다.

- [ ] **Step 5: 동작 확인과 커밋**

```bash
npm run validate && bash scripts/serve.sh && python3 scripts/look.py pack-alesia-52
```
Expected: 알레시아 콜아웃 핀이 뜬다(지연 로드 후). `/`로 검색이 열리고 3글자 입력에 결과가 온다.
```bash
git add src/app/App.tsx src/app/Search.tsx
git commit -m "perf(번들): 콜아웃·그래프·QC·내보내기·검색을 동적 청크로"
```

---

### Task 1.1: 미시지도 스키마와 색인

**Files:**
- Create: `schema/micromap.ts`
- Create: `data/micromaps/index.json` (Task 1.2가 채운다. 여기서는 빈 배열)
- Test: `test/micromap.test.ts`

**Interfaces:**
- Produces: `MicroMap`(zod) · `MicroFeature` · `Callout` · `KINDS` · `GRADES` · `lintMicroMap(def, ctx): string[]` · 타입 `MicroMapDef` `CalloutDef`.

- [ ] **Step 1: 실패하는 테스트**

```ts
// test/micromap.test.ts
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { MicroMap, KINDS, GRADES, lintMicroMap } from '../schema/micromap';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'data', 'micromaps');
const rd = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const files = readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'index.json');

describe('미시지도 스키마 (OVERHAUL §3.2)', () => {
  it('kind 어휘가 28종이고 grade가 넷이다', () => {
    expect(KINDS.length).toBe(28);
    expect([...GRADES]).toEqual(['확정', '근사', '복원', '논쟁']);
  });
  it('teaching을 빼면 파싱이 실패한다', () => {
    const ok = { id: 'x', title: 'x', year: -1, teaching: true, source: '열 글자 넘는 근거 문장입니다.',
      home: { at: [0, 0], minZoom: 10, span: 0.3 }, view: { center: [0, 0], zoom: 12 },
      features: [{ type: 'Feature', properties: { id: 'x:a', name_ko: '가', kind: 'river', grade: '확정', source: 'BG 1.1' }, geometry: { type: 'Point', coordinates: [0, 0] } }] };
    expect(() => MicroMap.parse(ok)).not.toThrow();
    const { teaching, ...no } = ok; expect(() => MicroMap.parse(no)).toThrow();
    expect(() => MicroMap.parse({ ...ok, features: [{ ...ok.features[0], properties: { ...ok.features[0].properties, kind: 'castle' } }] })).toThrow();
  });
  it('콜아웃 앵커가 피처를 못 찾으면 린트가 잡는다', () => {
    const def = MicroMap.parse({ id: 'x', title: 'x', year: -1, teaching: true, source: '열 글자 넘는 근거 문장입니다.',
      home: { at: [0, 0], minZoom: 10, span: 0.3 }, view: { center: [0, 0], zoom: 12 },
      features: [{ type: 'Feature', properties: { id: 'x:a', name_ko: '가', kind: 'river', grade: '확정', source: 's' }, geometry: { type: 'Point', coordinates: [0, 0] } }],
      callouts: [{ id: 'x:c1', anchor: { feature: 'x:없음' }, side: 'left', num: 1, title: 't', body: 'b', cite: 'c' }] });
    expect(lintMicroMap(def, { boards: [], scenes: [] })).toContain('x:c1: 앵커 피처 없음 x:없음');
  });
  for (const f of files) {
    it(`${f} 가 스키마와 린트를 통과한다`, () => {
      const def = MicroMap.parse(rd(join(DIR, f)));
      expect(def.id).toBe(f.replace(/\.json$/, ''));
      const boards = readdirSync(join(ROOT, 'data', 'boards')).map(b => b.replace(/\.json$/, ''));
      const scenes = rd(join(ROOT, 'data', 'scenes', 'rome.json'));
      expect(lintMicroMap(def, { boards, scenes })).toEqual([]);
    });
  }
  it('index.json 이 각 파일의 home·title과 같다', () => {
    const index = rd(join(DIR, 'index.json')) as { id: string; title: string; at: number[]; minZoom: number; span: number }[];
    expect(index.map(x => x.id).sort()).toEqual(files.map(f => f.replace(/\.json$/, '')).sort());
    for (const row of index) {
      const def = MicroMap.parse(rd(join(DIR, `${row.id}.json`)));
      expect(row).toEqual({ id: def.id, title: def.title, at: def.home.at, minZoom: def.home.minZoom, span: def.home.span });
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/micromap.test.ts`
Expected: FAIL (`schema/micromap` 없음).

- [ ] **Step 3: 스키마**

```ts
// schema/micromap.ts: 미시지도 데이터 계약 (OVERHAUL §3.2). zod는 여기만. src/는 import type만.
import { z } from 'zod';

/** 그리는 법이 정해진 kind만 허용한다. 늘리면 src/map/micro.ts의 KIND_PAINT에도 한 줄. */
export const KINDS = [
  'oppidum', 'inner_line', 'outer_line', 'camp', 'redoubt', 'gaul_camp', 'hill', 'river', 'plain', 'trap', 'ditch',
  'building', 'theatre', 'forum', 'temple', 'field', 'wall', 'boundary', 'gate', 'circus', 'road',
  'lighthouse', 'island', 'causeway', 'harbor', 'district', 'cape', 'lake',
] as const;
/** 정직성 태그. 확정(유구·현존) · 근사(자리 확실, 면은 단순화) · 복원(학설) · 논쟁(학계 갈림). */
export const GRADES = ['확정', '근사', '복원', '논쟁'] as const;

const LonLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const Geometry = z.object({ type: z.enum(['Point', 'LineString', 'Polygon', 'MultiLineString', 'MultiPolygon']), coordinates: z.any() });

export const MicroFeature = z.object({
  type: z.literal('Feature'),
  properties: z.object({
    id: z.string().regex(/^[a-z0-9-]+:[a-z0-9-]+$/, 'id는 <지도>:<슬러그>'),
    name_ko: z.string().min(1),
    name_la: z.string().optional(),
    kind: z.enum(KINDS),
    grade: z.enum(GRADES),
    source: z.string().min(1),          // 사료·근거 문장. 알레시아는 BG 절 번호, 로마는 태그+설명
    note_ko: z.string().optional(),
    wiki: z.string().url().optional(),
  }).passthrough(),                     // attested·camp_letter 같은 지도별 필드는 그대로 둔다
  geometry: Geometry,
});

export const Callout = z.object({
  id: z.string().min(1),
  topic: z.enum(['terrain', 'unit', 'event']).default('terrain'),
  anchor: z.union([z.object({ feature: z.string().min(1) }), z.object({ lnglat: LonLat }), z.object({ unit: z.string().min(1) })]),
  side: z.enum(['left', 'right']),
  num: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().min(1).max(160),
  cite: z.string().min(1).nullable().optional(),
  links: z.array(z.object({ label: z.string().min(1), url: z.string().url() })).default([]),
  image: z.object({ url: z.string(), credit: z.string(), alt: z.string() }).nullable().default(null),
});

/** 미시지도 밑에 깔 도판. 모양은 옛 pack-basemaps.json 항목과 같다(지오레퍼런싱 결과를 다시 안 만든다). */
export const Basemap = z.object({
  id: z.string(), file: z.string(), corners: z.object({ w: z.number(), e: z.number(), n: z.number(), s: z.number() }),
  opacity: z.number().min(0).max(1).default(0.5), min_zoom: z.number().optional(),
  title: z.string().optional(), caveat: z.string().optional(), short_caveat: z.string().optional(), source: z.string().optional(), rms_m: z.number().optional(),
}).passthrough();

export const MicroMap = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  year: z.number().int(),
  teaching: z.literal(true),
  source: z.string().min(10),
  home: z.object({ at: LonLat, minZoom: z.number().min(8).max(14), span: z.number().positive().max(2) }),
  view: z.object({ center: LonLat, zoom: z.number().min(8).max(16), pitch: z.number().min(0).max(85).default(0), bearing: z.number().default(0) }),
  hide: z.array(z.string()).default(['movements']),
  basemap: Basemap.nullable().default(null),
  dem: z.object({ dir: z.string().regex(/^terrain-[a-z0-9-]+$/), minzoom: z.number().int().default(8), maxzoom: z.number().int().default(12) }).nullable().default(null),
  board: z.string().nullable().default(null),
  features: z.array(MicroFeature).min(1),
  callouts: z.array(Callout).default([]),
});

export type MicroMapDef = z.infer<typeof MicroMap>;
export type CalloutDef = z.infer<typeof Callout>;
export type MicroFeatureDef = z.infer<typeof MicroFeature>;

/** 스키마만으로 못 잡는 것. 빈 배열이면 통과. */
export function lintMicroMap(def: MicroMapDef, ctx: { boards: string[]; scenes: { id: string; micro?: string }[] }): string[] {
  const err: string[] = [];
  const ids = new Set<string>();
  for (const f of def.features) {
    if (!f.properties.id.startsWith(`${def.id}:`)) err.push(`${f.properties.id}: 접두사가 ${def.id}: 가 아니다`);
    if (ids.has(f.properties.id)) err.push(`${f.properties.id}: id 중복`); ids.add(f.properties.id);
  }
  const nums = def.callouts.map(c => c.num);
  if (new Set(nums).size !== nums.length) err.push('콜아웃 num 중복');
  for (const c of def.callouts) {
    if ('feature' in c.anchor && !ids.has(c.anchor.feature)) err.push(`${c.id}: 앵커 피처 없음 ${c.anchor.feature}`);
    if ('unit' in c.anchor && !def.board) err.push(`${c.id}: unit 앵커인데 board가 없다`);
    if (c.topic === 'unit' && !def.board) err.push(`${c.id}: topic unit인데 board가 없다`);
  }
  if (def.board && !ctx.boards.includes(def.board)) err.push(`board 없음 ${def.board}`);
  const [w, s, e, n] = [def.home.at[0] - def.home.span, def.home.at[1] - def.home.span, def.home.at[0] + def.home.span, def.home.at[1] + def.home.span];
  const [cx, cy] = def.view.center;
  if (cx < w || cx > e || cy < s || cy > n) err.push('view.center가 home 범위 밖');
  for (const sc of ctx.scenes) if (sc.micro && sc.micro !== def.id && !ctx.scenes.some(x => x.micro === sc.micro)) { /* 다른 지도 참조는 그 지도 테스트가 본다 */ }
  return err;
}
```

- [ ] **Step 4: 빈 색인과 테스트 통과**

`data/micromaps/index.json`에 `[]`를 쓴다. Run: `npx vitest run test/micromap.test.ts`
Expected: PASS (파일이 아직 없어 파일별 케이스는 0건, 나머지 3건 통과).

- [ ] **Step 5: 커밋**

```bash
git add schema/micromap.ts data/micromaps/index.json test/micromap.test.ts
git commit -m "feat(미시지도): 스키마 zod + 린트 + 색인 (R47)"
```

---

### Task 1.2: 세 지도를 레지스트리로 이관 (일회성 스크립트)

**Files:**
- Create: `scripts/migrate-micromaps.mjs` (일회성. 끝나면 지운다)
- Create: `data/micromaps/{alesia,roma,alexandria}.json` · `data/micromaps/index.json`
- Delete: `data/overlays/pack-alesia.json` · `pack-roma-urbs.json` · `pack-alexandria.json` · `pack-callouts.json` · `pack-basemaps.json` (Task 1.4가 코드에서 참조를 끊은 뒤)

**Interfaces:**
- Consumes: 옛 파일 다섯 + `src/callouts.ts`의 `HOME` 값(알레시아 `[4.4958,47.535]` z11 span 0.6 · 로마 `[12.4823,41.8925]` z12 span 0.35 · 알렉산드리아 `[29.897,31.199]` z12 span 0.35) + 장면 `pack-alesia-52`의 카메라(z12.4).
- Produces: 스키마를 통과하는 파일 셋과 색인.

- [ ] **Step 1: 스크립트**

```js
// scripts/migrate-micromaps.mjs: 일회성. pack-*.json 셋 + 콜아웃 + 도판을 data/micromaps/<id>.json 으로.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const callouts = rd('data/overlays/pack-callouts.json').callouts;
const basemaps = rd('data/overlays/pack-basemaps.json').maps ?? [];
const scenes = rd('data/scenes/rome.json');
const cam = id => { const s = scenes.find(x => x.id === id); return { center: s.center, zoom: s.zoom, pitch: s.pitch ?? 0, bearing: s.bearing ?? 0 }; };

const MAPS = [
  { id: 'alesia', file: 'data/overlays/pack-alesia.json', title: '알레시아 포위전 · BC 52', year: -52,
    home: { at: [4.4958, 47.535], minZoom: 11, span: 0.6 }, view: cam('pack-alesia-52'), calloutKey: 'alesia',
    grade: p => p.attested === false ? '복원' : p.attested === true ? '확정' : '근사' },
  { id: 'roma', file: 'data/overlays/pack-roma-urbs.json', title: '로마 시내 · BC 44', year: -44,
    home: { at: [12.4823, 41.8925], minZoom: 12, span: 0.35 }, view: null, calloutKey: 'roma',
    grade: p => p.source.slice(0, 2) },
  { id: 'alexandria', file: 'data/overlays/pack-alexandria.json', title: '알렉산드리아 · BC 48–47', year: -47,
    home: { at: [29.897, 31.199], minZoom: 12, span: 0.35 }, view: null, calloutKey: 'alexandria',
    grade: p => p.source.slice(0, 2) },
];
const index = [];
for (const m of MAPS) {
  const src = rd(m.file);
  const view = m.view ?? { center: src.view.center, zoom: src.view.zoom, pitch: 0, bearing: 0 };
  const features = src.features.map(f => ({ ...f, properties: { ...f.properties, grade: m.grade(f.properties) } }));
  const bm = basemaps.find(b => b.id === m.id) ?? null;
  const out = {
    id: m.id, title: m.title, year: m.year, teaching: true, source: src.source,
    home: m.home, view, hide: ['movements'], basemap: bm, dem: null, board: null,
    features,
    callouts: callouts.filter(c => c.map === m.calloutKey).map(({ map, ...c }) => ({ topic: 'terrain', ...c })),
  };
  writeFileSync(join(ROOT, 'data', 'micromaps', `${m.id}.json`), JSON.stringify(out, null, 1) + '\n');
  index.push({ id: m.id, title: m.title, at: m.home.at, minZoom: m.home.minZoom, span: m.home.span });
  console.log(m.id, 'features', features.length, 'callouts', out.callouts.length, 'basemap', !!bm);
}
writeFileSync(join(ROOT, 'data', 'micromaps', 'index.json'), JSON.stringify(index, null, 1) + '\n');
```

- [ ] **Step 2: 실행과 스키마 검사**

```bash
node scripts/migrate-micromaps.mjs && npx vitest run test/micromap.test.ts
```
Expected: `alesia features 51 callouts 9 basemap false` · `roma 31 7 true` · `alexandria 16 7 true`. 테스트 PASS. 실패하면 메시지대로 데이터를 고친다(예: `grade`가 넷 밖이면 해당 피처의 `source` 첫 두 글자를 확인해 `grade`를 손으로 넣는다. 문장은 안 바꾼다).

- [ ] **Step 3: 커밋 (옛 파일 삭제는 Task 1.4 뒤)**

```bash
git add data/micromaps
git commit -m "feat(미시지도): 알레시아·로마·알렉산드리아를 레지스트리 파일로 이관"
```

---

### Task 1.3: 로더 `src/micromaps.ts`

**Files:**
- Create: `src/micromaps.ts`
- Test: `test/micromap.test.ts` 에 `microMapAt` 케이스 추가

**Interfaces:**
- Produces: `INDEX: MicroHome[]` · `loadMicro(id): Promise<MicroMapDef>` · `microMapAt(zoom, center): string | null`.
- Consumes: `data/micromaps/index.json` (eager, 수백 바이트) · `data/micromaps/*.json` (lazy).

- [ ] **Step 1: 테스트 추가**

```ts
import { microMapAt, INDEX } from '../src/micromaps';
describe('microMapAt', () => {
  it('줌 문턱을 넘고 그 지도 근처여야 켠다', () => {
    const alesia = INDEX.find(x => x.id === 'alesia')!;
    expect(microMapAt(alesia.minZoom - 0.1, alesia.at)).toBeNull();
    expect(microMapAt(alesia.minZoom, alesia.at)).toBe('alesia');
    expect(microMapAt(13, [alesia.at[0] + 5, alesia.at[1]])).toBeNull();
  });
  it('둘이 겹치면 가까운 쪽', () => {
    const roma = INDEX.find(x => x.id === 'roma')!;
    expect(microMapAt(13, roma.at)).toBe('roma');
  });
});
```

- [ ] **Step 2: 실패 확인**: Run: `npx vitest run test/micromap.test.ts` → FAIL (`src/micromaps` 없음).

- [ ] **Step 3: 구현**

```ts
// src/micromaps.ts: 미시지도 색인(가볍다, 초기 번들) + 지도별 지연 로더 + 어느 지도인가 판정.
// 지도 본문(피처·콜아웃·도판 정보)은 import()로만 온다. 초기 번들에 안 실린다(R46).
import type { MicroMapDef } from '../schema/micromap';
import index from '../data/micromaps/index.json';

export interface MicroHome { id: string; title: string; at: [number, number]; minZoom: number; span: number }
export const INDEX: MicroHome[] = index as MicroHome[];

const LOADERS = import.meta.glob<MicroMapDef>(['../data/micromaps/*.json', '!../data/micromaps/index.json'], { import: 'default' });
const cache = new Map<string, Promise<MicroMapDef>>();
export function loadMicro(id: string): Promise<MicroMapDef> {
  const key = `../data/micromaps/${id}.json`;
  const f = LOADERS[key];
  if (!f) return Promise.reject(new Error(`미시지도 없음: ${id}`));
  if (!cache.has(id)) cache.set(id, f());
  return cache.get(id)!;
}

/** 지금 화면이 어느 미시지도인가. 줌이 문턱을 넘고 **그 지도 근처**여야 한다 :
 *  줌만 보면 로마에서 z13으로 당겼을 때 알레시아 콜아웃이 같이 뜬다. */
export function microMapAt(zoom: number, center: [number, number]): string | null {
  let best: { id: string; d: number } | null = null;
  for (const h of INDEX) {
    if (zoom < h.minZoom) continue;
    const d = Math.hypot(center[0] - h.at[0], center[1] - h.at[1]);
    if (d > h.span) continue;
    if (!best || d < best.d) best = { id: h.id, d };
  }
  return best?.id ?? null;
}
```
`tsconfig.json`에 `"resolveJsonModule": true`가 없으면 넣는다.

- [ ] **Step 4: 통과 확인과 커밋**

Run: `npx vitest run test/micromap.test.ts` → PASS.
```bash
git add src/micromaps.ts test/micromap.test.ts tsconfig.json
git commit -m "feat(미시지도): 색인 + 지연 로더 + microMapAt"
```

---

### Task 1.4: 범용 렌더러 `src/map/micro.ts` 와 엔진 교체

**Files:**
- Create: `src/map/micro.ts`
- Modify: `src/map/engine.ts` (알레시아·로마·알렉산드리아 블록 763~870행 근처 삭제 · `syncDetailMaps` 506~530행 교체 · `LAYER_GROUPS`의 `alesia`·`roma`·`alexandria` 항목과 233행의 층 이름 삭제 · 도판(`PACK_BASEMAPS`) 처리 595~600행을 `micro.enter`로)
- Modify: `src/callouts.ts` (HOME·SOURCES·MicroMap 타입 삭제. `CALLOUTS`를 「지금 켜진 지도의 콜아웃」으로)
- Modify: `src/app/Callouts.tsx` (`microMapAt`은 `../micromaps`에서, 콜아웃 목록은 로더 결과에서)
- Modify: `src/present.ts` (`showAlesia`·`showRomaUrbs`·`showAlexandria`·`*_MIN_ZOOM` 삭제)
- Modify: `src/packData.ts` (`ALESIA`·`ROMA_URBS`·`ALEXANDRIA`·`PACK_BASEMAPS` 삭제)
- Test: `test/micromap.test.ts` 에 `KIND_PAINT` 키 = `KINDS` 검사 · `test/present.test.ts` 에서 지운 함수 케이스 제거

**Interfaces:**
- Produces: `createMicro(map, opts) → { enter(def: MicroMapDef): void; leave(): void; active(): MicroMapDef | null }` · `KIND_PAINT` · `MICRO_LAYERS`.
- 콜아웃 쪽: `resolveCallouts(def): Callout[]` (앵커 → 좌표 풀이. `representativePoint`는 지금 것 그대로).

- [ ] **Step 1: KIND_PAINT 키 검사 테스트**

```ts
import { KIND_PAINT } from '../src/map/micro';
it('KIND_PAINT 가 KINDS 전부를 안다', () => { expect(Object.keys(KIND_PAINT).sort()).toEqual([...KINDS].sort()); });
```
Run → FAIL.

- [ ] **Step 2: micro.ts**

옛 값은 `src/map/engine.ts` 763~870행(알레시아) · 로마 · 알렉산드리아 블록에서 **그대로 옮긴다**(색·굵기·점선·불투명도). 아래는 골격과 알레시아 네 줄의 실제 값이다. 나머지 kind는 그 블록에서 읽어 채운다. 세력색은 `opts.palette`(`d.actors`의 id → color)에서.

```ts
// src/map/micro.ts: 미시지도 범용 렌더러. 소스 하나(micro) + 층 8. 지도가 바뀌면 setData로 갈아끼운다.
// kind → 그리는 법 표. 여기 없는 kind는 스키마가 막는다(schema/micromap.ts KINDS와 키가 같아야 한다. 테스트가 본다).
import type maplibregl from 'maplibre-gl';
import type { MicroMapDef, CalloutDef } from '../../schema/micromap';

type Paint = { fill?: { color: string | 'rome' | 'gaul'; opacity: number; outline?: boolean }; line?: { color: string | 'rome' | 'gaul'; width: number; dash?: number[]; opacity?: number }; point?: 'site' | 'camp' | 'redoubt' | 'gate' | 'hill' | 'lighthouse'; label?: boolean };
export const KIND_PAINT: Record<string, Paint> = {
  plain:      { fill: { color: '#C9B98A', opacity: 0.25 }, label: true },
  oppidum:    { fill: { color: 'gaul', opacity: 0.45, outline: true }, label: true },
  river:      { line: { color: '#5B86A8', width: 2.4, opacity: 0.9 }, label: true },
  outer_line: { line: { color: 'rome', width: 3.4, opacity: 0.95, dash: [3, 1.6] } },
  inner_line: { line: { color: 'rome', width: 3.4, opacity: 0.95 } },
  // ↓ 아래 kind들의 값은 engine.ts 옛 블록에서 옮긴다. 값을 새로 정하지 않는다.
  camp: { point: 'camp', label: true }, redoubt: { point: 'redoubt' }, gaul_camp: { fill: { color: 'gaul', opacity: 0.3 }, label: true },
  hill: { fill: { color: '#B8A77A', opacity: 0.35 }, point: 'hill', label: true }, trap: { line: { color: '#6B4B2A', width: 1.6, dash: [1, 1] } },
  ditch: { line: { color: '#6B4B2A', width: 2.2 } }, building: { point: 'site', label: true }, theatre: { point: 'site', label: true },
  forum: { fill: { color: '#D9C9A3', opacity: 0.5 }, point: 'site', label: true }, temple: { point: 'site', label: true },
  field: { fill: { color: '#CFCFB0', opacity: 0.3 }, label: true }, wall: { line: { color: '#5A4632', width: 3 } },
  boundary: { fill: { color: '#000000', opacity: 0 }, line: { color: '#8A3B3B', width: 1.8, dash: [2, 2] }, label: true },
  gate: { point: 'gate', label: true }, circus: { fill: { color: '#D9C9A3', opacity: 0.5 }, label: true }, road: { line: { color: '#8A7B5C', width: 1.6 } },
  lighthouse: { point: 'lighthouse', label: true }, island: { fill: { color: '#D8CDA8', opacity: 0.5 }, point: 'site', label: true },
  causeway: { line: { color: '#8A7B5C', width: 4 }, label: true }, harbor: { fill: { color: '#9DBBD1', opacity: 0.35 }, label: true },
  district: { fill: { color: '#E1D5B5', opacity: 0.35 }, label: true }, cape: { point: 'site', label: true }, lake: { fill: { color: '#9DBBD1', opacity: 0.45 }, label: true },
};

export const MICRO_LAYERS = ['micro-basemap', 'micro-fill', 'micro-fill-outline', 'micro-line', 'micro-point', 'micro-label'] as const;
const EMPTY = { type: 'FeatureCollection', features: [] } as const;

export function representativePoint(g: { type: string; coordinates: unknown } | undefined): [number, number] | null {
  if (!g) return null;
  if (g.type === 'Point') return g.coordinates as [number, number];
  if (g.type === 'LineString') { const c = g.coordinates as [number, number][]; return c.length ? c[Math.floor(c.length / 2)] : null; }
  const pts: [number, number][] = [];
  const walk = (c: unknown): void => { if (Array.isArray(c) && typeof c[0] === 'number') { pts.push(c as [number, number]); return; } if (Array.isArray(c)) for (const x of c) walk(x); };
  walk(g.coordinates);
  if (!pts.length) return null;
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

export interface ResolvedCallout extends CalloutDef { at: [number, number] }
/** 앵커를 좌표로 푼다. 못 푼 것은 버리고 콘솔에 남긴다(빌드 린트가 같은 것을 CI에서 막는다). */
export function resolveCallouts(def: MicroMapDef, unitAt?: (unitId: string) => [number, number] | null): ResolvedCallout[] {
  return def.callouts.flatMap(c => {
    let at: [number, number] | null = null;
    if ('lnglat' in c.anchor) at = c.anchor.lnglat;
    else if ('feature' in c.anchor) at = representativePoint(def.features.find(f => f.properties.id === (c.anchor as { feature: string }).feature)?.geometry);
    else if ('unit' in c.anchor) at = unitAt?.((c.anchor as { unit: string }).unit) ?? null;
    if (!at) { if (import.meta.env?.DEV) console.warn('콜아웃 앵커를 못 찾았다', c.id); return []; }
    return [{ ...c, at }];
  });
}

export function createMicro(map: maplibregl.Map, opts: { root: string; ds: string; palette: Record<string, string>; before?: () => string | undefined; onEnter?: (def: MicroMapDef) => void; onLeave?: () => void }) {
  let active: MicroMapDef | null = null;
  const color = (c: string) => c === 'rome' ? (opts.palette['로마'] ?? '#A4243B') : c === 'gaul' ? (opts.palette['갈리아'] ?? '#3E7C4F') : c;
  const matchExpr = (pick: (p: Paint) => string | number | number[] | undefined, fallback: string | number | number[]) =>
    ['match', ['get', 'kind'], ...Object.entries(KIND_PAINT).flatMap(([k, p]) => { const v = pick(p); return v === undefined ? [] : [k, typeof v === 'string' ? color(v) : v]; }), fallback] as any;
  const kindsWith = (pred: (p: Paint) => boolean) => ['literal', Object.entries(KIND_PAINT).filter(([, p]) => pred(p)).map(([k]) => k)] as any;

  function ensureLayers() {
    if (map.getSource('micro')) return;
    const before = opts.before?.();
    map.addSource('micro', { type: 'geojson', data: EMPTY as any, promoteId: 'id' });
    map.addLayer({ id: 'micro-fill', type: 'fill', source: 'micro', filter: ['all', ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]], ['in', ['get', 'kind'], kindsWith(p => !!p.fill)]],
      paint: { 'fill-color': matchExpr(p => p.fill?.color, '#CCCCCC'), 'fill-opacity': matchExpr(p => p.fill?.opacity, 0.3) } }, before);
    map.addLayer({ id: 'micro-fill-outline', type: 'line', source: 'micro', filter: ['all', ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]], ['in', ['get', 'kind'], kindsWith(p => !!p.fill?.outline || !!p.line)]],
      paint: { 'line-color': matchExpr(p => p.line?.color ?? p.fill?.color, '#888888'), 'line-width': matchExpr(p => p.line?.width, 1), 'line-opacity': matchExpr(p => p.line?.opacity, 0.9) } }, before);
    map.addLayer({ id: 'micro-line', type: 'line', source: 'micro', filter: ['all', ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]], ['in', ['get', 'kind'], kindsWith(p => !!p.line)]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': matchExpr(p => p.line?.color, '#888888'), 'line-width': matchExpr(p => p.line?.width, 1.5), 'line-opacity': matchExpr(p => p.line?.opacity, 0.9) } }, before);
    // 점선은 dasharray가 match 표현식을 못 받는다(MapLibre 제약) → 점선 kind만 따로 한 층
    map.addLayer({ id: 'micro-line-dash', type: 'line', source: 'micro', filter: ['all', ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString', 'Polygon']]], ['in', ['get', 'kind'], kindsWith(p => !!p.line?.dash)]],
      paint: { 'line-color': matchExpr(p => p.line?.color, '#888888'), 'line-width': matchExpr(p => p.line?.width, 1.5), 'line-dasharray': [3, 1.6] } }, before);
    map.addLayer({ id: 'micro-point', type: 'circle', source: 'micro', filter: ['all', ['==', ['geometry-type'], 'Point'], ['in', ['get', 'kind'], kindsWith(p => !!p.point)]],
      paint: { 'circle-radius': ['match', ['get', 'kind'], 'redoubt', 3, 'camp', 6, 5], 'circle-color': matchExpr(p => p.fill?.color ?? p.line?.color, '#5A4632'), 'circle-stroke-color': '#F3ECDD', 'circle-stroke-width': 1.2 } }, before);
    map.addLayer({ id: 'micro-label', type: 'symbol', source: 'micro', filter: ['in', ['get', 'kind'], kindsWith(p => !!p.label)],
      layout: { 'text-field': ['get', 'name_ko'], 'text-size': 12, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false },
      paint: { 'text-color': '#2B2419', 'text-halo-color': '#F3ECDD', 'text-halo-width': 1.4 } }, before);
  }
  function setBasemap(def: MicroMapDef | null) {
    if (map.getLayer('micro-basemap')) map.removeLayer('micro-basemap');
    if (map.getSource('micro-basemap')) map.removeSource('micro-basemap');
    const bm = def?.basemap; if (!bm) return;
    const { w, e, n, s } = bm.corners;
    map.addSource('micro-basemap', { type: 'image', url: `${opts.root}datasets/${opts.ds}/rasters/${bm.file}`, coordinates: [[w, n], [e, n], [e, s], [w, s]] });
    map.addLayer({ id: 'micro-basemap', type: 'raster', source: 'micro-basemap', minzoom: bm.min_zoom ?? 0, paint: { 'raster-opacity': bm.opacity } }, 'micro-fill');
  }
  return {
    active: () => active,
    enter(def: MicroMapDef) {
      if (active?.id === def.id) return;
      ensureLayers();
      active = def;
      (map.getSource('micro') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: def.features } as any);
      setBasemap(def);
      opts.onEnter?.(def);
    },
    leave() {
      if (!active) return;
      active = null;
      (map.getSource('micro') as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY as any);
      setBasemap(null);
      opts.onLeave?.();
    },
  };
}
```

- [ ] **Step 3: 엔진 교체**

`src/map/engine.ts`에서
1. import에 `import { createMicro } from './micro'; import { INDEX, loadMicro, microMapAt } from '../micromaps';` 를 더하고 `ALESIA, ALEXANDRIA, ROMA_URBS, PACK_BASEMAPS` import를 지운다.
2. `LAYER_GROUPS`에서 `alesia`·`roma`·`alexandria` 항목을 지우고 `micro: ['micro-basemap','micro-fill','micro-fill-outline','micro-line','micro-line-dash','micro-point','micro-label']`를 더한다. 233행 근처에 나열된 `alesia-*` 이름도 지운다.
3. `addData()` 안의 알레시아·로마·알렉산드리아 블록(`if (ALESIA?.features?.length …` 부터 세 블록 끝까지)과 도판 블록(`PACK_BASEMAPS` 순회)을 지우고, 그 자리에 `micro = createMicro(map, { root, ds, palette: Object.fromEntries(d.actors.map(a => [a.id, a.color])), before: () => map.getLayer('label-marine') ? 'label-marine' : undefined, onEnter: def => hideContinental(true, def.hide), onLeave: () => hideContinental(false) });` (`let micro: ReturnType<typeof createMicro> | null = null;`을 함수 위에 선언).
4. `syncDetailMaps(scene)`를 이렇게 바꾼다.
```ts
  let microWanted: string | null = null;
  function syncDetailMaps(scene: string | null) {
    const sc = scene ? scenesRef.find(x => x.id === scene) : null;   // scenesRef: createEngine 인수로 scenes를 받아 둔다
    const id = sc?.micro ?? microMapAt(map.getZoom(), map.getCenter().toArray() as [number, number]);
    if (id === microWanted) return;
    microWanted = id;
    if (!id) { micro?.leave(); return; }
    loadMicro(id).then(def => { if (microWanted === id) micro?.enter(def); }).catch(err => console.warn(err));
  }
  function hideContinental(on: boolean, groups: string[] = ['movements']) {
    const set = (ids: string[], vis: boolean) => { for (const l of ids) if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', vis ? 'visible' : 'none'); };
    for (const g of groups) set(LAYER_GROUPS[g] ?? [], !on);
    set(['territory-label', 'territory-outline', 'region-name', 'peoples-label', 'peoples-line', 'client-hatch', 'client-edge'], !on);
  }
```
`createEngine(container, d, store, root, ds, dark, boards, scenes: Scene[] = [])`로 시그니처를 늘리고 `App.tsx`의 호출에 `scenes`를 넘긴다. `moveend`에도 `syncDetailMaps(store.get().scene)`를 건다(지금은 `zoomend`만 있다. 이동만으로 지도를 벗어나는 경우를 잡는다).
5. `present.ts`에서 `ALESIA_SCENE`·`ALESIA_MIN_ZOOM`·`ROMA_MIN_ZOOM`·`ALEXANDRIA_MIN_ZOOM`·`showAlesia`·`showRomaUrbs`·`showAlexandria`를 지운다. `test/present.test.ts`의 해당 케이스도 지운다.
6. `src/callouts.ts`는 `representativePoint`·`THUMBS`만 남기고 `CALLOUTS`·`HOME`·`SOURCES`·`microMapAt`·`MicroMap`을 지운다. `Callouts.tsx`는 엔진이 `onMicro(def | null)` 콜백으로 준 `def`에 `resolveCallouts(def)`를 걸어 핀을 그린다(엔진 반환 객체에 `onMicro(fn)` 추가, `micro.enter/leave`에서 호출).
7. `packData.ts`에서 `ALESIA`·`ROMA_URBS`·`ALEXANDRIA`·`PACK_BASEMAPS`·`BasemapScan`을 지운다.

- [ ] **Step 4: typecheck·테스트**

Run: `npm run validate`
Expected: 초록. `grep -rn "showAlesia\|ALESIA\b\|PACK_BASEMAPS" src/` 가 0건.

- [ ] **Step 5: 렌더 전후 대조**

```bash
npm run build && bash scripts/serve.sh
for s in pack-alesia-52 pack-roma-urbs pack-alexandria-47; do python3 scripts/look.py $s; done
```
`look.py`가 찍는 층 개수를 Task 1.2 이전 커밋(체크아웃 `git stash` 또는 이전 dist)에서 찍은 값과 비교한다. 알레시아 포위선 두 겹·로마 포메리움·알렉산드리아 헵타스타디온이 캡처에 보이고 콜아웃 핀 수가 9·7·7이다. 수치는 `docs/BACKLOG.md` R47 행에 적는다.

- [ ] **Step 6: 옛 파일 삭제와 커밋**

```bash
git rm data/overlays/pack-alesia.json data/overlays/pack-roma-urbs.json data/overlays/pack-alexandria.json data/overlays/pack-callouts.json data/overlays/pack-basemaps.json
git rm scripts/migrate-micromaps.mjs
git add src/map/micro.ts src/map/engine.ts src/callouts.ts src/app/Callouts.tsx src/app/App.tsx src/present.ts src/packData.ts test/micromap.test.ts test/present.test.ts
git commit -m "refactor(미시지도): 범용 렌더러 micro.ts · 엔진 하드코딩 31층 제거 · 옛 pack 파일 삭제 (R47)"
```

---

### Task 1.5: 장면 `micro` 필드 + 칸나이 미시지도

**Files:**
- Modify: `src/state.ts` (`Scene.micro?: string`)
- Create: `data/micromaps/cannae.json` · `data/micromaps/index.json` 갱신
- Modify: `data/scenes/rome.json` (`pack-alesia-52`·`pack-roma-urbs`·`pack-alexandria-47`에 `micro`, `cannae-board`에 `micro: "cannae"`)
- Test: `test/micromap.test.ts` (장면 `micro` 참조 실재) · `test/state.test.ts`(`bookmarkOf`가 `micro`를 담지 않는다: 미시지도는 카메라에서 파생되므로 장면 파일에서만 온다)

**Interfaces:**
- Produces: 장면이 `micro`를 가지면 줌과 무관하게 그 지도가 켜진다(Task 1.4의 `syncDetailMaps`가 이미 읽는다).

- [ ] **Step 1: 테스트**

```ts
it('장면의 micro 가 레지스트리에 있다', () => {
  const scenes = rd(join(ROOT, 'data', 'scenes', 'rome.json')) as { id: string; micro?: string }[];
  const ids = new Set(files.map(f => f.replace(/\.json$/, '')));
  for (const s of scenes) if (s.micro) expect(ids.has(s.micro), `${s.id} → ${s.micro}`).toBe(true);
});
```

- [ ] **Step 2: state.ts**

`Scene`에 `micro?: string;                 // 미시지도 id. 있으면 줌 문턱과 무관하게 그 지도가 켜진다 (OVERHAUL §3.2)` 한 줄.

- [ ] **Step 3: 칸나이 파일**

좌표는 정본에서만 가져온다. `public/datasets/rome/layers/settlements.geojson`에서 `place:칸나이평원` 좌표(`[16.1325, 41.3064]`)와 `layers/landmarks.geojson`에서 `Aufidus` 강 정점을 읽는다(없으면 강은 넣지 않는다. 지어내지 않는다).

```bash
python3 -c "
import json
L=json.load(open('public/datasets/rome/layers/landmarks.geojson'))['features']
print([ (f['properties'].get('name'), f['geometry']['type'], f['geometry']['coordinates'] if f['geometry']['type']=='Point' else len(f['geometry']['coordinates'])) for f in L if 'aufid' in str(f['properties'].get('name','')).lower()])"
```

```json
{
 "id": "cannae", "title": "칸나이 · BC 216", "year": -216, "teaching": true,
 "source": "말판 cannae-216의 그릇이다. 평원 중심은 정본 place:칸나이평원 좌표이고, 아우피두스 강은 Pleiades 정점을 그대로 썼다. 어느 기슭이었는지는 논쟁 중이라(말판 source 참조) 강 이외의 지형 요소는 그리지 않았다.",
 "home": { "at": [16.1325, 41.3064], "minZoom": 10, "span": 0.35 },
 "view": { "center": [16.1325, 41.3064], "zoom": 11, "pitch": 0, "bearing": 0 },
 "hide": ["movements"], "basemap": null, "dem": null, "board": "cannae-216",
 "features": [
  { "type": "Feature", "properties": { "id": "cannae:plain", "name_ko": "칸나이 평원", "name_la": "Cannae", "kind": "plain", "grade": "확정", "source": "정본 place:칸나이평원 중심점. 면은 반경 2km 근사", "note_ko": "한니발이 로마군을 끌어들인 평지" },
    "geometry": { "type": "Point", "coordinates": [16.1325, 41.3064] } }
 ],
 "callouts": []
}
```
아우피두스 강이 있으면 `{ "id": "cannae:aufidus", "kind": "river", "grade": "확정", "source": "Pleiades Aufidus" }` LineString을 더한다. `index.json`에 칸나이 행을 더한다.

- [ ] **Step 4: 장면 파일**

`data/scenes/rome.json`에서 `pack-alesia-52`에 `"micro": "alesia"`, `pack-roma-urbs`에 `"micro": "roma"`, `pack-alexandria-47`에 `"micro": "alexandria"`, `cannae-board`에 `"micro": "cannae"`.

- [ ] **Step 5: 검증·렌더·커밋**

```bash
npm run validate && npm run build && bash scripts/serve.sh && python3 scripts/look.py cannae-board
```
Expected: 칸나이 장면에서 말판 유닛 14와 평원 라벨이 보인다.
```bash
git add src/state.ts data/micromaps/cannae.json data/micromaps/index.json data/scenes/rome.json test/micromap.test.ts
git commit -m "feat(미시지도): 장면 micro 필드 · 칸나이 등록"
```

---

### Task 1.6: 번들 340 게이트 닫기 (P0·P1 완료 판정)

**Files:**
- Modify: `src/main.tsx` (`data/boards/*.json` eager glob → lazy는 하지 않는다. 말판은 20 KB라 남긴다. 대신 `data/overlays/pack-legions.json`·`pack-scene-text.json`처럼 발표 장면이 안 쓰는 건 없다. 여기서는 측정만)
- Modify: `docs/BACKLOG.md` (R46·R47 행 상태와 근거)

- [ ] **Step 1: 잰다**

Run: `npm run build`
Expected: postbuild 게이트(340) 통과. 안 되면 `grep -o "pack-[a-z-]*" dist/assets/index-*.js | sort -u`로 초기 청크에 남은 오버레이를 보고, 발표 장면 첫 화면에 필요 없는 것(`pack-legions`는 people 층이 쓰므로 남긴다)을 `import()`로 뗀다. 340을 넘는 동안은 커밋하지 않는다.

- [ ] **Step 2: BACKLOG 근거 적기**

`docs/BACKLOG.md` R46 행을 `● 2026-09-xx` 로 바꾸고 근거로 `index-*.js NNN.N kB gz (check-bundle)`, R47 행을 `◐`(세 지도 이관 + 칸나이, 새 셋은 계획 2/4) 로 바꾸고 `look.py` 층 개수 전후 값을 적는다.

- [ ] **Step 3: 커밋**

```bash
git add docs/BACKLOG.md
git commit -m "docs(BACKLOG): R46 닫힘 · R47 부분 (레지스트리 이관 근거)"
```

---

## Self-review (계획 작성자가 했다)

- 스펙 P-A: Task A1·A2. P0: Task 0.1·0.2 (360 게이트) + Task 1.6 (340 게이트). P1: Task 1.1~1.5. 스펙 §3.4 P0 행의 「≤ 340」은 Task 1.6 시점에 닫힌다. 미시 오버레이를 두 번 옮기지 않기 위한 순서 조정이고 `docs/OVERHAUL.md` §3.4에 같은 문장을 적어 둔다.
- 타입 일관성: `MicroMapDef`·`CalloutDef`(schema) ↔ `resolveCallouts`·`createMicro`(micro.ts) ↔ `loadMicro`·`microMapAt`(micromaps.ts) ↔ 엔진 `syncDetailMaps`. `Scene.micro`는 state.ts.
- 자리표시자: KIND_PAINT의 알레시아 네 줄 외 값은 「engine.ts 옛 블록에서 옮긴다」로 출처를 못 박았다. 지어내는 값은 없다.
