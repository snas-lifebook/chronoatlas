#!/usr/bin/env python3
"""홍보 영상 음악·효과음 합성. 외부 음원 없이 numpy로 만든다(라이선스 걱정 없음).

    python3 promo/music.py atlas out.wav '{"whoosh":[2,6],"click":[9.5],"stamp":[30]}'   # 큐는 마디 번호(0부터, 소수 = 박)

132 BPM · 4/4 · 32마디(58.2초). 0~1마디 인트로(필터 닫힘) · 2마디 드롭 · 30~31마디 아웃트로.
atlas: A단조 Am–F–C–G, 앰버 톤(따뜻한 패드). library: 같은 박자, C장조 C–Am–F–G(형제 곡).
"""
import json, sys, wave
import numpy as np

SR, BPM, BARS = 48000, 132, 32
BEAT = 60 / BPM; BAR = BEAT * 4
N = int(SR * BAR * BARS) + SR  # 꼬리 1초
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR

def env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)

def note(f): return 440 * 2 ** ((f - 69) / 12)

def add(buf, x, at):
    i = int(at * SR); j = min(len(buf), i + len(x))
    if i < len(buf): buf[i:j] += x[:j - i]

def lowpass(x, cutoff):
    # 1극 저역통과(단순, 충분)
    a = np.exp(-2 * np.pi * cutoff / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s = (1 - a) * x[i] + a * s; y[i] = s
    return y

def kick():
    n = int(SR * .35); t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .001, .18)

def clap():
    n = int(SR * .2); x = rng.standard_normal(n) * env(n, .001, .06)
    return np.diff(np.concatenate([[0], x])) * .6

def hat():
    n = int(SR * .06); x = rng.standard_normal(n)
    return np.diff(np.concatenate([[0], x])) * env(n, .0005, .015) * .35

def saw(f, n):
    t = np.arange(n) / SR; return 2 * ((t * f) % 1) - 1

def pad(chord, n):
    x = sum(saw(note(m) * d, n) for m in chord for d in (0.997, 1.003))
    return x / (len(chord) * 2) * np.minimum(1, np.arange(n) / (SR * .3)) * np.minimum(1, (n - np.arange(n)) / (SR * .2))

def pluck(m, n):
    t = np.arange(n) / SR; f = note(m)
    return (np.sin(2 * np.pi * f * t) + .4 * np.sin(4 * np.pi * f * t)) * env(n, .002, .12)

def whoosh():
    n = int(SR * .7); x = rng.standard_normal(n)
    sw = np.linspace(0, 1, n) ** 2
    y = lowpass(x * (0.2 + sw), 1800) * np.sin(np.pi * np.arange(n) / n) ** 1.5
    return y / (np.abs(y).max() + 1e-9) * .5

def click():
    n = int(SR * .04); t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2400 * t) * env(n, .0005, .008) * .5

def stamp():
    n = int(SR * .5); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * (70 + 60 * np.exp(-t * 25)) * t) * env(n, .001, .15)
    return body + rng.standard_normal(n) * env(n, .001, .02) * .4

PROG = {'atlas': ([57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]),    # Am F C G
        'library': ([48, 52, 55], [57, 60, 64], [53, 57, 60], [55, 59, 62])}  # C Am F G

def render(film, cues):
    drums = np.zeros(N); bass = np.zeros(N); pads = np.zeros(N); arp = np.zeros(N); fx = np.zeros(N)
    prog = PROG[film]
    K, C, H = kick(), clap(), hat()
    for b in range(BARS):
        chord = prog[b % 4]; t0 = b * BAR
        pads_n = int(SR * BAR); add(pads, pad([m + 12 for m in chord], pads_n), t0)
        if b < 2 or b >= 30:
            continue
        for q in range(4):
            add(drums, K, t0 + q * BEAT)
            if q in (1, 3): add(drums, C, t0 + q * BEAT)
        for e in range(8):
            add(drums, H, t0 + e * BEAT / 2 + (BEAT / 2 if e % 2 == 0 else 0) * 0)
            add(bass, saw(note(chord[0] - 24), int(SR * BEAT * .45)) * env(int(SR * BEAT * .45), .003, .2) * .5, t0 + e * BEAT / 2)
        if b >= 6:
            seq = [chord[0], chord[1], chord[2], chord[1] + 12]
            for s in range(16):
                add(arp, pluck(seq[s % 4] + 12, int(SR * .25)) * .35, t0 + s * BEAT / 4)
    for k, fn in (('whoosh', whoosh), ('click', click), ('stamp', stamp)):
        snd = fn()
        for c in cues.get(k, []):
            at = c * BAR - (0.55 if k == 'whoosh' else 0)   # 휙은 컷 직전에 차오른다
            add(fx, snd, max(0, at))
    # 인트로 필터 스윕 + 믹스
    intro = int(SR * BAR * 2)
    pads[:intro] = lowpass(pads[:intro], 900)
    mix = drums * .55 + bass * .45 + pads * .28 + lowpass(arp, 5000) * .6 + fx * .7
    fade = int(SR * BAR * 2); mix[-fade - SR:] *= np.linspace(1, 0, fade + SR)
    mix = np.tanh(mix * 1.2); mix /= np.abs(mix).max() + 1e-9; mix *= 10 ** (-1 / 20)
    st = np.stack([mix, np.roll(mix, int(SR * .012)) * .98], 1)   # 살짝 넓게
    return (st * 32767).astype(np.int16)

if __name__ == '__main__':
    film, out = sys.argv[1], sys.argv[2]; cues = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
    a = render(film, cues)
    with wave.open(out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(a.tobytes())
    print(out, round(len(a) / SR, 2), 's')
