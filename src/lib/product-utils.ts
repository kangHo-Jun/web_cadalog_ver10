/**
 * 상품 관련 공통 유틸리티 함수
 * @file src/lib/product-utils.ts
 */

/**
 * 상품명 정규화 함수
 *
 * 규칙:
 * 1. HTML 태그 (<br>, <p> 등) 제거 및 공백으로 치환
 * 2. &nbsp; 등 HTML 엔티티 제거
 * 3. 연속된 공백을 단일 공백으로 축소
 * 4. 앞뒤 공백 제거 (trim)
 *
 * 주의: 절삭 로직 없음 - '(' 또는 'x' 기준 잘라내기 금지
 */
export function normalizeProductName(name: string): string {
    if (!name) return '';
    return name
        .replace(/<[^>]*>/g, ' ')   // HTML 태그 → 공백
        .replace(/&nbsp;/g, ' ')    // &nbsp; → 공백
        .replace(/&amp;/g, '&')     // &amp; → &
        .replace(/&lt;/g, '<')      // &lt; → <
        .replace(/&gt;/g, '>')      // &gt; → >
        .replace(/\s+/g, ' ')       // 연속 공백 → 단일 공백
        .trim();
}

/**
 * 개별 옵션 자식 아이템 타입
 */
export interface ChildItem {
    name: string;           // 옵션값 표시명 (예: "30T x 1000 x 1800")
    price: number;          // 기본가 + 추가금액
    variantCode?: string;   // Cafe24 variant_code (옵션 상품인 경우)
    isSingle?: boolean;     // 단일 상품 플래그 (has_option: 'F')
}

/**
 * 부모 상품 그룹 타입
 * API /api/sync-products 응답 및 제품 목록 렌더링에 사용
 */
export interface GroupedProduct {
    id: string;             // 부모 코드 (product_code 또는 variant_code 앞 8자리)
    parentName: string;     // 정규화된 부모 상품명 (HTML 제거, 절삭 없음)
    detail_image?: string;  // 대표 이미지 URL
    categoryNo?: number[];   // 소속 카테고리 번호 목록
    children: ChildItem[];  // 옵션값 기반 자식 리스트
}
