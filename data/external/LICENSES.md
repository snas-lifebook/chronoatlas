# data/external — 출처·라이선스 대장

| 파일 | 출처 | 라이선스 | 비고 |
|---|---|---|---|
| ne_10m_land.geojson | Natural Earth 10m (nvkelso/natural-earth-vector) | Public Domain | → layers/land.geojson, bbox -25,12,75,62 |
| ne_10m_coastline.geojson | Natural Earth 10m (nvkelso/natural-earth-vector) | Public Domain | → layers/coast.geojson, bbox -25,12,75,62 |
| ne_10m_rivers_lake_centerlines.geojson | Natural Earth 10m (nvkelso/natural-earth-vector) | Public Domain | → layers/rivers.geojson, bbox -25,12,75,62 |
| ne_10m_lakes.geojson | Natural Earth 10m (nvkelso/natural-earth-vector) | Public Domain | → layers/lakes.geojson, bbox -25,12,75,62 |
| ne_10m_glaciated_areas.geojson | Natural Earth 10m (nvkelso/natural-earth-vector) | Public Domain | → layers/glaciers.geojson, bbox -25,12,75,62 |
| ne_10m_geography_marine_polys.geojson | Natural Earth 10m (nvkelso/natural-earth-vector) | Public Domain | → layers/marine_labels.geojson, bbox -25,12,75,62 |
| ne_10m_geography_regions_polys.geojson | Natural Earth 10m (nvkelso/natural-earth-vector) | Public Domain | → layers/region_labels.geojson, bbox -25,12,75,62 |
| ne_10m_bathymetry_L_0.geojson | Natural Earth 10m | Public Domain | → layers/bathy.geojson depth=0 |
| ne_10m_bathymetry_K_200.geojson | Natural Earth 10m | Public Domain | → layers/bathy.geojson depth=200 |
| ne_10m_bathymetry_J_1000.geojson | Natural Earth 10m | Public Domain | → layers/bathy.geojson depth=1000 |
| ne_10m_bathymetry_I_2000.geojson | Natural Earth 10m | Public Domain | → layers/bathy.geojson depth=2000 |
| ne_10m_bathymetry_H_3000.geojson | Natural Earth 10m | Public Domain | → layers/bathy.geojson depth=3000 |
| ne_10m_bathymetry_G_4000.geojson | Natural Earth 10m | Public Domain | → layers/bathy.geojson depth=4000 |
| ne_10m_bathymetry_F_5000.geojson | Natural Earth 10m | Public Domain | → layers/bathy.geojson depth=5000 |
| GRAY_HR_SR_OB_DR.tif | Natural Earth 10m Gray Earth — 음영·하계망·해저 (nvkelso/natural-earth-raster) | Public Domain | → rasters/relief.jpg 4800×2400 (image 소스). DEM 타일이 있으면 엔진이 이걸 걷어낸다(음영 두 벌이 겹치면 능선이 뭉개진다) |
| ne_10m_geography_regions_elevation_points.geojson | Natural Earth 10m (nvkelso/natural-earth-vector) | Public Domain | → layers/landmarks.geojson 고도점 132곳(이름난 봉우리 + 실측 고도, src=ne). Pleiades와 같은 레이어라 재배포된다 |
| pleiades/places.csv, places_place_types.csv | Pleiades GIS package (isawnyu/pleiades-datasets, Bagnall·Talbert 외) | CC BY 3.0 — 크레딧 "Pleiades" 필수 | → layers/landmarks.geojson (물리 유형 32종, bbox) |
| cliopatria.geojson.zip | Cliopatria — Seshat Global History Databank (정치체 폴리곤 3400BCE–2024CE) | CC BY 4.0 — 크레딧 "Cliopatria (Seshat)" 필수 | → layers/territory/<100년>.geojson (bbox·면적 3만km² 이상·팔레트 세력 매핑) |
| terrarium 타일(선택, TERRAIN=1) | AWS Terrain Tiles — Mapzen/Tilezen (SRTM·GMTED2010·ETOPO1 등) | 출처별 상이(PD·CC BY·ODbL) — 크레딧 표기 | → public/datasets/rome/terrain/ (기하 3D). 커밋 전 라이선스 확인 |
| KlokanTech Noto Sans CJK glyphs | klokantech/klokantech-gl-fonts | OFL | → public/glyphs/ (라벨 사용 범위만) |

생성: scripts/fetch-external.ts · 2026-09-17
