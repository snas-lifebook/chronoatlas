// src/app/MobileSheet.tsx: 620px 이하 읽기 모드(OVERHAUL §3.8, R50, DESIGN §4). 설명·콜아웃·객체·재생을 한 시트에 탭으로.
// 편집 UI 없음. 좁은 화면에서 탐색 카드·인스펙터·툴바·타임라인을 App과 CSS가 숨기고 이 시트가 그 자리를 맡는다.
import { useEffect, useState, type ReactNode } from 'react';
import { Button, Text } from '@astryxdesign/core';
import type { Scene } from '../state';
import type { ResolvedCallout } from '../map/micro';
import type { BoardData } from '../board';
import type { Engine } from '../map/engine';

type Tab = '설명' | '콜아웃' | '객체' | '재생';
type Brief = { note?: string; event_ko?: string; look_for?: string } | null;

export function MobileSheet({ scene, brief, callouts, selNode, board, engine, focus, onPick }:
  { scene: Scene | null; brief: Brief; callouts: ResolvedCallout[]; selNode: ReactNode; board: BoardData | null; engine: Engine | null; focus: string | null; onPick: (id: string) => void }) {
  const [snap, setSnap] = useState<'peek' | 'half' | 'full'>('peek');
  const [tab, setTab] = useState<Tab>('설명');
  const [, setTick] = useState(0);                          // 재생 프레임마다 캡션을 다시 읽는다
  const tabs: Tab[] = ['설명', '콜아웃', '객체', ...(board ? ['재생' as Tab] : [])];
  const b = engine?.battle() ?? null;
  useEffect(() => {
    let offF: (() => unknown) | undefined;
    const off = engine?.onBattle(x => { offF?.(); offF = x.onFrame(() => setTick(t => t + 1)); });
    return () => { off?.(); offF?.(); };
  }, [engine]);
  // 핀을 누르면 콜아웃 탭으로 와서 그 항목이 보이게 한다
  useEffect(() => { if (!focus) return; setTab('콜아웃'); setSnap(s => (s === 'peek' ? 'half' : s)); setTimeout(() => document.getElementById(`ms-${focus}`)?.scrollIntoView({ block: 'nearest' }), 50); }, [focus]);
  // 객체를 고르면 객체 탭이 열린다. 지도의 점을 눌렀는데 아무 일도 안 일어나면 안 된다
  useEffect(() => { if (selNode) { setTab('객체'); setSnap(s => (s === 'peek' ? 'half' : s)); } }, [!!selNode]);
  const frame = b?.frame() ?? null, ti = b ? Math.floor(b.t()) : 0;
  return (
    <section className={`mobile-sheet is-${snap}`} aria-label="읽기 시트">
      <button className="ms-grip" aria-label="시트 크기" onClick={() => setSnap(s => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'))} />
      <div className="ms-tabs" role="tablist">{tabs.map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => { setTab(t); if (snap === 'peek') setSnap('half'); }}>{t}</button>)}</div>
      <div className="ms-body">
        {tab === '설명' && (<>
          <Text weight="semibold">{scene?.title ?? ''}</Text>
          {(brief?.event_ko || scene?.note) && <Text size="sm">{brief?.event_ko ?? scene?.note}</Text>}
          {brief?.look_for && <Text size="sm" color="secondary">볼 것 · {brief.look_for}</Text>}
        </>)}
        {tab === '콜아웃' && (callouts.length ? <ol className="ms-callouts">{[...callouts].sort((a, c) => a.num - c.num).map(c => (
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
              <span className="bt-count">{Math.min(ti, board.phases.length - 1) + 1} / {board.phases.length}</span>
            </div>
            <Text size="sm">{frame?.caption ?? board.phases[Math.min(ti, board.phases.length - 1)].title}</Text>
            {frame?.cite && <Text size="sm" color="secondary">{frame.cite}</Text>}
          </div>)}
      </div>
    </section>
  );
}
