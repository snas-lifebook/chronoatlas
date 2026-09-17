import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// MODELS.md의 zod 생성 블록이 스키마와 같은지(OVERHAUL §3.6d P-Z). 다르면 scripts/models-diagram.mjs를 다시 돌린다.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
describe('모델 도식 (P-Z)', () => {
  it('MODELS.md 생성 블록이 schema/*.ts 와 같다', () => {
    const out = execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', join(ROOT, 'scripts', 'models-diagram.mjs'), '--check'], { encoding: 'utf8' });
    expect(out).toContain('최신');
  });
});
