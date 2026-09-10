// 원정로 고도 단면(로드맵 다음 증분): DEM 타일이 있으면 경로를 따라 해발고도를 읽어 스파크라인으로.
// 타일이 없으면 아무것도 그리지 않는다 — 없는 걸 0m로 그리면 평지처럼 보여서 거짓말이 된다.
import { useEffect, useState } from 'react';
import { Text } from '@astryxdesign/core';
import { profile, type TerrainMeta } from '../map/elevation';

const W = 300, H = 56, PAD = 2; // 인스펙터 본문이 좁다 — 낮게

export function Profile({ base, routeId, path }: { base: string; routeId: string; path: [number, number][] }) {
  const [pts, setPts] = useState<{ km: number; m: number | null }[] | null>(null);

  useEffect(() => {
    let live = true;
    setPts(null);
    fetch(`${base}/terrain/meta.json`)
      .then(r => (r.ok ? r.json() : null))
      .then((meta: TerrainMeta | null) => (meta ? profile(`${base}/terrain/`, meta, path) : null))
      .then(p => { if (live) setPts(p); })
      .catch(() => { if (live) setPts(null); });
    return () => { live = false; };
    // path는 routeId에서 결정적으로 나온다 — 배열을 deps에 넣으면 매 렌더 새 참조라 무한 재요청이 된다(패널이 깜빡이다 사라졌다).
  }, [base, routeId]);

  const raw = pts?.filter(p => p.m != null) as { km: number; m: number }[] | undefined;
  if (!raw?.length) return null;
  // 해상 구간은 해저 지형이 찍힌다(이오니아해 -4,260m). 행군 단면에 해저를 그리면 거짓말이라 0m로 눕히고 몇 %인지 따로 적는다.
  const seaPct = Math.round((raw.filter(p => p.m < 0).length / raw.length) * 100);
  const known = raw.map(p => ({ km: p.km, m: Math.max(0, p.m) }));

  const km = known[known.length - 1].km;
  const hi = Math.max(...known.map(p => p.m));
  const lo = Math.min(...known.map(p => p.m));
  const span = Math.max(hi - lo, 50); // 완전 평지여도 선이 바닥에 붙지 않게
  const x = (p: { km: number }) => PAD + (p.km / (km || 1)) * (W - 2 * PAD);
  const y = (p: { m: number }) => H - PAD - ((p.m - lo) / span) * (H - 2 * PAD - 10);
  const line = known.map(p => `${x(p).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  const peak = known.reduce((a, b) => (b.m > a.m ? b : a));

  return (
    <div className="ins-profile">
      <Text size="sm" color="secondary">고도 단면 · {Math.round(km).toLocaleString()}km · 최고 {Math.round(hi).toLocaleString()}m / 최저 {Math.round(lo).toLocaleString()}m{seaPct > 0 && ` · 해상 ${seaPct}%`}</Text>
      {/* 출처 툴팁은 title 속성이 아니라 <title> 자식이어야 뜬다. SVG에 title 속성은 없다. 접근명은 aria-label이 이긴다. */}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`경로 고도 단면. 총 ${Math.round(km)}킬로미터, 최고 ${Math.round(hi)}미터, 최저 ${Math.round(lo)}미터.`}>
        <title>{`AWS Terrain Tiles(SRTM·GMTED2010 외) · 96점 리샘플${seaPct > 0 ? ' · 해상 구간은 0m' : ''}`}</title>
        <polygon points={`${x(known[0])},${H} ${line} ${x(known[known.length - 1])},${H}`} className="fill" />
        <polyline points={line} className="line" />
        <circle cx={x(peak)} cy={y(peak)} r="2.5" className="peak" />
        <text x={Math.min(W - 34, Math.max(2, x(peak) - 16))} y={Math.max(9, y(peak) - 5)} className="tag">{Math.round(peak.m).toLocaleString()}m</text>
      </svg>
    </div>
  );
}
