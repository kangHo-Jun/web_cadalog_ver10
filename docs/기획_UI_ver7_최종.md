# 기획_UI_ver7_최종 - Accordion + 1행 레이아웃

**작성일:** 2025년 2월 14일  
**프로젝트:** web_cadalog_ver10  
**브랜드:** Daesan (대산)  
**핵심:** 한 번에 하나만 + 깔끔한 1행

---

## 🎯 핵심 변경사항

### 1. Accordion 방식 (단일 확장)
```
❌ ver6: 여러 그룹 동시 펼침 가능
✅ ver7: 한 번에 하나만 열림
```

### 2. 자식 상품 1행 표시
```
❌ ver6: 2행 (치수/가격, 수량/담기)
✅ ver7: 1행 (모든 정보 한 줄)
```

---

## 🎨 전체 레이아웃

```
┌─────────────────────────────────────────────────────┐
│ Daesan | 🔍 [검색...] (Ctrl+K)     🛒 장바구니 (3) │
├──────────┬──────────────────────────────────────────┤
│          │                                           │
│  [325] ← │  ┌─────────────────────────────────────┐ │
│  [326]   │  │ LX 단열재 (3개) ▾                    │ │
│  [327]   │  │ ├ 1220x2440 ₩15k [- 1 +] [담기]     │ │
│  [328]   │  │ ├ 1220x3050 ₩20k [- 1 +] [담기]     │ │
│  [329]   │  │ └ 915x2440  ₩25k [- 1 +] [담기]     │ │
│  [330]   │  └─────────────────────────────────────┘ │
│  [331]   │                                           │
│  [332]   │  ┌─────────────────────────────────────┐ │
│  [333]   │  │ 방화문 (1개) ▸                       │ │
│          │  └─────────────────────────────────────┘ │
│  ─────   │                                           │
│  ⌂ 전체  │  ┌─────────────────────────────────────┐ │
│          │  │ 석고보드 (5개) ▸                     │ │
│          │  └─────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────┘
```

---

## 📦 1. Accordion 구현

### 상태 관리 (단일 확장)

```typescript
// ❌ ver6 - 여러 개 동시 가능
const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

// ✅ ver7 - 하나만 가능
const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

const toggleExpand = (code: string) => {
  setExpandedProduct(prev => {
    // 같은 거 클릭하면 닫기
    if (prev === code) return null;
    // 다른 거 클릭하면 교체
    return code;
  });
};

const isExpanded = (code: string) => expandedProduct === code;
```

### 동작 시나리오

```
[초기 상태]
LX 단열재 ▸
방화문 ▸
석고보드 ▸

[LX 클릭]
LX 단열재 ▾
  ├ 1220x2440 ...
  ├ 1220x3050 ...
  └ 915x2440 ...
방화문 ▸
석고보드 ▸

[방화문 클릭]
LX 단열재 ▸     ← 자동 닫힘
방화문 ▾         ← 열림
  └ 2400x900 ...
석고보드 ▸

[방화문 다시 클릭]
LX 단열재 ▸
방화문 ▸         ← 닫힘
석고보드 ▸
```

---

## 📦 2. 부모 카드

### UI 구조

```
┌─────────────────────────────────┐
│ LX 단열재 (3개 옵션) ▸           │
└─────────────────────────────────┘
```

### 구현

```tsx
const ParentCard = ({ product, isExpanded, onToggle }) => {
  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* 부모 헤더 (클릭 영역) */}
      <button
        onClick={() => onToggle(product.code)}
        className={cn(
          "w-full text-left p-4",
          "hover:bg-gray-50 transition-colors",
          isExpanded && "bg-blue-50 border-b border-gray-200"
        )}
      >
        <div className="flex items-center justify-between">
          {/* 상품명 + 옵션 수 */}
          <div>
            <h3 className="text-base font-semibold text-[#222222]">
              {product.name}
            </h3>
            <p className="text-sm text-[#777777] mt-1">
              {product.children.length}개 옵션
            </p>
          </div>
          
          {/* 화살표 */}
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-[#FF6B6B]" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>
      
      {/* 자식 옵션 리스트 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {product.children.map((child, index) => (
              <ChildOption
                key={child.code}
                child={child}
                index={index}
                parentCode={product.code}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

---

## 📦 3. 자식 옵션 카드 (1행 레이아웃)

### UI 구조 (1행)

```
┌──────────────────────────────────────────────────┐
│ 1220 x 2440mm    ₩15,000    [- 1 +]    [담기]   │
└──────────────────────────────────────────────────┘
```

### 구현

```tsx
const ChildOption = ({ child, index, parentCode }) => {
  const [quantity, setQuantity] = useState(1);
  const [isFocused, setIsFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  // 키보드 네비게이션
  useEffect(() => {
    if (isFocused) {
      ref.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }
  }, [isFocused]);
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isFocused) return;
    
    switch(e.key) {
      case 'Enter':
        handleAddToCart();
        break;
      case 'ArrowUp':
        focusPrevOption(parentCode, index);
        break;
      case 'ArrowDown':
        focusNextOption(parentCode, index);
        break;
      case '+':
      case '=':
        setQuantity(q => q + 1);
        break;
      case '-':
        setQuantity(q => Math.max(1, q - 1));
        break;
    }
  };
  
  const handleAddToCart = () => {
    addToCart(child, quantity);
    setQuantity(1); // 담기 후 초기화
  };
  
  return (
    <div
      ref={ref}
      tabIndex={0}
      data-option-index={`${parentCode}-${index}`}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={handleKeyDown}
      className={cn(
        "px-4 py-3 border-t border-gray-100 first:border-t-0",
        "hover:bg-gray-50 transition-colors cursor-pointer",
        isFocused && "bg-blue-50 ring-2 ring-inset ring-[#FF6B6B]"
      )}
    >
      {/* 1행 레이아웃 */}
      <div className="flex items-center justify-between gap-4">
        {/* 치수 (왼쪽) */}
        <span className="text-sm font-medium text-[#222222] min-w-[120px]">
          {child.dimensions.width} x {child.dimensions.height}mm
        </span>
        
        {/* 가격 */}
        <span className="text-base font-bold text-[#222222] min-w-[80px]">
          ₩{(child.price / 1000).toFixed(0)}k
        </span>
        
        {/* 수량 선택 */}
        <div className="flex items-center border border-gray-300 rounded">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setQuantity(q => Math.max(1, q - 1));
            }}
            disabled={quantity <= 1}
            className={cn(
              "px-2 py-1 hover:bg-gray-100 transition-colors",
              quantity <= 1 && "opacity-50 cursor-not-allowed"
            )}
          >
            -
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setQuantity(isNaN(val) ? 1 : Math.max(1, val));
            }}
            onDoubleClick={(e) => e.currentTarget.select()}
            onClick={(e) => e.stopPropagation()}
            className="w-12 text-center border-x border-gray-300 py-1 text-sm focus:outline-none"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setQuantity(q => q + 1);
            }}
            className="px-2 py-1 hover:bg-gray-100 transition-colors"
          >
            +
          </button>
        </div>
        
        {/* 담기 버튼 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAddToCart();
          }}
          className="px-4 py-1.5 bg-[#FF6B6B] text-white text-sm font-medium rounded hover:bg-[#E55A5A] transition-colors"
        >
          담기
        </button>
      </div>
    </div>
  );
};
```

### 레이아웃 구성

```
┌─────────┬──────┬──────────┬────────┐
│ 치수    │ 가격 │ 수량     │ 담기   │
│ 120px   │ 80px │ 100px    │ 60px   │
└─────────┴──────┴──────────┴────────┘
```

**특징:**
1. ✅ 모든 정보 1행 표시
2. ✅ 가격 간략화 (₩15,000 → ₩15k)
3. ✅ 컴팩트한 수량 UI
4. ✅ 담기 버튼 최소 크기

---

## 🎬 사용자 플로우

### 시나리오 1: 단일 확장 (Accordion)

```
1. "LX 단열재" 클릭
   ↓
2. 자식 옵션 3개 펼쳐짐
   ↓
3. "방화문" 클릭
   ↓
4. LX 단열재 자동 닫힘
   방화문 펼쳐짐
   ↓
5. 명확한 포커스
```

---

### 시나리오 2: 빠른 주문

```
1. "LX 단열재" 클릭
   ↓
2. "1220 x 2440mm" 행 확인
   ₩15k [- 1 +] [담기]
   ↓
3. [+] 4번 클릭 (수량 5)
   ↓
4. [담기] 클릭
   ↓
5. Toast: "✓ 5개 추가됨"
```

---

### 시나리오 3: 키보드 (자동 스크롤)

```
1. ↓ 키로 "LX 단열재" 이동
   ↓
2. Enter → 확장
   ↓
3. ↓ 키로 "1220 x 2440mm" 옵션 이동
   (자동 스크롤)
   ↓
4. + 키 4번 (수량 5)
   ↓
5. Enter → 담기
```

---

## 📱 반응형 (1행 유지)

### 데스크톱 (>= 1024px)

```
┌──────────────┬─────────┬──────────┬────────┐
│ 1220 x 2440mm│ ₩15,000 │ [- 1 +]  │ [담기] │
└──────────────┴─────────┴──────────┴────────┘
```

### 태블릿 (768px ~ 1024px)

```
┌────────────┬────────┬────────┬────────┐
│ 1220x2440mm│ ₩15k   │ [- 1 +]│ [담기] │
└────────────┴────────┴────────┴────────┘
```

### 모바일 (< 768px)

```
┌──────────────────────────────────┐
│ 1220x2440  ₩15k  [1] [담기]      │
└──────────────────────────────────┘
```

**모바일 최적화:**
- 치수: `1220x2440` (공백 제거)
- 가격: `₩15k` (간략)
- 수량: `[1]` (증감 버튼 숨김, 클릭 시 확장)

---

## 🔑 키보드 네비게이션

### 부모 레벨

```
↑↓ : 부모 상품 간 이동
Enter/Space : 확장/닫기
→ : 확장 (닫힌 경우)
← : 닫기 (펼친 경우)
```

### 자식 레벨

```
↑↓ : 자식 옵션 간 이동 (자동 스크롤)
Enter : 담기
+/= : 수량 증가
- : 수량 감소
ESC : 부모로 포커스 이동
```

### 구현

```typescript
const handleParentKeyDown = (e: KeyboardEvent, code: string) => {
  switch(e.key) {
    case 'Enter':
    case ' ':
      toggleExpand(code);
      break;
    case 'ArrowRight':
      if (!isExpanded(code)) toggleExpand(code);
      break;
    case 'ArrowLeft':
      if (isExpanded(code)) toggleExpand(code);
      break;
    case 'ArrowDown':
      focusNextParent(code);
      break;
    case 'ArrowUp':
      focusPrevParent(code);
      break;
  }
};
```

---

## ⚡ 성능 최적화

### 1. Virtualization 적용

```typescript
const shouldVirtualize = products.length > 50;

{shouldVirtualize ? (
  <FixedSizeList
    height={window.innerHeight - 64}
    itemCount={products.length}
    itemSize={isExpanded(product.code) ? 200 : 80}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>
        <ParentCard product={products[index]} />
      </div>
    )}
  </FixedSizeList>
) : (
  products.map(product => (
    <ParentCard key={product.code} product={product} />
  ))
)}
```

---

### 2. Accordion 애니메이션 최적화

```tsx
<motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: "auto", opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ 
    duration: 0.2,
    ease: "easeInOut"
  }}
  style={{ overflow: "hidden" }}
>
  {/* 자식 옵션 */}
</motion.div>
```

---

## 📊 데이터 흐름

### 상태 관리 (Zustand)

```typescript
interface CatalogStore {
  // 상품
  products: Product[];
  filteredProducts: Product[];
  
  // 확장 상태 (단일)
  expandedProduct: string | null;
  setExpandedProduct: (code: string | null) => void;
  toggleExpand: (code: string) => void;
  
  // 검색
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // 카테고리
  activeCategory: number | null;
  setActiveCategory: (cat: number | null) => void;
  
  // 장바구니
  cart: CartItem[];
  addToCart: (product: Product, quantity: number) => void;
}

const useCatalogStore = create<CatalogStore>((set, get) => ({
  products: [],
  filteredProducts: [],
  expandedProduct: null,
  
  setExpandedProduct: (code) => set({ expandedProduct: code }),
  
  toggleExpand: (code) => set((state) => ({
    expandedProduct: state.expandedProduct === code ? null : code
  })),
  
  // ...
}));
```

---

## ✅ 검증 기준

| 테스트 | 기준 | 측정 방법 |
|--------|------|-----------|
| TEST-1 | 단일 확장 동작 | expandedProduct 값 |
| TEST-2 | 새 그룹 클릭 시 기존 닫힘 | 상태 변화 확인 |
| TEST-3 | 자식 1행 표시 | 화면 높이 측정 |
| TEST-4 | 키보드 자동 스크롤 | scrollIntoView |
| TEST-5 | 가격 간략화 (₩15k) | 표시 확인 |
| TEST-6 | 수량 초기화 (담기 후) | 기능 테스트 |
| TEST-7 | 모바일 1행 유지 | 반응형 테스트 |

---

## 🚀 구현 우선순위

### Phase 1: Accordion (필수)
```typescript
// 단일 확장 상태
const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

const toggleExpand = (code: string) => {
  setExpandedProduct(prev => prev === code ? null : code);
};
```

### Phase 2: 1행 레이아웃 (필수)
```tsx
<div className="flex items-center justify-between gap-4">
  <span>1220 x 2440mm</span>
  <span>₩15k</span>
  <div>[- 1 +]</div>
  <button>[담기]</button>
</div>
```

### Phase 3: 키보드 + 스크롤 (권장)
```typescript
element.scrollIntoView({ 
  behavior: 'smooth', 
  block: 'nearest' 
});
```

### Phase 4: 성능 최적화 (선택)
```
- react-window (50개 이상)
- 애니메이션 최적화
- 메모이제이션
```

---

## 📚 코딩 에이전시 전달 사항

### 즉시 구현 필요

```typescript
// 1. Accordion 상태
const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

// 2. 1행 레이아웃
<div className="flex items-center justify-between gap-4 p-3">
  <span className="min-w-[120px]">{dimensions}</span>
  <span className="min-w-[80px]">{price}</span>
  <QuantityInput />
  <AddButton />
</div>

// 3. 가격 간략화
const formatPrice = (price: number) => {
  return `₩${(price / 1000).toFixed(0)}k`;
};
```

### 변경사항 요약

```
✅ Set<string> → string | null (단일 확장)
✅ 2행 → 1행 레이아웃
✅ ₩15,000 → ₩15k (간략화)
✅ 자동 닫힘 동작
```

### 성공 기준

```
1. 한 번에 하나만 열림 ✓
2. 새 그룹 클릭 시 자동 닫힘 ✓
3. 자식 1행 표시 ✓
4. 모든 정보 한 줄에 ✓
```

---

**작성 완료:** 2025년 2월 14일  
**상태:** ver7 최종 완성  
**다음:** Phase 1-4 구현 시작
