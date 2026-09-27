#!/usr/bin/env python3
"""홍보 모션그래픽 영상 녹화. 기획서: 볼트 Works/크로노아틀라스/20260927_홍보영상_기획서.md

    python3 scripts/record-promo.py            # 라이브 사이트를 조작하며 구간별 녹화 → promo/out/chronoatlas-promo.mp4
    ATLAS=http://localhost:4180/chronoatlas/ python3 scripts/record-promo.py   # 로컬 빌드로

구간마다 새 페이지로 녹화하고(페이지 이동의 흰 화면을 안 싣기 위해), 로딩 시간은 재서 잘라낸 뒤 ffmpeg로 잇는다.
모션그래픽 층은 promo/overlay.js(앱 DOM은 안 건드린다). 영상은 git에 넣지 않는다(promo/out/ gitignore).
"""
import json, os, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'promo' / 'out'; RAW = OUT / 'raw'
ATLAS = os.environ.get('ATLAS', 'https://snas-lifebook.github.io/chronoatlas/')
LIB = os.environ.get('LIB', 'https://roma-library.pages.dev/')
W, H = 1920, 1080
OVERLAY = (ROOT / 'promo' / 'overlay.js').read_text(encoding='utf-8')


def js(page, code, *a):
    return page.evaluate(code, *a) if a else page.evaluate(code)


def slide(page, sel, a, b, secs, fps=8, ring=True):
    """range input을 a→b로. 지도가 따라오게 초당 fps번만 바꾼다(프레임마다 바꾸면 제목만 바뀌고 층은 옛 해에 멈춘다).
    React onChange가 듣게 native setter + input 이벤트."""
    n = max(2, int(secs * fps))
    bb = page.locator(sel).first.bounding_box()
    lo, hi = float(page.locator(sel).first.get_attribute('min') or 0), float(page.locator(sel).first.get_attribute('max') or 1)
    for i in range(n + 1):
        k = i / n; e = 2 * k * k if k < .5 else 1 - (-2 * k + 2) ** 2 / 2
        js(page, """([sel,v]) => { const el = document.querySelector(sel); if (!el) return;
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, String(v));
            el.dispatchEvent(new Event('input',{bubbles:true})); }""", [sel, round(a + (b - a) * e)])
        if ring and bb:
            v = a + (b - a) * e; js(page, f"pm.ring({bb['x'] + (v - lo) / (hi - lo) * bb['width']},{bb['y'] + bb['height'] / 2})")
        time.sleep(1 / fps)


def clean(page):
    """넓은 화면에서 열린 채 시작하는 왼쪽 탐색 목록을 접는다(영상에서는 지도가 주인공)."""
    b = page.locator('[aria-label="접기"]')
    if b.count(): b.first.click(); time.sleep(.4)


def center(page, sel):
    bb = page.locator(sel).first.bounding_box()
    return (bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2) if bb else (W / 2, H / 2)


def wait_map(page, extra=3.0):
    page.wait_for_selector('canvas', timeout=60000)
    page.wait_for_load_state('networkidle', timeout=60000)
    time.sleep(extra)


# ── 구간 ─────────────────────────────────────────────
def seg_open(page):
    page.goto(ATLAS + '?y=-270&c=16,40,4.1&layers=territory,settlements,people,relief,rivers,labels&skin=campaign')
    js(page, "pm.title('', '로마 천 년,', '')"); wait_map(page, 4); clean(page)
    yield 'ready'
    js(page, "pm.title('SANS · 인생책 · 로마제국쇠망사', '로마 천 년, 지도 한 장 위에서', '책 속 사람·장소·사건이 그 해 그 자리에 섭니다', 120)"); time.sleep(4.2)
    js(page, "pm.cardOff()"); time.sleep(.8)
    js(page, "pm.lower('연도를 끌면 판도가 바뀝니다', 'BC 270 → AD 117 · 영토는 Cliopatria(CC BY) 자료')"); time.sleep(1.2)
    slide(page, '.shell-slider', -270, 117, 7.0); time.sleep(1.8)
    js(page, "pm.ringOff(); pm.lowerOff()"); time.sleep(.4)
    js(page, "pm.stats([{n:672,l:'사람 · 장소 · 사건'},{n:730,l:'관계'},{n:53,l:'지도 장면'}])"); time.sleep(4.2)


def seg_present(page):
    page.goto(ATLAS + '?present=1&scene=p345-alps-218')
    js(page, "pm.title('발표 모드', '발표는 장면을 넘기기만', '회차별 장면이 이미 짜여 있습니다. 주소 하나로 열고 화살표로 넘깁니다', 104)"); wait_map(page, 4)
    yield 'ready'
    time.sleep(3.6); js(page, "pm.cardOff(); pm.chip('포인트 03·04·05')"); time.sleep(.6)
    js(page, "pm.lower('한니발, 알프스를 넘다 · BC 218', '정본 경로 · 전투점 · 인물이 그 해 자리에')"); time.sleep(4.2)
    page.keyboard.press(']'); js(page, "pm.lower('칸나이 · BC 216', '장면마다 낭독 문장과 사료 근거가 붙어 있습니다')"); time.sleep(4.2)
    page.keyboard.press(']'); page.keyboard.press(']')
    js(page, "pm.lower('자마 · BC 202', '[ ] 키, 또는 화면 위 ◀ ▶')"); time.sleep(4.0)
    js(page, "pm.lowerOff(); pm.chip('')"); time.sleep(.3)


def seg_board(page):
    page.goto(ATLAS + '?present=1&scene=zama-202')
    js(page, "pm.title('세부 지도 13장', '전투는 부대 단위로', '사료 구절과 함께. 자마 · 칸나이 · 알레시아 · 악티움 …', 104)"); wait_map(page, 5)
    yield 'ready'
    time.sleep(3.4); js(page, "pm.cardOff()"); time.sleep(.6)
    js(page, "pm.lower('자마 전투 · BC 202', '막대를 끌면 국면이 움직이고, 설명 카드는 폴리비오스·리비우스 구절과 사진을 답니다', 'right')")
    if page.locator('.bd-slider').count():
        bb = page.locator('.bd-slider').first
        lo, hi = float(bb.get_attribute('min') or 0), float(bb.get_attribute('max') or 100)
        slide(page, '.bd-slider', lo, hi, 7.5); js(page, "pm.ringOff()")
    else:
        time.sleep(7.5)
    time.sleep(1.5); js(page, "pm.lowerOff()"); time.sleep(.3)


def seg_search(page):
    page.goto(ATLAS + '?y=-44&c=12,42,4.6')
    js(page, "pm.title('찾기', '초성만 쳐도 찾습니다', '인물을 고르면 누구와 어떤 사이였는지가 연도와 함께', 104)"); wait_map(page, 4); clean(page)
    yield 'ready'
    time.sleep(3.4); js(page, "pm.cardOff()"); time.sleep(.5); js(page, "pm.tilt(true)"); time.sleep(1.2)
    js(page, "pm.lower('⌘K 또는 /', 'ㅋㅇㅅㄹ')"); page.keyboard.press('Meta+k'); time.sleep(1.0)
    for ch in 'ㅋㅇㅅㄹ':
        page.keyboard.insert_text(ch); time.sleep(.45)
    time.sleep(1.6); page.keyboard.press('Enter'); time.sleep(1.0)
    js(page, "pm.lower('카이사르', '관계 목록 · 등장 포인트 · 그 해 서 있던 자리')"); time.sleep(5.5)
    js(page, "pm.tilt(false); pm.lowerOff()"); time.sleep(1.2)


def seg_library(page):
    page.goto(LIB + 'objects/person/%EC%B9%B4%EC%9D%B4%EC%82%AC%EB%A5%B4')
    js(page, "pm.title('로마자료실', '읽다가, 바로 지도로', '포인트 본문과 객체 672개를 글로 읽는 자료실', 104)")
    page.wait_for_load_state('networkidle'); time.sleep(1.5)
    yield 'ready'
    time.sleep(3.4); js(page, "pm.cardOff()"); time.sleep(.8)
    js(page, "pm.lower('자료실 · 카이사르', '설명 · 관계 · 등장 포인트')"); time.sleep(2.0)
    page.mouse.wheel(0, 500); time.sleep(1.6)
    link = page.locator('a.atlas-link').first
    link.scroll_into_view_if_needed(); time.sleep(.8)
    x, y = center(page, 'a.atlas-link'); js(page, f"pm.ring({x},{y},true)"); js(page, "pm.lower('「지도에서 보기」', '같은 객체가 지도에서 열립니다')"); time.sleep(2.6)
    js(page, "pm.tap()"); time.sleep(.4)


def seg_jump(page):
    page.goto(ATLAS + '?sel=person%3A%EC%B9%B4%EC%9D%B4%EC%82%AC%EB%A5%B4')
    js(page, "pm.card('<div></div>')"); wait_map(page, 4); clean(page)
    yield 'ready'
    js(page, "pm.cardOff()"); time.sleep(.6); js(page, "pm.lower('크로노아틀라스 · 카이사르', '자료실과 지도는 같은 자료 한 벌을 씁니다')"); time.sleep(5.0)
    js(page, "pm.lowerOff()"); time.sleep(.3)


def seg_outro(page):
    page.set_content('<html><head></head><body style="margin:0;background:#0b0a09"></body></html>')
    js(page, "pm.mount(); pm.card('<div></div>')"); time.sleep(.5)
    yield 'ready'
    js(page, """pm.bento([
      {k:'발표자', t:'발표 준비', s:'회차 장면을 열고 넘기면 끝'},
      {k:'회원', t:'책 읽기', s:'모르는 이름은 누르면 나온다'},
      {k:'토론', t:'근거 대기', s:'장면마다 사료 구절'},
      {k:'누구나', t:'수업 · 공부', s:'연도 막대 하나로 로마사 한 바퀴'},
      {k:'AI와', t:'자료 그대로', s:'같은 자료를 AI에게 읽혀 묻기'},
      {k:'무료', t:'설치 없음', s:'가입 없이 브라우저에서'}], '이렇게 씁니다')"""); time.sleep(6.5)
    js(page, "pm.end('지금 열어 보세요', ['snas-lifebook.github.io/chronoatlas', 'roma-library.pages.dev'])"); time.sleep(5.5)


SEGS = [seg_open, seg_present, seg_board, seg_search, seg_library, seg_jump, seg_outro]


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    only = sys.argv[1:]  # 구간 이름으로 일부만 다시 찍기
    cuts = json.loads((RAW / 'cuts.json').read_text()) if (RAW / 'cuts.json').exists() else {}
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=False, args=['--ignore-gpu-blocklist', '--enable-gpu-rasterization', f'--window-size={W},{H + 90}'])
        for seg in SEGS:
            name = seg.__name__[4:]
            if only and name not in only: continue
            ctx = b.new_context(viewport={'width': W, 'height': H}, record_video_dir=str(RAW / name), record_video_size={'width': W, 'height': H}, locale='ko-KR')
            ctx.add_init_script(OVERLAY)
            page = ctx.new_page(); t0 = time.time()
            g = seg(page); next(g); ready = time.time() - t0
            for _ in g: pass
            vid = page.video.path(); ctx.close()
            dst = RAW / f'{name}.webm'; os.replace(vid, dst)
            cuts[name] = round(max(0, ready - 0.2), 2); print(name, 'cut', cuts[name], flush=True)
        b.close()
    (RAW / 'cuts.json').write_text(json.dumps(cuts))
    # 잇기: 로딩 구간을 잘라 mp4로, 그다음 concat
    parts = []
    for seg in SEGS:
        name = seg.__name__[4:]; src = RAW / f'{name}.webm'; dst = RAW / f'{name}.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(cuts[name]), '-i', str(src), '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-an', str(dst)], check=True)
        parts.append(dst)
    lst = RAW / 'list.txt'; lst.write_text(''.join(f"file '{p}'\n" for p in parts))
    final = OUT / 'chronoatlas-promo.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', '-movflags', '+faststart', str(final)], check=True)
    print('OUT', final)
    return 0


if __name__ == '__main__':
    sys.exit(main())
