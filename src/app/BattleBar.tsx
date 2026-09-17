// src/app/BattleBar.tsx: 전투 재생 바(OVERHAUL §3.6, R54). 재생·이전·다음·페이즈 슬라이더·캡션 띠·인용 카드. 말판이 있을 때만 App이 띄운다.
// 그림은 map/battle.ts가 그리고 여기는 그 컨트롤러의 t를 비출 뿐이다. 정수 페이즈로 옮길 때만 상태(URL의 bt)에 적는다:
// 소수 t를 상태에 적으면 엔진이 setBoard로 정수에 되돌려 놓아 드래그와 싸운다.
import { useEffect, useState } from 'react';
import { Button, Card } from '@astryxdesign/core';
import type { Engine } from '../map/engine';
import type { Store } from '../state';
import type { BoardData, BoardQuote, Frame } from '../board';

export function BattleBar({ engine, store, board, shift }: { engine: Engine; store: Store; board: BoardData; shift: boolean }) {
  const [t, setT] = useState(0); const [frame, setFrame] = useState<Frame | null>(null);
  const [playing, setPlaying] = useState(false); const [quote, setQuote] = useState<BoardQuote | null>(null);
  useEffect(() => {
    let offs: (() => unknown)[] = [];                 // onBattle은 콜백의 반환값을 버린다. 프레임 구독 해제는 여기서 쥔다
    const off = engine.onBattle(b => {
      offs.forEach(f => f());
      offs = [b.onFrame((tt, f) => { setT(tt); setFrame(f); setPlaying(b.playing()); }), b.onQuote(setQuote)];
      setFrame(b.frame()); setT(b.t()); setPlaying(b.playing());
    });
    return () => { off(); offs.forEach(f => f()); };
  }, [engine, board.id]);
  const b = engine.battle(); if (!b) return null;
  const n = board.phases.length, i = Math.min(n - 1, Math.floor(t)), end = t >= n - 1;
  const go = (v: number) => { b.seek(v); if (Number.isInteger(v) && store.get().phase !== v) store.set({ phase: v }); };
  return (
    <>
      {quote && <div className="bt-quote" role="status"><p>{quote.text}</p><footer>{quote.who} · {quote.cite}</footer></div>}
      <Card padding={3} elevation="low" className={`shell-board${shift ? ' is-shift' : ''}`}>
        <div className="bd-title">{board.title}</div>
        <div className="bt-controls">
          <Button label={playing ? '정지' : end ? '처음부터' : '재생'} size="sm" onClick={() => (playing ? b.pause() : b.play())} />
          <Button label="이전" size="sm" variant="ghost" isDisabled={t <= 0} onClick={() => go(Math.max(0, Math.ceil(t) - 1))} />
          <Button label="다음" size="sm" variant="ghost" isDisabled={end} onClick={() => go(Math.min(n - 1, Math.floor(t) + 1))} />
          <span className="bt-count">{i + 1} / {n}</span>
        </div>
        <input type="range" className="bd-slider" min={0} max={n - 1} step={0.01} value={t} aria-label="페이즈"
          onChange={e => go(Number(e.currentTarget.value))} />
        <div className="bd-ticks">{board.phases.map(p => <span key={p.t}>{p.title}</span>)}</div>
        <div className="bd-phase">{frame?.caption ?? board.phases[i].title}</div>
        {frame?.cite && <div className="bd-cite">{frame.cite}</div>}
        {!frame?.caption && board.phases[i].note && <div className="bd-note">{board.phases[i].note}</div>}
        <div className="bd-source">{board.source}</div>
      </Card>
    </>
  );
}
