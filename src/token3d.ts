import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';

// MapLibre 위 Three.js 장기말. 경로 폴리라인을 따라 행군한다(Rome: Total War 캠페인 맵).
// 뱃지(초상 원)는 줌 4에서 10px도 안 된다. 말은 화면 픽셀을 거의 일정하게 유지한다.
// 탑다운 = 장기 팔각 + 글자. pitch = 폰 실루엣.

const ANIM_MS = 1200; // 북마크 점프가 텔레포트로 안 읽히게. 연도 슬라이더도 같은 속도로 걷는다.
const SCREEN_PX = 64; // 지중해 줌에서 말 한 알.
const M_PER_PX_Z0 = 40075016.686 / 512; // Web Mercator, 512px 타일

export function tokenMeters(zoom: number): number {
  const m = (M_PER_PX_Z0 / Math.pow(2, zoom)) * SCREEN_PX;
  return Math.max(14000, Math.min(180000, m));
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

function pieceMesh(color: string) {
  const mat = new THREE.MeshBasicMaterial({ color });
  const dark = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.72).getHex() });
  const ring = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const group = new THREE.Group();

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.14, 24), dark);
  plinth.position.y = 0.07;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.52, 0.62, 8), mat);
  body.position.y = 0.45;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 8), ring);
  rim.position.y = 0.78;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.16, 12), dark);
  neck.position.y = 0.84;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), mat);
  head.position.y = 1.1;

  group.add(plinth, body, rim, neck, head);
  // three +y(위) → mercator +z(고도). 모델 행렬이 y를 뒤집어 쓰므로(.scale(s,-s,s))
  // 부호는 **+**다. -로 두면 말이 서지 않고 **땅에 누워** 받침에서 머리로 가는
  // 물방울 실루엣이 된다 — 9/12 캡처 넷이 다 그 모양이었다(docs/verify/pack-rubicon.png).
  group.rotation.x = Math.PI / 2;
  return group;
}

let tokenSeq = 0;

export type Token = ReturnType<typeof createToken>;
export function createToken(color: string, name = '') {
  const camera = new THREE.Camera();
  const scene = new THREE.Scene();
  const group = pieceMesh(color);
  group.userData.name = name;
  scene.add(group);

  let renderer: THREE.WebGLRenderer | null = null;
  let map: maplibregl.Map | null = null;
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
      const mc = maplibregl.MercatorCoordinate.fromLngLat(pos, 0);
      const s = mc.meterInMercatorCoordinateUnits() * tokenMeters(map.getZoom());
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
