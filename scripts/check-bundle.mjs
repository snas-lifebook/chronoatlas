// scripts/check-bundle.mjs: 초기 JS 예산 게이트. postbuild에서 돈다(OVERHAUL §3.4 P0·P1, R46).
// 예산을 넘으면 빌드가 실패한다. 동적 청크(token3d·mediabunny·미시지도·전투)는 별개로 찍기만 한다.
// 측정은 gzip -9. 2026-09-17 실측 491.8 kB(문서의 399.6은 측정법이 달랐다). 바닥은 maplibre 243 + react 60 + astryx 58 = 361.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'assets');
const LIMIT = Number(process.env.BUNDLE_LIMIT ?? 450) * 1000; // 래칫: 480(471.7) → P1 미시지도 지연 로드 뒤 450(443.7) → 대륙 교보재 청크 뒤 400
const files = readdirSync(DIR).filter(f => f.endsWith('.js'));
const rows = files.map(f => [f, gzipSync(readFileSync(join(DIR, f)), { level: 9 }).length]).sort((a, b) => b[1] - a[1]);
for (const [f, gz] of rows) console.log(`${(gz / 1000).toFixed(1).padStart(7)} kB gz  ${f}`);
const initial = rows.find(([f]) => /^index-/.test(f));
if (!initial) { console.error('index-*.js 가 없다'); process.exit(1); }
if (initial[1] > LIMIT) { console.error(`초기 JS ${(initial[1] / 1000).toFixed(1)} kB gz > 예산 ${LIMIT / 1000} kB`); process.exit(1); }
console.log(`초기 JS ${(initial[1] / 1000).toFixed(1)} kB gz ≤ ${LIMIT / 1000} kB  ok`);
