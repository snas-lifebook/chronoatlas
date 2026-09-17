// 콜아웃 썸네일 대장. 콜아웃 본문·앵커 풀이는 미시지도 레지스트리(data/micromaps/<id>.json + src/map/micro.ts resolveCallouts)로 갔다(2026-09-17).
//
// River: "각 설명에서 사진이 있으면 작게 사진을 해당 콜아웃 안에 넣으면 좋을듯."
// 사진을 런타임에 커먼즈에서 불러올 수 없다(AGENTS.md 「런타임 외부 호출 0」). 빌드 전에 구워 레포에 넣는데, 같은 문서가
// 「카피레프트 데이터는 재배포하지 않는다」고 못 박는다. 열한 장의 라이선스를 커먼즈 API로 파일마다 직접 확인한 결과
// 퍼블릭 도메인 넷 + CC BY 하나만 구울 수 있고, CC BY-SA 여섯은 링크로 남는다. 카드에 썸네일이 있는 것과 없는 것이 섞이는 것은 게으름이 아니라 라이선스다.
const thumbRaw = Object.values(import.meta.glob('../data/overlays/pack-callout-thumbs.json', { eager: true, import: 'default' }))[0] as
  { thumbs?: Record<string, { baked?: boolean; file?: string; license?: string; page?: string; why?: string }> } | undefined;
export const THUMBS: Record<string, { file: string; license: string; page: string }> = Object.fromEntries(
  Object.entries(thumbRaw?.thumbs ?? [])
    .filter(([, v]) => v.baked && v.file)
    .map(([k, v]) => [k, { file: v.file!, license: v.license ?? '', page: v.page ?? '' }]));
