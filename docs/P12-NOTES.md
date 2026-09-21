# 포인트 01·02 교보재 근거 노트

작성 2026-09-21. `docs/POINTS-01-11.md` §4 교보재 파일 규약에 따른 초안. 새 파일만 만들었고 기존 파일·정본 온톨로지는 건드리지 않았다.

## 전제 오류

**정본 `place:본곶`의 좌표가 실제로는 프랑스 불로뉴쉬르메르다.** `public/datasets/rome/layers/settlements.geojson`에서 `place:본곶`을 확인하면 `name_ancient: "Bononia"`, 좌표 `[1.57, 50.72]`다, 이건 카르타고 반도 동단의 본 곶(Cape Bon, 폴리비오스가 레굴루스의 상륙지로 적은 그 곶)이 아니라 프랑스 북부 항구도시 불로뉴쉬르메르의 고대 라틴명 "Bononia"(볼로냐와 이름이 겹치는 것과 같은 부류의 혼동으로 보인다)다. 진짜 본 곶은 Pleiades 315036 "Hermaia Akra/Mercurii Pr."(카르타고 반도 동쪽 곶, precise)로 좌표 `[11.0417, 37.0836]`이며, 볼트 atlas(`atlas/data/movements.json`)가 이미 이 값을 쓰고 있다(`[37.0783, 11.0219]`, 위경도 순서만 다름, 사실상 같은 지점).

이 버그는 `event:본곶전투`(-255)의 `occurred_at` 링크를 통해 **정본 `battles.geojson`에도 그대로 있다**, `POINTS-01-11.md`의 p12-regulus-255 행이 "본곶 전투점 ✔"라고 적은 것은 **틀렸다**. 그 점은 지도에서 프랑스 해협에 찍힌다. 더 심각한 것은 `person:레굴루스 participated_in event:본곶전투`(from_year -255, to_year null)가 `src/year.ts`의 `edgeActive`에 의해 **정확히 -255년에만** 활성화된다는 점이다, 이 팩의 `p12-routes.json` regulus 경로가 그 해를 덮지 않았다면 레굴루스 본인이 프랑스에 서게 된다. `p12-routes.json`의 마지막 두 구간(`regulus@carthage`, `regulus@defeat`)을 -255년까지 정확히 이어지도록 만들어 이 버그를 경로 우선순위로 덮었다(`src/people.ts`는 경로 위치를 관계 기반 위치보다 우선한다).

**추가 조사(2차): 버그의 근본 원인을 찾았다.** 볼트 노트 `entities/place/본 곶.md` 자체가 자기모순이다, **frontmatter**는 `location: [37.0783, 11.0219]`(위도·경도, 튀니지, `modern: "본 곶(Cape Bon), 튀니지"`, `ancient: "Promontorium Mercurii"`로 정확)인데, 같은 노트의 **본문**(「위치」 절의 leaflet 블록, `lat: 50.72 / long: 1.57`)과 「영토」 절은 완전히 다른 곳, 갈리아 해협의 게소리아쿰/불로뉴쉬르메르(카이사르 기원전 55년·클라우디우스 서기 43년의 브리타니아 원정 출항지)를 적고 있다. 정본 어댑터 산출물이 frontmatter가 아니라 본문의 틀린 값을 실어 날랐을 가능성이 높다. 즉 이름만 같은 두 자리(카르타고 인근의 본 곶 vs 갈리아 해협의 옛 이름 없는 곶)가 한 항목으로 뭉친 것으로 보인다.

**이번 라운드에서 처리한 것**: (a) `proposals/20260921_p12.jsonl`에 `op: "set_location"`(신설 op, 병합 스크립트 지원 필요, 기존 스키마에 필드 하나만 고치는 op이 없어서 이름을 새로 지었다) 제안을 추가해 `location: [11.0219, 37.0783]`(볼트 노트 frontmatter를 경도·위도로 뒤집은 값)로 정정을 제안했다. (b) `p12-anachronisms.json`에 `hide` 배열을 신설해 `place:본곶`·`event:본곶전투`를 정정 전까지 가리도록 표시했다(이 `hide` 키는 `src/packData.ts`의 기존 merge 로직이 읽는 키가 아니다, 엔진이 소비하려면 그쪽에도 배선이 필요하다, 이 노트에 적어 둔다). (c) `p12-battles.json`에 `event:본곶전투-교보재`(정본과 id가 겹치지 않게) 점을 볼트 노트 frontmatter 좌표로 추가했다. (d) `p12-cast.json`에 레굴루스 항목을 `at`+`override: true`로 추가해 -255년 위치를 명시적으로 고정했다(경로와 같은 좌표라 충돌 없음). **좌표 자체(정본 필드)는 여전히 고치지 않았다**, River가 `set_location` 제안을 승인하거나 직접 고쳐야 한다.

## 무엇을 어디서 가져왔나

| 파일 | 좌표 출처 |
|---|---|
| `p12-cast.json` | 정본 place(시라쿠사)·Pleiades(에릭스 462202, 밀라이 462379) |
| `p12-battles.json` | 정본 place(드레파나)·Pleiades(헤라클레아 452333, 아우스쿨룸 442487, 밀라이 462379, 에크노무스곶 462191, 릴리바이움 462282) |
| `p12-routes.json` | 정본 place(에페이로스·타란토·시라쿠사·로마·카르타고)·Pleiades(헤라클레아·아우스쿨룸·에크노무스곶·본곶·에릭스) |
| `p12-places.json` | 정본 settlements id 11개만(로마·카푸아·타란토·베네벤토·메시나·시라쿠사·아그리젠토시·팔레르모·드레파나·카르타고·우티카) |
| `p12-islands.json` | Natural Earth 10m land(PD), `data/external/ne_10m_land.geojson` feature 6의 polygon 23(시칠리아)·24(사르데냐)·25(코르시카). 세 폴리곤 모두 홀 없는 단일 외곽 링(357·581·401점)임을 확인하고 그대로 복사했다. |
| `p12-anachronisms.json` | 정본 place(카르타헤나·알렉산드리아)만. 창건 연도는 폴리비오스·리비우스·아리아노스·플루타르코스. `hide_admin_before`는 정본 `admin_regions.geojson`(카르타고 프로콘술라리스·아시아 속주)만 |
| `p12-peoples.json` | 볼트 온톨로지 `ontology/_routes/{samnites,latins,etruscans,hernici,epirus}_area.geojson` 정점을 그대로 복사(새 선 없음). 원본 파일 자체가 이미 '사료 기반 대략 범위(손그림)'로 표기돼 있어 그 신뢰도 표기를 그대로 이어받았다 |

볼트 atlas(`atlas/data/movements.json`)의 pyrrhus·regulus·hamilcar 세 경로는 `source: "book"`(로마제국쇠망사 편역본 자체, 1차 사료 인용이 아님)로만 표기돼 있었다. `p12-routes.json`은 이 세 경로를 뼈대로 삼되, 정점마다 플루타르코스(『피로스』)·폴리비오스(『역사』 1권)를 직접 인용해 보강했고, 피로스 경로는 볼트 atlas에 없던 헤라클레아·아우스쿨룸 두 정점을 추가했다(에페이로스→타란토→헤라클레아→아우스쿨룸→시라쿠사).

## 못 찾은 것 (비워 둠)

- **릴리바이움**: 정본 settlements에 없다. Pleiades cape(462282)만 있어 `p12-battles.json`에서 outside_canon으로 처리했다. proposals에도 넣지 않았다, 브리프가 요구한 6개 제안 목록에 없었고, 시(city) 전체를 얼마나 정밀하게 비정할지 판단이 더 필요해 보류했다.
- **하밀카르의 헤이르크테 거점(-247~244)**: 폴리비오스 1.56이 언급하지만 위치가 확정되지 않아(판노르무스 인근으로만 추정) Pleiades에 없다. `p12-routes.json`에서 카르타고→에릭스 직행으로 단순화했다, 이 구간을 못 찾은 것이지 안 넣은 게 아니다.
- **하밀카르의 에스파냐 원정(카디스·알리칸테, -237~-228)**: Pleiades로 좌표는 확인했다(Gades 256177, Lucentum 265954(볼트 atlas 좌표와 0.05° 이내로 일치)). 하지만 이 구간은 `PACK_YEARS.p12 = [-800, -230)`을 벗어난다(-228 > -230), p12 묶음에 넣어도 어느 p12 장면에서도 렌더되지 않는다. **p345(포인트 03·04·05) 몫으로 넘긴다.**
- **플로렌티아·아퀼레이아**: 정본 settlements에 두 도시가 없어(검색 결과 0건, 확인되는 것은 `place:밀라노`뿐) `p12-anachronisms.json`에서 뺐다. 가릴 정본 항목이 없으면 `hide_before`가 no-op이다.
- **알바롱가·릴리바이움**: 정본 settlements에 없어 `p12-places.json`(이야기 장소 이름표, 정본 id만 허용)에서 뺐다. 알바롱가는 proposals에 add_entity를 냈다.
- **사르데냐 섬·코르시카**: 정본에 `kind: island`로 이미 있다. `p12-places.json`(이야기 장소 층위)에서는 형식 규칙대로 뺐고, 대신 `p12-islands.json`의 면으로 강조한다.
- **마메르티니**: `ontology/_routes/mamertines_area.geojson`이 볼트에 없다(다섯 개 확인, 이것만 없음), `p12-peoples.json`에서 뺐다.
- **hide_admin_before 후보 다섯 개**: 브리프가 예시로 든 시칠리아 속주(-241)·사르디니아·코르시카(-238)·히스파니아 둘(-197)·마케도니아(-146)·이탈리아 11구역(-7)은 정본 `admin_regions.geojson`(176개 항목 전수 확인)에 이름이 없거나, 있어도 다른 시대 개념이라 뺐다, 상세 사유는 `p12-anachronisms.json`의 `hide_admin_rejected` 키에 항목별로 적었다. 나르보넨시스(-121)는 이미 `valid_from`이 채워져 있어(기존 pack-anachronisms.json 확인) 애초에 대상이 아니다. 실제로 반영한 것은 아프리카 프로콘술라리스(-146)·아시아 속주(-133) 둘뿐이다.

## 새 route id (routes.ts 배선 필요)

`p12-routes.json`에 새 route id 셋, `pyrrhus`(그리스계, 4구간), `regulus`(로마, 4구간), `hamilcar`(카르타고, 1구간). `src/routes.ts`의 `ROUTE_PHASES`에 이 셋의 국면·색이 없으면 선이 기본색으로만 그려진다, 다음에 그 파일에 세 항목을 추가해야 한다.

## NE 캐시

있다. `data/external/ne_10m_land.geojson`에 이미 받아 둔 Natural Earth 10m land가 있어 `p12-islands.json`을 만들 수 있었다. 「NE 캐시 없음」에 해당하지 않는다.

## 볼트 atlas 데이터 출처 표기 상태

`atlas/data/movements.json`·`battles.json`·`places.json`·`people.json`·`world.json` 다섯 파일 모두 최상위 `source` 필드가 `"book"`이고 하위 step마다도 대부분 `"source": "book"`이다, 로마제국쇠망사 편역본(2차/3차 자료) 자체를 가리킬 뿐 폴리비오스·플루타르코스 같은 1차 사료를 직접 인용하지 않는다. `confidence`도 `"medium"`으로 일괄돼 있어 항목별 신뢰도 차이를 담지 못한다. 이번 교보재에서는 좌표만 참고하고 인용은 전부 1차 사료로 새로 달았다.

## 산출물 요약

| 파일 | 항목 수 |
|---|---|
| `data/overlays/p12-cast.json` | people 4(히에론·하밀카르바르카스·가이우스두일리우스·레굴루스override), principals 3 |
| `data/overlays/p12-battles.json` | features 7(본곶전투-교보재 포함) |
| `data/overlays/p12-routes.json` | features 9 (pyrrhus 4 · regulus 4 · hamilcar 1) |
| `data/overlays/p12-places.json` | places 11 |
| `data/overlays/p12-islands.json` | features 3 |
| `data/overlays/p12-anachronisms.json` | hide_before 2 · hide 2(본곶 임시 가림) · hide_admin_before 2 |
| `data/overlays/p12-peoples.json` | features 5(삼니움·라틴·에트루리아·헤르니키·에페이로스) |
| `proposals/20260921_p12.jsonl` | 12개 op (add_entity 8 · add_link 3 · set_location 1) |

못 찾은 것 7건(위 목록, 마메르티니 포함), 전제 오류 1건(본곶 좌표, 근본 원인까지 확인).
