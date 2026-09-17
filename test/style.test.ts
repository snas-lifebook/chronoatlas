import { describe, it, expect } from 'vitest';
import { buildStyle, MAP, chromeTone, type Skin } from '../src/map/style';

const manifest: any = { basemap: ['land', 'coast', 'rivers', 'lakes', 'glaciers', 'bathy', 'marine_labels', 'region_labels'], relief: true, bbox: [-15, 20, 65, 60] };

describe('basemap style (TASKS 1.4)', () => {
  const st = buildStyle(manifest, '/chronoatlas/', 'rome');
  const ids = st.layers.map(l => l.id);
  it('순서: 바다 → 육지 → 음영 → 수심 → 물 → 강 → 해안 → 라벨', () => {
    const order = ['sea', 'land', 'relief', 'bathy', 'lakes', 'rivers-major', 'coast', 'label-region', 'label-settle-1'];
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
  it('지형지물(1.7): manifest에 landmarks가 있을 때만, 정착지 라벨 아래(우선순위 낮음), z5부터 lod 단계', () => {
    expect(ids).not.toContain('landmark-pleiades');
    const lm = buildStyle({ ...manifest, basemap: [...manifest.basemap, 'landmarks'] }, '/', 'rome');
    const lids = lm.layers.map(l => l.id);
    expect(lids.indexOf('landmark-pleiades')).toBeLessThan(lids.indexOf('label-settle-1'));
    const l: any = lm.layers.find(l => l.id === 'landmark-pleiades');
    expect(l.minzoom).toBe(5); expect(l.filter[2][0]).toBe('step');
  });
  // marine_labels.geojson은 이름 없는 GeometryCollection(바다 마스크)이다. 이름표 소스로 쓰면
  // text-field·filter가 읽을 name·scalerank가 없어 매 로드마다 null 경고를 내고 글자는 0개다.
  // 소스 자체는 바다를 클릭 대상으로 만드는 채우기에 계속 쓴다(P5).
  it('바다 이름표 심볼 레이어는 두지 않는다 — 마스크 소스엔 properties가 없다', () => {
    expect(ids).not.toContain('label-marine');
    expect(st.sources.marine_labels).toBeDefined();
    expect(ids).toContain('landmark-marine_labels');
  });
  it('다크는 육지·바다만 바뀌고 램프는 유지', () => {
    const dk = buildStyle(manifest, '/', 'rome', { dark: true });
    expect((dk.layers[0] as any).paint['background-color']).toBe(MAP.dark.sea);
    expect((st.layers[0] as any).paint['background-color']).toBe(MAP.light.sea);
  });
  it('베이스맵 파일이 없는 데이터셋(옛 초한지)도 스타일이 나온다', () => {
    const s2 = buildStyle({ basemap: [], relief: false } as any, '/', 'chuhan-206');
    expect(s2.layers.map(l => l.id)).toEqual(['sea', 'label-settle-1', 'label-settle-2', 'label-settle-3', 'label-settle-4', 'label-settle-5', 'label-sea']);
  });
});

// River: 「좌 상단에 년도나 하는 메타데이터들이 너무 잘 안 보여」 — 판 없이 지도 위에 얹는
// 글자(연도 44px·제목·각주·「그 해」)가 OS 테마 색을 쓰다가 밝은 스킨 위에서 1.20:1이 됐다.
// 색을 스킨에 묶은 뒤로는 **스킨이 곧 바탕**이므로, 각 스킨의 바탕 후보 전부에 대해 재면 된다.
describe('지도 위 맨글씨 크롬 색 (chromeTone)', () => {
  // WCAG 2.x 상대 휘도. rgb는 0~255다 — 0~1로 읽으면 200배 틀린다.
  const lum = (hex: string) => {
    const ch = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it('모든 스킨에서 잉크가 그 스킨의 육지·바다·최심 수심에 대해 AA(4.5:1)를 넘는다', () => {
    for (const [skin, c] of Object.entries(MAP)) {
      const ink = chromeTone(skin as Skin)['--map-ink'];
      expect(ink, skin).toBe(c.label);
      for (const bg of [c.land, c.sea, c.glacier, c.depth[c.depth.length - 1]]) {
        expect(ratio(ink, bg), `${skin} ${ink} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('테두리는 잉크 반대편이다 — 바탕이 단색이 아니어서(음영·영토) 글자를 세워 준다', () => {
    for (const [skin, c] of Object.entries(MAP)) {
      const t = chromeTone(skin as Skin);
      expect(ratio(t['--map-ink'], t['--map-halo']), skin).toBeGreaterThanOrEqual(4.5);
    }
  });
});
