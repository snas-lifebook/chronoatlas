# 적용된 제안

`scripts/apply-proposals.py --apply <파일…>`로 정본(ONTOLOGY_DIR)에 넣은 것. 백업은 정본 옆 `*.bak_YYYYMMDD`. 같은 파일을 다시 돌려도 아무것도 안 바뀐다(멱등).

| 날짜 | 파일 | 결과 |
|---|---|---|
| 2026-09-22 | `20260911_place_actium.jsonl` · `20260913_alesia_occurred_at.jsonl` · `20260921_p12.jsonl` · `20260921_p345.jsonl` · `20260921_p911.jsonl` | 엔티티 +22 · 링크 +32 · 링크 연도 채움 2(모의해전 occurred_at, 안토니우스 악티움) · 좌표 2(본곶은 `_geo/places_1.jsonl` 행까지, 에크노무스곶) · 갱신 1(모의해전 attrs.year 52). River 「go」(2026-09-22). adapt 뒤 settlements 220 → 232, battles 22 → 40 |

아직 안 넣은 것(River 판단 항목): `20260908_place_pleiades_link`(set_ext 8) · `20260908_rel_misuse_11`(replace_rel 11, lint baseline의 그 11건) · `20260909_palette_factions_3` · `20260911_event_year_3`(set_attrs, 자마전투 연도는 이제 occurred_at 링크 from_year -202가 대신한다) · `20260911_place_resource_terrain_7`(confidence low) · `20260912_palette_civilwar_2`. 스크립트가 이 op들을 아직 모른다(UNSUP으로 보고만 한다).
