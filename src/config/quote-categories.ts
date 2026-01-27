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
}

export const QUOTE_CATEGORIES: QuoteCategory[] = [
  {
    category_no: 325,
    category_name: '단열재(견적서)',
    display_name: '단열재',
  },
  {
    category_no: 326,
    category_name: '석고보드(견적서)',
    display_name: '석고보드',
  },
  // 새로운 견적서 카테고리를 여기에 추가하세요
  // {
  //   category_no: 327,
  //   category_name: '카테고리명(견적서)',
  //   display_name: '카테고리명',
  // },
];

// 카테고리 번호 배열 (API 호출용)
export const QUOTE_CATEGORY_NOS = QUOTE_CATEGORIES.map(c => c.category_no);
