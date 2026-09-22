#!/usr/bin/env python3
"""proposals/*.jsonl을 정본 온톨로지(ONTOLOGY_DIR)에 적용한다. 결정론·멱등·백업.

    python3 scripts/apply-proposals.py proposals/20260921_p12.jsonl ...          # 드라이런(계획만 찍는다)
    python3 scripts/apply-proposals.py --apply proposals/20260921_p12.jsonl ...  # 백업 뒤 쓴다

정본 경로는 ONTOLOGY_DIR 환경변수, 없으면 data/ontology-dir.txt 한 줄(AGENTS.md 「정본 온톨로지 경로」).

지원 op (proposals/에 실제로 쓰인 것만, 2026-09-21 기준):
  add_entity     id + set{type,name,aliases,attrs,points,desc,location,ext,source,confidence,year}
                 - 이미 있으면 건너뛴다(멱등). 기존 항목을 고치려면 update_entity.
                 - set.year(정수)는 스키마에 없다 → attrs.year 문자열로 옮긴다(정본 선례 event:밀라이해전 attrs.year "-260").
                   어댑터는 attrs.year ?? attrs.date ?? attrs.period를 parseYear로 읽는다.
                 - set.attrs.points는 최상위 points로 옮긴다(스키마 strict).
                 - points가 없으면 POINTS_OF(아래 표)에서 채운다. 정본 승격 기준이 「포인트 1개 이상 등장」이라 비워 두지 않는다.
  add_link       set{from,to,rel,from_year,to_year,src,confidence}
                 - 같은 (from,to,rel)이 있으면 새 줄을 안 만든다. 그 줄의 from_year/to_year가 null이면 제안 값으로 채운다.
                 - point는 from 쪽 엔티티의 points[0] (없으면 to 쪽).
  set_location   id + set{location:[lon,lat], ext?}
                 - 엔티티 location을 쓰고 ext를 합친다. _geo/places_*.jsonl에 같은 이름 행이 있으면 그 lat/lon도 바꾼다
                   (어댑터는 _geo가 이기고 location은 폴백이라 _geo를 안 고치면 화면이 안 바뀐다. place:본곶이 그 경우).
  update_entity  id + set{...}  attrs는 얕게 합치고 나머지 키는 덮는다. year → attrs.year.
  note_only      아무것도 안 한다. 보고에만 남긴다.

지원하지 않는 op(set_ext·set_attrs·replace_rel·add_faction·note·kind:palette)는 건너뛰고 보고한다. 그 파일들은 River 판단 항목이다.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import unicodedata
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENTITY_KEYS = {'id', 'type', 'name', 'aliases', 'attrs', 'points', 'chapters', 'desc', 'descs', 'history', 'ext', 'location', 'source', 'confidence', 'src', 'note'}
SRC = {'point', 'gibbon', 'wikidata', 'dprr', 'manual'}
CONFIDENCE = {'high', 'medium', 'low'}
SOURCE = {'book', 'web', 'book+web'}

# 제안에 points가 없을 때 채우는 「책의 포인트」. 제안 파일(p12=01·02, p345=03·04·05, p911=09·10·11)과 본문 위치로 정했다.
POINTS_OF = {
    'place:카우디움': [1], 'event:카우디움협곡전투': [1], 'place:알바롱가': [1],
    'place:밀라이': [2], 'place:아이가테스제도': [2], 'event:아이가테스해전': [2], 'person:가이우스두일리우스': [2],
    'event:트라시메노전투': [3],
    'place:실라루스강': [5], 'event:아피아가도십자가형': [5], 'place:피스토리아': [5],
    'place:아라우시오': [5], 'event:아라우시오전투': [5], 'place:아쿠아이섹스티아이': [5], 'event:아쿠아이섹스티아이전투': [5],
    'place:베르첼라이': [5], 'event:베르첼라이전투': [5],
    'event:필리피전투': [9], 'event:제2차삼두정치': [9], 'place:악티움': [9],
    'place:카물로두눔': [11], 'event:브리타니아정복': [11],
}


def nfc(s: str) -> str:
    return unicodedata.normalize('NFC', s)


def ontology_dir() -> Path:
    p = os.environ.get('ONTOLOGY_DIR')
    if not p:
        f = ROOT / 'data' / 'ontology-dir.txt'
        if not f.exists():
            sys.exit('ONTOLOGY_DIR도 data/ontology-dir.txt도 없다')
        p = f.read_text(encoding='utf-8').strip()
    d = Path(p).expanduser()
    if not (d / 'entities.jsonl').exists():
        sys.exit(f'{d}에 entities.jsonl이 없다')
    return d


def read_jsonl(p: Path) -> list[dict]:
    return [json.loads(l) for l in p.read_text(encoding='utf-8').splitlines() if l.strip()]


def write_jsonl(p: Path, rows: list[dict]) -> None:
    p.write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows), encoding='utf-8')


def backup(p: Path, today: str) -> Path:
    b = p.with_name(p.name + f'.bak_{today}')
    if not b.exists():
        shutil.copy2(p, b)
    return b


def normalize_entity(id_: str, s: dict) -> dict:
    """제안의 set → 정본 엔티티 한 줄. 스키마(schema/ontology.ts Entity, strict)에 맞춘다."""
    s = dict(s)
    attrs = dict(s.pop('attrs', {}) or {})
    points = s.pop('points', None)
    if 'points' in attrs:
        points = attrs.pop('points')
    year = s.pop('year', None)
    if year is not None and 'year' not in attrs and 'date' not in attrs:
        attrs['year'] = str(year)
    if points is None:
        points = POINTS_OF.get(id_, [])
    e = {
        'id': id_, 'name': s.pop('name'), 'type': s.pop('type'),
        'aliases': s.pop('aliases', []) or [], 'attrs': attrs, 'points': points,
    }
    desc = s.pop('desc', None)
    if desc:
        e['desc'] = desc
    e['descs'] = [{'point': points[0], 'desc': desc, 'src': 'manual'}] if desc and points else []
    e['note'] = e['name']
    e['src'] = s.pop('src', 'manual') or 'manual'
    e['ext'] = s.pop('ext', {}) or {}
    for k in ('location', 'source', 'confidence'):
        v = s.pop(k, None)
        if v is not None:
            e[k] = v
    if s:
        raise SystemExit(f'{id_}: 스키마에 없는 키 {sorted(s)}')
    if e['src'] not in SRC or (e.get('source') and e['source'] not in SOURCE) or (e.get('confidence') and e['confidence'] not in CONFIDENCE):
        raise SystemExit(f'{id_}: 어휘 밖 값 src={e["src"]} source={e.get("source")} confidence={e.get("confidence")}')
    if not points:
        raise SystemExit(f'{id_}: points가 없다. POINTS_OF에 넣어라')
    return e


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='+')
    ap.add_argument('--apply', action='store_true', help='실제로 쓴다(기본은 드라이런)')
    a = ap.parse_args()

    O = ontology_dir()
    ents = read_jsonl(O / 'entities.jsonl')
    links = read_jsonl(O / 'links.jsonl')
    by_id = {e['id']: e for e in ents}
    geo_files = sorted((O / '_geo').glob('places_*.jsonl'))
    geo: dict[str, tuple[Path, list[dict], int]] = {}
    geo_rows: dict[Path, list[dict]] = {}
    for gf in geo_files:
        rows = read_jsonl(gf)
        geo_rows[gf] = rows
        for i, r in enumerate(rows):
            geo[nfc(r['name'])] = (gf, rows, i)

    touched_geo: set[Path] = set()
    report: list[str] = []
    n_add_e = n_add_l = n_fill = n_loc = n_upd = 0

    for f in a.files:
        for i, o in enumerate(read_jsonl(Path(f)), 1):
            tag = f'{Path(f).name}:{i}'
            op = o.get('op')
            s = o.get('set', {}) or {}
            if op == 'add_entity':
                id_ = o['id']
                if id_ in by_id:
                    report.append(f'skip  {tag} add_entity {id_} 이미 있음')
                    continue
                e = normalize_entity(id_, s)
                ents.append(e); by_id[id_] = e; n_add_e += 1
                report.append(f'ADD   {tag} entity {id_} points={e["points"]} attrs.year={e["attrs"].get("year") or e["attrs"].get("date") or "-"} location={e.get("location")}')
            elif op == 'add_link':
                fr, to, rel = s['from'], s['to'], s['rel']
                if fr not in by_id or to not in by_id:
                    raise SystemExit(f'{tag}: 끝점이 없다 {fr} -> {to}')
                same = [l for l in links if l['from'] == fr and l['to'] == to and l['rel'] == rel]
                if same:
                    l = same[0]
                    filled = []
                    for k in ('from_year', 'to_year'):
                        if l.get(k) is None and s.get(k) is not None:
                            l[k] = s[k]; filled.append(k)
                    if filled:
                        l['year_basis'] = 'manual'; n_fill += 1
                        report.append(f'FILL  {tag} link {fr} -{rel}-> {to} {filled} <- {s.get("from_year")}..{s.get("to_year")}')
                    else:
                        report.append(f'skip  {tag} add_link {fr} -{rel}-> {to} 이미 있음')
                    continue
                pts = by_id[fr].get('points') or by_id[to].get('points') or []
                l = {'from': fr, 'to': to, 'rel': rel, 'point': pts[0] if pts else None,
                     'from_year': s.get('from_year'), 'to_year': s.get('to_year'), 'year_basis': 'manual' if s.get('from_year') is not None else None,
                     'src': s.get('src', 'manual') or 'manual'}
                if l['point'] is None:
                    del l['point']
                if s.get('confidence'):
                    l['confidence'] = s['confidence']
                links.append(l); n_add_l += 1
                report.append(f'ADD   {tag} link {fr} -{rel}-> {to} {l.get("from_year")}..{l.get("to_year")} point={l.get("point")}')
            elif op == 'set_location':
                id_ = o['id']
                e = by_id.get(id_)
                if not e:
                    raise SystemExit(f'{tag}: {id_} 없음')
                lon, lat = s['location']
                changed = []
                if e.get('location') != [lon, lat]:
                    e['location'] = [lon, lat]; changed.append('location')
                for k, v in (s.get('ext') or {}).items():
                    if e.setdefault('ext', {}).get(k) != v:
                        e['ext'][k] = v; changed.append(f'ext.{k}')
                g = geo.get(nfc(e['name']))
                if g:
                    gf, rows, gi = g
                    r = rows[gi]
                    if (r.get('lat'), r.get('lon')) != (lat, lon):
                        r['lat'], r['lon'] = lat, lon
                        r['source'] = f'proposals/{Path(f).name} (set_location)'
                        if e.get('attrs', {}).get('modern'):
                            r['modern'] = e['attrs']['modern']
                        r.pop('ancient', None)
                        touched_geo.add(gf); changed.append(f'_geo/{gf.name}')
                if changed:
                    n_loc += 1; report.append(f'LOC   {tag} {id_} -> [{lon}, {lat}] {changed}')
                else:
                    report.append(f'skip  {tag} set_location {id_} 이미 같음')
            elif op == 'update_entity':
                id_ = o['id']
                e = by_id.get(id_)
                if not e:
                    raise SystemExit(f'{tag}: {id_} 없음')
                s2 = dict(s)
                year = s2.pop('year', None)
                changed = []
                if year is not None and e.setdefault('attrs', {}).get('year') != str(year):
                    e['attrs']['year'] = str(year); changed.append('attrs.year')
                for k, v in (s2.pop('attrs', {}) or {}).items():
                    if e['attrs'].get(k) != v:
                        e['attrs'][k] = v; changed.append(f'attrs.{k}')
                for k, v in s2.items():
                    if k not in ENTITY_KEYS:
                        raise SystemExit(f'{tag}: 스키마에 없는 키 {k}')
                    if e.get(k) != v:
                        e[k] = v; changed.append(k)
                if changed:
                    n_upd += 1; report.append(f'UPD   {tag} {id_} {changed}')
                else:
                    report.append(f'skip  {tag} update_entity {id_} 이미 같음')
            elif op == 'note_only':
                report.append(f'note  {tag} {o.get("id")}: {(o.get("note") or "")[:80]}')
            else:
                report.append(f'UNSUP {tag} op={op} (지원 안 함, River 판단 항목)')

    print('\n'.join(report))
    print(f'\n엔티티 +{n_add_e} · 링크 +{n_add_l} · 링크 연도 채움 {n_fill} · 좌표 {n_loc} · 갱신 {n_upd} · 정본 {O}')
    if not a.apply:
        print('드라이런. 쓰려면 --apply')
        return 0
    today = date.today().strftime('%Y%m%d')
    for p in [O / 'entities.jsonl', O / 'links.jsonl', *sorted(touched_geo)]:
        print('백업', backup(p, today).name)
    write_jsonl(O / 'entities.jsonl', ents)
    write_jsonl(O / 'links.jsonl', links)
    for gf in touched_geo:
        write_jsonl(gf, geo_rows[gf])
    print('썼다')
    return 0


if __name__ == '__main__':
    sys.exit(main())
