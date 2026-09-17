#!/usr/bin/env python3
"""알레시아 포위선의 해자·참호·세 겹 함정 띠를 **정본 포위선 정점에서 파생**시켜
data/micromaps/alesia.json 에 덧붙인다(2026-09-17부터 레지스트리 파일).

좌표를 손으로 찍지 않는다. 기존 inner_line·outer_line 폴리곤을 shapely로 오프셋해
띠의 중심선 링(LineString)만 뽑고, 띠 폭은 속성(width_m)으로 넘긴다.

폴리곤(띠) 대신 선(중심선)으로 내는 이유는 축척이다. MapLibre는 512px 타일이라
CSS px 해상도가 40075017·cos(lat)/(512·2^z)이고, 이 위도에서 발표 줌 z12.4가 9.8m/px,
최대 줌 z15가 1.6m/px다. 릴리아 띠의 실폭 7.1m는 z12.4에서 0.7px, z15에서 4.4px다 —
면으로 그리면 발표 줌에서 사라지고, 픽셀 폭을 주는 line 레이어만 읽힌다.

거리는 전부 로마피트(pes)로 잡고 1 pes = 0.296 m로 환산한다. 부호는 「적 쪽이 양수」다:
안쪽 선은 농성군(오피둠)을 향하므로 안쪽으로, 바깥 선은 구원군을 향하므로 바깥으로.

재실행: python3 scripts/build-alesia-traps.py   (이미 붙어 있으면 지우고 다시 붙인다)
"""
import json
import math
import re
from pathlib import Path

from shapely.geometry import Point, Polygon

PES = 0.296  # 로마피트 → 미터
PACK = Path(__file__).resolve().parent.parent / 'data' / 'micromaps' / 'alesia.json'   # 2026-09-17 레지스트리로 이동
ANCHOR = (4.5006, 47.5392)  # 이 프로젝트 정본 앵커(몽 옥수아)

# 카이사르가 준 치수(BG 7.72·7.73)를 정본 링(= 보루/벽 선)에서 적 쪽으로 재 배치한다.
# near/far 는 띠의 앞뒤 끝(pedes), 링은 그 중심선에 놓는다.
#   fossae_15  0~30   : 폭·깊이 15피트 참호 두 줄을 붙여 놓은 것(둘 사이 간격은 사료에 없다)
#   cippi     60~90   : 5줄. 줄 간격은 사료에 없다 — 400피트 간격 안에 넣은 교보재 배치
#   lilia    120~144  : 8줄 × 3피트 = 24피트. **폭이 사료에서 나오는 유일한 띠**
#   stimuli  180~200  : 짧은 간격으로 흩뿌렸다고만 적혀 있다
#   fossa_20 430~450  : 폭 20피트 수직호. 「나머지 시설을 이 호에서 400피트 물렸다」를
#                       참호 띠 앞끝(30) + 400 = 430 으로 맞춘 것
BANDS = [
    # 폭·깊이 15피트 참호 두 줄(BG 7.72)은 링으로 내지 않는다. 중심선이 벽에서 4.4m라
    # 발표 줌 z12.4에서 0.45px, 최대 줌 z15에서도 2.75px 떨어져 포위선 선 자체의
    # 굵기(line-width 3.4) 안에 들어간다 — 다섯 띠 중 유일하게 어느 줌에서도 갈라 보이지
    # 않는 것이라, +15KB 용량 예산에서 먼저 잘랐다(링 두 개 = 3.8KB). 수치는 두 선 피처의
    # trench_pedes/trench_rows로 얹었다(note_ko에도 이미 평문으로 있다).
    # 그려야 하면 이 자리에 dict(key='fossae15', near=0, far=30, ...)을 되살리면 된다.
    dict(key='cippi', near=60, far=90, kind='trap', trap_type='cippi', rows=5,
         name_ko='킵피 (사슴뿔 통나무 5줄)', name_la='cippi', bg='7.73',
         note_ko='깊이 5피트 참호에 통나무를 박아 뽑히지 않게 고정하고 가지를 사슴뿔처럼 다듬었다. 5줄을 서로 엮어 들어온 자가 찔리게 했다. 이름은 병사들이 붙였다.',
         attest='5줄·깊이 5피트 참호는 전거. 줄 간격·띠 폭은 사료에 없다.'),
    dict(key='lilia', near=120, far=144, kind='trap', trap_type='lilia', rows=8,
         name_ko='릴리아 (깊이 3피트 함정 구덩이 8줄)', name_la='lilia', bg='7.73',
         note_ko='깊이 3피트(약 0.9m) 구덩이를 3피트 간격 바둑판으로 파고 넓적다리 굵기 말뚝을 박아 4인치만 내놓은 뒤 흙으로 1피트 덮고 잔가지로 위장했다. 백합을 닮아 릴리아라 불렀다.',
         attest='8줄 × 간격 3피트 = 24피트. 폭이 사료에서 나오는 유일한 띠다.'),
    dict(key='stimuli', near=180, far=200, kind='trap', trap_type='stimuli', rows=None,
         name_ko='스티물루스 (쇠갈고리 말뚝)', name_la='stimuli', bg='7.73',
         note_ko='길이 1피트(약 30cm) 말뚝에 쇠갈고리를 달아 땅에 완전히 묻고 짧은 간격으로 흩뿌렸다. 밟으면 발을 꿴다.',
         attest='존재·말뚝 1피트는 전거. 줄 수·띠 폭·거리는 사료에 없다.'),
    dict(key='fossa20', near=430, far=450, kind='ditch', ditch_type='fossa_20', rows=1,
         name_ko='수직호 (폭 20피트)', name_la='fossa XX pedum derectis lateribus',
         bg='7.72',
         note_ko='적과 가장 가까운 자리에 벽을 수직으로 깎은 폭 20피트(약 5.9m) 호를 한 줄 팠다. 바닥 폭이 입구 폭과 같다. 나머지 시설을 이 호에서 400피트 물린 그 빈 자리에 함정을 심었다.',
         attest='폭 20피트·수직벽·400피트 후퇴 전거. 400피트는 참호 띠 앞끝에서 재었다.'),
]

LINES = [
    dict(src='alesia:inner', slug='inner', sign=-1, face='안쪽',
         extra='BG 7.72의 안쪽 시설.'),
    dict(src='alesia:outer', slug='outer', sign=+1, face='바깥',
         extra='BG 7.74 「같은 규격, 방향만 반대(pares eiusdem generis munitiones, diversas ab his, contra exteriorem hostem)」.'),
]

TOWER_NOTE = '화면의 망루 개수는 표현이고 실제 간격은 80로마피트(약 24m)다.'

# 8피처가 공유하는 설명은 피처마다 복사하지 않고 팩 최상위 source에 한 번만 적는다.
PACK_NOTE = (
    ' 함정·해자 띠 8개(kind: trap·ditch)는 inner_line·outer_line 정본 정점을 shapely로 '
    '오프셋한 파생 기하다 — 손으로 찍은 좌표가 없다. 거리는 로마피트(1 pes = 0.296m)로 '
    '잡아 링 = 보루(벽) 선에서 적 쪽으로 재었다. 안쪽 선은 적이 성안이라 오피둠 쪽으로, '
    '바깥 선은 적이 구원군이라 밖으로 오프셋했다(BG 7.74). offset_pedes는 띠의 앞뒤 끝이고 '
    '기하는 그 중심선, 폭은 width_m이다 — 폭 7m 띠는 발표 줌(z12.4, 9.8m/px)에서 0.7px라 '
    '면으로 그릴 수 없어 선으로 낸다. 망루는 사료가 개별 위치를 특정하지 않아 점을 '
    '만들지 않고 간격만 두 선의 tower_spacing_pedes에 얹었다.')


def project(lon, lat):
    """앵커 기준 국소 평면(미터). 전장이 12km라 등장방형으로 충분하다(오차 0.1% 미만)."""
    m_lat = 111132.95 - 559.85 * math.cos(2 * math.radians(ANCHOR[1]))
    m_lon = 111320.0 * math.cos(math.radians(ANCHOR[1]))
    return ((lon - ANCHOR[0]) * m_lon, (lat - ANCHOR[1]) * m_lat)


def unproject(x, y):
    m_lat = 111132.95 - 559.85 * math.cos(2 * math.radians(ANCHOR[1]))
    m_lon = 111320.0 * math.cos(math.radians(ANCHOR[1]))
    return (round(x / m_lon + ANCHOR[0], 5), round(y / m_lat + ANCHOR[1], 5))


def offset_ring(ring_lonlat, metres):
    """폴리곤을 metres만큼 오프셋한 링의 정점. 양수 = 바깥, 음수 = 안쪽.
    mitre 조인이라 원본 정점 하나에 결과 정점 하나가 대응한다(정점 수 보존)."""
    poly = Polygon([project(*c) for c in ring_lonlat])
    off = poly.buffer(metres, join_style='mitre', mitre_limit=3.0)
    assert off.geom_type == 'Polygon' and off.is_valid, off.geom_type
    return [unproject(*c) for c in off.exterior.coords]


def feature_text(props, ring):
    """정점이 촘촘한 파생 기하라 좌표는 한 줄로 붙인다 — pack-peoples.json과 같은 관례."""
    body = json.dumps(props, ensure_ascii=False, separators=(',', ':'))
    coords = ','.join(f'[{x},{y}]' for x, y in ring)
    return ('{"type":"Feature","properties":' + body +
            ',"geometry":{"type":"LineString","coordinates":[' + coords + ']}}')


def main():
    pack = json.loads(PACK.read_text(encoding='utf-8'))
    # 재실행 대비: 앞서 붙인 파생 피처를 뺀다(id가 `alesia:{inner,outer}:*`인 것).
    pack['features'] = [f for f in pack['features']
                        if not re.match(r'alesia:(inner|outer):.', f['properties']['id'])]
    by_id = {f['properties']['id']: f for f in pack['features']}

    out = []
    for ln in LINES:
        src = by_id[ln['src']]
        ring0 = src['geometry']['coordinates'][0]
        for b in BANDS:
            centre = (b['near'] + b['far']) / 2 * PES
            ring = offset_ring(ring0, ln['sign'] * centre)
            inner = ln['sign'] < 0
            props = {
                'id': f"alesia:{ln['slug']}:{b['key']}",
                'name_ko': f"{b['name_ko']} — {ln['face']} 선",
                'name_la': b['name_la'],
                'kind': b['kind'],
                'line': ln['src'],
                'offset_pedes': [b['near'], b['far']],
                'width_m': round((b['far'] - b['near']) * PES, 2),
                'note_ko': b['note_ko'] if inner else
                           f"{b['name_ko'].split(' (')[0]}를 바깥 선에도 한 벌 더 두었다. 규격은 안쪽과 같고 향하는 쪽만 반대다.",
                'source': ((f"BG {b['bg']}. {b['attest']}" if inner else
                            f"{ln['extra']} 치수는 BG {b['bg']}.") +
                           f" 정본 {ln['src']}에서 {'안' if inner else '밖'}으로 {round(centre, 1)}m 오프셋."),
                'teaching': True,
            }
            if b['kind'] == 'trap':
                props['trap_type'] = b['trap_type']
            else:
                props['ditch_type'] = b['ditch_type']
            if b['rows']:
                props['rows'] = b['rows']
            out.append((props, ring))

    # 망루: 사료가 개별 위치를 특정하지 않아 점을 만들지 않는다. 간격만 선 속성으로 넘긴다.
    for ln in LINES:
        pr = by_id[ln['src']]['properties']
        pr['tower_spacing_pedes'] = 80
        pr['tower_spacing_m'] = round(80 * PES, 2)
        pr['tower_note_ko'] = TOWER_NOTE
        pr['trench_pedes'] = 15  # 폭·깊이 15피트 참호가
        pr['trench_rows'] = 2    # 두 줄. 링으로 내지 않은 이유는 BANDS 주석에.

    if PACK_NOTE.strip() not in pack['source']:
        pack['source'] += PACK_NOTE

    # 정본 43피처의 서식은 그대로 두고(indent=1 왕복이 바이트 동일) 파생 줄만 뒤에 붙인다.
    pack_txt = json.dumps(pack, ensure_ascii=False, indent=1)
    tail = '\n' + ',\n'.join(feature_text(p, r) for p, r in out) + '\n ]\n}'
    assert pack_txt.endswith('\n ]\n}'), pack_txt[-20:]
    PACK.write_text(pack_txt[: -len('\n ]\n}')] + ',' + tail, encoding='utf-8')

    n = len(out)
    size = PACK.stat().st_size
    print(f'파생 {n}피처, 정점 {[len(r) for _, r in out]}')
    print(f'파일 {size:,} B')
    check()


def check():
    """불변식. 여기서 걸리는 게 렌더에서 조용히 틀린 것보다 싸다."""
    pack = json.loads(PACK.read_text(encoding='utf-8'))
    fs = {f['properties']['id']: f for f in pack['features']}
    kinds = {}
    for f in pack['features']:
        kinds[f['properties']['kind']] = kinds.get(f['properties']['kind'], 0) + 1
    # test/present.test.ts가 세는 네 값은 건드리면 안 된다.
    assert (kinds['inner_line'], kinds['outer_line'], kinds['camp'], kinds['redoubt']) == (1, 1, 8, 23), kinds
    assert kinds['trap'] == 6 and kinds['ditch'] == 2, kinds

    inner = Polygon([project(*c) for c in fs['alesia:inner']['geometry']['coordinates'][0]])
    outer = Polygon([project(*c) for c in fs['alesia:outer']['geometry']['coordinates'][0]])
    oppidum = Polygon([project(*c) for c in fs['alesia:oppidum']['geometry']['coordinates'][0]])
    for fid, f in fs.items():
        pr = f['properties']
        if pr['kind'] not in ('trap', 'ditch'):
            continue
        cs = f['geometry']['coordinates']
        assert cs[0] == cs[-1], f'{fid} 링이 안 닫혔다'
        for k in ('name_ko', 'name_la', 'kind', 'source', 'note_ko'):
            assert pr.get(k), f'{fid} {k} 없음'
        assert pr['teaching'] is True and pr['width_m'] > 0
        for lon, lat in cs:  # 전장 bbox (정본 검증과 같은 값)
            assert 4.42 < lon < 4.58 and 47.49 < lat < 47.58, f'{fid} bbox 이탈 {lon},{lat}'
        band = Polygon([project(*c) for c in cs])
        if pr['line'] == 'alesia:inner':   # 안쪽 선 안에, 오피둠은 여전히 그 안에
            assert inner.contains(band), f'{fid}가 안쪽 선 밖으로 나갔다'
            assert band.contains(oppidum) and not band.exterior.intersects(oppidum), \
                f'{fid} 링이 오피둠을 가로지른다'
        else:                              # 바깥 선 밖에
            assert band.contains(outer), f'{fid}가 바깥 선 안으로 들어갔다'
        # 오프셋 실측 — 파생 거리가 사료 수치와 맞는지
        want = (pr['offset_pedes'][0] + pr['offset_pedes'][1]) / 2 * PES
        src = inner if pr['line'] == 'alesia:inner' else outer
        got = [src.exterior.distance(Point(project(*c))) for c in cs]
        assert abs(sum(got) / len(got) - want) < 1.0, f'{fid} 오프셋 {want} vs {sum(got)/len(got)}'
    for lid in ('alesia:inner', 'alesia:outer'):
        assert fs[lid]['properties']['tower_spacing_pedes'] == 80
        assert '80로마피트' in fs[lid]['properties']['tower_note_ko']
    print('불변식 통과 — 기하 8개, 링 폐합·bbox·포함관계·오프셋 실측·망루 간격')


if __name__ == '__main__':
    main()
