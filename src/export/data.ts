// 데이터 내보내기(F9): 현재 연도 단면 — GeoJSON(영토·속주·도시·전투·이동경로) + CSV(점 객체). QGIS·스프레드시트로.
import type { Dataset } from '../schema';
import { withinDate } from '../schema';

export function timeSlice(d: Dataset, year: number) {
  const features = [d.territory, d.admin_regions, d.settlements, d.battles, d.movements].flatMap(c => c.features.filter(f => withinDate(f.properties, year)));
  return { type: 'FeatureCollection', features } as const;
}

// 점 객체(도시·전투)만 표 형태로. 좌표는 lon,lat. 값에 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다(RFC 4180).
export function pointsCsv(d: Dataset, year: number): string {
  const cols = ['id', 'name_ko', 'name_ancient', 'kind', 'year', 'lon', 'lat'];
  const q = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = [...d.settlements.features, ...d.battles.features].filter(f => withinDate(f.properties, year)).map(f => {
    const [lon, lat] = f.geometry.coordinates as [number, number]; const p = f.properties;
    return [p.id, p.name_ko ?? p.name, p.name_ancient, p.id?.split(':')[0], p.year ?? p.valid_from, lon, lat].map(q).join(',');
  });
  return '﻿' + [cols.join(','), ...rows].join('\n'); // BOM: 엑셀이 UTF-8로 연다
}
