import { QuoteCategory } from '../config/quote-categories';

export interface SubCategory {
    category_no: number;
    category_name: string;
    display_name: string;
    parent_category_no: number;
}

const isRootCategory = (category: QuoteCategory): boolean =>
    category.parent_category_no === null || category.parent_category_no === undefined;

/**
 * 선택된 Root 카테고리(category_no)의 하위 카테고리만 필터링합니다.
 * Root가 아니거나 하위가 없으면 에러 없이 빈 배열([])을 반환합니다.
 */
export const mapSubCategories = (
    categories: QuoteCategory[],
    selectedRootCategoryNo: number
): SubCategory[] => {
    const selectedRoot = categories.find(cat => cat.category_no === selectedRootCategoryNo);
    if (!selectedRoot || !isRootCategory(selectedRoot)) return [];

    const children = categories.filter(cat => cat.parent_category_no === selectedRootCategoryNo);
    if (children.length === 0) return [];

    return children.map(cat => ({
        category_no: cat.category_no,
        category_name: cat.category_name,
        display_name: cat.display_name,
        parent_category_no: selectedRootCategoryNo,
    }));
};
