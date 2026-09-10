// ⌘K 검색 (TASKS 2.3): 650 객체 이름·이명·초성. 열릴 때 graph.json 지연 로드.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Text, Badge, Button, TextInput } from '@astryxdesign/core';
import { loadGraph, type Graph } from '../graph/data';
import { buildIndex, search, type SearchItem } from '../search';

const KIND: Record<string, string> = { person: '인물', place: '장소', event: '사건', group: '집단', institution: '제도', faction: '파벌', office: '관직', work: '저작', period: '시대' };
const fmt = (y: number) => (y < 0 ? `BC ${-y}` : `AD ${y}`);

export function Search({ base, onPick, onClose, placeholder }: { base: string; onPick: (id: string) => void; onClose: () => void; placeholder?: string }) {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [noIndex, setNoIndex] = useState(false); // graph.json이 없는 데이터셋 — '불러오는 중'에 영영 머무르지 않게
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { loadGraph(base).then(setGraph).catch(() => setNoIndex(true)); inputRef.current?.focus(); }, []);
  const index = useMemo(() => graph ? buildIndex([...graph.nodes.values()].map(n => ({ id: n.id, name: n.name, aliases: n.aliases, type: n.type }))) : [], [graph]);
  const results: SearchItem[] = useMemo(() => search(index, q), [index, q]);
  useEffect(() => setCursor(0), [q]);
  const sub = (id: string) => { const n = graph?.nodes.get(id); if (!n) return ''; if (n.type === 'person' && n.born != null) return `${fmt(n.born)}${n.died != null ? ` – ${fmt(n.died)}` : ''}`; if (n.year != null) return fmt(n.year); return n.aliases[0] ?? ''; };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(results.length - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
    else if (e.key === 'Enter' && results[cursor]) onPick(results[cursor].id);
    else if (e.key === 'Escape') onClose();
  };
  return (
    <div className="shell-search-backdrop" onMouseDown={onClose}>
      <Card padding={3} elevation="high" className="shell-search" onMouseDown={e => e.stopPropagation()}>
        <TextInput ref={inputRef} label="객체 검색" isLabelHidden placeholder={placeholder ?? "이름 · 이명 · 초성 (예: ㅋㅇㅅㄹ)"} value={q} onChange={v => setQ(v)} onKeyDown={onKey} />
        {q.trim() && (
          <ol className="shell-list shell-search-list">
            {results.map((r, i) => (
              <li key={r.id} className={i === cursor ? 'is-sel' : ''} onMouseEnter={() => setCursor(i)} onClick={() => onPick(r.id)}>
                <span className="num"><Badge label={KIND[r.type] ?? r.type} /></span>
                <span className="name">{r.name}<small>{sub(r.id)}</small></span>
                <span className="arrow">↵</span>
              </li>
            ))}
            {!results.length && <li className="empty"><Text size="sm" color="secondary">「{q.trim()}」와 일치하는 객체가 없다 — 이명이나 초성(ㅋㅇㅅ)으로.</Text><Button label="지우기" size="sm" variant="ghost" onClick={() => setQ('')} /></li>}
          </ol>
        )}
        {!q.trim() && <Text size="sm" color="secondary">{graph ? `${graph.nodes.size}개 객체` : noIndex ? '이 데이터셋에는 객체 색인이 없다' : '불러오는 중'} · ↑↓ 이동 · ↵ 선택 · Esc 닫기</Text>}
      </Card>
    </div>
  );
}
