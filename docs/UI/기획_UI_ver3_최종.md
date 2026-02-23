# 기획_UI_ver3_최종 - 좌측 사이드바 + 인라인 확장 카탈로그

**작성일:** 2025년 2월 14일  
**프로젝트:** web_cadalog_ver10  
**목표:** 빠른 네비게이션 + 명확한 부모-자식 구조

---

## 📊 상품 구조 정의

### 타입 A: 부모 + 자식 (옵션 상품)
```
부모: "LX 단열재"
실제 상품:
  - LX 단열재 340*234 (₩15,000)
  - LX 단열재 450*300 (₩20,000)
  - LX 단열재 600*400 (₩25,000)
```

**UI 표시:**
- 부모명만 표시
- 클릭 → 인라인 확장
- 각 자식: 규격/가격/수량/견적담기

---

### 타입 B: 단독 상품 (자식 없음)
```
상품: "P0000ABC 방화문" (₩150,000)
```

**UI 표시:**
- 상품코드 + 이름
- 가격/수량/견적담기 바로 표시

---

## 🎨 전체 레이아웃

```
┌──────────┬───────────────────────────────────────┐
│          │                                       │
│  [325]   │  ┌─────────────────────────────────┐ │
│  [326] ← │  │ LX 단열재                        │ │
│  [327]   │  │ [3개 옵션 보기 ▼]               │ │
│  [328]   │  └─────────────────────────────────┘ │
│  [329]   │                                       │
│  [330]   │  ┌─────────────────────────────────┐ │
│  [331]   │  │ P0000ABC 방화문                  │ │
│  [332]   │  │ ₩150,000                        │ │
│  [333]   │  │ [수량: 1] [견적담기]             │ │
│          │  └─────────────────────────────────┘ │
│  ─────   │                                       │
│  🔍 검색 │                                       │
│  ⌂ 전체  │                                       │
│          │                                       │
└──────────┴───────────────────────────────────────┘
  ↑ 고정              ↑ 스크롤 영역
```

**핵심:**
- 좌측 사이드바: 고정
- 우측 컨텐츠: 스크롤
- 자식 확장 시에도 카테고리 이동 가능

---

## 📐 상세 UI 명세

### 1️⃣ 좌측 사이드바 (고정)

```
┌──────────┐
│  [325]   │ ← 활성 (bg-blue-500 text-white)
│  [326]   │ ← 비활성 (hover:bg-gray-100)
│  [327]   │
│  [328]   │
│  [329]   │
│  [330]   │
│  [331]   │
│  [332]   │
│  [333]   │
│  ─────   │
│  🔍 검색 │ ← 전체 상품 검색
│  ⌂ 전체  │ ← 전체 카테고리
└──────────┘
```

**스펙:**
```typescript
// Tailwind CSS
<aside className="fixed left-0 top-0 h-screen w-48 bg-white border-r border-gray-200 overflow-y-auto">
  {/* 카테고리 버튼 */}
  <button className={cn(
    "w-full px-4 py-3 text-left transition-colors",
    isActive 
      ? "bg-blue-500 text-white font-semibold" 
      : "hover:bg-gray-100 text-gray-700"
  )}>
    카테고리 {catNo}
  </button>
  
  {/* 구분선 */}
  <div className="border-t border-gray-200 my-2" />
  
  {/* 검색 */}
  <button className="w-full px-4 py-3 text-left hover:bg-gray-100">
    🔍 검색
  </button>
  
  {/* 전체 */}
  <button className="w-full px-4 py-3 text-left hover:bg-gray-100">
    ⌂ 전체
  </button>
</aside>
```

---

### 2️⃣ 우측 컨텐츠 영역

#### A. 타입 A - 옵션 상품 (접힌 상태)

```
┌─────────────────────────────────────┐
│  LX 단열재                           │
│  [3개 옵션 보기 ▼]                   │
└─────────────────────────────────────┘
```

**스펙:**
```typescript
<div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-shadow">
  <h3 className="text-lg font-semibold text-gray-900">
    LX 단열재
  </h3>
  <button 
    onClick={() => setExpanded(!expanded)}
    className="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
  >
    {expanded ? "접기 ▲" : "3개 옵션 보기 ▼"}
  </button>
</div>
```

---

#### B. 타입 A - 옵션 상품 (펼친 상태)

```
┌─────────────────────────────────────────────────┐
│  LX 단열재                                       │
│  [접기 ▲]                                       │
│  ┌──────────┬──────────┬─────────────────┐   │
│  │ 규격     │ 가격     │ 주문            │   │
│  ├──────────┼──────────┼─────────────────┤   │
│  │ 340*234  │ ₩15,000  │ [- 1 +][담기]   │   │
│  │ 450*300  │ ₩20,000  │ [- 1 +][담기]   │   │
│  │ 600*400  │ ₩25,000  │ [- 1 +][담기]   │   │
│  └──────────┴──────────┴─────────────────┘   │
└─────────────────────────────────────────────────┘
```

**스펙:**
```typescript
{expanded && (
  <motion.div
    initial={{ height: 0, opacity: 0 }}
    animate={{ height: "auto", opacity: 1 }}
    exit={{ height: 0, opacity: 0 }}
    transition={{ duration: 0.2 }}
    className="mt-4"
  >
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">규격</th>
          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">가격</th>
          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">주문</th>
        </tr>
      </thead>
      <tbody>
        {children.map((child, idx) => (
          <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
            <td className="px-4 py-3 text-sm">{child.spec}</td>
            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
              ₩{child.price.toLocaleString()}
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                {/* 수량 선택 */}
                <div className="flex items-center border border-gray-300 rounded-lg">
                  <button className="px-2 py-1 hover:bg-gray-100">-</button>
                  <input 
                    type="number" 
                    value={1} 
                    className="w-12 text-center border-x border-gray-300"
                  />
                  <button className="px-2 py-1 hover:bg-gray-100">+</button>
                </div>
                {/* 견적담기 */}
                <button className="px-4 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600">
                  담기
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </motion.div>
)}
```

---

#### C. 타입 B - 단독 상품

```
┌─────────────────────────────────────┐
│  P0000ABC 방화문                     │
│  ₩150,000                           │
│  [수량: - 1 +] [견적담기]            │
└─────────────────────────────────────┘
```

**스펙:**
```typescript
<div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-shadow">
  <h3 className="text-lg font-semibold text-gray-900">
    P0000ABC 방화문
  </h3>
  <p className="mt-2 text-xl font-bold text-blue-600">
    ₩150,000
  </p>
  <div className="mt-3 flex items-center gap-3">
    {/* 수량 선택 */}
    <div className="flex items-center border border-gray-300 rounded-lg">
      <button className="px-3 py-2 hover:bg-gray-100">-</button>
      <input 
        type="number" 
        value={1} 
        className="w-16 text-center border-x border-gray-300"
      />
      <button className="px-3 py-2 hover:bg-gray-100">+</button>
    </div>
    {/* 견적담기 */}
    <button className="flex-1 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium">
      견적담기
    </button>
  </div>
</div>
```

---

## 🔧 데이터 구조

### API 응답 매핑

```typescript
// /api/sync-products 응답
{
  "P0000CNJ": {
    "prefix": "P0000CNJ",
    "parentName": "LX 단열재",
    "categoryNo": 325,
    "children": [
      {
        "product_code": "P0000CNJ",
        "product_name": "LX 단열재 340*234",
        "spec": "340*234",
        "price": 15000,
        "stock": 50
      },
      {
        "product_code": "P0000CNJ-A",
        "product_name": "LX 단열재 450*300",
        "spec": "450*300",
        "price": 20000,
        "stock": 30
      }
    ]
  },
  "P0000ABC": {
    "prefix": "P0000ABC",
    "parentName": "방화문",
    "categoryNo": 326,
    "children": []  // 빈 배열 = 단독 상품
  }
}
```

### UI 컴포넌트 Props

```typescript
// 부모 상품
interface ParentProduct {
  code: string;           // P0000CNJ
  name: string;           // LX 단열재
  categoryNo: number;     // 325
  hasChildren: boolean;   // children.length > 0
  children: ChildVariant[];
  price?: number;         // 단독 상품인 경우만
  stock?: number;         // 단독 상품인 경우만
}

// 자식 옵션
interface ChildVariant {
  code: string;      // P0000CNJ
  fullName: string;  // LX 단열재 340*234
  spec: string;      // 340*234
  price: number;     // 15000
  stock: number;     // 50
}
```

---

## 🚀 사용자 플로우

### 시나리오 1: 옵션 상품 주문

```
1. 좌측 사이드바에서 [325] 클릭
   ↓
2. "LX 단열재" 카드의 [3개 옵션 보기 ▼] 클릭
   ↓
3. 테이블 확장 (340*234, 450*300, 600*400)
   ↓
4. "340*234" 행에서 수량 조정 (예: 5개)
   ↓
5. [담기] 버튼 클릭
   ↓
6. 우측 상단 장바구니 아이콘에 (1) 표시
   ↓
7. 다른 옵션도 추가 가능
   ↓
8. 또는 좌측 [326] 클릭하여 다른 카테고리 이동
```

---

### 시나리오 2: 단독 상품 주문

```
1. 좌측 사이드바에서 [326] 클릭
   ↓
2. "P0000ABC 방화문" 카드에서 바로 수량 조정
   ↓
3. [견적담기] 클릭
   ↓
4. 장바구니 추가 완료
```

---

### 시나리오 3: 빠른 카테고리 이동

```
1. "LX 단열재" 옵션 확장 중
   ↓
2. 좌측 사이드바 [327] 클릭
   ↓
3. 즉시 카테고리 327 상품 표시
   ↓
4. 스크롤 위치 유지되므로 편리
```

---

## 🎯 핵심 기능 요구사항

### MUST (필수)

1. **좌측 사이드바 고정**
   - `position: fixed`
   - 스크롤 시에도 항상 보임
   - 카테고리 버튼 클릭 즉시 반응 (< 100ms)

2. **인라인 확장 애니메이션**
   - Framer Motion 사용
   - 펼침/접힘: 200ms 이내
   - 자연스러운 easing

3. **타입 구분 로직**
   ```typescript
   const hasChildren = product.children.length > 0;
   
   if (hasChildren) {
     // 타입 A: 옵션 상품 렌더링
   } else {
     // 타입 B: 단독 상품 렌더링
   }
   ```

4. **견적 담기 기능**
   - 전역 상태 관리 (Zustand)
   - 장바구니 카운트 표시
   - 중복 추가 시 수량 증가

---

### SHOULD (권장)

1. **검색 기능**
   - 좌측 사이드바 하단 검색 버튼
   - 모달 또는 드롭다운으로 검색창
   - 상품명/상품코드 검색

2. **전체 보기**
   - 모든 카테고리 상품 한 번에 표시
   - 카테고리별 구분선

3. **로딩 상태**
   - 카테고리 전환 시 스켈레톤 UI
   - 데이터 로딩 중 표시

---

### COULD (선택)

1. **카테고리명 표시**
   - API에서 카테고리명 가져오기
   - [325] → [방화문]

2. **즐겨찾기**
   - 자주 보는 상품 즐겨찾기
   - 사이드바 상단에 표시

3. **최근 본 상품**
   - localStorage 저장
   - 우측 하단 플로팅 버튼

---

## 📱 반응형 대응

### 데스크톱 (>= 1024px)
```
좌측 사이드바: 192px (w-48)
우측 컨텐츠: calc(100% - 192px)
```

### 태블릿 (768px ~ 1024px)
```
좌측 사이드바: 128px (w-32)
카테고리 번호만 표시
```

### 모바일 (< 768px)
```
좌측 사이드바: 숨김
상단 햄버거 메뉴 → 드로어
카테고리: 가로 스크롤 탭
```

---

## 🎨 디자인 토큰

### 색상
```css
:root {
  /* Primary */
  --primary-500: #3B82F6;
  --primary-600: #2563EB;
  
  /* Neutral */
  --gray-50: #F9FAFB;
  --gray-100: #F3F4F6;
  --gray-200: #E5E7EB;
  --gray-700: #374151;
  --gray-900: #111827;
  
  /* Success */
  --green-500: #10B981;
  
  /* Glassmorphism */
  --glass-bg: rgba(255, 255, 255, 0.8);
  --glass-border: rgba(229, 231, 235, 0.5);
}
```

### 간격
```css
--spacing-xs: 0.5rem;   /* 8px */
--spacing-sm: 0.75rem;  /* 12px */
--spacing-md: 1rem;     /* 16px */
--spacing-lg: 1.5rem;   /* 24px */
--spacing-xl: 2rem;     /* 32px */
```

### 타이포그래피
```css
/* 제목 */
--font-heading: 'Pretendard', -apple-system, sans-serif;
--font-size-h3: 1.125rem; /* 18px */
--font-weight-semibold: 600;

/* 본문 */
--font-size-body: 0.875rem; /* 14px */
--font-size-small: 0.75rem; /* 12px */

/* 가격 */
--font-size-price: 1.25rem; /* 20px */
--font-weight-bold: 700;
```

---

## ✅ 검증 기준

### TEST-1: 네비게이션 속도
```typescript
const startTime = performance.now();
onCategoryClick(325);
const endTime = performance.now();
expect(endTime - startTime).toBeLessThan(100); // 100ms 이내
```

### TEST-2: 확장 애니메이션
```typescript
const startTime = performance.now();
onExpandClick();
// 애니메이션 완료 대기
await waitForAnimation();
const endTime = performance.now();
expect(endTime - startTime).toBeLessThan(200); // 200ms 이내
```

### TEST-3: 렌더링 성능
```typescript
// 100개 상품 렌더링
const products = Array(100).fill(mockProduct);
const startTime = performance.now();
render(<ProductList products={products} />);
const endTime = performance.now();
expect(endTime - startTime).toBeLessThan(500); // 500ms 이내
```

---

## 🔄 구현 순서

### Phase 1: 레이아웃 구조 (우선순위: 최상)
```typescript
// 1. 좌측 사이드바 컴포넌트
<Sidebar categories={[325, 326, ..., 333]} />

// 2. 우측 컨텐츠 영역
<main className="ml-48 p-6">
  <ProductList products={filteredProducts} />
</main>
```

---

### Phase 2: 상품 카드 (우선순위: 높음)
```typescript
// 타입 구분 로직
{products.map(product => (
  product.children.length > 0 
    ? <ExpandableProductCard product={product} />
    : <SimpleProductCard product={product} />
))}
```

---

### Phase 3: 확장 애니메이션 (우선순위: 중간)
```typescript
// Framer Motion
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence>
  {expanded && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
    >
      {/* 테이블 */}
    </motion.div>
  )}
</AnimatePresence>
```

---

### Phase 4: 견적 담기 (우선순위: 중간)
```typescript
// Zustand 스토어
interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQuantity: (code: string, quantity: number) => void;
  removeItem: (code: string) => void;
}

// 사용
const { addItem } = useCartStore();
addItem({
  code: "P0000CNJ",
  name: "LX 단열재 340*234",
  price: 15000,
  quantity: 1
});
```

---

### Phase 5: 검색/필터 (우선순위: 낮음)
```typescript
// 검색 모달
<SearchModal 
  isOpen={isSearchOpen}
  onClose={() => setIsSearchOpen(false)}
  products={allProducts}
/>
```

---

## 📚 코딩 에이전시 전달 사항

### 즉시 구현 필요 (Phase 1-2)

```
1. 좌측 사이드바 고정 레이아웃
   - 카테고리 325-333 버튼
   - 활성 상태 스타일링
   - 클릭 이벤트 핸들링

2. 우측 컨텐츠 영역
   - 타입 A/B 구분 렌더링
   - 접힌 상태 카드
   - 펼친 상태 테이블

3. 데이터 연동
   - /api/sync-products 호출
   - children.length로 타입 구분
   - 카테고리 필터링
```

### 기술 스택

```json
{
  "framework": "Next.js 14",
  "styling": "Tailwind CSS",
  "animation": "Framer Motion",
  "state": "Zustand",
  "deployment": "Vercel"
}
```

### 성공 기준

```
✅ 카테고리 클릭 → 100ms 이내 전환
✅ 옵션 확장 → 200ms 이내 애니메이션
✅ 100개 상품 → 500ms 이내 렌더링
✅ 모바일 반응형 완벽 대응
```

---

**작성 완료:** 2025년 2월 14일  
**상태:** 코딩 에이전시 전달 준비 완료  
**다음:** Phase 1-2 구현 시작
