// QC 탭(F18): adapt가 뽑은 고칠 목록 — 고아·연도 미상·좌표 없음·동명이인·신뢰도 low. 클릭하면 그 객체로. 고치는 건 proposals/(CONSTITUTION 0-3).
import { useEffect, useState } from 'react';
import { Text, Collapsible } from '@astryxdesign/core';
import { loadGraph, type Graph } from '../graph/data';

interface Qc { orphan: string[]; undated: string[]; nocoord: string[]; homonym: { name: string; ids: string[] }[]; low: string[] }
const LABEL: Record<keyof Qc, string> = { homonym: '동명이인 후보', nocoord: '좌표 없는 장소', low: '신뢰도 low', undated: '연도 미상', orphan: '관계 없는 객체' };

export function Qc({ base, onLocate }: { base: string; onLocate: (id: string) => void }) {
  const [qc, setQc] = useState<Qc | null>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  useEffect(() => { fetch(`${base}/qc.json`).then(r => r.ok ? r.json() : null).then(setQc).catch(() => setQc(null)); loadGraph(base).then(setGraph).catch(() => {}); }, [base]);
  if (!qc) return <Text size="sm" color="secondary">qc.json 없음 — `npm run adapt`</Text>;
  const name = (id: string) => graph?.nodes.get(id)?.name ?? id;
  const row = (id: string, key: string) => <li key={key} onClick={() => onLocate(id)}><span className="num">{id.split(':')[0]}</span><span className="name">{name(id)}</span><span className="arrow">↗</span></li>;
  return (
    <div className="shell-qc">
      {(Object.keys(LABEL) as (keyof Qc)[]).map(k => (
        <Collapsible key={k} trigger={<span className="ins-group"><b>{LABEL[k]}</b><span className="ins-count">{qc[k].length}</span></span>} defaultIsOpen={k === 'homonym' || k === 'nocoord'}>
          <ol className="shell-list">
            {k === 'homonym'
              ? qc.homonym.map(h => <li key={h.name} className="qc-homonym"><span className="num">=</span><span className="name">{h.ids.map(id => <a key={id} onClick={e => { e.stopPropagation(); onLocate(id); }}>{id}</a>)}</span></li>)
              : (qc[k] as string[]).slice(0, 80).map(id => row(id, id))}
            {k !== 'homonym' && qc[k].length > 80 && <li className="empty"><Text size="sm" color="secondary">… 외 {qc[k].length - 80}</Text></li>}
          </ol>
        </Collapsible>
      ))}
    </div>
  );
}
