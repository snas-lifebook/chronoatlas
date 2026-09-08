import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 프로젝트 사이트는 /chronoatlas/ 서브경로에서 서빙된다.
// 빌드 때만 base를 주고(dev는 / 유지). 데이터셋 fetch는 main.tsx가 import.meta.env.BASE_URL로 맞춘다.
// MapLibre 6 워커·shared(assets/maplibre-gl-*.mjs)는 번들러가 안 복사한다 → package.json postbuild가 cp. 빠지면 지도가 빈 화면.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/chronoatlas/' : '/',
  plugins: [react()],
}));
