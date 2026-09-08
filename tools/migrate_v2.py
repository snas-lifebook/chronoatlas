"""SCHEMA v2 마이그레이션 — 정본 JSONL에 src·ext 상수 주입 (TASKS 0.1).

멱등. 이미 있는 값은 건드리지 않는다. 기본 dry-run, --write 로 실제 반영(백업 .bak_YYYYMMDD 자동).
사용: python3 migrate_v2.py <ontology_dir> [--write]
"""
import json, sys, shutil
from datetime import date
from pathlib import Path

DEFAULT_SRC = "point"


def migrate_entity(e):
    changed = False
    if "src" not in e:
        e["src"] = DEFAULT_SRC; changed = True
    if "ext" not in e:
        e["ext"] = {}; changed = True
    for d in e.get("descs") or []:
        if isinstance(d, dict) and "src" not in d:
            d["src"] = DEFAULT_SRC; changed = True
    return changed


def migrate_link(l):
    if "src" in l:
        return False
    l["src"] = DEFAULT_SRC
    return True


def run(dirpath, write):
    d = Path(dirpath)
    report = {}
    for name, fn in (("entities.jsonl", migrate_entity), ("links.jsonl", migrate_link)):
        p = d / name
        rows = [json.loads(x) for x in p.read_text(encoding="utf-8").splitlines() if x.strip()]
        n = sum(1 for r in rows if fn(r))
        report[name] = {"rows": len(rows), "changed": n}
        if write and n:
            shutil.copy(p, p.with_name(f"{name}.bak_{date.today():%Y%m%d}"))
            p.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
    return report


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    write = "--write" in sys.argv
    rep = run(sys.argv[1], write)
    print(("WRITE " if write else "DRY-RUN ") + json.dumps(rep, ensure_ascii=False))
    # 자체 검증: 다시 돌리면 changed=0 이어야 한다
    if write:
        assert all(v["changed"] == 0 for v in run(sys.argv[1], False).values()), "not idempotent"
