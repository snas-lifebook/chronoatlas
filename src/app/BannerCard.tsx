// src/app/BannerCard.tsx: 장군 배너 카드(OVERHAUL-II §3.4, R51). 고른 인물의 말 옆에 붙는 DOM 카드: 방패꼴 초상 · 이름판 · 군기 · 군단·병력 · 그 해 한 줄.
// River 결정 「선택했을 때만」. 콜아웃과 같은 DOM 방식이라 내보내기(캔버스)에는 안 담긴다. 좁은 화면(시트)에서는 App이 안 띄운다.
import { useEffect, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

export function BannerCard({ map, at, name, latin, color, portrait, emblem, legion, line, onClose }:
  { map: maplibregl.Map | null; at: [number, number]; name: string; latin: string | null; color: string; portrait: string | null; emblem: string | null;
    legion: { legions: number | null; men_low: number | null; men_high: number | null } | null; line: string | null; onClose: () => void }) {
  const [xy, setXy] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!map) return;
    const sync = () => { const p = map.project(at); setXy({ x: p.x, y: p.y }); };
    sync(); map.on('move', sync); map.on('resize', sync);
    return () => { map.off('move', sync); map.off('resize', sync); };
  }, [map, at[0], at[1]]);
  if (!xy) return null;
  // 오른쪽에 인스펙터(.shell-right)가 서 있으면 카드를 말 왼쪽에 둔다. 그리스 장면에서 카이사르 카드가 패널 밑에 깔렸다(2026-09-17)
  const rightEdge = (() => { const el = document.querySelector('.shell-right') as HTMLElement | null; return el && el.offsetParent ? el.getBoundingClientRect().left : innerWidth; })();
  const flip = xy.x + 44 + 300 > Math.min(rightEdge, innerWidth) - 8;
  const men = legion?.men_low != null ? `${fmt(legion.men_low)}${legion.men_high != null && legion.men_high !== legion.men_low ? `~${fmt(legion.men_high)}` : ''}명` : null;
  return (
    <div className={`banner-card${flip ? ' is-left' : ''}`} style={{ left: flip ? xy.x - 44 - 300 : xy.x + 44, top: xy.y - 72, ['--faction' as string]: color }} role="dialog" aria-label={`${name} 배너`}>
      <div className="bc-shield">{portrait ? <img src={portrait} alt="" /> : <span />}</div>
      <div className="bc-plate">
        {latin && <div className="bc-latin">{latin}</div>}
        <div className="bc-name">{name}</div>
        {(legion?.legions || men) && <div className="bc-force">{legion?.legions ? `${legion.legions}군단` : ''}{legion?.legions && men ? ' · ' : ''}{men ?? ''}</div>}
        {line && <div className="bc-line">{line}</div>}
      </div>
      <div className="bc-flag">{emblem && <img src={emblem} alt="" />}</div>
      <button className="bc-close" onClick={onClose} aria-label="닫기">×</button>
    </div>
  );
}
const fmt = (n: number) => n >= 10000 ? `${Math.round(n / 1000) / 10}만` : n.toLocaleString();
