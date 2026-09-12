// 카이사르 팩 교보재. 정본 어댑터 산출물이 아니라 data/overlays. teaching: true.
import type { Feature } from './schema';

const pompey = Object.values(import.meta.glob('../data/overlays/pack-pompey.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; features: Feature[] } | undefined;
const battles = Object.values(import.meta.glob('../data/overlays/pack-battles.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; features: Feature[] } | undefined;
const cast = Object.values(import.meta.glob('../data/overlays/pack-cast.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; people: { id: string; place: string; from_year: number; to_year: number }[] } | undefined;

const anachro = Object.values(import.meta.glob('../data/overlays/pack-anachronisms.json', { eager: true, import: 'default' }))[0] as
  { teaching?: boolean; hide_before: { id: string; valid_from: number; source: string }[] } | undefined;

export const PACK_MOVEMENTS: Feature[] = pompey?.features ?? [];
export const PACK_BATTLES: Feature[] = battles?.features ?? [];
export const PACK_CAST = cast ?? { teaching: true as const, people: [] };

/** 그 해에 아직 없는 이름의 정착지 id. 정착지 레이어에 연도 필드가 없어서 생기는 구멍이다
 *  — 어느 해를 띄워도 220개가 다 뜬다. 연도를 지어내지 않고, 확실히 후대인 이름만 가린다. */
export function hiddenPlaces(year: number): string[] {
  return (anachro?.hide_before ?? []).filter(h => year < h.valid_from).map(h => h.id);
}

// 발표 줌(4~6)에서 rank 3 도시가 안 떠서, 경로 정점만 이름표를 따로 켠다.
export const PACK_PLACES = [
  'place:로마', 'place:알레시아', 'place:루비콘강', 'place:브린디시',
  'place:일레르다', 'place:파르살루스', 'place:알렉산드리아', 'place:문다평원',
  'place:라리사', 'place:라벤나',
] as const;
