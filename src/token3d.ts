import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';

// MapLibre 위 Three.js 토큰(장군 말). 경로 폴리라인을 따라 행군한다(Rome:Total War식).
// render 매트릭스는 MapLibre v6 계약: args.defaultProjectionData.mainMatrix (문서 확인).
// 위치는 MercatorCoordinate + meterInMercatorCoordinateUnits() 스케일.

const TOKEN_METERS = 60000; // ponytail: 토큰 높이(약 60km) — zoom 3~9 가독성 튜닝 노브. 안 보이면 키운다.
const ANIM_MS = 500; // ponytail: 이동 애니메이션 총 지속시간 노브. 다중 정점 행군도 이 시간 안에 끝난다.

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function pointsEqual(a: [number, number], b: [number, number]) {
  return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
}

// pos→next 구간을 route 폴리라인 위 정점들을 따라 잇는다(직선 lerp 아님). 둘 다 route 위에 없으면 2점 직선 폴백.
function walkRoute(route: [number, number][], from: [number, number], to: [number, number]): [number, number][] {
  const iFrom = route.findIndex(p => pointsEqual(p, from));
  const iTo = route.findIndex(p => pointsEqual(p, to));
  if (iFrom === -1 || iTo === -1 || iFrom === iTo) return [from, to];
  return iFrom < iTo ? route.slice(iFrom, iTo + 1) : route.slice(iTo, iFrom + 1).reverse();
}

let tokenSeq = 0; // 인스턴스마다 고유 CustomLayer id 발급용

export type Token = ReturnType<typeof createToken>;
export function createToken(color: string) {
  const camera = new THREE.Camera();
  const scene = new THREE.Scene();
  // 장기 말 = 원뿔 + 받침 디스크. pitch 0(탑다운)에선 원으로, pitch를 주면 서 있는 말로 보인다.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 1.0, 24),
    new THREE.MeshBasicMaterial({ color }), // 조명 무관 — 항상 보임(검증 불가 환경 대비)
  );
  cone.position.y = 0.65; // 받침 위에 얹힌 원뿔
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.15, 24),
    new THREE.MeshBasicMaterial({ color }),
  );
  base.position.y = 0.075; // 바닥 받침 디스크
  const group = new THREE.Group();
  group.add(cone, base);
  group.rotation.x = -Math.PI / 2; // three +y(그룹 위) → mercator +z(위)
  scene.add(group);

  let renderer: THREE.WebGLRenderer | null = null;
  let map: maplibregl.Map | null = null;
  let pos: [number, number] | null = null; // 현재 렌더 위치(행군 중엔 매 프레임 갱신)
  let route: [number, number][] = []; // setRoute로 받은 전체 경로 폴리라인
  let animPath: [number, number][] | null = null; // 이번 행군 구간의 경유 정점들
  let animCum: number[] = []; // animPath 각 정점까지 누적 호길이
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
      pos = animPath[animPath.length - 1]; // 부동소수 오차 없이 정확히 착지
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
      if (!pos || !renderer) return; // 원정 전 연도엔 안 그림
      const mc = maplibregl.MercatorCoordinate.fromLngLat(pos, 0);
      const s = mc.meterInMercatorCoordinateUnits() * TOKEN_METERS;
      const model = new THREE.Matrix4()
        .makeTranslation(mc.x, mc.y, mc.z)
        .scale(new THREE.Vector3(s, -s, s));
      camera.projectionMatrix = new THREE.Matrix4()
        .fromArray(args.defaultProjectionData.mainMatrix)
        .multiply(model);
      renderer.resetState();
      renderer.render(scene, camera);
      map!.triggerRepaint();
    },
  };

  return {
    layer,
    /** 행군할 경로 폴리라인(연도순 [lng,lat]). setPosition이 이 정점들을 경유해 이동한다. */
    setRoute(path: [number, number][]) {
      route = path;
    },
    /** 토큰을 [lng,lat]로 이동. route가 설정돼 있으면 경유 정점을 따라 호길이 보간(직선 lerp 아님). null이면 즉시 숨김. */
    setPosition(next: [number, number] | null) {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      animPath = null;
      if (next === null) {
        pos = null; // 즉시 숨김 — render()가 pos 없으면 그리지 않음
        map?.triggerRepaint();
        return;
      }
      if (pos === null) {
        pos = next; // 첫 등장은 이징 없이 즉시 표시(이전 위치가 없음)
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

// 호환 alias — 구 API(단일 한니발 토큰) 호출부가 남아있어도 동작.
export const createHannibalToken = createToken;
