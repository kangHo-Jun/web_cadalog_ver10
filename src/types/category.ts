/**
 * Cafe24 카테고리 정보 인터페이스
 */
export interface CategoryItem {
    category_no: number;
    parent_category_no: number;
    category_name: string;
    category_depth: number;
    full_category_no: string; // 예: "000100010001"
    is_display?: 'Y' | 'N';
}

/**
 * 8자리 Prefix 기준 그룹 정보
 */
export interface CategoryGroup {
    prefix: string;        // 8자리 코드 (예: "00010002")
    displayName: string;   // 부모 카테고리 이름
    children: CategoryItem[]; // 해당 prefix를 가진 하위 아이템 (Variant)
}

/**
 * Safe Triangle 계산을 위한 마우스 좌표 타입
 */
export interface Point {
    x: number;
    y: number;
}
