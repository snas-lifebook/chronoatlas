// 인스펙터 (DESIGN v3 §3, TASKS 2.2): compact 스케일, 의미군별 접이식 관계, 빈 값은 행 자체가 사라진다. 자료실 객체 페이지와 같은 순서.
import { useEffect, useState } from 'react';
import { Card, Text, Heading, Badge, Button, IconButton, Collapsible } from '@astryxdesign/core';
import type { Dataset } from '../schema';
import type { Store } from '../state';
import { loadGraph, neighborsOf, GROUP_LABEL, REL_LABEL, type Graph, type GNode, type Neighbor } from '../graph/data';
import { stateAt } from '../time';

const KIND: Record<string, string> = { person: '인물', place: '장소', event: '사건', group: '집단', institution: '제도', faction: '파벌', office: '관직', work: '저작', period: '시대', landmark: '지형지물' };
const SRC_LABEL: Record<string, string> = { point: '포인트', gibbon: '기번', wikidata: 'Wikidata', dprr: 'DPRR', manual: '수기' };
// 원시 키 노출 금지(P15): 알려진 속성만 한글 라벨로. 나머지는 안 보인다.
const ATTR_LABEL: Record<string, string> = { role: '역할', region: '지역', type: '유형', reign: '재위', period: '시대', origin: '출신', relation: '관계', title: '직함', location: '위치', status: '지위',
  modern: '오늘의', participants: '참가자', founder: '창설자', age: '나이', original: '원어', parent: '상위', place_kind: '종류', duration: '기간', empire: '제국', language: '언어', leader: '지도자', country: '나라',
  achievement: '업적', population: '인구', importance: '중요도', author: '저자', creator: '창시자', office: '관직', faction: '파벌', dynasty: '왕조' };
const GROUP_ORDER = ['hostile', 'ally', 'rule', 'lineage', 'member', 'act', 'locate', 'make', 'other'];
export const fmtYear = (y: number) => (y < 0 ? `BC ${-y}` : `AD ${y}`);
const pad = (n: number) => String(n).padStart(2, '0');

export function Inspector({ d, store, sel, year, base, onHoverNeighbor, onLocate }:
  { d: Dataset; store: Store; sel: string; year: number; base: string; onHoverNeighbor: (id: string | null) => void; onLocate: (id: string) => void }) {
  const [graph, setGraph] = useState<Graph | null>(null);
  useEffect(() => { if (!sel.startsWith('landmark:')) loadGraph(base).then(setGraph).catch(() => setGraph(null)); }, [base]);
  const close = () => store.set({ sel: null });

  // 지형지물(NE) — 정본 객체가 아니다
  if (sel.startsWith('landmark:')) {
    const name = sel.slice('landmark:'.length);
    return (
      <Card padding={4} elevation="low" className="shell-inspector ins">
        <Text size="sm" color="secondary">지형지물 · Natural Earth</Text>
        <Heading level={2}>{name}</Heading>
        <Text size="sm" color="secondary">정본 place 제안 대상 — 이름·라틴명·설명을 붙이면 온톨로지 객체가 된다.</Text>
        <div className="shell-actions"><IconButton label="닫기" size="sm" variant="ghost" icon={<span>✕</span>} onClick={close} /></div>
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
  const libHref = `${d.manifest.library ?? 'https://roma-library.pages.dev'}/objects/${type}/${encodeURIComponent(name)}`;

  return (
    <Card padding={4} elevation="low" className="shell-inspector ins">
      <div className="ins-head">
        <Text size="sm" color="secondary">{KIND[type] ?? type}{ancient ? ` · ${ancient}` : ''}</Text>
        <IconButton label="닫기" size="sm" variant="ghost" icon={<span>✕</span>} onClick={close} />
      </div>
      <Heading level={2}>{name}</Heading>
      {yearLine && <div className="ins-year">{yearLine}</div>}
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
      ) : node ? <Text size="sm" color="secondary">연결된 관계가 없다 · 등장 포인트 {node.points.length}</Text> : null)}

      {node && node.points.length > 0 && (
        <section className="ins-sec">
          <div className="ins-label">등장 포인트</div>
          <div className="ins-chips">{node.points.map(p => <a key={p} href={`${d.manifest.library ?? ''}/read/point/${p}`} target="_blank" rel="noreferrer">P{pad(p)}</a>)}</div>
        </section>
      )}
      <div className="shell-actions">
        <Button label="자료실에서 읽기" size="sm" variant="secondary" onClick={() => open(libHref)} />
        <Button label="링크 복사" size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(location.href)} />
      </div>
    </Card>
  );
}
