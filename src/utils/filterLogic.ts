import { CategoryItem, CategoryGroup } from '../types/category';

/**
 * 카테고리 데이터를 8자리 Prefix 기준으로 그룹화합니다.
 * @param categories 전체 카테고리 배열
 * @returns 그룹화된 CategoryGroup 배열
 */
export const groupCategoriesByPrefix = (categories: CategoryItem[]): CategoryGroup[] => {
    const groupMap = new Map<string, CategoryGroup>();

    categories.forEach((item) => {
        // full_category_no가 8자리 이상인 경우만 처리 (Prefix 추출 가능)
        if (item.full_category_no && item.full_category_no.length >= 8) {
            const prefix = item.full_category_no.substring(0, 8);

            if (!groupMap.has(prefix)) {
                // 부모 카테고리를 찾거나, 현재 아이템의 이름을 기본값으로 사용
                // 실무에서는 depth가 2인 것을 부모명으로 쓰거나 prefix를 별도 처리
                groupMap.set(prefix, {
                    prefix,
                    displayName: item.category_name.split('>')[0].trim() || '기타',
                    children: [],
                });
            }

            groupMap.get(prefix)?.children.push(item);
        }
    });

    return Array.from(groupMap.values());
};

/**
 * 특정 Prefix에 해당하는 자식 아이템만 필터링합니다.
 * @param categories 전체 카테고리 배열
 * @param prefix 필터링할 8자리 prefix
 */
export const filterChildrenByPrefix = (categories: CategoryItem[], prefix: string): CategoryItem[] => {
    return categories.filter(item => item.full_category_no.startsWith(prefix) && item.full_category_no.length > 8);
};
