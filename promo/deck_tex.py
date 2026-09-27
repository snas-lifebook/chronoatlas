#!/usr/bin/env python3
"""3D 덱 카드 앞면: 실제 화면 캡처 + 아래 라벨 띠(잉크 바탕, 강조색 줄, 굵은 한글). deck.py가 t0~t3.png를 쓴다."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

out, acc, items = Path(sys.argv[1]), sys.argv[2], json.loads(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)
TTC = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
font = None
for i in range(20):
    try:
        f = ImageFont.truetype(TTC, 96, index=i)
        if 'ExtraBold' in ' '.join(f.getname()) or 'Heavy' in ' '.join(f.getname()): font = f; break
    except OSError: break
font = font or ImageFont.truetype(TTC, 96, index=0)
W, H, BAND = 1600, 1100, 200
for n, (src, label) in enumerate(items):
    shot = Image.open(src).convert('RGB').resize((W, H - BAND), Image.LANCZOS)
    card = Image.new('RGB', (W, H), '#14110e'); card.paste(shot, (0, 0))
    d = ImageDraw.Draw(card)
    d.rectangle([0, H - BAND, W, H - BAND + 10], fill=acc)
    d.text((64, H - BAND + 48), f'{n + 1:02d}', font=font.font_variant(size=64), fill=acc)
    d.text((190, H - BAND + 36), label, font=font, fill='#f3ead9')
    card.save(out / f't{n}.png')
print('tex', len(items))
