// scripts/gen-credits.mjs: CREDITS.md + LICENSES.md를 읽을 수 있는 HTML 한 장(dist/credits.html)으로 굽는다.
// postbuild에서 돈다. 마크다운 전체가 아니라 두 파일이 쓰는 문법(제목·표·목록·코드·굵게·링크)만 안다.
// 내부 경로(볼트 Works/...)를 담은 「정본」 절은 사용자에게 필요 없어 뺀다.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const esc = s => s.replace(/ — /g, ' · ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');

export function md(src) {
  const out = []; const L = src.split('\n'); let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (/^```/.test(l)) { const b = []; i++; while (i < L.length && !/^```/.test(L[i])) b.push(L[i++]); i++; out.push(`<pre>${esc(b.join('\n'))}</pre>`); continue; }
    if (/^\|/.test(l)) {
      const rows = []; while (i < L.length && /^\|/.test(L[i])) rows.push(L[i++]);
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const [h, , ...b] = rows;
      out.push(`<div class="tw"><table><thead><tr>${cells(h).map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${b.map(r => `<tr>${cells(r).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const m = /^(#{1,3}) (.*)/.exec(l);
    if (m) { out.push(`<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`); i++; continue; }
    if (/^- /.test(l)) { const b = []; while (i < L.length && /^- /.test(L[i])) b.push(`<li>${inline(L[i++].slice(2))}</li>`); out.push(`<ul>${b.join('')}</ul>`); continue; }
    if (l.trim()) { const b = []; while (i < L.length && L[i].trim() && !/^(#|\||- |```)/.test(L[i])) b.push(L[i++]); out.push(`<p>${inline(b.join(' '))}</p>`); continue; }
    i++;
  }
  return out.join('\n');
}

// 「## 정본」 절을 통째로, 그리고 볼트 경로가 든 표 줄을 뺀다.
const dropSection = (s, title) => s.replace(new RegExp(`^## ${title}[\\s\\S]*?(?=^## |(?![\\s\\S]))`, 'm'), '');
const credits = dropSection(readFileSync(join(ROOT, 'public/assets/CREDITS.md'), 'utf8'), '정본')
  .split('\n').filter(l => !/Works\/|볼트/.test(l)).join('\n').replace(/^# .*\n/, '');
const licenses = readFileSync(join(ROOT, 'data/external/LICENSES.md'), 'utf8').replace(/^# .*\n/, '');

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>출처와 라이선스 · 크로노아틀라스</title>
<meta name="description" content="크로노아틀라스가 쓴 지도 데이터, 이미지, 글꼴의 출처와 라이선스.">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<style>
  :root { --ink: #16120f; --paper: #f5efe4; --muted: #6b6259; --line: #e4dccd; --acc: #b8651f; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.7 Pretendard, -apple-system, 'Apple SD Gothic Neo', system-ui, sans-serif; }
  main { max-width: 960px; margin: 0 auto; padding: 48px 24px 80px; }
  h1 { font-size: 34px; margin: 0 0 8px; } h2 { font-size: 22px; margin: 40px 0 10px; } h3 { font-size: 18px; }
  a { color: var(--acc); } code { font-size: .9em; background: #fffaf2; padding: 1px 4px; border-radius: 4px; word-break: break-all; }
  .tw { overflow-x: auto; } table { border-collapse: collapse; font-size: 14px; width: 100%; }
  th, td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; vertical-align: top; } th { background: #fffaf2; }
  pre { background: #fffaf2; padding: 12px; overflow-x: auto; }
  footer { margin-top: 48px; color: var(--muted); font-size: 14px; }
</style>
</head>
<body>
<main>
<h1>출처와 라이선스</h1>
<p><a href="./">지도로 돌아가기</a> · <a href="about.html">소개</a></p>
${md(credits)}
<h2>외부 데이터 목록</h2>
${md(licenses)}
<footer>산스 인생책 편데 · 크로노아틀라스</footer>
</main>
</body>
</html>
`;
writeFileSync(join(ROOT, 'dist/credits.html'), html);
console.log('dist/credits.html');
