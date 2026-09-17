# 전면 개선 슬라이스 I · 계획 4/4: 없던 장면 둘 · 즉석 북마크 · 모바일 읽기 모드 · 마감

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대표님 녹취에서 아직 없던 장면 둘(평야 · 카르하이)을 넣고, 커밋 없이 저장·공유·내보내는 즉석 북마크를 열고, 620px 이하에서 발표를 따라갈 수 있는 읽기 모드를 만든다. 끝으로 슬라이스 I의 완료 근거를 문서에 적는다.

**Architecture:** 장면은 `data/scenes/rome.json`에 두 항목. 북마크는 `src/bookmarks.ts`가 localStorage를 `Scene[]`로 읽고 쓰며 장면 목록에 「내 북마크」 그룹으로 합쳐진다(발표 넘김은 그룹 안에서만). 모바일은 `MobileSheet.tsx` 하나가 설명·콜아웃·객체·재생을 탭으로 담고, 좁은 화면에서 탐색 카드·인스펙터·툴바를 숨긴다.

**Tech Stack:** TypeScript · React 19 · localStorage · CSS 미디어쿼리 · vitest · Python playwright(CDP) 계측

**Spec:** `docs/OVERHAUL.md` §3.2(북마크) · §3.3(6) · §3.4 P5~P7 · §3.8. 요구 원장 R44 · R49 · R50. 선행: 계획 1/4~3/4.

## Global Constraints

- 초기 JS ≤ 340 kB gz(postbuild 게이트). 북마크 모듈은 작다(zod 없음, 필드 화이트리스트).
- 장면 연도 단조성 테스트(`test/present.test.ts`) 유지. 좌표·연도를 지어내지 않는다(카르하이 점은 정본·교보재에서 읽는다).
- 모바일은 읽기 전용(DESIGN §4): 스크럽·탭·재생만. 터치 타깃 ≥ 44px. 브라우저 다이얼로그(`prompt`·`confirm`) 금지(CDP 검증이 막힌다). 
- `git add` 경로 명시. push는 River가 말할 때만. 카피는 한국어, 작대기·이모지 금지.
- 렌더 확인: `bash scripts/serve.sh` + `python3 scripts/look.py` · 모바일은 `python3 scripts/look-mobile.py`.

---

## 모델링 (이 계획이 정하는 모델)

| 모델 | 정의 | 요지 |
|---|---|---|
| 북마크 저장소 | `src/bookmarks.ts` | localStorage 키 `chronoatlas:bookmarks:<ds>` → `{ v: 1, items: Scene[] }`. `group`은 항상 `내 북마크` |
| 북마크 항목 | `Scene`(state.ts) 그대로 | `bookmarkOf()`가 만드는 조각과 같은 모양. 화이트리스트 밖 키는 가져오기에서 버린다 |
| 장면 합집합 | App | `allScenes = [...파일 장면, ...북마크]`. 발표 넘김·장면 탭은 합집합, 엔진 `syncDetailMaps`는 파일 장면만(`micro`는 파일 장면에만 있다) |
| 좁은 화면 | `useNarrow()` | `matchMedia('(max-width: 620px)')`. 참이면 `MobileSheet`가 탐색·인스펙터·툴바를 대신한다 |
| 시트 상태 | `MobileSheet` | `snap: 'peek' | 'half' | 'full'` · `tab: '설명' | '콜아웃' | '객체' | '재생'` |

---

### Task 5.1: 장면 둘 (R49)

**Files:**
- Modify: `data/scenes/rome.json` (`plains-empire` · `carrhae-53`) · `data/overlays/pack-scene-text.json`(두 항목)
- Test: `test/present.test.ts` (기존 단조성 + 새 장면 존재)

- [ ] **Step 1: 카르하이 점을 데이터에서 읽는다**

```bash
python3 - <<'EOF'
import json
for f in ['data/overlays/pack-battles.json']:
    for x in json.load(open(f))['features']:
        if '카르' in json.dumps(x['properties'], ensure_ascii=False): print(f, x['properties'], x['geometry']['coordinates'])
L=json.load(open('public/datasets/rome/layers/landmarks.geojson'))['features']
print([ (f['properties'].get('name'), f['geometry']['coordinates']) for f in L if 'Carrhae' in str(f['properties'].get('name'))])
EOF
```
카메라 중심은 그 점(교보재 `pack-battles`의 카르하이 정점이 있으면 그것, 없으면 Pleiades `Carrhae`)을 화면 가운데 오른쪽에 두는 값으로 잡는다(줌 5.4, 중심은 점에서 서쪽으로 3°). 값은 `note`가 아니라 커밋 메시지에 출처를 적는다.

- [ ] **Step 2: 테스트 추가**

```ts
it('대표님 녹취에서 없던 장면 둘이 있고 그룹 안 연도가 오름차순이다', () => {
  const scenes = rd('data/scenes/rome.json');
  for (const id of ['plains-empire', 'carrhae-53']) expect(scenes.some((s: any) => s.id === id), id).toBe(true);
  for (const g of ['로마의 확장', '선례']) {
    const ys = scenes.filter((s: any) => s.group === g).map((s: any) => s.year);
    expect(ys).toEqual([...ys].sort((a: number, b: number) => a - b));
  }
});
```
(`rd`는 파일 상단의 헬퍼. 없으면 `readFileSync` + `JSON.parse`로 한 줄 만든다.) Run → FAIL.

- [ ] **Step 3: 장면**

`로마의 확장` 그룹 **맨 앞**에:
```json
{ "id": "plains-empire", "title": "왜 제국인가: 평야 · BC 270", "year": -270, "center": [9, 39.5], "zoom": 4.6, "pitch": 0, "bearing": 0, "view": "2d", "skin": "campaign",
  "layers": ["territory", "admin_regions", "settlements", "relief", "rivers", "labels", "plains"], "group": "로마의 확장",
  "note": "곡창 일곱과 척박 셋. 평야가 잉여를 만들고 잉여가 군단을 먹인다. 그리스 반도에는 이 색이 없다." }
```
`선례` 그룹의 `sulla-88` 뒤에:
```json
{ "id": "carrhae-53", "title": "카르하이 · BC 53, 삼두정치가 깨진 곳", "year": -53, "center": [36.0, 36.9], "zoom": 5.4, "pitch": 0, "bearing": 0, "view": "2d", "skin": "campaign",
  "layers": ["territory", "admin_regions", "settlements", "people", "relief", "rivers", "labels", "story_battles"], "group": "선례",
  "note": "크라수스가 파르티아에게 죽는다. 세 사람의 균형이 둘의 대결이 된다. 루비콘은 여기서 시작한다." }
```
`center`는 Step 1의 값으로 바꾼다. `pack-scene-text.json`의 `scenes`에 두 id를 더한다(`note` · `event_ko` · `look_for`. 카르하이 `look_for`: 「전투점과 그 해 크라수스의 말. 파르티아 영역은 보라」).

- [ ] **Step 4: 검증·커밋**

```bash
npm run validate && npm run build && bash scripts/serve.sh && python3 scripts/look.py plains-empire && python3 scripts/look.py carrhae-53
```
Expected: 평야 장면에 곡창 금색 면이 뜨고, 카르하이 장면에 전투점과 크라수스 말이 뜬다(`look.py`의 people 목록에 크라수스). 캡처 → `docs/verify/overhaul/`.
```bash
git add data/scenes/rome.json data/overlays/pack-scene-text.json test/present.test.ts docs/verify/overhaul
git commit -m "feat(장면): 「왜 제국인가: 평야」 · 「카르하이 BC 53」 (R49)"
```

---

### Task 6.1: `src/bookmarks.ts`

**Files:**
- Create: `src/bookmarks.ts`
- Test: `test/bookmarks.test.ts`

**Interfaces:**
- Produces: `createBookmarks(ds, storage?: Storage) → { list(): Scene[]; save(s: Scene): Scene[]; remove(id): Scene[]; exportJson(): string; importJson(text): { added: number; dropped: number }; available: boolean }`. 상수 `BOOKMARK_GROUP = '내 북마크'`.

- [ ] **Step 1: 테스트**

```ts
// test/bookmarks.test.ts
import { describe, it, expect } from 'vitest';
import { createBookmarks, BOOKMARK_GROUP } from '../src/bookmarks';
import { bookmarkOf, DEFAULTS } from '../src/state';

function fakeStorage(): Storage { const m = new Map<string, string>(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage; }

describe('즉석 북마크 (R44)', () => {
  it('저장 → 목록 → 삭제 왕복', () => {
    const b = createBookmarks('rome', fakeStorage());
    const sc = bookmarkOf({ ...DEFAULTS, year: -49, center: [12.4, 44.1], zoom: 10.8, board: 'pharsalus-48', phase: 2 }, { id: 'x1', title: '루비콘', layers: ['territory'] });
    expect(b.save(sc)).toHaveLength(1);
    expect(b.list()[0]).toMatchObject({ id: 'x1', title: '루비콘', year: -49, group: BOOKMARK_GROUP, board: 'pharsalus-48', phase: 2 });
    expect(b.remove('x1')).toHaveLength(0);
  });
  it('같은 id 는 덮어쓴다', () => {
    const b = createBookmarks('rome', fakeStorage());
    b.save({ id: 'a', title: '1', year: -1 }); b.save({ id: 'a', title: '2', year: -2 });
    expect(b.list()).toHaveLength(1); expect(b.list()[0].title).toBe('2');
  });
  it('가져오기는 화이트리스트 밖 키를 버리고 형식 밖 항목을 센다', () => {
    const b = createBookmarks('rome', fakeStorage());
    const r = b.importJson(JSON.stringify({ v: 1, items: [{ id: 'ok', title: '좋음', year: -44, evil: '<script>' }, { title: '없음' }, 'x'] }));
    expect(r).toEqual({ added: 1, dropped: 2 });
    expect(Object.keys(b.list()[0])).not.toContain('evil');
    expect(b.importJson('not json')).toEqual({ added: 0, dropped: 0 });
  });
  it('내보내기는 다시 가져올 수 있다', () => {
    const a = createBookmarks('rome', fakeStorage()), c = createBookmarks('rome', fakeStorage());
    a.save({ id: 'k', title: 't', year: 117, skin: 'oldmap', layers: ['territory'] });
    expect(c.importJson(a.exportJson())).toEqual({ added: 1, dropped: 0 });
    expect(c.list()).toEqual(a.list());
  });
  it('storage 가 없으면 available=false 이고 저장은 조용히 실패한다', () => {
    const b = createBookmarks('rome', undefined as unknown as Storage);
    expect(b.available).toBe(false); expect(b.save({ id: 'x', title: 'x', year: 0 })).toEqual([]);
  });
});
```
Run → FAIL.

- [ ] **Step 2: 구현**

```ts
// src/bookmarks.ts — 커밋 없는 즉석 북마크(R44). localStorage ↔ Scene[]. 서버도 zod도 없다.
import type { Scene } from './state';

export const BOOKMARK_GROUP = '내 북마크';
const KEYS = ['id', 'title', 'year', 'to', 'sel', 'center', 'zoom', 'pitch', 'bearing', 'view', 'skin', 'layers', 'note', 'board', 'phase'] as const;

function clean(x: unknown): Scene | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id || typeof o.title !== 'string' || !o.title || !Number.isInteger(o.year)) return null;
  const out: Record<string, unknown> = {};
  for (const k of KEYS) if (o[k] !== undefined) out[k] = o[k];
  out.group = BOOKMARK_GROUP;
  return out as unknown as Scene;
}

export function createBookmarks(ds: string, storage: Storage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage) {
  const key = `chronoatlas:bookmarks:${ds}`;
  let available = !!storage;
  try { storage?.setItem(`${key}:probe`, '1'); storage?.removeItem(`${key}:probe`); } catch { available = false; }
  const read = (): Scene[] => { if (!available) return []; try { const j = JSON.parse(storage!.getItem(key) ?? '{"v":1,"items":[]}'); return Array.isArray(j.items) ? j.items.flatMap((i: unknown) => clean(i) ?? []) : []; } catch { return []; } };
  const write = (items: Scene[]): Scene[] => { if (!available) return []; try { storage!.setItem(key, JSON.stringify({ v: 1, items })); return items; } catch { available = false; return []; } };
  return {
    get available() { return available; },
    list: read,
    save(s: Scene) { const c = clean(s); if (!c) return read(); return write([...read().filter(x => x.id !== c.id), c]); },
    remove(id: string) { return write(read().filter(x => x.id !== id)); },
    exportJson() { return JSON.stringify({ v: 1, items: read() }, null, 2); },
    importJson(text: string) {
      let j: unknown; try { j = JSON.parse(text); } catch { return { added: 0, dropped: 0 }; }
      const items = (j as { items?: unknown[] })?.items; if (!Array.isArray(items)) return { added: 0, dropped: 0 };
      const ok = items.map(clean); const good = ok.filter((x): x is Scene => !!x);
      const merged = [...read().filter(x => !good.some(g => g.id === x.id)), ...good];
      write(merged); return { added: good.length, dropped: ok.length - good.length };
    },
  };
}
export type Bookmarks = ReturnType<typeof createBookmarks>;
```

- [ ] **Step 3: 통과·커밋**

Run: `npx vitest run test/bookmarks.test.ts` → PASS.
```bash
git add src/bookmarks.ts test/bookmarks.test.ts
git commit -m "feat(북마크): localStorage 즉석 북마크 저장소 (R44)"
```

---

### Task 6.2: 장면 탭 UI와 발표 넘김 합류

**Files:**
- Modify: `src/app/App.tsx` (장면 탭 `scene-new` 블록 교체 · `allScenes` 합집합 · `[` `]`·장면 알약이 합집합을 쓴다)
- Modify: `src/app/shell.css` (`.bm-*`)

**Interfaces:**
- Consumes: `createBookmarks(ds)` · `bookmarkOf` · `bookmarkId()`·`bookmarkTitle()`(App에 이미 있다).
- Produces: 「내 북마크」 그룹이 장면 탭·발표 넘김에 보인다.

- [ ] **Step 1: 상태와 합집합**

App 상단:
```tsx
import { createBookmarks, BOOKMARK_GROUP } from '../bookmarks';
const bm = useMemo(() => createBookmarks(ds), [ds]);
const [marks, setMarks] = useState<Scene[]>(() => bm.list());
const allScenes = useMemo(() => [...scenes, ...marks], [scenes, marks]);
```
`presentGroupOf(scenes, …)`·`scenesInGroup(scenes, …)`·`sceneGroups`·장면 알약(`list`)의 `scenes`를 전부 `allScenes`로 바꾼다. `createEngine(...)`에 넘기는 것은 `scenes`(파일) 그대로.

- [ ] **Step 2: 저장 UI (다이얼로그 없음)**

`scene-new` 블록을 이렇게 바꾼다.
```tsx
<div className="scene-new">
  <div className="bm-row">
    <input className="bm-title" value={newTitle} onChange={e => setNewTitle(e.currentTarget.value)} placeholder={bookmarkTitle()} aria-label="북마크 제목" />
    <Button label="지금 화면 저장" size="sm" variant="secondary" isDisabled={!bm.available}
      onClick={() => { setMarks(bm.save(bookmarkOf(store.get(), { id: bookmarkId(), title: newTitle.trim() || bookmarkTitle(), group: BOOKMARK_GROUP, layers: [...on] }))); setNewTitle(''); }} />
  </div>
  {!bm.available && <Text size="sm" color="secondary">이 브라우저는 저장 공간을 막아 두었다. 링크 복사만 된다.</Text>}
  <div className="bm-row">
    <Button label={copied === 'url' ? '복사됨' : '이 화면 링크 복사'} size="sm" variant="ghost" onClick={() => copy('url', location.href)} />
    <Button label={copied === 'json' ? '복사됨' : '북마크 조각 복사'} size="sm" variant="ghost" onClick={() => copy('json', JSON.stringify(bookmarkOf(store.get(), { id: bookmarkId(), title: bookmarkTitle(), layers: [...on] }), null, 2))} />
    <Button label="내보내기" size="sm" variant="ghost" isDisabled={!marks.length} onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bm.exportJson()], { type: 'application/json' })); a.download = `chronoatlas-bookmarks-${ds}.json`; a.click(); URL.revokeObjectURL(a.href); }} />
    <label className="bm-import"><input type="file" accept="application/json" onChange={async e => { const f = e.currentTarget.files?.[0]; if (!f) return; const r = bm.importJson(await f.text()); setMarks(bm.list()); setImportNote(`${r.added}개 가져옴${r.dropped ? `, ${r.dropped}개 버림` : ''}`); e.currentTarget.value = ''; }} />가져오기</label>
  </div>
  {importNote && <Text size="sm" color="secondary">{importNote}</Text>}
</div>
```
상태 `const [newTitle, setNewTitle] = useState(''); const [importNote, setImportNote] = useState('');`. 장면 목록의 `내 북마크` 그룹 항목에는 `<button className="bm-del" aria-label="삭제" onClick={e => { e.stopPropagation(); setMarks(bm.remove(sc.id)); }}>지우기</button>`를 `arrow` 앞에 둔다(`sc.group === BOOKMARK_GROUP`일 때만).
CSS:
```css
.bm-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.bm-title { flex: 1 1 140px; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: var(--radius-element, 8px); background: var(--color-background-surface); color: var(--color-text-primary); font: 500 13px/1 var(--font-family-body); }
.bm-import { font-size: 12px; color: var(--color-text-secondary); cursor: pointer; } .bm-import input { display: none; }
.bm-del { margin-left: auto; font-size: 11px; color: var(--color-text-secondary); background: none; border: 0; cursor: pointer; }
```

- [ ] **Step 3: 검증**

```bash
npm run validate && npm run build && bash scripts/serve.sh
```
검증 창(발표 모드 끄고 `F`): 장면 탭 → 제목 입력 → 저장 → 새로고침 → 「내 북마크」 그룹에 있다 → 클릭하면 그 화면으로 → `F` → `[` `]`가 그 그룹 안에서 돈다 → 내보내기 파일이 내려온다. CDP 콘솔에서 `localStorage.getItem('chronoatlas:bookmarks:rome')`가 `{"v":1,"items":[…]}`.

- [ ] **Step 4: 커밋**

```bash
git add src/app/App.tsx src/app/shell.css
git commit -m "feat(북마크): 장면 탭 저장·삭제·내보내기·가져오기 · 발표 넘김에 합류 (R44)"
```

---

### Task 7.1: 모바일 읽기 모드 `MobileSheet.tsx`

**Files:**
- Create: `src/app/MobileSheet.tsx` · `src/app/useNarrow.ts`
- Modify: `src/app/App.tsx` (좁으면 시트, 탐색·인스펙터·툴바·범례 숨김) · `src/app/Callouts.tsx` (좁으면 핀만, 카드는 시트로) · `src/app/shell.css`

**Interfaces:**
- Produces: `useNarrow(): boolean` · `MobileSheet({ scene, brief, callouts, sel, board, engine, onPick(id), onGo(scene) })`.

- [ ] **Step 1: 훅**

```ts
// src/app/useNarrow.ts
import { useEffect, useState } from 'react';
const Q = '(max-width: 620px)';
export function useNarrow(): boolean {
  const [n, setN] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(Q).matches);
  useEffect(() => { const m = matchMedia(Q); const fn = () => setN(m.matches); m.addEventListener('change', fn); return () => m.removeEventListener('change', fn); }, []);
  return n;
}
```

- [ ] **Step 2: 시트**

```tsx
// src/app/MobileSheet.tsx — 620px 이하 읽기 모드. 설명·콜아웃·객체·재생을 한 시트에 탭으로. 편집 UI 없음(DESIGN §4).
import { useState } from 'react';
import { Button, Text } from '@astryxdesign/core';
import type { Scene } from '../state';
import type { ResolvedCallout } from '../map/micro';
import type { BoardData } from '../board';
import type { Engine } from '../map/engine';

type Tab = '설명' | '콜아웃' | '객체' | '재생';
export function MobileSheet({ scene, brief, callouts, selNode, board, engine, focus, onPick }:
  { scene: Scene | null; brief: { note?: string; event_ko?: string; look_for?: string } | null; callouts: ResolvedCallout[]; selNode: React.ReactNode; board: BoardData | null; engine: Engine | null; focus: string | null; onPick: (id: string) => void }) {
  const [snap, setSnap] = useState<'peek' | 'half' | 'full'>('peek');
  const [tab, setTab] = useState<Tab>('설명');
  const tabs: Tab[] = ['설명', '콜아웃', '객체', ...(board ? ['재생' as Tab] : [])];
  const b = engine?.battle() ?? null;
  return (
    <section className={`mobile-sheet is-${snap}`} aria-label="읽기 시트">
      <button className="ms-grip" aria-label="시트 크기" onClick={() => setSnap(s => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'))} />
      <div className="ms-tabs" role="tablist">{tabs.map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => { setTab(t); if (snap === 'peek') setSnap('half'); }}>{t}</button>)}</div>
      <div className="ms-body">
        {tab === '설명' && (<>
          <Text weight="semibold">{scene?.title ?? ''}</Text>
          {(brief?.event_ko || scene?.note) && <Text size="sm">{brief?.event_ko ?? scene?.note}</Text>}
          {brief?.look_for && <Text size="sm" color="secondary">{brief.look_for}</Text>}
        </>)}
        {tab === '콜아웃' && (callouts.length ? <ol className="ms-callouts">{callouts.sort((a, c) => a.num - c.num).map(c => (
          <li key={c.id} id={`ms-${c.id}`} className={focus === c.id ? 'is-focus' : ''} onClick={() => onPick(c.id)}>
            <span className="num">{c.num}</span><div><strong>{c.title}</strong><p>{c.body}</p>{c.cite && <small>{c.cite}</small>}</div>
          </li>))}</ol> : <Text size="sm" color="secondary">이 화면에는 콜아웃이 없다. 세부 지도로 들어가면 생긴다.</Text>)}
        {tab === '객체' && (selNode ?? <Text size="sm" color="secondary">지도의 점이나 부대를 누르면 여기 뜬다.</Text>)}
        {tab === '재생' && board && b && (
          <div className="ms-play">
            <div className="bt-controls">
              <Button label={b.playing() ? '정지' : '재생'} size="sm" onClick={() => (b.playing() ? b.pause() : b.play())} />
              <Button label="이전" size="sm" variant="ghost" onClick={() => b.seek(Math.max(0, Math.ceil(b.t()) - 1))} />
              <Button label="다음" size="sm" variant="ghost" onClick={() => b.seek(Math.min(board.phases.length - 1, Math.floor(b.t()) + 1))} />
            </div>
            <Text size="sm">{b.frame()?.caption ?? board.phases[Math.floor(b.t())].title}</Text>
            {b.frame()?.cite && <Text size="sm" color="secondary">{b.frame()!.cite}</Text>}
          </div>)}
      </div>
    </section>
  );
}
```
CSS(`shell.css` 끝):
```css
.mobile-sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 6; display: grid; grid-template-rows: 24px 44px 1fr; background: var(--color-background-surface); border-top: 1px solid var(--color-border); border-radius: 14px 14px 0 0; box-shadow: var(--shadow-med, 0 -4px 16px rgba(0,0,0,.12)); transition: height 180ms ease; }
.mobile-sheet.is-peek { height: 68px; } .mobile-sheet.is-half { height: 46vh; } .mobile-sheet.is-full { height: 88vh; }
.ms-grip { height: 24px; background: none; border: 0; position: relative; } .ms-grip::after { content: ''; position: absolute; left: 50%; top: 9px; width: 40px; height: 4px; margin-left: -20px; border-radius: 2px; background: var(--color-border); }
.ms-tabs { display: flex; gap: 4px; padding: 0 12px; } .ms-tabs button { flex: 1; min-height: 44px; border: 0; background: none; font: 600 13px/1 var(--font-family-body); color: var(--color-text-secondary); border-bottom: 2px solid transparent; } .ms-tabs button.is-on { color: var(--color-text-primary); border-bottom-color: var(--color-text-primary); }
.ms-body { overflow: auto; padding: 8px 16px 24px; display: grid; gap: 8px; align-content: start; }
.ms-callouts { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; } .ms-callouts li { display: flex; gap: 10px; min-height: 44px; } .ms-callouts li.is-focus { background: var(--color-background-muted); border-radius: 8px; }
.ms-callouts .num { flex: 0 0 24px; height: 24px; border-radius: 50%; background: #B8860B; color: #fff; font: 700 12px/24px var(--font-family-body); text-align: center; }
.ms-callouts p { margin: 2px 0; font-size: 13px; line-height: 1.5; } .ms-callouts small { color: var(--color-text-secondary); }
@media (max-width: 620px) {
  .shell-explorer, .shell-explorer-pill, .shell-right, .shell-legend, .shell-env, .shell-footnote, .shell-scan-note, .shell-board, .ca-callout-col, .ca-callout-lines { display: none !important; }
  .shell-scene-nav { bottom: 76px; }          /* 시트(peek 68px) 위 */
  .shell-present-hud { max-width: calc(100% - 24px); }
  .shell-timeline { display: none; }          /* 읽기 전용: 연도 스크럽은 시트 「설명」 아래 장면 넘김으로 대신한다 */
}
```
(`.shell-timeline`·`.shell-toolbar`처럼 실제 클래스 이름은 `App.tsx`에서 확인해 맞춘다. 위 목록의 `shell-env`·`shell-legend`·`shell-footnote`·`shell-scan-note`·`shell-explorer-pill`은 실재한다.)

- [ ] **Step 3: App 배선**

```tsx
const narrow = useNarrow();
const [focusCallout, setFocusCallout] = useState<string | null>(null);
…
{narrow
  ? <MobileSheet scene={curScene} brief={sceneBrief(s.scene)} callouts={microCallouts} selNode={s.sel ? <Inspector … /> : null} board={liveBoard?.board ?? null} engine={engRef.current} focus={focusCallout} onPick={id => { const c = microCallouts.find(x => x.id === id); if (c) engRef.current?.map.easeTo({ center: c.at, duration: 400 }); }} />
  : (기존 탐색 카드 · 인스펙터 · BattleBar)}
```
`microCallouts`는 `Callouts.tsx`가 계산하던 `resolved`를 App으로 올린다(엔진 `onMicro` + `onBattle`에서 `resolveCallouts(def, unitAt)`를 App이 계산해 `Callouts`와 `MobileSheet` 둘에 내려준다). `Callouts`는 `narrow`면 핀만 그리고, 핀 탭이 `onPin(id)`로 `setFocusCallout(id)`를 올려 시트가 그 항목으로 `scrollIntoView`한다. 발표 알약(`.shell-scene-nav`)은 그대로 쓴다.

- [ ] **Step 4: 검증·커밋**

Task 7.2의 스크립트로 잰다. 먼저 `npm run validate && npm run build`.
```bash
git add src/app/MobileSheet.tsx src/app/useNarrow.ts src/app/App.tsx src/app/Callouts.tsx src/app/shell.css
git commit -m "feat(모바일): 620px 이하 읽기 모드 시트 (설명·콜아웃·객체·재생) (R50)"
```

---

### Task 7.2: 모바일 계측 `scripts/look-mobile.py`

**Files:**
- Create: `scripts/look-mobile.py`
- Create: `docs/verify/overhaul/mobile-*.png`

- [ ] **Step 1: 스크립트**

```python
#!/usr/bin/env python3
"""look-mobile.py — 390×844 · dsf 3 으로 장면을 떠서 HUD·알약·시트의 경계 상자가 안 겹치는지, 탭 타깃이 44px 이상인지 잰다.
    python3 scripts/look-mobile.py pack-rubicon rubicon-49 pharsalus-48 athens-acropolis cannae-board
serve.sh 의 디버그 Chrome(9222)에 CDP로 붙는다."""
import json, sys
from playwright.sync_api import sync_playwright
JS = """() => {
  const box = s => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const overlap = (a, b) => a && b && !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  const hud = box('.shell-present-hud'), nav = box('.shell-scene-nav'), sheet = box('.mobile-sheet');
  const small = [...document.querySelectorAll('.mobile-sheet button, .shell-scene-nav button')].map(b => b.getBoundingClientRect()).filter(r => r.width > 0 && (r.height < 44 || r.width < 44)).length;
  const pins = document.querySelectorAll('.ca-pin').length, items = document.querySelectorAll('.ms-callouts li').length;
  return { hud, nav, sheet, overlaps: { hudNav: !!overlap(hud, nav), hudSheet: !!overlap(hud, sheet), navSheet: !!overlap(nav, sheet) }, smallTargets: small, pins, items,
           hidden: ['.shell-explorer', '.shell-right', '.shell-board'].filter(s => { const el = document.querySelector(s); return el && getComputedStyle(el).display !== 'none'; }) };
}"""
bad = 0
with sync_playwright() as p:
    br = p.chromium.connect_over_cdp('http://127.0.0.1:9222'); ctx = br.contexts[0]; page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.set_viewport_size({'width': 390, 'height': 844})
    for scene in sys.argv[1:]:
        page.goto(f'http://127.0.0.1:4180/chronoatlas/?present=1&scene={scene}'); page.wait_for_function('window.__ca && window.__ca.map && window.__ca.map.loaded()'); page.wait_for_timeout(3000)
        page.click('.ms-tabs button:nth-child(2)'); page.wait_for_timeout(300)   # 콜아웃 탭 → half
        out = page.evaluate(JS); print(scene, json.dumps(out, ensure_ascii=False))
        page.screenshot(path=f'/tmp/mobile-{scene}.png')
        if any(out['overlaps'].values()) or out['smallTargets'] or out['hidden'] or (out['pins'] and out['pins'] != out['items']): bad += 1
sys.exit(f'문제 장면 {bad}' if bad else 0)
```

- [ ] **Step 2: 여섯 장면 계측**

```bash
bash scripts/serve.sh
python3 scripts/look-mobile.py pack-rubicon rubicon-49 pharsalus-48 athens-acropolis cannae-board pack-alesia-52 && cp /tmp/mobile-*.png docs/verify/overhaul/
```
Expected: exit 0. 겹침이 나오면 `.shell-scene-nav { bottom }`과 시트 `peek` 높이를 맞추고, `smallTargets`가 있으면 해당 버튼 `min-height: 44px`. `pins != items`면 콜아웃 목록이 시트로 안 넘어온 것이다(App 배선).

- [ ] **Step 3: 커밋**

```bash
git add scripts/look-mobile.py docs/verify/overhaul
git commit -m "test(모바일): 390×844 경계 상자·탭 타깃 계측 (R50 근거)"
```

---

### Task 7.3: 슬라이스 I 마감 문서

**Files:**
- Modify: `docs/BACKLOG.md` (R44 · R49 · R50 ● 근거, R47·R48·R54 확인) · `docs/HANDOFF.md` §1(테스트 수·번들·DEM 용량·장면 수) · `docs/OVERHAUL.md` §3.4(P0 게이트가 P1 끝에서 닫힌 사실 한 줄, 각 단계 ●) · `docs/MICROMAP-UX.md` §7(모바일 항목 갱신) · `docs/00-START.md`(「지금 어디까지 왔나」 한 줄: 슬라이스 I 닫힘, 다음은 II)
- Modify: 볼트 `산업스터디/.agent/handoff.md` · `.agent/weekly/2026-WNN.md`(River 지시 원문 그대로 + 산출물 링크)

- [ ] **Step 1: 수치는 실측에서**

```bash
node scripts/check-bundle.mjs | tail -1; npx vitest run 2>&1 | tail -3; du -sh public/datasets/rome/terrain*; python3 -c "import json;print(len(json.load(open('data/scenes/rome.json'))))"
```

- [ ] **Step 2: 문서 갱신과 커밋**

```bash
git add docs/BACKLOG.md docs/HANDOFF.md docs/OVERHAUL.md docs/MICROMAP-UX.md docs/00-START.md
git commit -m "docs: 슬라이스 I 닫힘 근거 (R44·R47~R50·R54) · HANDOFF 수치 갱신"
```
푸시는 하지 않는다. River에게 CloseSummary(변경점/산출물/다음행동) 3줄로 보고하고 배포 여부를 묻는다.

---

## Self-review

- 스펙 P5(장면 둘)·P6(북마크 왕복·거절)·P7(시트·44px·핀=목록·재생 탭): Task 5.1 · 6.1~6.2 · 7.1~7.2. 마감: 7.3.
- 다이얼로그 없음: 제목은 인라인 입력, 삭제는 즉시(되돌리기는 가져오기 파일로).
- 타입 일관성: `Scene`(state.ts) 한 모양을 북마크·장면 탭·시트가 공유. `ResolvedCallout`(micro.ts) ↔ `MobileSheet.callouts`. `Engine.battle()`(계획 3/4) ↔ 시트 「재생」 탭.
- 좌표: 카르하이는 교보재·Pleiades에서 읽는다(Task 5.1 Step 1). 평야 장면 카메라는 기존 `rome-italy-270`과 같다.
