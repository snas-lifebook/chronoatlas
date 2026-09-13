#!/usr/bin/env python3
"""pack-clients.json 자체검사.

이 팩이 조용히 실패하는 방식은 딱 하나다: name 문자열이 정본 폴리곤과 한 글자라도
다르거나, from~to 구간이 어떤 슬라이스와도 겹치지 않아서 무늬가 아무것에도 안 붙는 것.
렌더가 에러를 안 내므로 여기서 잡는다.

    python3 data/overlays/check-pack-clients.py
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
PACK = ROOT / "data/overlays/pack-clients.json"
TERRITORY = ROOT / "public/datasets/rome/layers/territory"

pack = json.loads(PACK.read_text(encoding="utf-8"))

# 정본에 실제로 있는 (name, valid_from, valid_to) 전부 모은다.
slices: dict[str, list[tuple[int, int]]] = {}
for geo in TERRITORY.glob("*.geojson"):
    for feat in json.loads(geo.read_text(encoding="utf-8"))["features"]:
        p = feat["properties"]
        if p.get("valid_from") is None or p.get("valid_to") is None:
            continue
        slices.setdefault(p["name"], []).append((p["valid_from"], p["valid_to"]))

errors = []
for row in pack["clients"]:
    name, lo, hi = row["name"], row["from"], row["to"]

    if name not in slices:
        errors.append(f"{name!r}: 정본 territory 레이어에 이 이름이 없다 (무늬가 안 붙는다)")
        continue
    if lo >= hi:
        errors.append(f"{name!r} {lo}~{hi}: from이 to보다 크거나 같다")
    # 반열림 구간 [from, to) 끼리 겹치는 슬라이스가 하나라도 있어야 한다.
    if not any(lo < s_hi and s_lo < hi for s_lo, s_hi in slices[name]):
        errors.append(
            f"{name!r} {lo}~{hi}: 겹치는 폴리곤 슬라이스가 없다. 정본: {sorted(slices[name])}"
        )
    if row["kind"] not in ("client", "ally", "hostile"):
        errors.append(f"{name!r} {lo}~{hi}: kind={row['kind']!r} 가 허용값 밖이다")
    if row["confidence"] not in ("high", "medium", "low"):
        errors.append(f"{name!r} {lo}~{hi}: confidence={row['confidence']!r} 가 허용값 밖이다")

# 같은 폴리티 안에서 구간이 겹치면 무늬가 두 겹으로 쌓인다.
by_name: dict[str, list[tuple[int, int]]] = {}
for row in pack["clients"]:
    by_name.setdefault(row["name"], []).append((row["from"], row["to"]))
for name, spans in by_name.items():
    spans.sort()
    for (a_lo, a_hi), (b_lo, b_hi) in zip(spans, spans[1:]):
        if b_lo < a_hi:
            errors.append(f"{name!r}: 구간 {a_lo}~{a_hi} 와 {b_lo}~{b_hi} 가 겹친다")

# 발표 여덟 장의 연도에서 각 폴리티가 어떤 관계로 뜨는지 눈으로 확인한다.
SCENES = [-60, -52, -51, -49, -48, -47, -44, -27]
print(f"{PACK.name}: {len(pack['clients'])}행, 폴리티 {len(by_name)}개, 제외 {len(pack['candidates_excluded'])}개\n")
print("연도별로 붙는 관계:")
for year in SCENES:
    hit = sorted(
        f"{r['name']}={r['kind']}"
        for r in pack["clients"]
        if r["from"] <= year < r["to"]
        and any(s_lo <= year < s_hi for s_lo, s_hi in slices.get(r["name"], []))
    )
    print(f"  기원전 {-year:>3}: " + (", ".join(hit) if hit else "(없음)"))

if errors:
    print("\n실패:")
    for e in errors:
        print("  -", e)
    sys.exit(1)
print("\n통과: 모든 name이 정본과 일치하고 모든 구간이 실제 슬라이스와 겹친다.")
