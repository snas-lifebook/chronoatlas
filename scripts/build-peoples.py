#!/usr/bin/env python3
"""data/overlays/pack-peoples.json 생성 — 기원전 1세기 지중해 주변 비국가 민족·왕국 영역.

정본 영토(Cliopatria/Seshat 파생)는 국가 단위로만 코딩돼 부족 연합이 구조적으로 없다.
그래서 기원전 60년 프레임에 게르마니아·다키아·사르마티아·보스포루스·브리타니아가 뜨지 않는다.
이 스크립트는 **좌표를 발명하지 않고** 레포에 이미 있는 Natural Earth(퍼블릭 도메인) 기하에서
경계를 오려 낸다:

  - `layers/rivers.geojson`  강 경계(라인·다누비우스·비스툴라·티사·프루트·타나이스·볼가·쿠반)
  - `layers/land.geojson`    해안선(박스 변을 잘라 육지로 제한 → 바다를 덮지 않는다)
  - `layers/territory/*.geojson` 정본 폴리티(difference로 빼서 겹침 0)

방식: 큰 박스를 강 라인으로 split() 하고 씨앗점이 든 쪽을 고른다. 박스 변은 육지 교차에서
해안선으로 대체되거나(바다) 문서에 적힌 이음선으로 남는다. 이음선 길이는 전부 로그에 찍는다.

실행: python3 scripts/build-peoples.py   (인자 없음. shapely만 필요)
"""
import json
import math
import os
import sys

import shapely
from shapely.geometry import LineString, MultiLineString, Polygon, box, mapping, shape
from shapely.ops import linemerge, split, unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAYERS = os.path.join(ROOT, "public/datasets/rome/layers")
OUT = os.path.join(ROOT, "data/overlays/pack-peoples.json")

WINDOW = (-60, -27)   # 이 발표 구간(기원전 60~27)
SIMPLIFY = 0.02       # 도(度). 적도에서 ~2.2km — 대륙 축척 교보재에 충분
PRECISION = 3         # 소수 3자리 ≈ 111m. 단순화 허용오차보다 훨씬 촘촘하다
MIN_KM2 = 400         # 이보다 작은 조각은 difference 잔여물로 보고 버린다
LAND_INSET = 0.025    # 육지 마스크를 ~2.8km 안쪽으로 당긴다 — 단순화 부풀림(≤2.2km)이 바다를 덮지 않게
SEAM = 0.0015         # 이웃 면과 ~165m 이음 틈. 좌표 3자리 반올림 뒤에도 겹침이 정확히 0이 된다
MAX_GAP = 60          # 하천 조각 사이 이 거리(km)를 넘으면 다른 물줄기로 보고 버린다
R = 6371.0088         # km


# ---------------------------------------------------------------- 측정·입출력

def km2(g):
    """구면 폴리곤 면적(km²). 대권 변 가정 — 대륙 축척에서 평면 근사보다 정확하다."""
    if g.is_empty:
        return 0.0
    if g.geom_type == "Polygon":
        polys = [g]
    else:  # MultiPolygon / GeometryCollection(교차 결과에 선·점이 섞일 수 있다)
        polys = [p for p in g.geoms if p.geom_type == "Polygon"]
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


def load(name):
    with open(os.path.join(LAYERS, name)) as f:
        return json.load(f)["features"]


def geoms(features):
    return [shape(f["geometry"]) for f in features if f.get("geometry")]


def lines_named(rivers, names):
    """이름이 names에 든 하천 세그먼트를 모아 linemerge한 조각 목록."""
    out = []
    for f in rivers:
        if f["properties"].get("name") not in names:
            continue
        g = shape(f["geometry"])
        out += list(g.geoms) if g.geom_type == "MultiLineString" else [g]
    merged = linemerge(out)
    parts = list(merged.geoms) if merged.geom_type == "MultiLineString" else [merged]
    return [p for p in parts if p.length > 1e-6]


def dist_km(a, b):
    dx = math.radians(b[0] - a[0]) * math.cos(math.radians((a[1] + b[1]) / 2))
    dy = math.radians(b[1] - a[1])
    return math.hypot(dx, dy) * R


def chain(parts, start, label):
    """조각들을 start에 가까운 끝에서 출발해 끝점끼리 탐욕 연결한 하나의 라인.

    조각 사이 벌어진 곳은 직선 이음선이 된다 — 길이를 전부 반환해 문서에 적는다.
    """
    remaining = list(parts)
    coords, gaps = [], []
    tip = start
    while remaining:
        best, rev, d = None, False, float("inf")
        for p in remaining:
            c = list(p.coords)
            for r, pt in ((False, c[0]), (True, c[-1])):
                dd = dist_km(tip, pt)
                if dd < d:
                    best, rev, d = p, r, dd
        if coords and d > MAX_GAP:
            gaps.append((round(d, 1), "버림", len(remaining)))
            break
        c = list(best.coords)[::-1] if rev else list(best.coords)
        if coords:
            gaps.append((round(d, 1), tuple(round(v, 3) for v in coords[-1]),
                         tuple(round(v, 3) for v in c[0])))
        coords += c
        tip = c[-1]
        remaining.remove(best)
    return LineString(coords), [(label, *g) for g in gaps]


def extend(line, head=None, tail=None):
    """양 끝을 지정한 점까지 직선으로 늘린다(split이 박스를 관통하도록)."""
    c = list(line.coords)
    if head:
        c = [head] + c
    if tail:
        c = c + [tail]
    return LineString(c)


def cut(poly, barrier, seed, label):
    """barrier로 poly를 자르고 seed가 든 조각만 남긴다."""
    pieces = list(split(poly, barrier).geoms)
    if len(pieces) < 2:
        sys.exit(f"[{label}] barrier가 폴리곤을 관통하지 못했다 — 연장 끝점을 고쳐라")
    keep = [p for p in pieces if p.contains(shapely.Point(*seed))]
    if len(keep) != 1:
        sys.exit(f"[{label}] 씨앗점이 든 조각이 {len(keep)}개다 — 씨앗점을 고쳐라")
    return keep[0]


def clean(g, land, minus, mainland_only=True):
    """육지로 제한 → 다른 영역 제거 → 단순화 → 자투리·섬 제거.

    mainland_only: 대륙 본체에서 오려진 조각만 남긴다. 박스 북변(60°N)이 스칸디나비아를
    반 토막 내고 고틀란드·발트 섬까지 게르마니아로 끌고 오는 것을 막는다 — 섬은 대륙
    폴리곤과 교차하지 않으므로 한 줄로 걸러진다.
    """
    # 순서가 중요하다. ①원본 해상도로 육지 클립 → ②단순화 → ③단순화가 해안 밖으로 부풀린
    # 곳만 다시 클립(바다 침범 0) → ④이웃·정본을 SEAM 만큼 넉넉히 빼기(**단순화 뒤에** 빼야
    # 한다 — 단순화를 나중에 하면 공유 경계가 폴리곤마다 다르게 접혀 2km 폭 겹침이 생긴다).
    g = g.intersection(land_in).simplify(SIMPLIFY, preserve_topology=True)
    for m in minus:
        if not m.is_empty:
            g = g.difference(m.buffer(SEAM))
    g = shapely.set_precision(g, 10 ** -PRECISION)
    polys = list(g.geoms) if g.geom_type == "MultiPolygon" else ([g] if not g.is_empty else [])
    polys = [p for p in polys if p.is_valid and km2(p) >= MIN_KM2]
    if mainland_only:
        polys = [p for p in polys if p.intersects(MAINLAND)]
    if not polys:
        return shapely.geometry.GeometryCollection()
    return polys[0] if len(polys) == 1 else shapely.MultiPolygon(polys)


def round_coords(obj):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], float):
            return [round(v, PRECISION) for v in obj]
        return [round_coords(v) for v in obj]
    return obj


# ---------------------------------------------------------------- 기하 원자료

rivers = load("rivers.geojson")
LAND_PARTS = [p for g in geoms(load("land.geojson"))
              for p in (g.geoms if g.geom_type == "MultiPolygon" else [g])]
land = unary_union([p.buffer(0) for p in LAND_PARTS])
land_in = land.buffer(-LAND_INSET)                           # 반올림 여유분만큼 안쪽으로
MAINLAND = max(LAND_PARTS, key=lambda p: p.area).buffer(0)   # 유라시아·아프리카 본체

gaps = []


def river(names, start, label):
    line, g = chain(lines_named(rivers, names), start, label)
    gaps.extend(g)
    return line


# 라인 강: 알프스 수원 → 북해 하구. 카이사르 BG 1.1·4.10이 갈리아/게르마니아 경계로 쓴 강.
rhine = river(["Rhein", "Rhin", "Rhine"], (4.99, 51.82), "라인")
# 다누비우스(도나우): 수원 → 흑해 델타. 타키투스 『게르마니아』 1의 남쪽 경계.
danube = river(["Donau", "Danube"], (8.18, 48.09), "다누비우스")
# 비스툴라: 카르파티아 수원 → 발트 하구. 프톨레마이오스가 게르마니아 동계로 쓴 강.
vistula = river(["Vistula"], (18.95, 54.36), "비스툴라")
# 티사(티서): 다누비우스 합류점 → 상류. NE 데이터가 하류만 담고 있다(문서에 적음).
tisa = river(["Tisa"], (20.28, 45.14), "티사")
# 프루트: 다누비우스 합류점 → 카르파티아 수원.
prut = river(["Prut"], (28.21, 45.45), "프루트")
# 타나이스(돈): 상류 → 아조프 하구. 스트라본 11.1.5의 유럽/아시아 경계.
don = river(["Don"], (38.31, 54.06), "타나이스")
# 볼가: 상류 → 카스피 델타.
volga = river(["Volga"], (41.34, 57.49), "볼가")
# 쿠반: 카우카소스 수원 → 흑해 하구.
kuban = river(["Kuban"], (37.38, 45.31), "쿠반")

# 연장·이음선. split()이 박스를 관통하려면 양 끝이 박스 **밖**이어야 한다 — 전부 바다 위이거나
# 어차피 다른 컷·정본 difference로 잘려 나가는 방향으로 뺀다.
rhine_x = extend(rhine, head=(1.0, 52.6), tail=(9.5, 43.0))          # 북해 / 알프스 남쪽
danube_x = extend(danube, head=(6.0, 47.6), tail=(31.0, 42.0))       # 라인 서쪽 / 흑해
vistula_x = extend(vistula, head=(19.0, 61.0), tail=(18.85, 43.5))   # 발트 / 카르파티아 남단
tisa_x = extend(tisa, head=(20.3, 42.5), tail=(20.15, 49.5))         # 다누비우스 남쪽 / 북쪽 박스
prut_x = extend(prut, head=(28.9, 42.5), tail=(24.5, 53.0))          # 다누비우스 남쪽 / 북쪽 박스
# 타나이스 + 킴메리아 보스포루스(케르치 해협) 이음선 — 스트라본 11.1.5의 유럽/아시아 경계선.
# 아조프 해 위라 육지 교차에서 사라진다.
don_x = LineString([(38.0, 56.0)] + list(don.coords) + [(36.6, 45.35), (35.5, 42.0)])
volga_x = extend(volga, head=(40.0, 59.0), tail=(49.5, 45.6))        # 북쪽 박스 / 카스피
# 쿠반 + 카우카소스 북측 기슭(테레크 강 대응) 직선 이음선 → 카스피.
kuban_x = extend(kuban, head=(35.5, 45.8), tail=(49.5, 43.0))

# 정본 폴리티(발표 구간과 겹치는 전부) — difference용
canon = []
canon_rome = []
for bucket in ("-100.geojson", "0.geojson"):
    for f in load(os.path.join("territory", bucket)):
        p, g = f["properties"], f.get("geometry")
        if not g or g["type"] == "Point":
            continue
        vf, vt = p.get("valid_from"), p.get("valid_to")
        if vf is None or vt is None or vt < WINDOW[0] or vf > WINDOW[1]:
            continue
        canon.append(shape(g).buffer(0))
        if p.get("actor") == "로마" and vf == -63 and vt == -50:
            canon_rome.append(shape(g).buffer(0))
canon_u = unary_union(canon)
rome_u = unary_union(canon_rome)

# 자유 갈리아 교보재(gallia-free.json)와도 겹치면 안 된다 — pack-extent-60·51 장면에서 둘이
# 같이 뜨고, 라인 강 경계를 저쪽은 원본 해상도로 저쪽은 단순화해서 썼기 때문에 73km²가 겹쳤다.
with open(os.path.join(ROOT, "data/overlays/gallia-free.json")) as f:
    gallia_u = unary_union([shape(x["geometry"]).buffer(0) for x in json.load(f)["features"]])


# ---------------------------------------------------------------- 민족별 영역

# 보스포루스 왕국: 크림 반도 + 타만 반도. 페레코프 지협·타만 목만 박스 변으로 끊고
# 나머지 외곽은 전부 Natural Earth 해안선이다.
bosporan_raw = unary_union([
    box(32.4, 44.2, 36.8, 46.15).intersection(land),   # 크림(페레코프 지협 남쪽)
    box(36.6, 44.8, 38.5, 45.65).intersection(land),   # 타만 + 쿠반 하구
])

# 게르마니아: 서=라인, 남=다누비우스, 동=비스툴라, 북=북해·발트 해안선(육지 교차).
g_box = box(2.0, 44.0, 26.0, 60.0)
germania = cut(g_box, rhine_x, (10.0, 51.0), "게르마니아/라인")
germania = cut(germania, danube_x, (10.0, 51.0), "게르마니아/다누비우스")
germania = cut(germania, vistula_x, (10.0, 51.0), "게르마니아/비스툴라")

# 다키아: 남=다누비우스, 서=티사, 동=프루트, 북=카르파티아(박스 변 48.4°N 직선 근사).
d_box = box(19.0, 42.8, 31.0, 48.4)
dacia = cut(d_box, danube_x, (24.5, 45.5), "다키아/다누비우스")
dacia = cut(dacia, tisa_x, (24.5, 45.5), "다키아/티사")
dacia = cut(dacia, prut_x, (24.5, 45.5), "다키아/프루트")

# 사르마티아: 서=프루트, 남서=다누비우스 하류, 남=흑해·아조프 해안선, 남동=쿠반+테레크선,
# 동=볼가. 타나이스(돈) 양쪽을 **한 면으로** 낸다 — 스트라본이 가르는 것은 유럽/아시아 지리
# 구분이고(11.1.5) 양쪽 다 사르마타이다(7.3.17 이아지게스·록솔라니, 11.5.8 아오르시·시라케스).
# 발표 축척에서 이름 둘이 나란히 뜨면 같은 것의 두 이름으로 읽힌다.
#
# 북쪽 경계는 **위도선을 쓰지 않는다.** 사료에 북쪽 한계가 없고, 상자로 때우면 모르는 것이
# 확실한 주장처럼 보인다. 대신 폰토스·마이오티스·카스피 북안을 내륙으로 BAND도 밀어 만든
# 띠로 자른다 — 정점은 전부 Natural Earth 해안선에서 나오고, 경계가 해안을 따라 굽는다.
# 스트라본 7.3이 실제로 말하는 것도 그 바다 북안의 유목 평원이다.
BAND = 3.0    # 도. 위도로 ~330km, 경도로 ~220km(북위 48). 띠 폭
CLOSE = 1.6   # 띠를 닫는 형태학 연산(팽창→수축). 스타브로폴 내륙처럼 해안에서 BAND보다 먼
              # 구멍이 V자로 패이는데, 그 패임은 사료가 아니라 버퍼 반경의 흔적이다
coast_band = (land.boundary.intersection(box(20.0, 40.0, 55.0, 50.0))
               .buffer(BAND).buffer(CLOSE).buffer(-CLOSE))

s_box = box(23.0, 43.0, 49.0, 52.0)   # 동변은 a_box와 같게 — 41.0이면 돈 강 대굴곡(북위 49.5,
                                      # 동경 43.5) 서쪽이 박스 밖으로 빠져 세로 직선이 남는다
sarmatia = cut(s_box, prut_x, (33.0, 48.5), "사르마티아/프루트")
sarmatia = cut(sarmatia, danube_x, (33.0, 48.5), "사르마티아/다누비우스")
sarmatia = cut(sarmatia, don_x, (33.0, 48.5), "사르마티아/타나이스")

a_box = box(36.0, 41.0, 49.0, 52.0)
aorsi = cut(a_box, don_x, (44.0, 48.0), "아오르시/타나이스")
aorsi = cut(aorsi, kuban_x, (44.0, 48.0), "아오르시/쿠반")
aorsi = cut(aorsi, volga_x, (44.0, 48.0), "아오르시/볼가")
# 둘 다 같은 돈+케르치 라인으로 잘랐으므로 경계가 정확히 맞물려 한 폴리곤으로 합쳐진다.
sarmatia = unary_union([sarmatia, aorsi]).intersection(coast_band)

# 브리타니아: 브리튼 섬. 외곽 전부 Natural Earth 해안선 — 자른 변이 없다.
britain = max(
    (p for g in geoms(load("land.geojson")) for p in (g.geoms if g.geom_type == "MultiPolygon" else [g])
     if -6.5 < p.bounds[0] and p.bounds[2] < 2.5 and p.bounds[1] > 49.0),
    key=lambda p: p.area,
)

bosporan = clean(bosporan_raw, land_in, [canon_u])
germania = clean(germania, land_in, [canon_u, gallia_u])
dacia = clean(dacia, land_in, [canon_u, germania])
sarmatia = clean(sarmatia, land_in, [canon_u, bosporan, dacia])
britain = clean(britain, land_in, [canon_u], mainland_only=False)

FEATURES = [
    (germania, {
        "id": "people:germania",
        "name_ko": "게르마니아",
        "name": "게르마니아",
        "actor": "게르만",
        "valid_from": -60, "valid_to": -27,
        "confidence": "medium",
        "source": "타키투스 『게르마니아』 1(라인·다누비우스가 갈리아·라이티아·판노니아와 가르고, "
                  "사르마티아·다키아와는 산과 서로의 두려움이 가른다) + 카이사르 BG 4.1~4.4·6.24(라인 동안 게르만) "
                  "+ 동계 비스툴라는 프톨레마이오스 『지리학』 2.11 통상 독법. 기하: Natural Earth rivers "
                  "라인(Rhein+Rhin+Rhine)·다누비우스(Donau+Danube)·비스툴라 정점 복사, 북쪽 외곽은 "
                  "land.geojson 북해·발트 해안선(스칸디나비아·발트 섬은 뺐다). gallia-free.json과도 "
                  "difference — 같은 장면에서 둘이 같이 뜬다. 알려진 단순화: 보헤미아·모라비아"
                  "(기원전 60년엔 켈트계 보이이)가 이 외곽 안에 든다 — 마르코만니 이주는 기원전 9년경.",
        "actor_reason": "타키투스·카이사르가 라인 동안을 Germani로 부른 지역 그대로 — 정본 어휘 '게르만'.",
    }),
    (dacia, {
        "id": "people:dacia",
        "name_ko": "다키아",
        "name": "다키아",
        "actor": "기타중립",
        "valid_from": -60, "valid_to": -27,
        "confidence": "medium",
        "source": "스트라본 7.3.11~13(부레비스타스가 보이이·타우리스키를 꺾고 다누비우스 북안을 아울렀다, "
                  "마리소스=무레슈가 다키아를 지나 다누비우스로 든다). 기하: Natural Earth rivers "
                  "다누비우스(남)·티사(서)·프루트(동) 정점 복사. 북쪽 경계는 카르파티아 능선을 48.4°N "
                  "직선으로 근사했다(해당 산맥 라인 데이터 없음). NE 데이터의 티사는 하류만 있어 "
                  "상류는 직선 연장이다 — 서쪽 경계가 판노니아 평원으로 조금 넘칠 수 있다.",
        "actor_reason": "정본 어휘에 트라키아·게타이계 항목이 없다. '갈리아'·'게르만'은 사실을 틀리게 말하므로 중립색.",
    }),
    (sarmatia, {
        "id": "people:sarmatia",
        "name_ko": "사르마티아",
        "name": "사르마티아",
        "actor": "기타중립",
        "valid_from": -60, "valid_to": -27,
        "confidence": "low",
        "peoples": "이아지게스 · 록솔라니 · 아오르시 · 시라케스",
        "source": "스트라본 7.3.17(록솔라니가 타나이스와 보리스테네스 사이 평원에, 이아지게스 사르마타이가 "
                  "그 서쪽에) + 11.5.8(아오르시가 타나이스 쪽에, 시라케스가 카우카소스에서 흐르는 강 쪽에) "
                  "+ 11.1.5(타나이스가 유럽과 아시아를 가른다). **타나이스 양쪽을 한 면으로 낸다** — "
                  "사료가 가르는 것은 유럽/아시아 지리 구분이고 양쪽 다 사르마타이다. 「알란」은 이 연대에 "
                  "쓸 수 없다: 알라니는 서기 1세기 중반 사료(세네카 『튀에스테스』, 루카누스 『파르살리아』 "
                  "8·10권, 요세푸스 『유대전쟁기』 7권의 서기 72년경 침입)에 처음 나오고, 같은 공간을 "
                  "직접 서술한 스트라본은 알란을 모른 채 아오르시·시라케스를 든다. "
                  "기하: Natural Earth rivers 프루트(서)·다누비우스 하류(남서)·쿠반(남동)·볼가(동) 정점 "
                  "복사, 남쪽은 land.geojson 흑해·아조프·카스피 해안선. 북쪽은 위도선을 쓰지 않았다 — "
                  "사료에 북쪽 한계가 없어서 상자로 때우면 모르는 것이 확실한 주장처럼 보인다. 대신 그 "
                  "바다 북안을 내륙으로 3°(위도 ~330km) 밀어 만든 띠로 잘라 경계가 해안을 따라 굽는다. "
                  "카우카소스 북측 기슭(쿠반 수원~카스피)과 프루트 수원 북쪽은 직선 이음선이고, "
                  "프루트~드니스테르 사이(바스타르나이·티라게타이)와 볼가 서쪽까지가 이 면에 들어간다.",
        "actor_reason": "유목 부족 연합이라 정본 어휘에 대응 항목이 없다 → 중립색.",
    }),
    (bosporan, {
        "id": "people:bosporan",
        "name_ko": "보스포루스 왕국",
        "name": "보스포루스 왕국",
        "actor": "그리스계",
        "valid_from": -63, "valid_to": -27,
        "confidence": "medium",
        "source": "기원전 63년 미트리다테스 6세 사후 폼페이우스가 파르나케스 2세에게 보스포루스를 남긴 "
                  "왕국(정본 폴리티 목록에 없다). 범위는 크림 반도 + 타만 반도 — 외곽 전부 "
                  "Natural Earth land.geojson 해안선이고 자른 변은 페레코프 지협·타만 목 두 곳뿐. "
                  "알려진 단순화: 크림 내륙의 스키타이 왕국(네아폴리스)과 케르소네소스를 구분하지 않고 "
                  "한 면으로 묶었다(디오판토스 원정 이후 폰토스·보스포루스 종주권 아래였다는 통상 독법).",
        "actor_reason": "판티카파이온 등 밀레토스계 그리스 식민시가 모태이고 왕조·주화·문자가 헬레니즘계 → '그리스계'.",
    }),
    (britain, {
        "id": "people:britannia",
        "name_ko": "브리타니아",
        "name": "브리타니아",
        "actor": "갈리아",
        "valid_from": -60, "valid_to": -27,
        "confidence": "medium",
        "source": "카이사르 BG 4.20~4.38·5.8~5.23(기원전 55·54년 두 차례 도해) + BG 5.12(해안부는 약탈과 "
                  "전쟁을 위해 벨기카에서 건너온 자들이 살고 내륙은 토착이라 전한다). 기하: Natural Earth "
                  "land.geojson 브리튼 섬 폴리곤 그대로 — 자른 변이 하나도 없다. 정치 단위가 아니라 "
                  "지리 단위다(카이사르가 닿은 곳은 남동부뿐). 히베르니아(아일랜드)는 넣지 않았다.",
        "actor_reason": "BG 5.12의 벨가이계 이주 서술에 따라 켈트권으로 묶어 '갈리아' — 자유 갈리아와 같은 초록이 된다. "
                        "구분이 필요하면 '기타중립'으로 바꾸면 된다(면 기하는 그대로).",
    }),
]

out = {
    "type": "FeatureCollection",
    "teaching": True,
    "source": "정본 영토(public/datasets/rome/layers/territory/, Cliopatria/Seshat 파생)가 국가 단위로만 "
              "코딩돼 부족 연합·비국가 민족이 없다 — 기원전 60년 지중해 프레임에 게르마니아·다키아·"
              "사르마티아·보스포루스 왕국·브리타니아가 한 면도 뜨지 않는다. 그 여섯을 교보재로 채운 "
              "파일. 좌표는 전부 이 레포에 이미 있는 Natural Earth 10m(nvkelso/natural-earth-vector, "
              "Public Domain) rivers_lake_centerlines·land 정점 복사이며, 문헌이 말하는 강·해안을 경계로 "
              "삼고 split()으로 오렸다. ODbL(OSM) 파생 데이터는 쓰지 않았다. 모든 면은 land.geojson과 "
              "교차해 육지로 제한했고, 발표 구간(기원전 60~27)과 겹치는 정본 폴리티 전부를 "
              "difference()로 뺐다(겹침 면적 0 실측). 단순화 허용오차 0.02°(~2.2km), 좌표 소수 3자리. "
              "생성: scripts/build-peoples.py (재현 가능, 인자 없음).",
    "features": [
        {"type": "Feature", "geometry": round_coords(mapping(g)),
         "properties": {**props, "teaching": True, "area": int(round(km2(g)))}}
        for g, props in FEATURES
    ],
}
with open(OUT, "w") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))  # gallia-free와 같은 한 줄 압축
    f.write("\n")


# ---------------------------------------------------------------- 보고·자체검증

def nverts(g):
    return len(shapely.get_coordinates(g))


print(f"{'민족':<18}{'폴리곤':>5}{'정점':>7}{'km²':>12}")
for g, props in FEATURES:
    n = len(g.geoms) if g.geom_type == "MultiPolygon" else 1
    print(f"{props['name_ko']:<16}{n:>6}{nverts(g):>7}{km2(g):>12,.0f}")
print(f"{'합계':<16}{'':>6}{sum(nverts(g) for g, _ in FEATURES):>7}"
      f"{sum(km2(g) for g, _ in FEATURES):>12,.0f}")

raw = os.path.getsize(OUT)
import gzip
gz = len(gzip.compress(open(OUT, "rb").read(), 9))
print(f"\nraw {raw:,} B / gzip {gz:,} B")

print("\n겹침(km²) — 정본 폴리티 / 로마 -63~-50 / 자유 갈리아 / 서로")
for g, props in FEATURES:
    print(f"  {props['name_ko']:<16} 정본 {km2(g.intersection(canon_u)):.6f}"
          f"  로마 {km2(g.intersection(rome_u)):.6f}"
          f"  자유갈리아 {km2(g.intersection(gallia_u)):.6f}")
pairs = [(FEATURES[i], FEATURES[j]) for i in range(len(FEATURES)) for j in range(i + 1, len(FEATURES))]
worst = max(pairs, key=lambda pr: km2(pr[0][0].intersection(pr[1][0])))
print(f"  서로 최대: {worst[0][1]['name_ko']}×{worst[1][1]['name_ko']} "
      f"{km2(worst[0][0].intersection(worst[1][0])):.6f}")
print(f"  바다 침범(육지 밖): {sum(km2(g.difference(land)) for g, _ in FEATURES):.6f}")

print("\n이음선(하천 조각 사이 직선 보간, km)")
for label, d, a, b in sorted(gaps, key=lambda x: -x[1]):
    if d > 1:
        print(f"  {label:<12}{d:>8.1f}  {a} → {b}")

# 자체검증: 면적 함수·겹침·바다·용량. 하나라도 깨지면 산출물을 쓰면 안 된다.
assert abs(km2(box(-180, -90, 180, 90)) - 510_065_622) / 510_065_622 < 0.001, "구면 면적 함수 오류"
assert abs(km2(box(0, 0, 1, 1)) - 12_363) < 5, "1°×1° 적도 칸 면적 오류"
for g, props in FEATURES:
    assert not g.is_empty and g.is_valid, props["id"]
    assert km2(g.intersection(canon_u)) < 1.0, f"{props['id']} 정본 겹침"
    assert km2(g.intersection(gallia_u)) < 1.0, f"{props['id']} 자유 갈리아 겹침"
    assert km2(g.difference(land)) < 1.0, f"{props['id']} 바다 침범"
for (ga, pa), (gb, pb) in pairs:
    assert km2(ga.intersection(gb)) < 1.0, f"{pa['id']}×{pb['id']} 겹침"
assert raw < 40_000, f"raw {raw} > 40kB 예산"
print("\nOK — 자체검증 통과")
