// 미시 지도 위의 어노테이션 콜아웃. 지도 위 번호 핀 → 지시선 → 여백의 글상자.
//
// River가 붙인 레퍼런스가 전부 같은 문법이었다 — 수사 유적 번호 지도, 아크레 1291년
// 성벽·탑 이름표, 스페인 내전 참호 분해도, 로크루아 전투 배치도. 지도 위 지점에 번호를
// 찍고 **여백까지 지시선을 끌어** 거기서 설명한다. 이름표를 지도 안에 욱여넣지 않는 것이
// 요점이다 — 그래야 지형이 안 가려지고 설명은 길게 쓸 수 있다.
//
// ## 왜 DOM인가 (MapLibre 심볼이 아니라)
//
// 여백 글상자는 **지도 좌표에 없다.** 화면 왼쪽·오른쪽 끝에 세로로 쌓이고, 지도가 움직여도
// 그 자리에 있어야 한다. 심볼 레이어는 전부 지도 좌표에 매이므로 이 배치를 못 한다.
// 지시선만 지도 좌표(핀)와 화면 좌표(카드)를 잇는 혼합이라 SVG로 직접 그린다.
//
// 대신 **정지 이미지로 구울 때는 안 담긴다** — 내보내기가 캔버스만 읽기 때문이다
// (HUD·인스펙터를 빼려고 일부러 그렇게 짰다, scripts/shoot-pack.py). 미시 지도는
// 아홉 장에 안 들어가고 「들어가면 보이는」 대화형이라 그게 맞다. 미시 지도를 이미지로
// 뽑아야 할 날이 오면 shoot-pack의 caption()처럼 PIL로 같은 JSON에서 합성하면 된다.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { THUMBS } from '../callouts';
import { resolveCallouts, type ResolvedCallout } from '../map/micro';
import type { Engine } from '../map/engine';
import type { MicroMapDef } from '../../schema/micromap';

type Callout = ResolvedCallout & { thumb: { file: string; license: string; page: string } | null };
type Pin = { c: Callout; x: number; y: number };

/** 카드가 세로로 쌓이는 칸. 화면 높이에 맞춰 잘라 쓴다. */
const CARD_W = 300;

export function Callouts({ map, engine, root, ds }: { map: maplibregl.Map | null; engine: Engine | null; root: string; ds: string }) {
  // 어느 미시지도가 켜져 있는가는 엔진이 말한다(레지스트리 진입·이탈). 줌 문턱 계산은 엔진 몫이다.
  const [def, setDef] = useState<MicroMapDef | null>(null);
  useEffect(() => { const off = engine?.onMicro(setDef); return () => { off?.(); }; }, [engine]);
  const resolved = useMemo<Callout[]>(() => def ? resolveCallouts(def).map(c => ({ ...c, thumb: THUMBS[c.id] ?? null })) : [], [def]);
  const which = def?.id ?? null;
  const [pins, setPins] = useState<Pin[]>([]);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  const [open, setOpen] = useState(true);
  const [hudBox, setHud] = useState<{ side: 'left' | 'right'; bottom: number }>({ side: 'left', bottom: 0 });
  // 일반 모드에서 왼쪽·오른쪽에 앱 패널이 서 있다. 그 폭만큼 칸을 밀어 넣는다 —
  // River의 알레시아 화면에서 왼쪽 카드 넷이 탐색 패널 **밑에 깔려** 아예 안 보였다.
  const [inset, setInset] = useState<{ left: number; right: number }>({ left: 10, right: 10 });
  const [anchors, setAnchors] = useState<Record<string, { x: number; y: number }>>({});
  const cardRef = useRef<Record<string, HTMLElement | null>>({});
  const hostRef = useRef<HTMLDivElement | null>(null);
  const squeezeRef = useRef(false);

  useEffect(() => {
    if (!map) return;
    const sync = () => {
      const cv = map.getCanvas();
      setSize([cv.clientWidth, cv.clientHeight]);
      // 설명창은 M으로 좌우를 바꾼다. **어느 쪽에 있는지 읽어서** 그 쪽 칸만 밀어낸다 —
      // 예전엔 왼쪽으로 못 박아서, 설명창을 오른쪽으로 옮기면 오른쪽 카드가 그 밑에 깔렸다.
      const hud = document.querySelector('.shell-present-hud, .shell-hud-peek') as HTMLElement | null;
      setHud(hud ? { side: hud.classList.contains('is-right') ? 'right' : 'left',
                     bottom: hud.getBoundingClientRect().bottom } : { side: 'left', bottom: 0 });
      // 앱 패널을 실측해서 비킨다. 높이를 예측하지 않는 것과 같은 원칙 —
      // 탐색 패널은 열림·닫힘과 탭에 따라 폭이 달라지고, 인스펙터는 선택이 있을 때만 뜬다.
      const edge = (sel: string, side: 'left' | 'right') => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el || !el.offsetParent) return 10;
        const r = el.getBoundingClientRect();
        if (r.width < 1) return 10;
        return Math.max(10, side === 'left' ? r.right + 12 : innerWidth - r.left + 12);
      };
      setInset(prev => {
        const next = { left: edge('.shell-explorer', 'left'), right: edge('.shell-right', 'right') };
        return prev.left === next.left && prev.right === next.right ? prev : next;
      });
      if (!which) { setPins([]); return; }
      setPins(resolved.map(c => {
        const p = map.project(c.at);
        return { c, x: p.x, y: p.y };
      }));
    };
    sync();
    map.on('move', sync); map.on('zoom', sync); map.on('resize', sync);
    return () => { map.off('move', sync); map.off('zoom', sync); map.off('resize', sync); };
  }, [map, resolved, which]);

  // 미시 지도에 들어왔음을 문서 루트에 적는다. 발표 HUD가 그걸 보고 **본문을 접는다** —
  // HUD는 지중해 장면을 설명하는 글이라 도시 지도에서는 맞지도 않고, 실측 446px이라
  // 왼쪽 카드 칸을 그만큼 밀어내 넷째 카드가 화면 밖(bottom 1249 / 1080)으로 나갔다.
  // 제목은 남긴다 — 지금 몇 번째 장인지는 계속 보여야 한다.
  useEffect(() => {
    const el = document.documentElement;
    // **`open`을 보지 않는다.** 예전엔 콜아웃을 끄면 이 값이 지워져, 미시 축척에서
    // 접어 뒀던 대륙 크롬(왼쪽 위 연도·가운데 위 「그 해」)이 되살아났다 — River의
    // 알렉산드리아 화면이 정확히 그 상태였다(설명 닫힘 + BC 47 큰 글씨 + 인물 이름 줄).
    // 미시 지도에 들어와 있다는 사실은 콜아웃을 보든 말든 그대로다.
    if (which) el.dataset.micro = which; else delete el.dataset.micro;
    return () => { delete el.dataset.micro; };
  }, [which]);

  // C로 껐다 켠다. 발표 중에 그림만 보여 주고 싶을 때가 있다.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'c' && e.key !== 'C') return;
      if (e.target instanceof HTMLElement && /input|textarea/i.test(e.target.tagName)) return;
      setOpen(o => !o);
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  // **카드 높이를 재고 나서 지시선을 그린다.** 처음엔 칸 높이를 n등분해 균등히 놓았는데
  // 실제로 겹쳤다 — 로마 시내 판에서 왼쪽 넷이 서로 위에 올라탔다. 본문을 160자로 묶어도
  // 사료 줄과 링크 줄이 붙으면 카드 높이가 두 배씩 벌어진다. 그래서 **쌓는 것은 브라우저에
  // 맡기고**(flex column) 그 결과를 읽어 선을 건다. 내가 높이를 예측하지 않는다.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const base = host.getBoundingClientRect();
    const next: Record<string, { x: number; y: number }> = {};
    for (const [id, el] of Object.entries(cardRef.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const c0 = resolved.find(c => c.id === id);
      const side: 'left' | 'right' = !c0 ? 'left' : (squeezeRef.current ? 'right' : c0.side);
      next[id] = {
        x: (side === 'left' ? r.right : r.left) - base.left,
        y: r.top - base.top + Math.min(24, r.height / 2),
      };
    }
    setAnchors(prev => {
      const same = Object.keys(next).length === Object.keys(prev).length
        && Object.entries(next).every(([k, v]) => prev[k] && Math.abs(prev[k].x - v.x) < 0.5 && Math.abs(prev[k].y - v.y) < 0.5);
      return same ? prev : next;
    });
  });

  // 미시 지도에 들어왔는데 콜아웃이 꺼져 있으면 되돌릴 단추를 남긴다.
  // River가 「토글로 보일수도 있고 숨길 수도 있고」라고 했고, 키(C)만으로는 찾을 수 없다.
  if (which && !open) {
    return <button className="ca-callout-toggle is-off" onClick={() => setOpen(true)}
                   title="설명 보이기 (C)">설명 ▸</button>;
  }
  if (!which || !pins.length) return null;
  const [W, H] = size;
  // 왼쪽에 앱 패널(탐색)이 서 있으면 **카드를 전부 오른쪽으로 몰아넣는다.** 패널을 비켜
  // 오른쪽으로 밀면 카드가 지도 한가운데(x 336~636)를 덮어 알레시아 포위선의 서쪽 절반을
  // 가렸다 — 여백에 두려고 만든 장치가 여백을 벗어나면 뜻이 없다. 발표 모드는 패널이
  // 없으니 원래대로 양쪽을 쓴다.
  const squeeze = inset.left > 40;
  squeezeRef.current = squeeze;
  const sideOf = (c: Callout): 'left' | 'right' => (squeeze ? 'right' : c.side);
  const cols: Record<'left' | 'right', Pin[]> = { left: [], right: [] };
  for (const p of [...pins].sort((a, b) => a.c.num - b.c.num)) cols[sideOf(p.c)].push(p);

  // 카드 높이는 글 길이에 따라 다르지만, 지시선을 그리려면 **그리기 전에** 자리를 알아야
  // 한다. 칸 높이를 n등분해 균등히 놓고 카드 안은 스크롤 없이 흐르게 둔다 — 본문이
  // 160자 이내로 묶여 있어(data/overlays/pack-callouts.json) 넘칠 일이 거의 없다.
  return (
    <div className="ca-callouts" ref={hostRef} aria-hidden={false}>
      <button className="ca-callout-toggle" onClick={() => setOpen(false)} title="설명 숨기기 (C)">설명 ×</button>
      <svg className="ca-callout-lines" width={W} height={H}>
        {pins.map(p => {
          const a = anchors[p.c.id];
          if (!a) return null;
          // 꺾임 한 번. 곧은 대각선은 지도 위를 길게 가로질러 지형을 덮는다.
          const mid = sideOf(p.c) === 'left' ? a.x + (p.x - a.x) * 0.35 : a.x - (a.x - p.x) * 0.35;
          return (
            <g key={p.c.id} className="ca-leader">
              <path d={`M ${a.x} ${a.y} L ${mid} ${a.y} L ${p.x} ${p.y}`} />
            </g>
          );
        })}
        {pins.map(p => (
          <g key={`pin-${p.c.id}`} className="ca-leader">
            <circle cx={p.x} cy={p.y} r={11} className="ca-pin" />
            <text x={p.x} y={p.y + 4} className="ca-pin-num">{p.c.num}</text>
          </g>
        ))}
      </svg>
      {(['left', 'right'] as const).filter(side => cols[side].length).map(side => (
        <div key={side} className={`ca-callout-col is-${side}`}
             style={{ width: CARD_W, [side]: inset[side],
                      top: side === hudBox.side ? Math.max(H * 0.05, hudBox.bottom + 12) : H * 0.05 }}>
          {cols[side].map(p => (
            <article key={p.c.id} ref={el => { cardRef.current[p.c.id] = el; }} className="ca-card">
              <h4><span className="ca-card-num">{p.c.num}</span>{p.c.title}</h4>
              <p>{p.c.body}</p>
              {/* 사진은 **구운 것만** 인라인으로 띄운다. 런타임에 커먼즈를 부르면 레포
                  `AGENTS.md`의 「런타임 외부 호출 0」에 걸리고, 카피레프트는 구울 수 없다
                  (`src/callouts.ts`의 THUMBS 주석). 못 구운 것은 아래 링크 칩으로 남는다.
                  눌러서 커먼즈 파일 페이지로 나가면 원본·라이선스·작자가 거기 있다. */}
              {p.c.thumb && (
                <a className="ca-thumb" href={p.c.thumb.page || p.c.image?.url}
                   target="_blank" rel="noreferrer noopener"
                   title={`${p.c.image?.alt ?? ''} — ${p.c.image?.credit ?? ''}`}>
                  <img src={`${root}datasets/${ds}/callouts/${p.c.thumb.file}`}
                       alt={p.c.image?.alt ?? p.c.title} loading="lazy" />
                  <span>{p.c.thumb.license}</span>
                </a>
              )}
              {p.c.cite && <div className="ca-cite">{p.c.cite}</div>}
              {(p.c.links?.length || (p.c.image && !p.c.thumb)) && (
                <div className="ca-links">
                  {p.c.image && !p.c.thumb && (
                    <a href={p.c.image.url} target="_blank" rel="noreferrer noopener"
                       title={`${p.c.image.alt} — ${p.c.image.credit}`}>사진</a>
                  )}
                  {p.c.links?.map(l => (
                    <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener">{l.label}</a>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      ))}
    </div>
  );
}
