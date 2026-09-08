// MP4 내보내기(TASKS 3.2): 연도 구간을 스크럽하며 프레임을 잡아 mediabunny(WebCodecs)로 인코딩. 서버 0. 동적 import — 첫 번들에 안 든다.
import { renderPng } from './png';

export interface Mp4Opt { from: number; to: number; step?: number; fps?: number; scale?: number; setYear: (y: number) => Promise<void> | void; mapCanvas: HTMLCanvasElement; overlay: (y: number) => { year: string; subtitle?: string; legend: { color: string; label: string }[]; credit: string; dark?: boolean }; onProgress?: (p: number) => void }

export async function renderMp4(o: Mp4Opt): Promise<Blob> {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, getFirstEncodableVideoCodec, QUALITY_HIGH } = await import('mediabunny');
  const step = o.step ?? 1, fps = o.fps ?? 12, scale = o.scale ?? 1;
  const w = Math.round((o.mapCanvas.clientWidth || o.mapCanvas.width) * scale) & ~1, h = Math.round((o.mapCanvas.clientHeight || o.mapCanvas.height) * scale) & ~1;
  const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: w, height: h });
  if (!codec) throw new Error('이 브라우저는 WebCodecs 비디오 인코딩을 지원하지 않는다(Chrome/Edge 권장)');
  const target = new BufferTarget();
  const out = new Output({ format: new Mp4OutputFormat(), target });
  const frame = document.createElement('canvas'); frame.width = w; frame.height = h; const g = frame.getContext('2d')!;
  const src = new CanvasSource(frame, { codec, bitrate: QUALITY_HIGH });
  out.addVideoTrack(src, { frameRate: fps });
  await out.start();
  const total = Math.floor((o.to - o.from) / step) + 1;
  const hold = Math.max(1, Math.round((10 * fps) / total)); // 구간이 짧아도 ~10초: 한 해를 hold 프레임만큼 붙든다
  for (let i = 0; i < total; i++) {
    const y = o.from + i * step;
    await o.setYear(y);
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 40))); // 지도가 그릴 시간
    const png = await renderPng(o.mapCanvas, { ...o.overlay(y), scale });
    const bmp = await createImageBitmap(png);
    g.drawImage(bmp, 0, 0, w, h); bmp.close();
    await src.add((i * hold) / fps, hold / fps);
    o.onProgress?.((i + 1) / total);
  }
  await out.finalize();
  return new Blob([target.buffer!], { type: 'video/mp4' });
}
