# 기획 UI ver8~ver9 최종 명세서

> 작성일: 2026-02-19 | 버전: ver9 Final (Build ✅ Exit code 0)

---

## 1. 색상 시스템 (Daesan 브랜드 토큰)

```css
/* 배경 */
--bg-main:    #f3f3f3   /* 메인 배경, 사이드바 배경 */
--bg-card:    #FFFFFF   /* 카드 배경 */

/* 메인 컬러 */
--primary:    #123628   /* 헤더, 하단 카트바 */

/* 강조색 */
--accent:     #48BB78   /* 담기 버튼, 카테고리 활성, 견적요청 버튼, 뱃지 */

/* 텍스트 */
--text-dark:  #222222
--text-gray:  #777777
--text-white: #FFFFFF
```

| 영역 | 배경색 | 텍스트 |
|---|---|---|
| 헤더 | `#123628` | `white` |
| 사이드바 | `#f3f3f3` | `gray-700` |
| 메인 | `#f3f3f3` | `gray-800` |
| 카드 | `#FFFFFF` | `gray-800` |
| 하단 카트바 | `#123628` | `white` |
| 버튼 (담기/견적) | `#48BB78` | `white` |

---

## 2. 헤더 구조

```
┌─────────────────────────────────────────────────────┐ #123628
│  Daesan   [──────── 상품 검색 ────────]   [🛒 장바구니 (N)]  │
└─────────────────────────────────────────────────────┘
```

- **견적요청 버튼 헤더에서 삭제** (ver9 수정)
- 장바구니 버튼: 배지(N개) 표시 + 클릭 시 **CartDrawer 슬라이드인**

---

## 3. 장바구니 드로어 (CartDrawer)

> 파일: `src/components/phase1/CartDrawer.tsx` [NEW]

- 우측에서 슬라이드인 (width: 360px)
- 배경 클릭 시 닫힘
- 담긴 상품 목록, 수량 조절(+/−), 개별 삭제
- 하단 합계 + **[전체삭제] [견적요청]** 버튼
- 견적요청 클릭 → `/quote/summary` 이동

---

## 4. 하단 카트바

> `Phase1CatalogView.tsx`

```
[🛒 N개 선택 | ₩X,XXX원]         [초기화]  [견적요청 →]
```

- 담긴 상품이 있을 때만 표시
- **견적요청 버튼 기능 활성화**: `router.push('/quote/summary')`

---

## 5. 자식 상품 행 레이아웃 (Grid)

> `ProductListPhase1.tsx` → `ChildOption` 컴포넌트

```
grid-cols-[1fr_110px_148px_100px]
   치수      가격     수량 조절    담기
```

| 컬럼 | 너비 | 내용 |
|---|---|---|
| 치수 | flex | 규격 문자열 |
| 가격 | 110px | `₩15,000원` (전체 표기) |
| 수량 조절 | 148px | −/숫자/+ 스테퍼 |
| 담기 | 100px | `#48BB78` 버튼 (항상 우측 고정) |

- **가격 표기**: `₩${price.toLocaleString()}원` (전체 금액, k 약식 폐기)
- **수량 입력**: `onClick/onFocus` 시 자동 전체 선택, `min=1`, `max=9999`

---

## 6. 아코디언 동작

> `ProductListPhase1.tsx`

| 이전 | 이후 |
|---|---|
| `Set<string>` (다중 오픈) | `string \| null` (단일 오픈) |
| 여러 그룹 동시 열림 | 새 그룹 클릭 시 기존 자동 닫힘 |

```ts
const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

const toggleGroup = useCallback((key: string) => {
    setExpandedProduct(prev => prev === key ? null : key);
}, []);
```

---

## 7. 견적요청 페이지 (/quote/summary)

> 파일: `src/app/quote/summary/page.tsx` [NEW]

- **`useCartStore` 직접 연결** (Phase1 카트 데이터 자동 로드)
- 상품 목록 확인, 수량 조절, 개별 삭제
- 견적 폼: 이름, 연락처, 이메일, 추가 요청사항
- 제출 후 성공 화면 + 카트 자동 초기화

```
/quote          → QuoteCatalog (기존 카탈로그 브라우저, 독립 cart)
/quote/summary  → 견적서 요청 페이지 (Phase1 카트 연결) ← 신규
```

---

## 8. 수정된 파일 목록

| 파일 | 수정 내용 |
|---|---|
| `StickySearchHeader.tsx` | 헤더 ver9 색상, 견적요청 삭제, 장바구니 뱃지 추가 |
| `FixedSidebar.tsx` | 사이드바 `#f3f3f3` 배경, `gray-700` 텍스트 |
| `Phase1CatalogView.tsx` | 메인 배경 `#f3f3f3`, CartDrawer 연결, 카트바 견적요청 라우팅 |
| `ProductListPhase1.tsx` | Grid 레이아웃, 가격 전체 표기, 수량 select-on-focus, 단일 아코디언 |
| `CartDrawer.tsx` | **[NEW]** 장바구니 슬라이드 드로어 |
| `app/quote/summary/page.tsx` | **[NEW]** 견적서 요청 페이지 |
