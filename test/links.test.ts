import { describe, it, expect } from 'vitest';
import { atlasUrl, libraryObject, libraryPoint } from '../src/links';
import { parseState } from '../src/state';

describe('딥링크 양방향 (TASKS 2.5)', () => {
  it('자료실 → 지도 주소가 state로 되돌아온다', () => {
    const u = new URL(atlasUrl({ sel: 'person:카이사르', year: -49 }));
    expect(parseState(u.search)).toMatchObject({ sel: 'person:카이사르', year: -49, ds: 'rome' });
  });
  it('지도 → 자료실 객체·포인트', () => {
    expect(libraryObject('person:카이사르', '카이사르')).toBe('https://roma-library.pages.dev/objects/person/%EC%B9%B4%EC%9D%B4%EC%82%AC%EB%A5%B4');
    expect(libraryPoint(7)).toBe('https://roma-library.pages.dev/read/point/7');
  });
  it('기본값은 주소에 안 실린다', () => expect(atlasUrl({ ds: 'rome' })).toBe('https://snas-lifebook.github.io/chronoatlas/'));
});
