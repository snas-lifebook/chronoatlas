import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';

// MapLibre 위 Three.js 장기말. 경로 폴리라인을 따라 행군한다(Rome: Total War 캠페인 맵).
// 뱃지(초상 원)는 줌 4에서 10px도 안 된다. 말은 화면 픽셀을 거의 일정하게 유지한다.
// 탑다운 = 장기 팔각 + 글자. pitch = 폰 실루엣.

const ANIM_MS = 1200; // 북마크 점프가 텔레포트로 안 읽히게. 연도 슬라이더도 같은 속도로 걷는다.
const SCREEN_PX = 60; // 지중해 줌에서 말 한 알.
const M_PER_PX_Z0 = 40075016.686 / 512; // Web Mercator, 512px 타일
// 발표 시점이 지중해 전역(z4.2)으로 고정돼 있어 여기서는 **상한이 실제로 물린다.**
// 옛 상한 180km는 말을 받침 57px로 눌러 얼굴이 안 보였고, 360km는 115px로 판을 덮었다
// (River가 두 번 "너무 크다"). 145km면 받침 ~46px · 얼굴 ~31px — 얼굴은 알아보이고 판은 안 덮는다.
// 하한 14000m은 줌 천장이 9였을 때의 값이다. 천장을 15로 올리자 z12.4에서 말이
// 972px가 되어 알레시아 포위선을 통째로 덮었다. 하한은 「너무 작아져 사라지는 것」만
// 막으면 되고, 크기 유지는 상한이 한다. 120m이면 z15에서도 ~67px다.
const MIN_M = 120, MAX_M = 145000;

/** `scale`은 주역 1, 조역 0.62다(people.COMPANION_SCALE). **상·하한을 물린 뒤에 곱한다** —
 *  먼저 곱하면 상한 145km에 조역도 같이 걸려서 주역과 같은 크기가 되어 버린다.
 *  지중해 줌(z4.2)이 정확히 그 상한에 걸리는 자리라, 순서를 바꾸면 차등이 통째로 사라진다. */
export function tokenMeters(zoom: number, scale = 1): number {
  const m = (M_PER_PX_Z0 / Math.pow(2, zoom)) * SCREEN_PX;
  return Math.max(MIN_M, Math.min(MAX_M, m)) * scale;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function pointsEqual(a: [number, number], b: [number, number]) {
  return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
}

function walkRoute(route: [number, number][], from: [number, number], to: [number, number]): [number, number][] {
  const iFrom = route.findIndex(p => pointsEqual(p, from));
  const iTo = route.findIndex(p => pointsEqual(p, to));
  if (iFrom === -1 || iTo === -1 || iFrom === iTo) return [from, to];
  return iFrom < iTo ? route.slice(iFrom, iTo + 1) : route.slice(iTo, iFrom + 1).reverse();
}

/** 로마 숫자(명패). 1~39면 충분하다(군단 수). */
export function roman(n: number): string {
  if (!(n > 0)) return '';
  const t: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = ''; let v = Math.min(39, Math.floor(n));
  for (const [k, r] of t) while (v >= k) { out += r; v -= k; }
  return out;
}
/** 명패 텍스처: 양피지 판에 먹색 로마 숫자. 캔버스라 글리프 파일이 필요 없다. */
function plaqueTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#EFE8D4'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#8C7B55'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 88);
  g.fillStyle = '#2B2419'; g.font = '700 62px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 52);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function pieceMesh(color: string, portrait?: string | null, onTexture?: () => void, emblem?: string | null) {
  const mat = new THREE.MeshBasicMaterial({ color });
  const dark = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.72).getHex() });
  const ring = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const group = new THREE.Group();

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.14, 24), dark);
  plinth.position.y = 0.07;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.58, 0.34, 8), mat);
  body.position.y = 0.31;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.05, 8), ring);
  rim.position.y = 0.50;
  // 세력색 테 — 얼굴 판을 두른다. 누구 편인지는 색이 말하고, 누구인지는 얼굴이 말한다.
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.07, 32), mat);
  bezel.position.y = 0.54;
  group.add(plinth, body, rim, bezel);

  // **얼굴 판.** 정본 초상(`assets/portraits/*.webp`)을 말 윗면에 얹는다.
  //
  // 초상 뱃지는 한 번 퇴짜맞은 적이 있다(PACK-CAESAR §5 「줌 4에서 ~10px」). 그건 MapLibre
  // icon-image라 **화면 고정 크기**였기 때문이고, 여기서는 말의 일부라 `tokenMeters`를 따라
  // 커진다 — 지중해 줌에서도 얼굴이 말 지름만큼(≈87 CSS px) 나온다. 같은 그림, 다른 자리.
  //
  // 윗면인 이유는 발표 시점이 탑다운(pitch 0)이라서다. 위에서 내려다보면 이 면이 정면이다.
  // 초상이 없으면 **흰 원반**이 남는다. 로마 시내 판에서 카스카가 정확히 그 모양으로
  // 떴다 — 얼굴 없는 흰 동전 하나가 도시 한복판에 놓인다. 초상이 없을 때는 세력색으로
  // 칠해 적어도 「누구 편인가」는 말하게 한다.
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 48),
    new THREE.MeshBasicMaterial({ color: portrait ? 0xffffff : new THREE.Color(color).multiplyScalar(0.85).getHex() }));
  face.rotation.x = -Math.PI / 2;   // 국소 +y(말의 위)를 보게
  face.position.y = 0.58;
  group.add(face);
  if (portrait) {
    new THREE.TextureLoader().load(portrait, tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      (face.material as THREE.MeshBasicMaterial).map = tex;
      (face.material as THREE.MeshBasicMaterial).needsUpdate = true;
      onTexture?.();
    }, undefined, () => { /* 초상이 없으면 흰 판으로 남는다 */ });
  }
  // three +y(위) → mercator +z(고도). 모델 행렬이 y를 뒤집어 쓰므로(.scale(s,-s,s))
  // 부호는 **+**다. -로 두면 말이 서지 않고 **땅에 누워** 받침에서 머리로 가는
  // 물방울 실루엣이 된다 — 9/12 캡처 넷이 다 그 모양이었다(docs/verify/pack-rubicon.png).
  // ── 군기 (OVERHAUL-II §3.5, R51): 말 뒤(-z)에 깃대 + 깃발. 발표 시점이 탑다운이라 깃발은 뒤로 눕혀(52도) 위에서도 면이 보이게 한다.
  const ink = new THREE.MeshBasicMaterial({ color: 0x2b2419 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.2, 8), ink);
  pole.position.set(0, 0.6, -0.62);
  const flag = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.38), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  cloth.position.set(0.3, 0, 0);
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.05), new THREE.MeshBasicMaterial({ color: 0xEFE8D4, side: THREE.DoubleSide }));
  edge.position.set(0.3, -0.19, 0.002);
  // 명패(로마 숫자)는 깃발 아랫단에 붙인다. 말 앞에 두면 이름표(people-label)와 겹쳤다(QA 2026-09-17 최대 판도 44 「XVI」)
  const plaqueMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.14), plaqueMat);
  plaque.position.set(0.3, -0.15, 0.004); plaque.visible = false;
  flag.add(cloth, edge, plaque);
  if (emblem) {   // 세력 문장(있는 세력만). 흰 재질에 텍스처라 문장 색이 그대로 나온다
    const em = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide }));
    em.position.set(0.3, 0.02, 0.004); flag.add(em);
    new THREE.TextureLoader().load(emblem, tex => { tex.colorSpace = THREE.SRGBColorSpace; (em.material as THREE.MeshBasicMaterial).map = tex; (em.material as THREE.MeshBasicMaterial).needsUpdate = true; onTexture?.(); }, undefined, () => {});
  }
  flag.position.set(0.02, 1.0, -0.62); flag.rotation.x = -0.9;   // 뒤로 눕힌다(52도)
  group.add(pole, flag);
  // ── 군단 무리: 장군 뒤 4열 대형. 채우는 것은 setLegions. z6~10에서만 render가 보인다(LOD: 지중해 줌에서는 얼룩, 도시 줌에서는 지도를 덮는다)
  const cluster = new THREE.Group(); cluster.name = 'cluster';
  group.add(cluster);
  group.userData.plaque = plaque; group.userData.plaqueMat = plaqueMat; group.userData.cluster = cluster; group.userData.mat = mat; group.userData.dark = dark;
  group.rotation.x = Math.PI / 2;
  return group;
}

let tokenSeq = 0;

export type Token = ReturnType<typeof createToken>;
export function createToken(color: string, name = '', portrait?: string | null, scale = 1, opts: { emblem?: string | null } = {}) {
  const camera = new THREE.Camera();
  const scene = new THREE.Scene();
  let renderer: THREE.WebGLRenderer | null = null;
  let map: maplibregl.Map | null = null;
  // 초상은 비동기로 온다. 도착하면 한 프레임 더 돌려야 얼굴이 실제로 찍힌다.
  const group = pieceMesh(color, portrait, () => map?.triggerRepaint(), opts.emblem);
  let legions = 0;
  group.userData.name = name;
  scene.add(group);

  let pos: [number, number] | null = null;
  let route: [number, number][] = [];
  let animPath: [number, number][] | null = null;
  let animCum: number[] = [];
  let animStart = 0;
  let rafId: number | null = null;

  function tick() {
    rafId = null;
    if (!animPath) return;
    const total = animCum[animCum.length - 1];
    const t = Math.min(1, (performance.now() - animStart) / ANIM_MS);
    const e = easeOutCubic(t);
    if (total === 0) {
      pos = animPath[animPath.length - 1];
    } else {
      const target = total * e;
      let i = 0;
      while (i < animCum.length - 2 && animCum[i + 1] < target) i++;
      const segStart = animCum[i], segEnd = animCum[i + 1];
      const frac = segEnd > segStart ? (target - segStart) / (segEnd - segStart) : 1;
      const a = animPath[i], b = animPath[i + 1];
      pos = [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
    }
    map?.triggerRepaint();
    if (t < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      pos = animPath[animPath.length - 1];
      animPath = null;
    }
  }

  const layer: maplibregl.CustomLayerInterface = {
    id: `token-${tokenSeq++}`,
    type: 'custom',
    renderingMode: '3d',
    onAdd(m, gl) {
      map = m;
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    render(_gl, args: any) {
      if (!pos || !renderer || !map) return;
      { const z = map.getZoom(); (group.userData.cluster as THREE.Group).visible = z >= 6 && z < 10; }   // 지중해 줌에서 무리는 얼룩이고, 도시 줌(로마 시내)에서는 도판을 덮는다
      const mc = maplibregl.MercatorCoordinate.fromLngLat(pos, 0);
      const s = mc.meterInMercatorCoordinateUnits() * tokenMeters(map.getZoom(), scale);
      const model = new THREE.Matrix4()
        .makeTranslation(mc.x, mc.y, mc.z)
        .scale(new THREE.Vector3(s, -s, s));
      camera.projectionMatrix = new THREE.Matrix4()
        .fromArray(args.defaultProjectionData.mainMatrix)
        .multiply(model);
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    },
  };

  return {
    layer,
    /** 군단 수(pack-legions 사료 수치). 명패에 로마 숫자, 뒤에 작은 말 무리(최대 12, 4열). 0이면 둘 다 없다. */
    setLegions(n: number) {
      if (n === legions) return;
      legions = n;
      const plaque = group.userData.plaque as THREE.Mesh, pm = group.userData.plaqueMat as THREE.MeshBasicMaterial, cluster = group.userData.cluster as THREE.Group;
      plaque.visible = n > 0;
      if (n > 0) { pm.map?.dispose(); pm.map = plaqueTexture(roman(n)); pm.needsUpdate = true; }
      for (const c of [...cluster.children]) cluster.remove(c);
      const k = Math.min(12, Math.max(0, Math.floor(n)));
      for (let i = 0; i < k; i++) {
        const col = i % 4, row = Math.floor(i / 4);
        const m = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.07, 12), group.userData.dark as THREE.Material); base.position.y = 0.035;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.2, 8), group.userData.mat as THREE.Material); body.position.y = 0.17;
        m.add(base, body); m.position.set((col - 1.5) * 0.5, 0, -(1.15 + row * 0.5));
        cluster.add(m);
      }
      map?.triggerRepaint();
    },
    legions: () => legions,
    setRoute(path: [number, number][]) {
      route = path;
    },
    setPosition(next: [number, number] | null) {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      animPath = null;
      if (next === null) {
        pos = null;
        map?.triggerRepaint();
        return;
      }
      if (pos === null) {
        pos = next;
        map?.triggerRepaint();
        return;
      }
      const wp = route.length ? walkRoute(route, pos, next) : [pos, next];
      const cum = [0];
      for (let i = 1; i < wp.length; i++) {
        cum.push(cum[i - 1] + Math.hypot(wp[i][0] - wp[i - 1][0], wp[i][1] - wp[i - 1][1]));
      }
      animPath = wp;
      animCum = cum;
      animStart = performance.now();
      rafId = requestAnimationFrame(tick);
    },
  };
}

export const createHannibalToken = createToken;
