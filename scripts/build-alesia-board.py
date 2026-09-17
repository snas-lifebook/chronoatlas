#!/usr/bin/env python3
"""build-alesia-board.py: 알레시아 말판(alesia-52)을 미시지도 피처에서 파생한다. 손으로 찍는 좌표 0. OVERHAUL §3.6 (R54).

세 페이즈는 『갈리아 전기』 7.79~89: ① 구원군 도착 ② 정오의 총공격(평원 · 북쪽 진영 D · 안쪽 선) ③ 카이사르 기병의 우회와 붕괴.
유닛 위치 = 피처 대푯점(진영 점 · 오피둠 중심 · 구원군 진영 중심 · 포위선의 가까운 정점 · 몽 레아). 병력은 data/boards/_alesia-strength.json
(docs/LEGIONS.md·ALESIA.md에서 옮겨 적은 사료 수치만. 없는 값은 null이라 유닛에서 빠진다).
    python3 scripts/build-alesia-board.py   →  data/boards/alesia-52.json
"""
import json, math
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
mm = json.loads((ROOT / 'data/micromaps/alesia.json').read_text())
F = {f['properties']['id']: f for f in mm['features']}
STR = json.loads((ROOT / 'data/boards/_alesia-strength.json').read_text())


def rep(f):
    g = f['geometry']; c = g['coordinates']
    if g['type'] == 'Point':
        return [round(c[0], 5), round(c[1], 5)]
    pts = c if g['type'] == 'LineString' else c[0]
    return [round(sum(p[0] for p in pts) / len(pts), 5), round(sum(p[1] for p in pts) / len(pts), 5)]


def nearest_vertex(f, to):
    g = f['geometry']; pts = g['coordinates'] if g['type'] == 'LineString' else g['coordinates'][0]
    p = min(pts, key=lambda p: math.hypot(p[0] - to[0], p[1] - to[1]))
    return [round(p[0], 5), round(p[1], 5)]


def bearing(a, b):
    return round((math.degrees(math.atan2((b[0] - a[0]) * math.cos(math.radians(a[1])), b[1] - a[1])) + 360) % 360)


def unit(**u):
    return {k: v for k, v in u.items() if v is not None}


opp = rep(F['alesia:oppidum']); relief = rep(F['alesia:reliefcamp']); rea = rep(F['alesia:hill:rea']); plain = rep(F['alesia:plain'])
inner, outer = F['alesia:inner'], F['alesia:outer']
camps = sorted([f for f in mm['features'] if f['properties']['kind'] == 'camp'], key=lambda f: f['properties']['camp_letter'])
campD = rep(F['alesia:campD'])
hit_plain = nearest_vertex(outer, relief)          # 구원군 본대가 치는 바깥선(평원 쪽)
hit_north = nearest_vertex(outer, rea)             # 베르카시벨라우누스가 치는 북쪽 진영 앞 바깥선
hit_inner = nearest_vertex(inner, plain)           # 베르킹게토릭스가 내려와 치는 안쪽 선(평원 쪽)
behind = [round(hit_north[0] + (hit_north[0] - campD[0]), 5), round(hit_north[1] + (hit_north[1] - campD[1]), 5)]   # 북쪽 공격군의 등: 진영 D에서 접점 너머 같은 거리


def romans(status=None):
    return [unit(id=f"rom-camp-{f['properties']['camp_letter']}", at=rep(f), actor='로마', arm='infantry', label=f['properties']['name_ko'], strength=STR['legion'], facing=bearing(rep(f), opp), status=status) for f in camps]


def verc(at, status=None, label='베르킹게토릭스 · 농성군'):
    return unit(id='gaul-oppidum', at=at, actor='갈리아', arm='infantry', label=label, strength=STR['oppidum'], facing=bearing(at, hit_inner), entity='person:베르킹게토릭스', status=status)


relief_inf = unit(id='gaul-relief-inf', at=relief, actor='갈리아', arm='infantry', label='구원군 보병', strength=STR['relief_inf'], facing=bearing(relief, opp))
relief_cav = unit(id='gaul-relief-cav', at=relief, actor='갈리아', arm='cavalry', label='구원군 기병', strength=STR['relief_cav'], facing=bearing(relief, opp))
vercas = unit(id='gaul-vercassivellaunus', at=hit_north, actor='갈리아', arm='infantry', label='베르카시벨라우누스 · 정예 6만', strength=STR['vercassivellaunus'], facing=bearing(hit_north, campD))
german = unit(id='rom-cav-german', at=rep(camps[0]), actor='로마', arm='cavalry', label='게르만 기병(카이사르)', strength=STR['german_cav'], facing=bearing(rep(camps[0]), behind))

board = {
  'id': 'alesia-52', 'title': '알레시아 · 구원군의 사흘', 'year': -52, 'center': mm['view']['center'], 'zoom': mm['view']['zoom'], 'bearing': 0, 'teaching': True,
  'source': '『갈리아 전기』 7.79~89를 통설대로 도식화. 유닛 위치는 미시지도 피처(진영 점 · 오피둠 · 구원군 진영 · 몽 레아 · 포위선 정점)에서 파생한 상대 배치이고 측량이 아니다(scripts/build-alesia-board.py). 병력은 카이사르 본인의 수치이고 구원군은 현대 추정 8만~10만으로 갈린다(docs/LEGIONS.md §3). 로마 진영별 병력은 사료에 없어 비웠다. 몽 레아 사면의 진영 D는 발굴에서 끝내 못 찾았다(docs/ALESIA.md). ' + STR['note'],
  'phases': [
    {'t': 0, 'title': '구원군 도착', 'caption': '구원군이 서쪽 평원 너머 언덕에 진을 친다. 안팎 두 겹 사이에 로마군이 갇힌 꼴이다', 'cite': '『갈리아 전기』 7.79',
     'units': romans() + [verc(opp), relief_inf, relief_cav], 'arrows': [], 'clashes': []},
    {'t': 1, 'title': '정오의 총공격', 'caption': '구원군은 평원의 바깥선을, 베르카시벨라우누스는 북쪽 진영을, 베르킹게토릭스는 안쪽 선을 한꺼번에 친다', 'cite': '『갈리아 전기』 7.83~85',
     'units': romans() + [verc(hit_inner), dict(relief_inf, at=hit_plain, facing=bearing(hit_plain, opp)), dict(relief_cav, at=hit_plain, facing=bearing(hit_plain, opp)), vercas],
     'arrows': [{'from': relief, 'to': hit_plain, 'actor': '갈리아', 'kind': 'advance'}, {'from': rea, 'to': hit_north, 'actor': '갈리아', 'kind': 'advance'}, {'from': opp, 'to': hit_inner, 'actor': '갈리아', 'kind': 'advance'}],
     'clashes': [{'at': hit_plain, 'label': '평원'}, {'at': hit_north, 'label': '북쪽 진영'}, {'at': hit_inner, 'label': '안쪽 선'}]},
    {'t': 2, 'title': '기병의 우회', 'caption': '카이사르가 기병을 바깥으로 돌려 북쪽 공격군의 등을 친다. 구원군이 무너지고 이튿날 베르킹게토릭스가 항복한다', 'cite': '『갈리아 전기』 7.87~89',
     'quote': {'text': '카이사르는 붉은 외투로 자신이 오는 것을 알렸다', 'who': '『갈리아 전기』의 서술', 'cite': '『갈리아 전기』 7.88'},
     'units': romans() + [verc(opp, 'routed', '베르킹게토릭스 · 성으로 물러난다'), dict(relief_inf, at=hit_plain, status='routed'), dict(relief_cav, at=relief, status='routed', label='구원군 기병, 흩어진다'), dict(vercas, status='routed'), dict(german, at=behind)],
     'arrows': [{'from': rep(camps[0]), 'to': behind, 'via': [round(behind[0], 5), round(rep(camps[0])[1], 5)], 'actor': '로마', 'kind': 'flank'}],
     'clashes': [{'at': behind, 'label': '북쪽 공격군의 등'}]},
  ],
}
(ROOT / 'data/boards/alesia-52.json').write_text(json.dumps(board, ensure_ascii=False, indent=1) + '\n')
print('alesia-52: 유닛', [len(p['units']) for p in board['phases']], '진영', [f['properties']['camp_letter'] for f in camps])
