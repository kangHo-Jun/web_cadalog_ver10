/**
 * 견적서 전용 카테고리 설정
 * Cafe24에서 "표시안함"으로 설정된 카테고리는 API로 조회되지 않아
 * 수동으로 카테고리 번호를 등록해야 합니다.
 *
 * 새로운 견적서 카테고리 추가 시 아래 배열에 추가해주세요.
 */

export interface QuoteCategory {
  category_no: number;
  category_name: string;      // Cafe24에서 사용하는 전체 이름
  display_name: string;       // 화면에 표시할 이름 (견적서) 제거된 버전
  category_depth: number;     // 카테고리 깊이 (대분류 = 1)
  parent_category_no?: number | null; // 부모 카테고리 번호
}

export const QUOTE_CATEGORIES: QuoteCategory[] = [
   {
    category_no: 192,
    category_name: '합판/MDF/보드',
    display_name: '합판/MDF/보드',
    category_depth: 1,
    parent_category_no: null,
  },
  {
    category_no: 25,
    category_name: '각재/목재',
    display_name: '각재/목재',
    category_depth: 1,
    parent_category_no: null,
  },
  {
    category_no: 50,
    category_name: '석고/텍스',
    display_name: '석고/텍스',
    category_depth: 1,
    parent_category_no: null,
  },
  {
    category_no: 197,
    category_name: '바닥재/특수목',
    display_name: '바닥재/특수목',
    category_depth: 1,
    parent_category_no: null,
  },
  {
    category_no: 203,
    category_name: '집성목',
    display_name: '집성목',
    category_depth: 1,
    parent_category_no: null,
  },
  {
    category_no: 284,
    category_name: 'UV코팅/방염`',
    display_name: 'UV코팅/방염',
    category_depth: 1,
    parent_category_no: null,
  },
  {
    category_no: 254,
    category_name: '몰딩도어/하드웨어',
    display_name: '몰딩도어/하드웨어',
    category_depth: 1,
    parent_category_no: null,
  }, 
  {
    category_no: 220,
    category_name: '실내마감재',
    display_name: '실내마감재',
    category_depth: 1,
    parent_category_no: null,
  },
  {
    category_no: 223,
    category_name: '철물/부자재',
    display_name: '철물/부자재',
    category_depth: 1,
    parent_category_no: null,
  },
  {
    category_no: 26,
    category_name: '단열재/흡음재',
    display_name: '단열재/흡음재',
    category_depth: 1,
    parent_category_no: null,
  },
];

// 카테고리 번호 배열 (API 호출용)
export const QUOTE_CATEGORY_NOS = QUOTE_CATEGORIES.map(c => c.category_no);
