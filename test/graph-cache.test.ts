// loadGraph는 모듈 수준에 약속 하나를 캐시한다. 거절된 약속까지 캐시하면 그 뒤 호출이
// 전부 같은 거절을 다시 던져서, 한 번 놓친 graph.json이 새로고침 전까지 영영 안 온다.
// graph.json이 아예 없는 데이터셋(초한지)에서도 검색 팔레트가 이 경로를 탄다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const RAW = { nodes: [{ id: 'person:유방', name: '유방', aliases: [] }], edges: [], adjacency: {} };

beforeEach(() => vi.resetModules()); // 모듈 캐시가 테스트 간에 새로 시작하도록
afterEach(() => vi.unstubAllGlobals());

describe('loadGraph 캐시', () => {
  it('실패를 캐시하지 않는다 — 다음 호출에서 다시 받는다', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => (++n === 1 ? { ok: false, status: 404 } : { ok: true, json: async () => RAW })));
    const { loadGraph } = await import('../src/graph/data');

    await expect(loadGraph('/d')).rejects.toThrow('404');
    const g = await loadGraph('/d');
    expect(g.nodes.size).toBe(1);
    expect(n).toBe(2);
  });

  it('성공은 캐시한다 — 두 번 부르면 fetch는 한 번', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => RAW }));
    vi.stubGlobal('fetch', fetchMock);
    const { loadGraph } = await import('../src/graph/data');

    await loadGraph('/d');
    await loadGraph('/d');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
