#!/usr/bin/env python3
"""data/overlays/pack-plains.json 생성 — 기원전 1세기 로마 세계의 곡창지대와 척박지.

2회차 발표(「카이사르 팩」, 기원전 60~27)의 인과 축은 **평야 = 잉여 생산물 = 제국**이다.
그런데 정본 온톨로지와 베이스맵에는 「평야」라는 것이 한 조각도 없다 — 영토(폴리티)와
지형 음영만 있어서, 왜 그리스가 아니고 로마인지, 왜 카르타고가 아니고 이집트인지가
지도에서 한 픽셀도 대답하지 않는다. 이 스크립트가 그 한 겹을 채운다.

**좌표를 발명하지 않는다.** 전부 Natural Earth 10m(nvkelso/natural-earth-vector,
퍼블릭 도메인)에서 나온다:

  - `layers/rivers.geojson`   포·아디제·티키누스·나일·과달키비르 실측 라인지오메트리
  - `layers/land.geojson`     해안선(모든 면을 육지로 제한 → 바다를 덮지 않는다)
  - `layers/lakes.geojson`    호수(곡창이 가르다 호를 덮지 않게 뺀다)
  - `data/external/ne_10m_geography_regions_polys.geojson`
        알프스·아펜니노·시에라모레나·시에라네바다(곡창의 산악 경계)
        사하라·리비아·서부·동부·누비아 사막, 핀도스·디나르알프스(척박지 본체)
        나일 델타(델타는 NE가 면으로 갖고 있다)

    이 파일만 레포에 없다. `layers/region_labels.geojson`이 같은 원본에서 왔지만
    어댑터가 `-simplify 10% -dissolve NAME`을 걸어 **157개 중 128개가 geometry
    null이고 나머지는 라벨 리본 자투리**다(사하라가 567km²로 찍힌다). 그래서
    쓸 수 없다. 원본을 `data/external/`에 받아 쓴다 — `fetch-external.ts`와 같은
    빌드타임 캐시 경로이고, 같은 URL·같은 라이선스(PD)다. 런타임 외부 호출은 0.

방식은 `build-peoples.py`와 같다. 강·해안·산맥 폴리곤을 경계로 오리고, 남은 변만
문서에 적는다. 면적은 구면 공식으로 잰다 — 평면 도(度) 면적은 지중해 위도대에서
1.3배 과대다.

실행: python3 scripts/build-plains.py   (인자 없음. shapely + 첫 실행 시 네트워크)
"""
import gzip
import json
import math
import os
import sys
import urllib.request

import shapely
from shapely.geometry import LineString, Point, box, mapping, shape
from shapely.ops import linemerge, split, unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAYERS = os.path.join(ROOT, "public/datasets/rome/layers")
EXT = os.path.join(ROOT, "data/external")
OUT = os.path.join(ROOT, "data/overlays/pack-plains.json")
NE_REGIONS = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_geography_regions_polys.geojson"

WINDOW = (-60, -27)      # 발표 구간(기원전 60~27). 지리는 정치보다 느리다 — 전부 이 값
FRAME = (-15, 20, 65, 60)  # manifest.json의 rome bbox. 사하라는 이 창 밖까지 뻗는다
PRECISION = 3            # 소수 3자리 ≈ 111m
MIN_KM2 = 300            # 이보다 작은 조각은 클립 잔여물로 보고 버린다
SEAM = 0.0015            # 같은 kind 이웃과 ~165m 이음 틈. 3자리 반올림 뒤에도 겹침 0
R = 6371.0088            # km

# kind별 단순화 허용오차. 사막 경계는 원래 그라데이션이라 촘촘할 이유가 없다.
SIMPLIFY = {"granary": 0.02, "barren": 0.05}
INSET = {k: v * 1.25 for k, v in SIMPLIFY.items()}   # 단순화 부풀림이 바다를 덮지 않게


# ---------------------------------------------------------------- 측정·입출력

def km2(g):
    """구면 폴리곤 면적(km²). 대권 변 가정. 평면 도(度) 면적 × 상수는 쓰지 않는다."""
    if g.is_empty:
        return 0.0
    polys = [g] if g.geom_type == "Polygon" else [
        p for p in getattr(g, "geoms", []) if p.geom_type == "Polygon"]
    total = 0.0
    for p in polys:
        for ring, sign in [(p.exterior, 1)] + [(h, -1) for h in p.interiors]:
            c = list(ring.coords)
            s = 0.0
            for (lon1, lat1), (lon2, lat2) in zip(c, c[1:]):
                s += math.radians(lon2 - lon1) * (
                    2 + math.sin(math.radians(lat1)) + math.sin(math.radians(lat2))
                )
            total += sign * abs(s) * R * R / 2
    return total


def nverts(g):
    return len(shapely.get_coordinates(g))


def load(name):
    with open(os.path.join(LAYERS, name)) as f:
        return json.load(f)["features"]


def parts_of(g):
    return list(g.geoms) if g.geom_type in ("MultiPolygon", "GeometryCollection") else [g]


def polys_of(g):
    return [p for p in parts_of(g) if p.geom_type == "Polygon" and not p.is_empty]


def round_coords(obj):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], float):
            return [round(v, PRECISION) for v in obj]
        return [round_coords(v) for v in obj]
    return obj


# ---------------------------------------------------------------- 기하 원자료

os.makedirs(EXT, exist_ok=True)
src = os.path.join(EXT, "ne_10m_geography_regions_polys.geojson")
if not os.path.exists(src):
    print(f"내려받는다(빌드타임 1회, PD): {NE_REGIONS}")
    urllib.request.urlretrieve(NE_REGIONS, src)

REG = {}
with open(src) as f:
    for feat in json.load(f)["features"]:
        if feat.get("geometry"):
            REG[feat["properties"]["NAME"]] = shape(feat["geometry"]).buffer(0)

LAND_PARTS = [p for f in load("land.geojson") if f.get("geometry")
              for p in parts_of(shape(f["geometry"]))]
land = unary_union([p.buffer(0) for p in LAND_PARTS])
# 기원전 1세기에 없던 물. NE lakes에는 현대 저수지가 섞여 있고, 이 둘이 실제로 이 팩의
# 면들과 닿는다 — 빼면 사막·계곡에 없던 구멍이 뚫린다(나일 계곡 자리의 3,508km²가 그것).
MODERN_LAKES = {"Lake Nasser", "Great Bitter Lake"}
lake_feats = [f for f in load("lakes.geojson") if f.get("geometry")]
lakes = unary_union([shape(f["geometry"]).buffer(0) for f in lake_feats
                     if f["properties"].get("name") not in MODERN_LAKES])
# 뺄 때 쓰는 호수 마스크. 원본 해상도로 빼면 가르다·코모 해안선 정점이 그대로 따라 들어와
# 용량을 먹는다 — 1.3km 부풀려 단순화한 마스크로 빼면 단순화 뒤에도 실제 호수를 덮는다.
lakes_mask = lakes.buffer(0.012).simplify(0.012, preserve_topology=True)
frame = box(*FRAME)

rivers = load("rivers.geojson")


def riverline(names):
    """이름이 names에 든 하천 세그먼트를 모아 linemerge한 뒤 union."""
    segs = []
    for f in rivers:
        if f["properties"].get("name") in names:
            g = shape(f["geometry"])
            segs += list(g.geoms) if g.geom_type == "MultiLineString" else [g]
    if not segs:
        sys.exit(f"하천 {names} 가 rivers.geojson에 없다")
    merged = linemerge(segs)
    return unary_union(list(merged.geoms) if merged.geom_type == "MultiLineString" else [merged])


def cut(poly, barrier, seed, label):
    """barrier로 poly를 자르고 seed가 든 조각만 남긴다(build-peoples.py와 같은 계약)."""
    pieces = polys_of(split(poly, barrier))
    if len(pieces) < 2:
        sys.exit(f"[{label}] barrier가 폴리곤을 관통하지 못했다")
    keep = [p for p in pieces if p.contains(Point(*seed))]
    if len(keep) != 1:
        sys.exit(f"[{label}] 씨앗점이 든 조각이 {len(keep)}개다")
    return keep[0]


def clean(g, kind, minus=()):
    """호수·이웃 제거 → 육지 클립 → 단순화 → 자투리 제거.

    순서는 build-peoples.py의 교훈을 그대로 따른다. ①원본 해상도로 육지 클립
    → ②단순화 → ③이웃·호수를 SEAM만큼 넉넉히 빼기. **호수를 단순화 앞에서 빼면
    단순화가 가르다 호를 다시 덮는다**(실측 766km² 침범) — 뺄 것은 전부 뒤에서 뺀다.
    """
    inset = land.buffer(-INSET[kind])
    g = g.intersection(inset).intersection(frame)
    g = unary_union(polys_of(g)).simplify(SIMPLIFY[kind], preserve_topology=True)
    for m in list(minus) + [lakes_mask]:
        if not m.is_empty:
            g = g.difference(m.buffer(SEAM))
    g = shapely.set_precision(g, 10 ** -PRECISION)
    keep = [p for p in polys_of(g) if p.is_valid and km2(p) >= MIN_KM2]
    if not keep:
        sys.exit("clean() 이 빈 면을 냈다")
    return keep[0] if len(keep) == 1 else shapely.MultiPolygon(keep)


# ---------------------------------------------------------------- 곡창지대

ALPS, APEN = REG["ALPS"], REG["APPENNINI"]

# ① 포 강 평야(롬바르디아). 대표님이 이름을 직접 댄 면.
# 경계를 산맥 폴리곤 차집합만으로 잡으면 카디보나 안부(사보나 북쪽, 알프스와 아펜니노가
# 만나지 않고 벌어지는 유일한 지점)를 타고 리구리아·토스카나까지 새어 66,163km²가 된다
# (실측). 그래서 **강 자신**으로 잡는다 — 포 본류 + 티키누스·민키우스·아디제·두리아
# 네트워크를 0.55°(위도 ~61km) 부풀린 뒤 알프스·아펜니노를 뺀다. 제노바·피사는 밖,
# 밀라노·토리노·볼로냐는 안(실측). 라벤나가 빠지는데 고대 라벤나는 실제로 소택지였다.
padus_net = riverline(["Po", "Ticino", "Mincio", "Adige", "Dora Baltea"])
padus = padus_net.buffer(0.55).intersection(land).difference(ALPS).difference(APEN)
padus = unary_union([p for p in polys_of(padus) if p.intersects(padus_net)])

# ② 라티움·캄파니아. "위로 가도 비옥하고 밑으로 가도 비옥해요" — 로마를 가운데 두고
# 티레니아 해안 저지를 한 면으로 낸다. 동쪽 경계는 아펜니노 폴리곤, 서쪽은 해안선.
# 북(43.05°N, 타르퀴니아·톨파 산지)·남(40.45°N, 실라루스 강 하구) 두 변은 직선 근사다.
latium = box(11.0, 40.45, 15.35, 43.05).intersection(land).difference(APEN)
latium = [p for p in polys_of(latium) if p.contains(Point(12.4866, 41.8929))][0]

# ③ 시칠리아. land.geojson의 섬 폴리곤 그대로 — 자른 변이 하나도 없다.
sicilia = max((p for p in LAND_PARTS
               if 12.0 < p.bounds[0] and p.bounds[2] < 16.0 and 36.0 < p.bounds[1] < 38.5),
              key=lambda p: p.area)

# ④ 아프리카 프로콘술라리스(바그라다스=메제르다 유역 + 카르타고 배후 텔). NE 10m rivers는
# 건조대 하천이 희박해 **메제르다가 없다**(북아프리카 하천은 모로코 4개뿐). 그래서 북·동은
# 실측 해안선이고 남(35.95°N, 튀니지 도르살레)·서(7.8°E) 두 변은 직선이다.
africa = box(7.8, 35.95, 11.6, 37.45).intersection(land)

# ⑤ 나일 델타. NE가 면으로 갖고 있는 유일한 델타급 곡창.
nile_delta = REG["Nile Delta"].intersection(land)

# ⑥ 나일 계곡. 폭이 5~25km인 띠라 면 데이터가 없다 — 실측 하천 라인을 0.07°(폭 ~15km)
# 부풀려 만든다. 남쪽은 시에네(제1폭포, 북위 24.09)에서 끊는다: 스트라본 17.1.2~3이
# "시에네와 엘레판티네 위의 작은 폭포가 아이깁토스와 아이티오피아의 경계"라 적는다.
nile_valley = (riverline(["Nile"]).buffer(0.07, quad_segs=3)
               .intersection(land)
               .difference(nile_delta)
               .intersection(box(20, 23.95, 40, 32)))

# ⑦ 바이티카(과달키비르=바이티스 유역). 강을 0.30°(폭 ~66km) 부풀려 캄피냐를 잡고
# 북쪽 시에라모레나·동쪽 시에라네바다를 뺀다. 남쪽 수브베티카 산지는 NE에 면이 없어
# 버퍼 반경이 경계다.
baetica = (riverline(["Guadalquivir"]).buffer(0.30)
           .intersection(land)
           .difference(REG["Sierra Morena"])
           .difference(REG["S. Nevada"]))

GRANARY = [
    (padus, {
        "id": "plain:padus",
        "name_ko": "포 강 평야 (롬바르디아)",
        "crop": "밀",
        "confidence": "high",
        "why_ko": "로마가 시작해서 빼앗아 온 땅. 폴리비오스는 이 들판의 밀·포도주가 너무 싸서 "
                  "여관이 하루 숙식을 반 아스에 받았다고 적었다.",
        "source": "폴리비오스 2.15(파두스 평원 — 밀 1시칠리아 메딤노스가 4오볼, 보리가 2오볼, "
                  "기장·수수 산출이 「엄청나다」, 이탈리아 돼지의 대부분이 이 들판의 도토리로 "
                  "길러진다, 여관이 하루 숙식을 반 아스에 받는다). 기하: Natural Earth 10m rivers "
                  "포(Po)·티키누스(Ticino)·민키우스(Mincio)·아디제(Adige)·두리아(Dora Baltea) "
                  "실측 라인을 0.55°(~61km) 버퍼한 뒤 NE geography_regions ALPS·APPENNINI를 "
                  "difference. 산맥 차집합만으로 잡으면 카디보나 안부를 타고 리구리아·토스카나까지 "
                  "새어 66,163km²가 된다(실측) — 그래서 강을 기준으로 삼았다. "
                  "알려진 단순화: 프리울리(아퀼레이아) 평원은 그 쪽 하천(피아베·탈리아멘토)이 "
                  "NE 10m에 없어 빠진다. 라벤나도 빠지는데 고대 라벤나는 실제로 소택지였다.",
    }),
    (latium, {
        "id": "plain:latium-campania",
        "name_ko": "라티움·캄파니아",
        "crop": "밀",
        "confidence": "medium",
        "why_ko": "로마는 이 평야 가운데 앉아 있다. 위로 가도 비옥하고 밑으로 가도 비옥하다.",
        "source": "스트라본 5.4.3(캄파니아 평원은 「모든 평야 가운데 가장 축복받은 곳」이고 "
                  "둘레에 비옥한 언덕이 있다, 어떤 들판은 한 해에 스펠트를 두 번 뿌리고 "
                  "세 번째로 기장을 뿌린다). 기하: 동쪽 경계는 NE geography_regions APPENNINI "
                  "폴리곤, 서쪽은 land.geojson 티레니아 해안선. 북(43.05°N, 타르퀴니아·톨파 "
                  "산지)·남(40.45°N, 실라루스 강 하구) 두 변은 직선 근사다 — 해당 경계선 "
                  "데이터가 없다. 티베리스 강 북쪽(남부 에트루리아)을 일부러 포함했다: "
                  "「위로 가도 비옥」이 가리키는 곳이고, 로마가 면 가운데 앉아야 그림이 된다. "
                  "알려진 단순화: 폼프티나이 소택지(폰티노 습지)는 이 시기 농지가 아니라 "
                  "말라리아 소택지였는데 이 면 안에 든다. 콜리 알바니·베수비우스 등 화산 "
                  "구릉도 「평야」는 아니지만 그 화산토가 비옥함의 실제 원인이라 남겼다.",
    }),
    (sicilia, {
        "id": "plain:sicilia",
        "name_ko": "시칠리아",
        "crop": "밀",
        "confidence": "medium",
        "why_ko": "로마의 첫 속주이자 첫 곡물 창고. 키케로는 시칠리아를 공화국의 식료품 "
                  "창고(cella penaria rei publicae)라 불렀다.",
        "source": "키케로 『베레스 탄핵』 2.2.5(시칠리아 = 공화국의 pons et cella penaria — "
                  "아프리카로 가는 다리이자 식료품 창고) + 같은 연설 2.3권 전체가 시칠리아 "
                  "곡물 십일세(decuma) 수탈 재판이다. 기하: land.geojson 시칠리아 섬 폴리곤 "
                  "그대로 — 자른 변이 없다(구면 25,673km², 실제 25,711km²). "
                  "알려진 단순화: 섬 전체를 한 면으로 칠했다. 실제 곡물은 내륙·남부 평원과 "
                  "레온티니 평야에서 나왔고 북쪽 마도니에·네브로디 산지와 에트나는 곡창이 "
                  "아니다. NE 10m에 시칠리아 산맥 폴리곤이 없어 오려 낼 수 없었다 — "
                  "사료가 「속주 시칠리아」 단위로 말하므로 섬 단위로 두었다.",
    }),
    (africa, {
        "id": "plain:africa",
        "name_ko": "아프리카 (바그라다스 유역)",
        "crop": "밀",
        "confidence": "low",
        "why_ko": "카르타고가 앉아 있던 땅. 사막이 아니라 로마를 여덟 달 먹인 곡창이다.",
        "source": "요세푸스 『유대전쟁기』 2.383(아프리카의 해마다의 땅 열매가 로마 대중을 "
                  "한 해 여덟 달 먹인다 — 같은 연설 2.386의 이집트 넉 달과 합쳐 열두 달) + "
                  "[카이사르] 『아프리카 전기』가 기원전 46년 탑수스 이후 이 도시들에 곡물·기름 "
                  "부담금을 물린 기록(97장. 구체 수치는 확인하지 못해 인용하지 않는다). "
                  "기하: 북·동 경계는 land.geojson 실측 해안선(비제르트~카르타고~카프 봉). "
                  "**남(35.95°N, 튀니지 도르살레)·서(7.8°E) 두 변은 직선이다** — NE 10m rivers에 "
                  "바그라다스(메제르다)가 없고(북아프리카 하천은 모로코 4개뿐), NE 산맥 "
                  "폴리곤도 아틀라스 텔리엔이 동경 6.14에서 끊겨 튀니지에 닿지 않는다. "
                  "confidence low는 그 두 직선 때문이다. "
                  "**측정된 반증**: NE 사하라 폴리곤의 북쪽 한계는 북위 34.61이고, "
                  "카르타고(10.32E 36.85N)에서 사하라까지 345km다. 이 땅은 사막이 아니다.",
    }),
    (nile_delta, {
        "id": "plain:nile-delta",
        "name_ko": "나일 델타",
        "crop": "밀",
        "confidence": "high",
        "why_ko": "이집트가 몰살당하지 않은 이유. 비옥한 델타는 없애는 것보다 거두는 것이 이득이다.",
        "source": "요세푸스 『유대전쟁기』 2.386(알렉산드리아는 한 달에 유다이아의 한 해보다 많은 "
                  "세를 내고, 그 위에 로마를 넉 달 먹일 곡물을 보낸다). 기하: Natural Earth 10m "
                  "geography_regions_polys의 'Nile Delta' 면(Delta 분류) 그대로, land.geojson과 "
                  "교차만 했다 — 자른 변이 없다. "
                  "주의: 이집트는 기원전 30년까지 프톨레마이오스 독립 왕국이다. 헬레니즘기 "
                  "지중해 최대 곡물 수출국이었지만 「로마의 곡창(annona)」이 되는 것은 "
                  "옥타비아누스의 병합(기원전 30) 이후다 — 발표 구간의 맨 끝.",
    }),
    (nile_valley, {
        "id": "plain:nile-valley",
        "name_ko": "나일 계곡",
        "crop": "밀",
        "confidence": "medium",
        "why_ko": "폭 15km의 초록 띠 하나가 로마의 넉 달치 빵이다. 카이사르가 본 것은 이것이다.",
        "source": "스트라본 17.1.2~3(나일은 시에네와 엘레판티네 위의 작은 폭포 — 아이깁토스와 "
                  "아이티오피아의 경계 — 에서 하구까지 이집트를 곧게 관통한다). 기하: Natural Earth "
                  "10m rivers 'Nile' 실측 라인을 0.07°(폭 ~15km) 버퍼. **버퍼 반경은 사료가 아니라 "
                  "선택한 상수다** — 실제 범람 평야 폭은 5~25km로 변하고, 이 면의 구면 면적은 "
                  "현대 이집트 계곡 경작지(델타 제외 약 1.2~1.3만km²)와 같은 자리에 떨어진다. "
                  "남쪽은 북위 23.95에서 끊었다(시에네 24.09 = 제1폭포). 그 남쪽 누비아를 "
                  "이집트 곡창으로 칠하지 않기 위해서다. "
                  "알려진 누락: 파이윰(모이리스 호 관개지)은 NE에 면이 없어 빠진다.",
    }),
    (baetica, {
        "id": "plain:baetica",
        "name_ko": "바이티카 (과달키비르 유역)",
        "crop": "밀·올리브유",
        "confidence": "medium",
        "why_ko": "밀과 기름과 포도주가 같이 나온 강. 스트라본은 「양도 많고 품질도 최상」이라 적었다.",
        "source": "스트라본 3.2.6(투르데타니아에서 곡물과 포도주가 많이, 올리브유는 양도 많고 "
                  "품질도 최상으로 수출된다) + 3.2.3(바이티스는 바다에서 코르두바까지 1,200스타디온 "
                  "항행되고, 강가와 강 안 섬들이 지극히 잘 경작돼 있다). 기하: Natural Earth 10m "
                  "rivers 'Guadalquivir' 실측 라인을 0.30°(폭 ~66km) 버퍼한 뒤 NE "
                  "geography_regions 'Sierra Morena'(북)·'S. Nevada'(동)를 difference. "
                  "남쪽 수브베티카·페니베티카 산지는 NE에 면이 없어 **버퍼 반경이 경계다**. "
                  "넣은 이유: 대표님 축은 「잉여 생산물 → 제국」이고 스트라본이 우리 구간에 대해 "
                  "밀·기름·포도주 수출을 직접 증언한다. 카이사르의 문다(기원전 45)도 이 땅이다. "
                  "주의: 드레셀 20 암포라로 대표되는 바이티카 올리브유 호황은 제국기(서기 1~2세기) "
                  "현상이다 — 우리 구간은 그 전야다.",
    }),
]

# ---------------------------------------------------------------- 척박지

# ⑧ 사하라 + 이집트 양쪽 사막. NE의 큰 사막 면들을 합쳐 한 면으로 낸다 — 리비아 사막·
# 서부 사막·동부 사막·누비아 사막은 사하라의 하위 구역이라 따로 두면 척박지끼리 겹친다.
sahara = unary_union([REG[k] for k in
                      ["SAHARA", "LIBYAN DESERT", "WESTERN DESERT", "Eastern Desert",
                       "NUBIAN DESERT"]])

# ⑨ 발칸 서안 산악. 대표님이 "그 발칸반도 왼쪽에 그리스 반도는 발칸반도의 끝"이라 가리킨 벽.
balkan = unary_union([REG["Dinaric Alps"], REG["Pindus Mts."]])

# ⑩ 시리아·아라비아 사막.
arabia = unary_union([REG[k] for k in ["SYRIAN DESERT", "An Nafud Desert", "Negev Desert"]])

BARREN = [
    (sahara, {
        "id": "barren:sahara",
        "name_ko": "사하라 · 이집트 사막",
        "confidence": "high",
        "why_ko": "여기엔 잉여 생산물이 없다. 나일의 초록 띠 하나만 이 갈색을 가른다.",
        "source": "기하: Natural Earth 10m geography_regions_polys의 Desert 분류 면 다섯을 union "
                  "— SAHARA · LIBYAN DESERT · WESTERN DESERT · Eastern Desert · NUBIAN DESERT. "
                  "하위 구역이라 서로 겹쳐서 한 면으로 합쳤다. manifest bbox(-15,20,65,60)로 잘라 "
                  "발표 프레임 안만 남겼고(사하라 원면은 북위 9.34·서경 17.07까지 뻗는다), "
                  "곡창 면들을 difference했다 — 나일 계곡·델타가 이 갈색 위에 초록 띠로 뜬다. "
                  "**이 면이 대표님의 카르타고 설명을 반증한다**: 북쪽 한계가 북위 34.61이고 "
                  "카르타고는 36.85다(345km 북쪽).",
    }),
    (balkan, {
        "id": "barren:balkan-mts",
        "name_ko": "발칸 서안 산악 (디나르알프스·핀도스)",
        "confidence": "medium",
        "why_ko": "평야지대가 없는 거예요. 먹고 살게 없어요. 그래서 제국이 이루어질 수 없어요.",
        "source": "기하: Natural Earth 10m geography_regions_polys의 Range/mtn 면 둘을 union — "
                  "'Dinaric Alps'(125,286km² 원면)와 'Pindus Mts.'(28,862km² 원면). 두 면은 "
                  "북위 41.5~41.8에서 32km 벌어져 MultiPolygon으로 남는다. "
                  "**알려진 불완전**: NE 10m에 그리스의 나머지 산맥 면이 없다 — 타이게토스·파르논"
                  "(펠로폰네소스)·파르나소스·올림포스·로도페가 전부 빠져 있다. 그래서 이 면은 "
                  "펠로폰네소스·아티카·에우보이아를 덮지 못한다. 좌표를 발명해 채우지 않았다. "
                  "테살리아·보이오티아·에마티아(마케도니아)는 그리스의 실제 평야라 비워 두는 것이 "
                  "오히려 맞다.",
    }),
    (arabia, {
        "id": "barren:syria-arabia",
        "name_ko": "시리아 · 아라비아 사막",
        "confidence": "medium",
        "why_ko": "여기서 농경이 끊긴다. 시리아 속주의 도시들은 이 사막의 테두리에 매달려 있다.",
        "source": "기하: Natural Earth 10m geography_regions_polys의 Desert 분류 면 셋을 union — "
                  "SYRIAN DESERT · An Nafud Desert · Negev Desert. "
                  "알려진 누락: 시나이 반도에 NE 면이 없어 사하라 면과 이 면 사이가 비어 있다. "
                  "루브 알할리는 발표 프레임 밖이라 넣지 않았다.",
    }),
]

# ---------------------------------------------------------------- 조립

# 같은 kind끼리 겹치지 않게 앞 면을 뒤 면에서 뺀다. 곡창×척박은 허용이지만(지리가 겹치는 게
# 아니라 분류가 다른 것) 나일 띠가 사막에 묻히면 교보재로서 죽으므로 척박지에서 곡창을 뺀다.
FEATURES = []
done_g = []
for g, props in GRANARY:
    c = clean(g, "granary", minus=done_g)
    done_g.append(c)
    FEATURES.append((c, {**props, "kind": "granary"}))

granary_u = unary_union(done_g)
done_b = []
for g, props in BARREN:
    c = clean(g, "barren", minus=done_b + [granary_u])
    done_b.append(c)
    FEATURES.append((c, {**props, "kind": "barren"}))

out = {
    "type": "FeatureCollection",
    "teaching": True,
    "source": "「평야 = 잉여 생산물 = 제국」 — 2회차 발표(카이사르 팩, 기원전 60~27)의 인과 축을 "
              "면으로 만든 교보재. 정본 온톨로지와 베이스맵에는 영토(폴리티)와 지형 음영만 있고 "
              "「곡창」이라는 분류가 없어서, 왜 그리스가 아니고 로마인지·왜 카르타고가 아니고 "
              "이집트인지가 지도에서 대답되지 않았다. 곡창 7면 + 척박 3면. "
              "좌표는 전부 Natural Earth 10m(nvkelso/natural-earth-vector, Public Domain)에서 "
              "나온다: 레포에 이미 있는 layers/{rivers,land,lakes}.geojson 실측 정점과, "
              "data/external/ne_10m_geography_regions_polys.geojson(빌드타임 캐시)의 산맥·사막·"
              "델타 면. ODbL(OSM) 파생 데이터는 쓰지 않았다. region_labels.geojson을 쓸 수 없는 "
              "이유는 그것이 같은 원본을 -simplify 10% -dissolve 한 라벨 레이어여서 157개 중 "
              "128개가 geometry null이고 사하라가 567km²로 찍히기 때문이다. "
              "모든 면은 land.geojson과 교차해 육지로 제한했고 호수를 뺐다(바다 침범 0 실측) — "
              "단 나세르 호(1970 아스완 하이 댐)와 대비터 호(1869 수에즈 운하)는 기원전 1세기에 "
              "없던 물이라 마스크에서 제외했다. 그대로 빼면 나일 계곡 자리에 3,508km² 구멍이 뚫린다. "
              "같은 kind끼리 겹침 0(실측). **정본 폴리티와는 일부러 겹친다 — 이건 영토가 아니라 "
              "지리다.** 단순화 허용오차 곡창 0.02°(~2.2km)·척박 0.05°(~5.5km), 좌표 소수 3자리. "
              "면적은 구면 공식(평면 도 면적 × 상수는 지중해 위도대에서 1.3배 과대). "
              "생성: scripts/build-plains.py (재현 가능, 인자 없음).",
    "features": [
        {"type": "Feature", "geometry": round_coords(mapping(g)),
         "properties": {**props, "name": props["name_ko"],
                        "valid_from": WINDOW[0], "valid_to": WINDOW[1],
                        "teaching": True, "area": int(round(km2(g)))}}
        for g, props in FEATURES
    ],
}
with open(OUT, "w") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    f.write("\n")


# ---------------------------------------------------------------- 보고·자체검증

print(f"\n{'면':<30}{'kind':<9}{'폴리':>5}{'정점':>6}{'km²':>12}  bbox")
for g, props in FEATURES:
    n = len(g.geoms) if g.geom_type == "MultiPolygon" else 1
    print(f"{props['name_ko']:<28}{props['kind']:<9}{n:>5}{nverts(g):>6}{km2(g):>12,.0f}"
          f"  {[round(v, 2) for v in g.bounds]}")
print(f"{'합계':<28}{'':<9}{'':>5}{sum(nverts(g) for g, _ in FEATURES):>6}"
      f"{sum(km2(g) for g, _ in FEATURES):>12,.0f}")

raw = os.path.getsize(OUT)
gz = len(gzip.compress(open(OUT, "rb").read(), 9))
print(f"\nraw {raw:,} B / gzip {gz:,} B  (예산 raw < 40,000)")

print("\n겹침·침범 (km², 실측)")
print(f"  바다 밖(육지 difference) 합계 : {sum(km2(g.difference(land)) for g, _ in FEATURES):.6f}")
print(f"  호수 위 합계                  : {sum(km2(g.intersection(lakes)) for g, _ in FEATURES):.6f}")
for kind in ("granary", "barren"):
    ks = [(g, p) for g, p in FEATURES if p["kind"] == kind]
    worst, wname = 0.0, "-"
    for i in range(len(ks)):
        for j in range(i + 1, len(ks)):
            a = km2(ks[i][0].intersection(ks[j][0]))
            if a > worst:
                worst, wname = a, f"{ks[i][1]['name_ko']}×{ks[j][1]['name_ko']}"
    print(f"  {kind} 끼리 최대            : {worst:.6f}  ({wname})")
print(f"  곡창×척박 (허용, 참고)        : "
      f"{km2(unary_union([g for g,p in FEATURES if p['kind']=='granary']).intersection(unary_union([g for g,p in FEATURES if p['kind']=='barren']))):.6f}")

print("\n대표님 전제 대조(실측)")
carth = Point(10.3233, 36.8525)
afr = [g for g, p in FEATURES if p["id"] == "plain:africa"][0]
print(f"  NE 사하라 폴리곤 북쪽 한계 : 북위 {REG['SAHARA'].bounds[3]:.3f}")
print(f"  카르타고 → 사하라 최단거리 : {carth.distance(REG['SAHARA']) * 111.2:.0f} km")
print(f"  카르타고 → 아프리카 곡창면 : {carth.distance(afr) * 111.2:.1f} km "
      f"(해안 인셋 {INSET['granary'] * 111.2:.1f}km 안쪽으로 당긴 탓. 내륙 우티카는 "
      f"{Point(10.06, 37.056).within(afr)})")

# 자체검증. 하나라도 깨지면 산출물을 쓰면 안 된다.
assert abs(km2(box(-180, -90, 180, 90)) - 510_065_622) / 510_065_622 < 0.001, "구면 면적 함수 오류"
assert abs(km2(box(0, 0, 1, 1)) - 12_363) < 5, "1°×1° 적도 칸 면적 오류"
for g, props in FEATURES:
    assert not g.is_empty and g.is_valid, props["id"]
    assert km2(g.difference(land)) < 1.0, f"{props['id']} 바다 침범"
    assert km2(g.intersection(lakes)) < 1.0, f"{props['id']} 호수 침범"
for kind in ("granary", "barren"):
    ks = [(g, p) for g, p in FEATURES if p["kind"] == kind]
    for i in range(len(ks)):
        for j in range(i + 1, len(ks)):
            assert km2(ks[i][0].intersection(ks[j][0])) < 1.0, \
                f"{ks[i][1]['id']}×{ks[j][1]['id']} {kind} 겹침"
assert raw < 40_000, f"raw {raw} > 40kB 예산"
# 면적 온전성 — 알려진 실측값과 어긋나면 경계 로직이 깨진 것이다
by = {p["id"]: km2(g) for g, p in FEATURES}
assert 40_000 < by["plain:padus"] < 56_000, f"포 평야 {by['plain:padus']:,.0f} — 파두스 평원은 ~46,000km²"
# 시칠리아는 실제 25,711km²인데 해안 인셋 2.8km가 섬 둘레를 깎아 ~8% 줄어든다(정상).
assert 23_000 < by["plain:sicilia"] < 26_500, f"시칠리아 {by['plain:sicilia']:,.0f} — 실제 25,711km²"
assert 18_000 < by["plain:nile-delta"] < 25_000, f"나일 델타 {by['plain:nile-delta']:,.0f}"

# 지점 검증 — 경계 로직이 깨지면 여기서 먼저 터진다. 해안 인셋(2.8km) 때문에 항구 도시는
# 면 밖으로 떨어지므로 내륙 지점만 넣었다.
geom = {p["id"]: g for g, p in FEATURES}
LANDMARKS = [
    ("plain:padus", True, "메디올라눔(밀라노)", 9.19, 45.46),
    ("plain:padus", True, "아우구스타 타우리노룸(토리노)", 7.69, 45.07),
    ("plain:padus", True, "보노니아(볼로냐)", 11.34, 44.49),
    ("plain:padus", False, "게누아(제노바) — 산에 눌린 항구", 8.93, 44.41),
    ("plain:padus", False, "피사이(피사) — 아펜니노 남쪽", 10.40, 43.72),
    ("plain:latium-campania", True, "로마", 12.4866, 41.8929),
    ("plain:latium-campania", True, "카푸아", 14.25, 41.08),
    ("plain:latium-campania", False, "아드리아 쪽 아펜니노 너머", 14.20, 42.35),
    ("plain:sicilia", True, "엔나(내륙 곡물 지대)", 14.28, 37.57),
    ("plain:africa", True, "우티카", 10.06, 37.056),
    ("plain:africa", False, "카푸트 바다(사하라 쪽 내륙)", 9.00, 34.50),
    ("plain:nile-valley", True, "테바이(룩소르)", 32.64, 25.70),
    ("plain:nile-delta", True, "부바스티스(델타 내륙)", 31.51, 30.57),
    ("plain:baetica", True, "코르두바", -4.78, 37.88),
    ("plain:baetica", True, "히스팔리스", -5.99, 37.39),
    ("barren:sahara", True, "시와 오아시스 서쪽 서부사막", 26.50, 27.00),
    ("barren:sahara", False, "카르타고", 10.3233, 36.8525),
    ("barren:balkan-mts", True, "핀도스 능선", 21.20, 39.80),
    ("barren:balkan-mts", False, "아테나이 — NE에 아티카 산맥 면이 없다(알려진 공백)",
     23.73, 37.98),
    ("barren:syria-arabia", True, "팔미라 동쪽 시리아 사막", 39.50, 33.50),
]
bad = [(i, nm, want) for i, want, nm, x, y in LANDMARKS
       if geom[i].contains(Point(x, y)) != want]
for i, nm, want in bad:
    print(f"  [지점 불일치] {i}  {nm}  기대={want}")
assert not bad, f"지점 검증 {len(bad)}건 실패"
print(f"\n지점 검증 {len(LANDMARKS)}곳 통과")
print("OK — 자체검증 통과")
