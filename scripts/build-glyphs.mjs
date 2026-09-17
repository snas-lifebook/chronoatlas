// scripts/build-glyphs.mjs: 세리프 글리프 PBF를 레포에 굽는다(OVERHAUL-II §2·§3.3, R51). 런타임 외부 호출 0.
//   npm i --no-save fontnik && node scripts/build-glyphs.mjs
// Cinzel(OFL, google/fonts ofl/cinzel, 가변 폰트의 기본 인스턴스 400)을 폴리티 라틴 대문자 이름표용으로. 라틴 범위 0~255·256~511만.
// fontnik은 package.json에 안 둔다: 네이티브 바이너리라 CI 설치가 깨질 수 있고, 산출물(public/glyphs)이 커밋되므로 CI에 필요 없다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fontnik = require('fontnik');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = [{ name: 'Cinzel Regular', file: 'data/external/fonts/Cinzel.ttf', ranges: [0, 256] }];
for (const f of FONTS) {
  const src = join(ROOT, f.file);
  if (!existsSync(src)) { console.error(`${f.file} 없음. curl -sL -o ${f.file} "https://github.com/google/fonts/raw/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf"`); process.exit(1); }
  const font = readFileSync(src);
  const dir = join(ROOT, 'public', 'glyphs', f.name); mkdirSync(dir, { recursive: true });
  for (const start of f.ranges) {
    const pbf = await new Promise((res, rej) => fontnik.range({ font, start, end: start + 255 }, (e, b) => (e ? rej(e) : res(b))));
    writeFileSync(join(dir, `${start}-${start + 255}.pbf`), pbf);
    console.log(f.name, `${start}-${start + 255}.pbf`, pbf.length, 'B');
  }
}
