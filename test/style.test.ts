import { describe, it, expect } from 'vitest';
import { buildStyle, MAP } from '../src/map/style';

const manifest: any = { basemap: ['land', 'coast', 'rivers', 'lakes', 'glaciers', 'bathy', 'marine_labels', 'region_labels'], relief: true, bbox: [-15, 20, 65, 60] };

describe('basemap style (TASKS 1.4)', () => {
  const st = buildStyle(manifest, '/chronoatlas/', 'rome');
  const ids = st.layers.map(l => l.id);
  it('순서: 바다 → 육지 → 음영 → 수심 → 물 → 강 → 해안 → 라벨', () => {
    const order = ['sea', 'land', 'relief', 'bathy', 'lakes', 'rivers-major', 'coast', 'label-marine', 'label-region', 'label-settle-1'];
    expect(order.map(id => ids.indexOf(id))).toEqual([...order.map(id => ids.indexOf(id))].sort((a, b) => a - b));
    expect(ids.indexOf('sea')).toBe(0);
  });
  it('글리프는 자체 호스팅, 외부 호출 0', () => {
    expect(st.glyphs).toBe('/chronoatlas/glyphs/{fontstack}/{range}.pbf');
    for (const s of Object.values(st.sources) as any[]) if (s.url) expect(s.url.startsWith('/chronoatlas/')).toBe(true);
    for (const s of Object.values(st.sources) as any[]) if (s.data) expect(String(s.data).startsWith('/chronoatlas/')).toBe(true);
  });
  it('relief 이미지 모서리 = bbox', () => {
    expect((st.sources.relief as any).coordinates).toEqual([[-15, 60], [65, 60], [65, 20], [-15, 20]]);
  });
  it('수심 램프 5단 이상, 라벨은 겹치지 않는다(P9)', () => {
    const bathy: any = st.layers.find(l => l.id === 'bathy');
    expect(bathy.paint['fill-color'].length).toBeGreaterThanOrEqual(2 + 2 * 5);
    for (const l of st.layers.filter(l => l.type === 'symbol') as any[]) expect(l.layout['text-allow-overlap'] ?? false).toBe(false);
  });
  it('다크는 육지·바다만 바뀌고 램프는 유지', () => {
    const dk = buildStyle(manifest, '/', 'rome', { dark: true });
    expect((dk.layers[0] as any).paint['background-color']).toBe(MAP.dark.sea);
    expect((st.layers[0] as any).paint['background-color']).toBe(MAP.light.sea);
  });
  it('베이스맵 파일이 없는 데이터셋(옛 초한지)도 스타일이 나온다', () => {
    const s2 = buildStyle({ basemap: [], relief: false } as any, '/', 'chuhan-206');
    expect(s2.layers.map(l => l.id)).toEqual(['sea', 'label-settle-1', 'label-settle-2', 'label-settle-3']);
  });
});
