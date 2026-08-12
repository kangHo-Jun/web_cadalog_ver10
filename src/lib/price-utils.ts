/**
 * 부가세(10%) 포함 가격 → 공급가(부가세 전) 변환
 * Cafe24 상품가격은 부가세 포함가이므로, 표시 시 /1.1 변환 적용
 */
export const toSupplyPrice = (vatIncluded: number): number =>
    Math.round(vatIncluded / 1.1);

/**
 * 가격 포맷 헬퍼 (₩16,500 형식)
 */
export const formatPrice = (price: number): string =>
    `₩${price.toLocaleString('ko-KR')}`;

/**
 * 공급가 포맷 원스텝 (표시용)
 */
export const formatSupplyPrice = (vatIncluded: number): string =>
    formatPrice(toSupplyPrice(vatIncluded));
