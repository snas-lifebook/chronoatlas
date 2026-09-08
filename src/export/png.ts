// PNG 내보내기(F9, TASKS 3.1): 지도 캔버스 + 연도·범례·출처 줄을 2× 오프스크린 캔버스에 합성. 서버 0. 스킨은 P1(export/skins).
export interface FrameSpec { width: number; height: number; scale: number; band: number; margin: number; yearPx: number; textPx: number }
export const frameSpec = (vw: number, vh: number, scale = 2): FrameSpec =>
  ({ width: vw * scale, height: vh * scale, scale, band: 72 * scale, margin: 24 * scale, yearPx: 36 * scale, textPx: 12 * scale });

export interface Legend { color: string; label: string }
export async function renderPng(mapCanvas: HTMLCanvasElement, opt: { year: string; subtitle?: string; legend: Legend[]; credit: string; dark?: boolean; scale?: number }): Promise<Blob> {
  const spec = frameSpec(mapCanvas.clientWidth || mapCanvas.width, mapCanvas.clientHeight || mapCanvas.height, opt.scale ?? 2);
  const c = document.createElement('canvas'); c.width = spec.width; c.height = spec.height;
  const g = c.getContext('2d')!;
  g.drawImage(mapCanvas, 0, 0, spec.width, spec.height);
  // 하단 띠(반투명) + 텍스트. 색은 DESIGN 지도 토큰(크롬 토큰 아님 — 그림은 UI 밖이다).
  const ink = opt.dark ? '#E6E8EB' : '#111418', ink2 = opt.dark ? '#9AA3AE' : '#7C8794', bg = opt.dark ? 'rgba(27,33,41,.85)' : 'rgba(255,255,255,.85)';
  g.fillStyle = bg; g.fillRect(0, spec.height - spec.band, spec.width, spec.band);
  g.fillStyle = ink; g.font = `700 ${spec.yearPx}px Pretendard, system-ui, sans-serif`; g.textBaseline = 'middle';
  g.fillText(opt.year, spec.margin, spec.height - spec.band / 2);
  if (opt.subtitle) { g.fillStyle = ink2; g.font = `500 ${spec.textPx}px Pretendard, system-ui, sans-serif`; g.fillText(opt.subtitle, spec.margin + g.measureText(opt.year).width * 0 + spec.yearPx * 5.2, spec.height - spec.band / 2); }
  // 범례(우측 정렬)
  g.font = `500 ${spec.textPx}px Pretendard, system-ui, sans-serif`;
  let x = spec.width - spec.margin;
  for (const l of [...opt.legend].reverse()) {
    const w = g.measureText(l.label).width; x -= w; g.fillStyle = ink; g.fillText(l.label, x, spec.height - spec.band / 2 - spec.textPx * 0.4);
    x -= spec.textPx * 1.2; g.fillStyle = l.color; g.fillRect(x, spec.height - spec.band / 2 - spec.textPx * 0.9, spec.textPx * 0.9, spec.textPx * 0.9); x -= spec.textPx * 1.4;
  }
  g.fillStyle = ink2; g.font = `400 ${spec.textPx * 0.85}px Pretendard, system-ui, sans-serif`; g.textAlign = 'right';
  g.fillText(opt.credit, spec.width - spec.margin, spec.height - spec.band / 2 + spec.textPx * 0.9);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/png'));
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
