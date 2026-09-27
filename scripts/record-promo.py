#!/usr/bin/env python3
"""홍보 모션그래픽 영상 2판(2026-09-27). 기획서: 볼트 Works/크로노아틀라스/20260927_홍보영상_기획서.md(아틀라스)·
20260927_자료실_홍보영상_기획서.md(자료실).

    python3 scripts/record-promo.py atlas            # 녹화 → 3D 덱(블렌더) → 음악 → promo/out/atlas/final.mp4
    python3 scripts/record-promo.py library
    python3 scripts/record-promo.py atlas --only search,board   # 일부 구간만 다시 찍고 다시 잇기

문법(첨부 프롬프트에서 가져옴): 132 BPM · 4/4 · 32마디(58.2초) 격자에 모든 컷을 마디 첫 박에 맞춘다 · 문구는 샷마다 한 줄 ·
음악·효과음은 promo/music.py가 새로 합성 · 3D는 블렌더(promo/deck.py)가 투명 시퀀스로 렌더해 2D에 합성.
화질: 1280×720 화면을 DPR 2(2560×1440)로 CDP 스크린캐스트 → 1080p로 내린다. 화면 재료가 1.5배 커지고 또렷하다.
"""
import base64, json, os, shutil, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
ATLAS = os.environ.get('ATLAS', 'https://snas-lifebook.github.io/chronoatlas/')
LIB = os.environ.get('LIB', 'https://roma-library.pages.dev/')
VW, VH, DPR = 1280, 720, 2
BPM = 132; BEAT = 60 / BPM; BAR = BEAT * 4
OVERLAY = (ROOT / 'promo' / 'overlay.js').read_text(encoding='utf-8')
BLENDER = shutil.which('blender') or '/Applications/Blender.app/Contents/MacOS/Blender'


class Shot:
    """한 구간의 녹화기. 준비(로딩)는 찍지 않고, go() 뒤부터 스크린캐스트 프레임을 받은 시각과 함께 쌓는다."""
    def __init__(self, page, d: Path):
        self.page, self.d, self.frames, self.events = page, d, [], []
        d.mkdir(parents=True, exist_ok=True)
        for f in d.glob('*.jpg'): f.unlink()
        self.cdp = page.context.new_cdp_session(page)
        self.cdp.on('Page.screencastFrame', self._frame)
        self.t0 = None

    def _frame(self, p):
        now = time.time(); path = self.d / f'{len(self.frames):06d}.jpg'
        path.write_bytes(base64.b64decode(p['data'])); self.frames.append((now, path))
        try: self.cdp.send('Page.screencastFrameAck', {'sessionId': p['sessionId']})
        except Exception: pass

    def go(self):
        self.cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 92, 'maxWidth': VW * DPR, 'maxHeight': VH * DPR, 'everyNthFrame': 1})
        self.t0 = time.time(); js(self.page, "pm.progress(0.0001)")   # 첫 프레임을 당긴다

    def mark(self, kind):
        self.events.append((kind, time.time() - self.t0))

    def stop(self):
        self.page.wait_for_timeout(200); self.t1 = time.time()
        self.cdp.send('Page.stopScreencast')


def js(page, code, *a):
    return page.evaluate(code, *a) if a else page.evaluate(code)


def beats(page, n):
    page.wait_for_timeout(int(n * BEAT * 1000))


def bb(page, sel):
    b = page.locator(sel).first.bounding_box() if page.locator(sel).count() else None
    return b


def slide(page, sel, a, b, n_beats, fps=8):
    """range input을 a→b로. 초당 fps번만 바꾼다(프레임마다 바꾸면 지도 층이 옛 해에 멈춘다)."""
    box = bb(page, sel)
    if not box: beats(page, n_beats); return
    lo = float(page.locator(sel).first.get_attribute('min') or 0); hi = float(page.locator(sel).first.get_attribute('max') or 1)
    dur = n_beats * BEAT; t0 = time.time()
    while True:
        k = min(1.0, (time.time() - t0) / dur)   # 벽시계 기준: 명령 지연이 쌓여도 정해진 박 안에 끝난다
        e = 2 * k * k if k < .5 else 1 - (-2 * k + 2) ** 2 / 2; v = round(a + (b - a) * e)
        js(page, """([sel,v]) => { const el = document.querySelector(sel); if (!el) return;
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, String(v));
            el.dispatchEvent(new Event('input',{bubbles:true})); }""", [sel, v])
        js(page, f"pm.ring({box['x'] + (v - lo) / (hi - lo) * box['width']},{box['y'] + box['height'] / 2})")
        if k >= 1: break
        page.wait_for_timeout(int(1000 / fps))
    js(page, "pm.ringOff()")


def wait_map(page, extra=3000):
    page.wait_for_selector('canvas', timeout=60000)
    try: page.wait_for_load_state('networkidle', timeout=45000)
    except Exception: pass
    page.wait_for_timeout(extra)


def fold(page):
    b = page.locator('[aria-label="접기"]')
    if b.count(): b.first.click(); page.wait_for_timeout(400)


def tex(page, out: Path, name):
    out.mkdir(parents=True, exist_ok=True)
    js(page, "document.getElementById('pm').style.visibility='hidden'"); page.wait_for_timeout(150)
    page.screenshot(path=str(out / f'{name}.png'))
    js(page, "document.getElementById('pm').style.visibility=''")


SCROLL = """(dy) => { const els = [document.scrollingElement, ...document.querySelectorAll('main, [class*=scroll], div')]
  .filter(e => e && e.scrollHeight > e.clientHeight + 40 && (e === document.scrollingElement || /auto|scroll/.test(getComputedStyle(e).overflowY)));
  const el = els.sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement; el.scrollBy({top: dy, behavior: 'smooth'}); }"""


def scroll(page, dy):
    js(page, SCROLL, dy)


def cover(page):
    js(page, "pm.card('<div></div>')")


# ── 아틀라스 ────────────────────────────────────────────
def a_hook(page, s, T):
    page.set_content('<html><head></head><body style="margin:0;background:#0b0a09"></body></html>'); js(page, "pm.mount(); pm.cardOff()")
    yield
    js(page, "pm.title('', '로마 천 년,|지도 한 장 위에서', '', 132)"); beats(page, 8)


def a_deck(page, s, T):
    # 3D 덱 뒤에 깔 바탕: 아래쪽 한 줄만. 카드는 블렌더가 얹는다
    page.set_content('<html><head></head><body style="margin:0;background:#0b0a09"></body></html>'); js(page, "pm.mount()")
    yield
    js(page, """pm.card(`<div style="position:absolute;left:0;right:0;bottom:120px;text-align:center">
      <div class="kt" style="font-size:64px;margin:0 auto">${['책','속','사람·장소·사건이','그','해','그','자리에'].map((w,i)=>`<span class="w"><span style="transition-delay:${(.6+i*.08).toFixed(2)}s">${w}</span></span>`).join('')}</div></div>`)""")
    beats(page, 16)


def a_year(page, s, T):
    page.goto(ATLAS + '?y=-270&c=13,39,4.2&layers=territory,settlements,people,relief,rivers,labels&skin=campaign')
    cover(page); wait_map(page, 3500); fold(page); tex(page, T, 'year')
    yield
    js(page, "pm.cardOff()"); beats(page, 2)
    js(page, "pm.lower('연도를 끌면 판도가 바뀝니다', 'BC 270 → AD 117')"); beats(page, 2)
    slide(page, '.shell-slider', -270, 117, 12)
    js(page, f"pm.zoom({VW*0.55},{VH*0.45},1.35)"); beats(page, 6); js(page, "pm.zoom(0,0,1); pm.lowerOff()"); beats(page, 2)


def a_present(page, s, T):
    page.goto(ATLAS + '?present=1&scene=p345-alps-218'); cover(page); wait_map(page, 3500); tex(page, T, 'present')
    yield
    js(page, "pm.cardOff(); pm.chip('발표 모드')"); beats(page, 2)
    js(page, "pm.lower('발표는 장면을 넘기기만', '알프스 · BC 218')")
    b = bb(page, '.shell-year-brief')
    if b: js(page, f"pm.zoom({b['x']+b['width']/2},{b['y']+b['height']/2},1.45)")
    beats(page, 6); js(page, "pm.zoom(0,0,1)"); beats(page, 2)
    s.mark('click'); page.keyboard.press(']'); js(page, "pm.lower('장면마다 낭독 문장과 사료 근거', '칸나이 · BC 216')"); beats(page, 6)
    s.mark('click'); page.keyboard.press(']'); page.keyboard.press(']'); js(page, "pm.lower('[ ] 키 하나로 다음 장면', '자마 · BC 202')"); beats(page, 6)
    js(page, "pm.lowerOff(); pm.chip('')")


def a_board(page, s, T):
    page.goto(ATLAS + '?present=1&scene=zama-202'); cover(page); wait_map(page, 5000); tex(page, T, 'board')
    yield
    js(page, "pm.cardOff()"); beats(page, 1)
    js(page, "pm.lower('전투는 부대 단위로', '설명 카드마다 사료 구절과 사진', 'right')")
    if page.locator('.bd-slider').count():
        el = page.locator('.bd-slider').first
        slide(page, '.bd-slider', float(el.get_attribute('min') or 0), float(el.get_attribute('max') or 100), 9)
    card = bb(page, '.ca-card')
    if card: js(page, f"pm.zoom({card['x']+card['width']/2},{card['y']+card['height']/2},1.7)")
    beats(page, 7); js(page, "pm.zoom(0,0,1); pm.lowerOff()"); beats(page, 3)


def a_search(page, s, T):
    page.goto(ATLAS + '?y=-44&c=12,42,4.4'); cover(page); wait_map(page, 3500); fold(page)
    yield
    js(page, "pm.cardOff()"); beats(page, 1)
    js(page, "pm.lower('초성만 쳐도 찾습니다', 'ㅋㅇㅅㄹ')"); page.keyboard.press('Meta+k'); beats(page, 1)
    b = bb(page, '.shell-search')
    if b: js(page, f"pm.zoom({b['x']+b['width']/2},{b['y']+60},1.6)")
    for ch in 'ㅋㅇㅅㄹ':
        s.mark('click'); page.keyboard.insert_text(ch); beats(page, 1)
    beats(page, 1); s.mark('click'); page.keyboard.press('Enter'); js(page, "pm.zoom(0,0,1)"); beats(page, 1)
    js(page, "pm.lower('카이사르', '누구와 어떤 사이였는지, 그 해의 자리')")
    ins = bb(page, '.shell-inspector, [class*=inspector]')
    if ins: js(page, f"pm.zoom({ins['x']+ins['width']/2},{ins['y']+ins['height']*0.35},1.5)")
    beats(page, 6); js(page, "pm.zoom(0,0,1); pm.lowerOff()")


def a_link(page, s, T):
    page.goto(LIB + 'objects/person/%EC%B9%B4%EC%9D%B4%EC%82%AC%EB%A5%B4'); cover(page)
    page.wait_for_load_state('networkidle'); page.wait_for_timeout(1200); tex(page, T, 'library')
    link = page.locator('a.atlas-link').first; link.scroll_into_view_if_needed(); page.wait_for_timeout(300)
    yield
    js(page, "pm.cardOff(); pm.lower('자료실에서 읽다가', '「지도에서 보기」 한 번')"); beats(page, 2)
    b = bb(page, 'a.atlas-link')
    if b:
        js(page, f"pm.zoom({b['x']+b['width']/2},{b['y']},1.5)"); beats(page, 1)
        js(page, f"pm.ring({b['x']+b['width']/2},{b['y']+b['height']/2},true)"); beats(page, 2); s.mark('click'); js(page, "pm.tap()"); beats(page, 1)
    js(page, "pm.zoom(0,0,1); pm.ringOff()"); beats(page, 2)


def a_end(page, s, T):
    page.set_content('<html><head></head><body style="margin:0;background:#0b0a09"></body></html>'); js(page, "pm.mount()")
    yield
    s.mark('stamp'); js(page, "pm.end('크로노아틀라스', ['snas-lifebook.github.io/chronoatlas'])"); beats(page, 8)


ATLAS_FILM = dict(accent=('#f0a45c', '#2f5dab'), deck=[('year', '연도'), ('present', '발표'), ('board', '전투'), ('library', '자료실')],
                  shots=[('hook', 2, a_hook), ('deck', 4, a_deck), ('year', 6, a_year), ('present', 6, a_present),
                         ('board', 5, a_board), ('search', 4, a_search), ('link', 3, a_link), ('end', 2, a_end)])


# ── 자료실 ─────────────────────────────────────────────
def l_hook(page, s, T):
    page.set_content('<html><head></head><body style="margin:0;background:#0b0a09"></body></html>'); js(page, "pm.mount(); pm.cardOff()")
    yield
    js(page, "pm.title('', '읽다가 막히면,|여기서 찾습니다', '', 132)"); beats(page, 8)


def l_deck(page, s, T):
    page.set_content('<html><head></head><body style="margin:0;background:#0b0a09"></body></html>'); js(page, "pm.mount()")
    yield
    js(page, """pm.card(`<div style="position:absolute;left:0;right:0;bottom:120px;text-align:center">
      <div class="kt" style="font-size:64px;margin:0 auto">${['로마제국쇠망사','30포인트를','읽고','찾고','가져가는','자료실'].map((w,i)=>`<span class="w"><span style="transition-delay:${(.6+i*.08).toFixed(2)}s">${w}</span></span>`).join('')}</div></div>`)""")
    beats(page, 16)


def l_read(page, s, T):
    page.goto(LIB + 'read/point/6'); cover(page); page.wait_for_load_state('networkidle'); page.wait_for_timeout(1500); tex(page, T, 'read')
    yield
    js(page, "pm.cardOff(); pm.lower('맡은 포인트를 바로 읽고', '포인트 06 · 천적과의 전쟁')"); beats(page, 4)
    for _ in range(6):
        scroll(page, 240); beats(page, 1)
    js(page, "pm.lower('본문에 나온 인물이 옆에', '누르면 그 인물 화면으로')")
    m = bb(page, 'aside')
    if m: js(page, f"pm.zoom({m['x']+m['width']/2},{VH*0.4},1.5)")
    for _ in range(4):
        scroll(page, 200); beats(page, 2)
    js(page, "pm.zoom(0,0,1); pm.lowerOff()"); beats(page, 2)


def l_object(page, s, T):
    page.goto(LIB + 'objects/person/%EC%B9%B4%EC%9D%B4%EC%82%AC%EB%A5%B4'); cover(page); page.wait_for_load_state('networkidle'); page.wait_for_timeout(1200); tex(page, T, 'object')
    yield
    js(page, "pm.cardOff(); pm.lower('모르는 이름은 누르면 나옵니다', '객체 672 · 관계 730')"); beats(page, 4)
    if page.locator('.ego-graph').count():
        js(page, "document.querySelector('.ego-graph').scrollIntoView({behavior:'smooth',block:'center'})"); beats(page, 2)
    g = bb(page, '.ego-graph')
    if g: js(page, f"pm.zoom({g['x']+g['width']/2},{g['y']+g['height']/2},1.5)")
    beats(page, 6); js(page, "pm.zoom(0,0,1)"); beats(page, 4); js(page, "pm.lowerOff()"); beats(page, 4)


def l_family(page, s, T):
    page.goto(LIB + 'objects/family/%EC%95%84%EC%9A%B0%EA%B5%AC%EC%8A%A4%ED%88%AC%EC%8A%A4'); cover(page); page.wait_for_load_state('networkidle'); page.wait_for_timeout(1500); tex(page, T, 'family')
    yield
    js(page, "pm.cardOff(); pm.lower('헷갈리는 가문은 가계도로', '아우구스투스 가문')"); beats(page, 4)
    js(page, f"pm.zoom({VW*0.5},{VH*0.5},1.35)"); page.mouse.wheel(0, 300); beats(page, 6); js(page, "pm.zoom(0,0,1); pm.lowerOff()"); beats(page, 6)


def l_ai(page, s, T):
    page.goto(LIB + 'use/recipes'); cover(page); page.wait_for_load_state('networkidle'); page.wait_for_timeout(1200); tex(page, T, 'ai')
    yield
    js(page, "pm.cardOff(); pm.lower('쓰던 AI에 붙여넣기', '활용 사례 · 프롬프트 그대로')"); beats(page, 4)
    for _ in range(4):
        scroll(page, 260); beats(page, 2)
    js(page, "pm.lower('발표용 표는 시트로 가져가기', '가져가기')"); beats(page, 6); js(page, "pm.lowerOff()"); beats(page, 2)


def l_map(page, s, T):
    page.goto(LIB + 'objects/person/%EC%B9%B4%EC%9D%B4%EC%82%AC%EB%A5%B4'); cover(page); page.wait_for_load_state('networkidle'); page.wait_for_timeout(1000)
    link = page.locator('a.atlas-link').first; link.scroll_into_view_if_needed(); page.wait_for_timeout(300)
    yield
    js(page, "pm.cardOff(); pm.lower('그리고 지도로', '크로노아틀라스와 같은 자료 한 벌')"); beats(page, 2)
    b = bb(page, 'a.atlas-link')
    if b:
        js(page, f"pm.zoom({b['x']+b['width']/2},{b['y']},1.5)"); beats(page, 1)
        js(page, f"pm.ring({b['x']+b['width']/2},{b['y']+b['height']/2},true)"); beats(page, 2); s.mark('click'); js(page, "pm.tap()"); beats(page, 1)
    js(page, "pm.zoom(0,0,1); pm.ringOff()"); page.goto(ATLAS + '?sel=person%3A%EC%B9%B4%EC%9D%B4%EC%82%AC%EB%A5%B4'); wait_map(page, 2500); fold(page)
    js(page, "pm.lower('크로노아틀라스 · 카이사르', '')"); beats(page, 4); js(page, "pm.lowerOff()")


def l_end(page, s, T):
    page.set_content('<html><head></head><body style="margin:0;background:#0b0a09"></body></html>'); js(page, "pm.mount()")
    yield
    s.mark('stamp'); js(page, "pm.end('로마쇠망사 자료실', ['roma-library.pages.dev'])"); beats(page, 8)


LIB_FILM = dict(accent=('#36c2d6', '#2f5dab'), deck=[('read', '읽기'), ('object', '찾아보기'), ('family', '가계도'), ('ai', 'AI 활용')],
                shots=[('hook', 2, l_hook), ('deck', 4, l_deck), ('read', 6, l_read), ('object', 5, l_object),
                       ('family', 4, l_family), ('ai', 5, l_ai), ('map', 4, l_map), ('end', 2, l_end)])
FILMS = {'atlas': ATLAS_FILM, 'library': LIB_FILM}


def encode_shot(fr, t0, t1, n_bars, out: Path):
    """받은 시각대로 가변 프레임 → 30fps 고정 · 정확히 n마디 길이(모자라면 마지막 프레임을 늘린다)."""
    lst = out.with_suffix('.txt'); L = []
    for i, (t, p) in enumerate(fr):
        nxt = fr[i + 1][0] if i + 1 < len(fr) else t1
        d = max(0.001, nxt - (t0 if i == 0 else t)); L.append(f"file '{p}'\nduration {d:.4f}\n")
    L.append(f"file '{fr[-1][1]}'\n")
    lst.write_text(''.join(L))
    dur = n_bars * BAR
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(lst),
                    '-vf', f'fps=30,scale=1920:1080:flags=lanczos,tpad=stop_mode=clone:stop_duration={dur}', '-t', f'{dur:.4f}',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', str(out)], check=True)


def main() -> int:
    film = sys.argv[1] if len(sys.argv) > 1 else 'atlas'; F = FILMS[film]
    only = set(sys.argv[sys.argv.index('--only') + 1].split(',')) if '--only' in sys.argv else None
    OUT = ROOT / 'promo' / 'out' / film; T = OUT / 'tex'; OUT.mkdir(parents=True, exist_ok=True)
    meta_p = OUT / 'meta.json'; meta = json.loads(meta_p.read_text()) if meta_p.exists() else {}
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=False, args=['--ignore-gpu-blocklist', f'--window-size={VW},{VH + 90}'])
        for name, n_bars, fn in F['shots']:
            if only and name not in only: continue
            ctx = b.new_context(viewport={'width': VW, 'height': VH}, device_scale_factor=DPR, locale='ko-KR')
            ctx.add_init_script(OVERLAY + f"\n;document.addEventListener('DOMContentLoaded',()=>window.pm&&pm.accent('{F['accent'][0]}','{F['accent'][1]}'));")
            page = ctx.new_page(); s = Shot(page, OUT / 'frames' / name)
            g = fn(page, s, T); next(g); js(page, f"pm.accent('{F['accent'][0]}','{F['accent'][1]}')")
            s.go()
            for _ in g: pass
            s.stop(); ctx.close()
            encode_shot(s.frames, s.t0, s.t1, n_bars, OUT / f'{name}.mp4')
            meta[name] = {'events': s.events, 'frames': len(s.frames), 'real': round(s.t1 - s.t0, 2), 'bars': n_bars}
            print(name, f"{len(s.frames)} frames, real {s.t1 - s.t0:.1f}s → {n_bars * BAR:.2f}s", flush=True)
        b.close()
    meta_p.write_text(json.dumps(meta, ensure_ascii=False))

    # 3D 덱(블렌더) → 덱 구간 위에 합성
    deck_dir = OUT / 'deck'
    if not (deck_dir / 'done').exists() or (only and 'deck' in only):
        labels = [(str(T / f'{k}.png'), lab) for k, lab in F['deck']]
        subprocess.run([sys.executable, str(ROOT / 'promo' / 'deck_tex.py'), str(deck_dir), F['accent'][0], json.dumps(labels, ensure_ascii=False)], check=True)
        subprocess.run([BLENDER, '-b', '--factory-startup', '-P', str(ROOT / 'promo' / 'deck.py'), '--', str(deck_dir), str(int(4 * BAR * 30))],
                       check=True, stdout=subprocess.DEVNULL)
        (deck_dir / 'done').write_text('ok')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(OUT / 'deck.mp4'), '-framerate', '30', '-i', str(deck_dir / 'r_%04d.png'),
                    '-filter_complex', '[0][1]overlay=0:-40:shortest=1', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p',
                    str(OUT / 'deck_c.mp4')], check=True)

    # 잇기 + 음악(컷마다 휙, 기록한 클릭·도장을 박에 맞춰)
    parts, cues, bar = [], {'whoosh': [], 'click': [], 'stamp': []}, 0
    for name, n_bars, _ in F['shots']:
        parts.append(OUT / ('deck_c.mp4' if name == 'deck' else f'{name}.mp4'))
        if bar: cues['whoosh'].append(bar)
        for kind, t in meta.get(name, {}).get('events', []):
            cues[kind].append(round(bar + t / BAR, 3))
        bar += n_bars
    (OUT / 'list.txt').write_text(''.join(f"file '{p}'\n" for p in parts))
    subprocess.run([sys.executable, str(ROOT / 'promo' / 'music.py'), film, str(OUT / 'music.wav'), json.dumps(cues)], check=True)
    final = OUT / 'final.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(OUT / 'list.txt'), '-i', str(OUT / 'music.wav'),
                    '-af', 'loudnorm=I=-16:TP=-1.5', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-maxrate', '3M', '-bufsize', '6M',
                    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', str(final)], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '4', '-i', str(final), '-frames:v', '1', '-q:v', '3', str(OUT / 'poster.jpg')], check=True)
    print('OUT', final)
    return 0


if __name__ == '__main__':
    sys.exit(main())
