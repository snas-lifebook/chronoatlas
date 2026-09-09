// 인스펙터 (DESIGN v3 §3, TASKS 2.2): compact 스케일, 의미군별 접이식 관계, 빈 값은 행 자체가 사라진다. 자료실 객체 페이지와 같은 순서.
import { useEffect, useState } from 'react';
import { Card, Text, Heading, Badge, Button, IconButton, Collapsible } from '@astryxdesign/core';
import type { Dataset } from '../schema';
import type { Store } from '../state';
import { loadGraph, neighborsOf, shortestPath, groupOf, GROUP_LABEL, REL_LABEL, type Graph, type GNode, type Neighbor } from '../graph/data';
import { GROUP_COLOR } from '../map/engine';
import { stateAt } from '../time';
import { libraryObject, libraryPoint } from '../links';
import { renderCard } from '../export/card';
import { download } from '../export/png';

const KIND: Record<string, string> = { person: '인물', place: '장소', event: '사건', group: '집단', institution: '제도', faction: '파벌', office: '관직', work: '저작', period: '시대', landmark: '지형지물' };
const SRC_LABEL: Record<string, string> = { point: '포인트', gibbon: '기번', wikidata: 'Wikidata', dprr: 'DPRR', manual: '수기' };
// 원시 키 노출 금지(P15): 알려진 속성만 한글 라벨로. 나머지는 안 보인다.
const ATTR_LABEL: Record<string, string> = { role: '역할', region: '지역', type: '유형', reign: '재위', period: '시대', origin: '출신', relation: '관계', title: '직함', location: '위치', status: '지위',
  modern: '오늘의', participants: '참가자', founder: '창설자', age: '나이', original: '원어', parent: '상위', place_kind: '종류', duration: '기간', empire: '제국', language: '언어', leader: '지도자', country: '나라',
  achievement: '업적', population: '인구', importance: '중요도', author: '저자', creator: '창시자', office: '관직', faction: '파벌', dynasty: '왕조' };
const GROUP_ORDER = ['hostile', 'ally', 'rule', 'lineage', 'member', 'act', 'locate', 'make', 'other'];
export const fmtYear = (y: number) => (y < 0 ? `BC ${-y}` : `AD ${y}`);
const pad = (n: number) => String(n).padStart(2, '0');

// 초상 블록(DESIGN §3): 룬델 1:1 초상 + 세력 링. 없으면 절차적(세력 링 + 타입 글리프/이니셜) — 관계분석 노드 조립 규칙과 같다.
const TYPE_GLYPH: Record<string, string> = { person: '', place: '◉', event: '✕', group: '⚑', institution: '▣', faction: '⚑', office: '▤', work: '▥', period: '▬' };
function Portrait({ node, root, color }: { node: GNode | undefined; root: string; color: string }) {
  if (!node) return null;
  const initial = node.name.replace(/\s+/g, '').slice(0, 1);
  return (
    <div className="ins-portrait" style={{ '--ring': color } as React.CSSProperties} aria-hidden>
      {node.asset ? <img src={`${root}${node.asset}`} alt="" loading="lazy" /> : <span className="glyph">{TYPE_GLYPH[node.type] || initial}</span>}
    </div>
  );
}

export function Inspector({ d, store, sel, year, base, root, onHoverNeighbor, onLocate, getMapCanvas, dark, pathTo, onAskPath, onClearPath }:
  { d: Dataset; store: Store; sel: string; year: number; base: string; root: string; onHoverNeighbor: (id: string | null) => void; onLocate: (id: string) => void; getMapCanvas?: () => HTMLCanvasElement | null; dark?: boolean; pathTo?: string | null; onAskPath?: () => void; onClearPath?: () => void }) {
  const [graph, setGraph] = useState<Graph | null>(null);
  useEffect(() => { if (!/^(landmark|territory):/.test(sel)) loadGraph(base).then(setGraph).catch(() => setGraph(null)); }, [base]);
  const close = () => store.set({ sel: null });

  // 영토(Cliopatria) — 정본 객체가 아니다. 이름·기간·세력·Wikidata
  if (sel.startsWith('territory:')) {
    const t = d.territory.features.find(f => f.properties.id === sel)?.properties;
    const actor = d.actors.find(a => a.id === t?.actor);
    return (
      <Card padding={4} elevation="low" className="shell-inspector ins">
        <div className="ins-head"><Text size="sm" color="secondary">영토 · Cliopatria(Seshat)</Text><IconButton label="닫기" size="sm" variant="ghost" icon={<span>✕</span>} onClick={close} /></div>
        <Heading level={2}>{t?.name ?? sel.split(':')[1]}</Heading>
        {t && <div className="ins-body">
          <div className="ins-badges">{actor && <Badge label={actor.label} variant={'blue' as any} />}<Badge label="신뢰도 medium" /></div>
          <dl className="ins-kv"><div><dt>기간</dt><dd>{fmtYear(t.valid_from)} – {fmtYear(t.valid_to - 1)}</dd></div><div><dt>면적</dt><dd>{Math.round(t.area / 1000).toLocaleString()}천 km²</dd></div></dl>
          <Text size="sm" color="secondary">경계는 한 견해다(Seshat). 정본 세력색은 팔레트 매핑, 회색은 팔레트 밖.</Text>
        </div>}
        <div className="shell-actions">{t?.wikidata && <Button label="Wikidata ↗" size="sm" variant="secondary" onClick={() => open(`https://www.wikidata.org/wiki/${t.wikidata}`, '_blank')} />}</div>
      </Card>
    );
  }
  // 지형지물(NE 폴리곤 = 이름, Pleiades 점 = pid) — 정본 객체가 아니다
  if (sel.startsWith('landmark:')) {
    const key = sel.slice('landmark:'.length);
    const lm = d.landmarks?.features.find(f => String(f.properties.pid) === key)?.properties;
    return (
      <Card padding={4} elevation="low" className="shell-inspector ins">
        <Text size="sm" color="secondary">지형지물 · {lm ? `${lm.kind_ko} · ${lm.src === 'ne' ? 'Natural Earth 10m' : 'Pleiades'}` : 'Natural Earth'}</Text>
        <Heading level={2}>{lm?.name ?? key}</Heading>
        {lm && <div className="ins-body">
          {lm.desc && <Text size="sm" className="ins-desc">{lm.desc}</Text>}
          {lm.elev != null && <dl className="ins-kv"><div><dt>고도</dt><dd>{lm.elev.toLocaleString()} m</dd></div></dl>}
          <Text size="sm" color="secondary">좌표 {lm.precision === 'rough' ? '대략(rough) — 범위의 중심점' : '정밀(precise)'} · {lm.kind}</Text>
        </div>}
        <Text size="sm" color="secondary">정본 place 제안 대상 — 한글 이름·설명을 붙이면 온톨로지 객체가 된다.</Text>
        <div className="shell-actions">
          {lm?.uri && <Button label={lm.src === 'ne' ? 'Wikidata ↗' : 'Pleiades ↗'} size="sm" variant="secondary" onClick={() => open(lm.uri, '_blank')} />}
          <IconButton label="닫기" size="sm" variant="ghost" icon={<span>✕</span>} onClick={close} />
        </div>
      </Card>
    );
  }

  const node: GNode | undefined = graph?.nodes.get(sel);
  const feat = [...d.settlements.features, ...d.battles.features].find(f => f.properties.id === sel);
  const name = node?.name ?? feat?.properties.name_ko ?? sel.slice(sel.indexOf(':') + 1);
  const type = sel.split(':')[0];
  const ancient = feat?.properties.name_ancient ?? null;
  const yearLine = node?.type === 'person' && (node.born != null || node.died != null) ? `${node.born != null ? fmtYear(node.born) : '?'} – ${node.died != null ? fmtYear(node.died) : '?'}`
    : node?.year != null ? fmtYear(node.year) : feat?.properties.year != null ? fmtYear(feat.properties.year) : null;
  const state = node ? stateAt(node, year) : {};
  const stateRows = Object.entries(state).filter(([k, v]) => v != null && v !== '' && ATTR_LABEL[k]).slice(0, 6);
  const neighbors = graph ? neighborsOf(graph, sel, year) : [];
  const groups = GROUP_ORDER.map(g => [g, neighbors.filter(n => n.group === g)] as const).filter(([, l]) => l.length);
  const hidden = graph ? neighborsOf(graph, sel).length - neighbors.length : 0;
  const firstYear = graph ? Math.min(...neighborsOf(graph, sel).map(n => n.link.from_year ?? Infinity)) : null; // 빈 상태(DESIGN §4): 연도 밖 객체 → 첫 관계 연도로
  const path = graph && pathTo && pathTo !== sel ? shortestPath(graph, sel, pathTo, 6) : null; // F14
  const libHref = libraryObject(sel, name);
  const ringColor = d.actors.find(a => a.id === node?.faction)?.color ?? 'var(--color-border-emphasized)';

  return (
    <Card padding={4} elevation="low" className="shell-inspector ins">
      <div className="ins-head">
        <Text size="sm" color="secondary">{KIND[type] ?? type}{ancient ? ` · ${ancient}` : ''}</Text>
        <IconButton label="닫기" size="sm" variant="ghost" icon={<span>✕</span>} onClick={close} />
      </div>
      <div className="ins-identity">
        <Portrait node={node} root={root} color={ringColor} />
        <div>
          <Heading level={2}>{name}</Heading>
          {yearLine && <div className="ins-year">{yearLine}</div>}
        </div>
      </div>
      <div className="ins-body">
      {graph && pathTo && pathTo !== sel && (
        <section className="ins-sec">
          <div className="ins-label">경로 → {graph.nodes.get(pathTo)?.name ?? pathTo}{path ? <span className="ins-muted"> · {path.length}홉</span> : null}</div>
          {path ? (
            <ol className="ins-path">
              {path.map((st, i) => (
                <li key={i} style={{ '--c': GROUP_COLOR[groupOf(st.rel)] } as React.CSSProperties} onMouseEnter={() => onHoverNeighbor(st.to)} onMouseLeave={() => onHoverNeighbor(null)} onClick={() => onLocate(st.to)}>
                  <span className="ins-rel-meta">{REL_LABEL[st.rel] ?? st.rel}{st.dir === 'in' ? ' ←' : ' →'}</span><span className="ins-rel-name">{graph.nodes.get(st.to)?.name ?? st.to}</span>
                </li>
              ))}
            </ol>
          ) : <div className="ins-empty"><Text size="sm" color="secondary">6홉 안에 이어지지 않는다.</Text></div>}
          <div className="shell-actions"><Button label="다른 객체까지" size="sm" variant="ghost" onClick={onAskPath} /><Button label="지우기" size="sm" variant="ghost" onClick={onClearPath} /></div>
        </section>
      )}

      <div className="ins-badges">
        {node?.faction && <Badge label={node.faction} variant={'blue' as any} />}
        {node?.src && <Badge label={SRC_LABEL[node.src] ?? node.src} />}
        {node?.confidence && node.confidence !== 'high' && <Badge label={`신뢰도 ${node.confidence}`} />}
      </div>
      {stateRows.length > 0 && (
        <section className="ins-sec">
          <div className="ins-label">{fmtYear(year)}의 상태</div>
          <dl className="ins-kv">{stateRows.map(([k, v]) => <div key={k}><dt>{ATTR_LABEL[k]}</dt><dd>{String(v)}</dd></div>)}</dl>
        </section>
      )}
      {node?.desc && <Text size="sm" className="ins-desc">{node.desc}</Text>}
      {feat?.properties.name_modern && <Text size="sm" color="secondary">오늘의 {feat.properties.name_modern}</Text>}

      {graph && (groups.length > 0 ? (
        <section className="ins-sec">
          <div className="ins-label">관계 {neighbors.length}{hidden > 0 ? <span className="ins-muted"> · {fmtYear(year)} 이후 {hidden}</span> : null}</div>
          {groups.map(([g, list]) => (
            <Collapsible key={g} trigger={<span className="ins-group"><b>{GROUP_LABEL[g]}</b><span className="ins-count">{list.length}</span></span>} defaultIsOpen={g === 'hostile' || g === 'ally' || groups.length <= 2}>
              <ul className="ins-rel">
                {list.map((n: Neighbor, i) => (
                  <li key={i} onMouseEnter={() => onHoverNeighbor(n.node.id)} onMouseLeave={() => onHoverNeighbor(null)} onClick={() => onLocate(n.node.id)}>
                    <span className="ins-rel-name">{n.node.name}</span>
                    <span className="ins-rel-meta">{REL_LABEL[n.rel] ?? n.rel}{n.dir === 'in' ? ' ←' : ''}{n.link.from_year != null ? ` · ${fmtYear(n.link.from_year)}` : ''}{n.link.point != null ? ` · P${pad(n.link.point)}` : ''}</span>
                  </li>
                ))}
              </ul>
            </Collapsible>
          ))}
        </section>
      ) : hidden > 0 ? (
        <div className="ins-empty"><Text size="sm" color="secondary">{fmtYear(year)}엔 아직 관계가 없다 — {fmtYear(firstYear!)}부터 {hidden}건.</Text><Button label={`${fmtYear(firstYear!)}로 이동`} size="sm" variant="secondary" onClick={() => store.set({ year: firstYear! })} /></div>
      ) : node ? <Text size="sm" color="secondary">연결된 관계가 없다 · 등장 포인트 {node.points.length}</Text> : null)}

      {node && node.points.length > 0 && (
        <section className="ins-sec">
          <div className="ins-label">등장 포인트</div>
          <div className="ins-chips">{node.points.map(p => <a key={p} href={libraryPoint(p, name)} target="_blank" rel="noreferrer">P{pad(p)}</a>)}</div>
        </section>
      )}
      </div>
      <div className="shell-actions">
        <Button label="자료실에서 읽기" size="sm" variant="secondary" onClick={() => open(libHref)} />
        {node && <Button label="카드" size="sm" variant="ghost" onClick={async () => download(await renderCard(node, { year, state, stateLabels: ATTR_LABEL, neighbors, ringColor: d.actors.find(a => a.id === node.faction)?.color ?? '#8A8F98', root, dark, mapCanvas: getMapCanvas?.() }), `card_${name}_${fmtYear(year).replace(' ', '')}.png`)} />}
        {!pathTo && onAskPath && <Button label="경로" size="sm" variant="ghost" onClick={onAskPath} />}
        <Button label="링크 복사" size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(location.href)} />
      </div>
    </Card>
  );
}
