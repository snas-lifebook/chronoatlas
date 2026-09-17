#!/usr/bin/env python3
"""build-emblems.py: 세력 문장 PNG(River 자산, 볼트 Works/관계분석_방법론/components/01_세력/문장_<세력>.png 512²)를
128px로 줄여 public/assets/emblems/<세력>.png 에 두고, 목록을 data/overlays/pack-emblems.json 에 적는다(OVERHAUL-II §2, R51).
장기말 깃발·배너 카드가 쓴다. 문장을 만들어 넣지 않는다: 파일이 있는 세력만.
    python3 scripts/build-emblems.py            # 볼트 위치는 data/ontology-dir.txt(gitignore) 또는 ONTOLOGY_DIR, 또는 EMBLEM_DIR
"""
import json, os, sys, unicodedata
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
def components_dir() -> Path:
    if os.environ.get('EMBLEM_DIR'):
        return Path(os.environ['EMBLEM_DIR'])
    onto = os.environ.get('ONTOLOGY_DIR') or ((ROOT / 'data' / 'ontology-dir.txt').read_text().strip() if (ROOT / 'data' / 'ontology-dir.txt').exists() else None)
    if not onto:
        sys.exit('볼트 위치를 모른다: data/ontology-dir.txt 또는 ONTOLOGY_DIR, EMBLEM_DIR')
    return Path(onto).resolve().parent.parent.parent / 'Works' / '관계분석_방법론' / 'components' / '01_세력'

src = components_dir()
if not src.exists():
    sys.exit(f'문장 폴더 없음: {src}')
out = ROOT / 'public' / 'assets' / 'emblems'; out.mkdir(parents=True, exist_ok=True)
actors = []
for f in sorted(src.glob('*.png')):
    stem = unicodedata.normalize('NFC', f.stem)   # iCloud 파일명은 NFD가 섞여 있다. 정규화 없이는 카르타고가 빠졌다(2026-09-17)
    if not stem.startswith('문장_'):
        continue
    actor = stem[len('문장_'):]
    im = Image.open(f).convert('RGBA')
    im.thumbnail((128, 128), Image.LANCZOS)
    im.save(out / f'{actor}.png', optimize=True)
    actors.append(actor)
    print(actor, (out / f'{actor}.png').stat().st_size, 'B')
(ROOT / 'data' / 'overlays' / 'pack-emblems.json').write_text(json.dumps({
    'teaching': True, 'source': '볼트 Works/관계분석_방법론/components/01_세력/문장_<세력>.png (River 자산, AI 생성 문장). scripts/build-emblems.py가 128px로 줄여 public/assets/emblems/에 둔다. 있는 세력만.',
    'actors': actors}, ensure_ascii=False, indent=1) + '\n')
print('문장', len(actors), '개 →', out)
