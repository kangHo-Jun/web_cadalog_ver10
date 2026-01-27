견적서 전용 웹 카탈로그 구현 계획
목표
기존 카탈로그(/)와 별도로 "(견적서)" 분류 상품만 표시하는 전용 카탈로그(/quote) 생성

사용자 검토 필요
IMPORTANT

기존 카탈로그 유지: 이 작업은 기존 / 경로의 카탈로그에 영향을 주지 않습니다. 새로운 /quote 경로를 추가하는 방식입니다.

WARNING

Cafe24 API 의존성: 카테고리명에 "(견적서)"가 정확히 포함되어 있어야 필터링이 작동합니다. 현재 Cafe24 상품 분류에 해당 형식의 카테고리가 있는지 확인이 필요합니다.

제안된 변경사항
API 수정
[MODIFY] 
route.ts
변경 내용:

type 쿼리 파라미터 추가 (?type=quote)
견적서 상품 필터링 로직 추가
응답 데이터에 카테고리명 변환 포함
주요 로직:

// 1. type=quote 파라미터 확인
const type = searchParams.get('type');
// 2. Cafe24 API에서 전체 상품 조회
const response = await apiClient.get('/products', { ... });
// 3. type=quote인 경우 필터링
if (type === 'quote') {
  products = products.filter(p => 
    p.category_name?.includes('(견적서)')
  );
  
  // 4. 카테고리명 변환
  products = products.map(p => ({
    ...p,
    display_category_name: p.category_name?.replace('(견적서)', '').trim()
  }));
}
[MODIFY] 
route.ts
변경 내용:

type 쿼리 파라미터 추가
견적서 카테고리만 필터링
카테고리명 변환 로직 추가
주요 로직:

const type = searchParams.get('type');
if (type === 'quote') {
  categories = categories.filter(c => 
    c.category_name.includes('(견적서)')
  ).map(c => ({
    ...c,
    display_name: c.category_name.replace('(견적서)', '').trim()
  }));
}
컴포넌트 생성
[NEW] 
Pagination.tsx
기능:

페이지 번호 표시 (1, 2, 3, ...)
이전/다음 버튼
현재 페이지 강조
페이지 클릭 이벤트 처리
Props:

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
UI 구조:

[이전] 1 2 3 4 5 [다음]
[NEW] 
QuoteCatalog.tsx
기능:

견적서 상품 전용 카탈로그
페이지네이션 통합 (20개씩)
기존 
ProductTable
 로직 재사용
카테고리명 변환 처리
주요 차이점:

// API 호출 시 type=quote 파라미터 추가
const productKey = `/api/products?type=quote&keyword=${search}&category=${category}`;
const categoryKey = `/api/categories?type=quote`;
// 페이지네이션 적용
const ITEMS_PER_PAGE = 20;
const paginatedProducts = products.slice(
  (currentPage - 1) * ITEMS_PER_PAGE,
  currentPage * ITEMS_PER_PAGE
);
페이지 생성
[NEW] 
page.tsx
경로: /quote

내용:

import QuoteCatalog from '@/components/QuoteCatalog';
export default function QuotePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="py-12">
        <QuoteCatalog />
      </div>
    </main>
  );
}
유틸리티 함수
[MODIFY] 
utils.ts
추가 함수:

/**
 * 카테고리명에서 "(견적서)" 제거
 */
export function removeQuoteLabel(categoryName: string): string {
  return categoryName.replace('(견적서)', '').trim();
}
/**
 * 페이지네이션 계산
 */
export function paginate<T>(items: T[], page: number, itemsPerPage: number) {
  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return {
    items: items.slice(start, end),
    totalPages: Math.ceil(items.length / itemsPerPage),
    hasNext: end < items.length,
    hasPrev: page > 1,
  };
}
검증 계획
자동화된 테스트
1. API 필터링 테스트
테스트 파일: 수동 테스트 (curl 사용)

테스트 명령어:

# 1. 견적서 상품만 조회
curl "http://localhost:3000/api/products?type=quote" | jq '.products[] | .category_name'
# 예상 결과: 모든 카테고리명에 "(견적서)" 포함
# 2. 견적서 카테고리만 조회
curl "http://localhost:3000/api/categories?type=quote" | jq '.categories[] | .category_name'
# 예상 결과: 모든 카테고리명에 "(견적서)" 포함
2. 페이지네이션 테스트
테스트 방법: 브라우저 수동 테스트

테스트 단계:

http://localhost:3000/quote 접속
상품 개수 확인 (20개 이하인지)
총 상품이 20개 초과인 경우:
페이지 번호가 표시되는지 확인
"다음" 버튼 클릭 → 2페이지로 이동 확인
2페이지에서 21-40번 상품 표시 확인
"이전" 버튼으로 1페이지 복귀 확인
수동 검증
1. 기존 카탈로그 정상 작동 확인
테스트 단계:

http://localhost:3000/ 접속
모든 상품이 표시되는지 확인 (견적서 + 일반 상품)
검색, 카테고리 필터 정상 작동 확인
예상 결과: 기존 기능에 영향 없음

2. 견적서 카탈로그 필터링 확인
테스트 단계:

http://localhost:3000/quote 접속
표시된 상품의 카테고리명 확인
카테고리 탭 이름 확인 ("(견적서)" 제거되었는지)
예상 결과:

상품: "(견적서)" 포함 카테고리만 표시
카테고리 탭: "단열재", "창호" 등 (괄호 제거됨)
3. 페이지네이션 동작 확인
테스트 단계:

총 상품 수 확인 (예: 45개)
1페이지: 1-20번 상품 표시 확인
2페이지: 21-40번 상품 표시 확인
3페이지: 41-45번 상품 표시 확인
페이지 이동 버튼 동작 확인
예상 결과: 각 페이지에 정확히 20개씩 (마지막 페이지 제외)

4. Vercel 배포 후 검증
테스트 단계:

코드 푸시 후 Vercel 자동 배포 대기
https://web-cadalog-ver10.vercel.app/quote 접속
위의 모든 수동 테스트 반복
예상 결과: 로컬과 동일한 동작

구현 순서
API 수정 (10분)

/api/products 필터링 로직 추가
/api/categories 필터링 로직 추가
Pagination 컴포넌트 (15분)

UI 구현
이벤트 핸들러 구현
QuoteCatalog 컴포넌트 (20분)

ProductTable 기반으로 작성
페이지네이션 통합
API 호출 수정
Quote 페이지 (5분)

/quote 경로 생성
QuoteCatalog 컴포넌트 배치
테스트 (10분)

로컬 테스트
기존 카탈로그 영향 확인
배포 (5분)

Git 커밋 및 푸시
Vercel 배포 확인