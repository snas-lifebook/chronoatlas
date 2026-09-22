#!/usr/bin/env python3
"""정본 entities.jsonl에는 있는데 `entities/<type>/<name>.md`가 없는 객체의 노트를 만든다.

    python3 scripts/ontology-notes.py            # 드라이런: 만들 파일 목록
    python3 scripts/ontology-notes.py --apply    # 새 파일만 쓴다. 있는 노트는 절대 안 건드린다

볼트 운영 불변식 「객체 하나에 노트 하나」(Admin/로마제국쇠망사_온톨로지_운영/운영_온톨로지_리포_동기화.md)를
apply-proposals.py가 엔티티를 더한 뒤에 지키기 위한 것. 노트 골격은 기존 노트(2026-07-28 rome30_* 생성분)와 같다:
frontmatter · H1 · 설명 · 등장 포인트 · 관계 · (place) 위치 표. 거리 표의 상수는 ontology/_scripts/rome30_geo.py와 같다.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import unicodedata
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROME = (41.8931, 12.4828)   # rome30_geo.py와 같다
DETOUR, WALK, HORSE, RELAY, SEA = 1.3, 30, 60, 75, 120
CONF_KO = {'high': '확실', 'medium': '대표점', 'low': '추정'}
REL_KO = {'participated_in': '참전·관여', 'occurred_at': '발생지', 'ruled': '통치', 'allied_with': '동맹', 'opposed': '적대',
          'member_of': '소속', 'child_of': '자녀', 'succeeded': '계승', 'created': '세움·지음', 'married': '혼인', 'conquered': '정복'}
# 등장 포인트 링크. points/ 폴더의 파일명.
POINT_FILES = {1: '01_위대한_로마_제국의_탄생', 2: '02_제1차_포에니_전쟁', 3: '03_제2차_포에니_전쟁', 4: '04_제3차_포에니_전쟁',
               5: '05_카이사르_등장_이전의_혼란', 6: '06_천적과의_전쟁', 7: '07_로마_영웅과_이집트_여왕의_밀애', 8: '08_카이사르와_원로원의_대결',
               9: '09_로마를_뒤흔든_여왕의_야심', 10: '10_훌륭한_독재자', 11: '11_서서히_다가오는_쇠락의_징후'}


def nfc(s: str) -> str:
    return unicodedata.normalize('NFC', s)


def ontology_dir() -> Path:
    p = os.environ.get('ONTOLOGY_DIR') or (ROOT / 'data' / 'ontology-dir.txt').read_text(encoding='utf-8').strip()
    return Path(p).expanduser()


def hav(a: tuple[float, float], b: tuple[float, float]) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def year_ko(y: int | None) -> str:
    if y is None:
        return ''
    return f'기원전 {-y}' if y < 0 else f'서기 {y}'


def link_line(rel: str, other: str, incoming: bool, y: int | None) -> str:
    lab = REL_KO.get(rel, rel)
    tail = f'  *{year_ko(y)}*' if y is not None else ''
    return f'- [[{other}]] ← {lab}{tail}' if incoming else f'- {lab} → [[{other}]]{tail}'


def note_for(e: dict, links: list[dict], names: dict[str, str], geo: dict | None) -> str:
    t, name, pts = e['type'], nfc(e['name']), e.get('points') or []
    fm = ['---', f'created: {date.today().isoformat()}', 'type: entity', f'entity_type: {t}', f'entity_id: {e["id"]}', 'book: 로마제국쇠망사']
    body: list[str] = []
    if t == 'place':
        lat, lon = (geo['lat'], geo['lon']) if geo else (e['location'][1], e['location'][0])
        kind = e.get('attrs', {}).get('place_kind') or (geo or {}).get('kind') or 'city'
        conf = e.get('confidence') or (geo or {}).get('confidence') or 'medium'
        d = hav(ROME, (lat, lon)); road = d * DETOUR
        modern = e.get('attrs', {}).get('modern') or (geo or {}).get('modern') or ''
        fm += [f'location: [{lat}, {lon}]', f'mapmarker: {kind}', f'place_kind: {kind}', f'coord_confidence: {conf}', f'dist_from_rome_km: {round(d)}']
        if modern:
            fm.append(f'modern: "{modern}"')
        if e.get('aliases'):
            fm.append(f'ancient: "{e["aliases"][0]}"')
        fm.append(f'points: [{", ".join(map(str, pts))}]')
        if e.get('attrs', {}).get('region'):
            fm.append(f'region: "{e["attrs"]["region"]}"')
        src = e.get('ext', {}).get('pleiades') or e.get('source') or '정본 location'
        body += ['### 위치', '', f'**{CONF_KO.get(conf, conf)}**' + (f' · 현재 {modern}' if modern else '') + (f' · 고대 표기 *{e["aliases"][0]}*' if e.get('aliases') else ''), '',
                 '```leaflet', f'id: place-{e["id"].split(":", 1)[1]}', f'lat: {lat}', f'long: {lon}', 'height: 320px', 'zoom: 6', 'minZoom: 3', 'maxZoom: 12',
                 f'marker: default,{lat},{lon},[[{name}]],{name}', '```', '',
                 '| 로마에서 | |', '|---|---|', f'| 직선거리 | {d:,.0f} km |', f'| 가도 추정 | {road:,.0f} km |',
                 f'| 도보 행군 | 약 {road / WALK:,.0f}일 (하루 {WALK}km) |', f'| 기마 | 약 {road / HORSE:,.0f}일 (하루 {HORSE}km) |',
                 f'| 역참 릴레이 | 약 {road / RELAY:,.0f}일 (하루 {RELAY}km) |', f'| 해로 | 약 {d / SEA:,.0f}일 (순풍 하루 {SEA}km, 직선 기준) |', '',
                 '이동 일수는 직선거리에 우회 계수 1.3을 곱한 어림이다. 실제 로마 가도는 지형과 노선에 따라 더 길어지고, 계절·보급·적정에 따라 크게 달라진다. 바다 건너 목적지는 육로 수치가 성립하지 않으니 해로 쪽을 볼 것.', '',
                 f'좌표 출처: {src} ({CONF_KO.get(conf, conf)})', '']
    elif t == 'event':
        y = e.get('attrs', {}).get('year') or e.get('attrs', {}).get('date') or ''
        fm.append(f'points: [{", ".join(map(str, pts))}]')
        if y:
            fm.append(f'year: "{y}"')
    else:
        fm.append(f'points: [{", ".join(map(str, pts))}]')
        role = e.get('attrs', {}).get('role') or e.get('attrs', {}).get('office')
        if role:
            fm.append(f'role: "{role}"')
    fm += ['tags:', '  - topic/산스', '  - topic/편데', f'  - entity/{t}', *[f'  - point/{p:02d}' for p in pts], 'up:', '  - "[[로마제국쇠망사_온톨로지]]"', '---', '']
    out = fm + [f'# {name}', '']
    if e.get('desc'):
        out += [e['desc'], '']
    out += ['### 등장 포인트', '', *[f'- [[{POINT_FILES[p]}]]' for p in pts if p in POINT_FILES], '']
    rel_lines = []
    for l in links:
        if l['from'] == e['id'] and l['to'] in names:
            rel_lines.append(link_line(l['rel'], names[l['to']], False, l.get('from_year')))
        elif l['to'] == e['id'] and l['from'] in names:
            rel_lines.append(link_line(l['rel'], names[l['from']], True, l.get('from_year')))
    if rel_lines:
        out += ['### 관계', '', *rel_lines, '']
    out += body
    out += [f'생성: chronoatlas `scripts/ontology-notes.py` ({date.today().isoformat()}, proposals 병합 뒤 「객체 하나에 노트 하나」 보전). 관계·위치는 그날 정본 기준이다.', '']
    return '\n'.join(out)


def main() -> int:
    ap = argparse.ArgumentParser(); ap.add_argument('--apply', action='store_true'); a = ap.parse_args()
    O = ontology_dir(); V = O.parent   # <책 폴더>
    ents = [json.loads(l) for l in (O / 'entities.jsonl').read_text(encoding='utf-8').splitlines() if l.strip()]
    links = [json.loads(l) for l in (O / 'links.jsonl').read_text(encoding='utf-8').splitlines() if l.strip()]
    names = {e['id']: nfc(e['name']) for e in ents}
    geo: dict[str, dict] = {}
    for gf in sorted((O / '_geo').glob('places_*.jsonl')):
        for r in (json.loads(l) for l in gf.read_text(encoding='utf-8').splitlines() if l.strip()):
            geo[nfc(r['name'])] = r
    made = 0
    for e in ents:
        d = V / 'entities' / e['type']
        if not d.exists():
            print('폴더 없음', d); continue
        have = {nfc(p.stem) for p in d.glob('*.md')}
        name = nfc(e['name'])
        if name in have or any(h.startswith(name + ' (') for h in have):
            continue
        if e['type'] == 'place' and not (geo.get(name) or e.get('location')):
            print('좌표 없어 건너뜀', e['id']); continue
        target = d / f'{name}.md'
        print(('WRITE ' if a.apply else 'would ') + str(target.relative_to(V)))
        if a.apply:
            target.write_text(note_for(e, links, names, geo.get(name)), encoding='utf-8'); made += 1
    print(f'{"썼다" if a.apply else "드라이런"} {made}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
