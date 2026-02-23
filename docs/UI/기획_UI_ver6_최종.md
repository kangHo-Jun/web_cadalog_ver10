# 기획_UI_ver6_최종 - 깔끔한 부모-자식 구조

**작성일:** 2025년 2월 14일  
**프로젝트:** web_cadalog_ver10  
**브랜드:** Daesan (대산)  
**핵심:** 깔끔한 리스트 + 클릭 확장 + 빠른 견적

---

## 🎯 핵심 변경사항

### 1. 부모-자식 분리 표시
```
❌ 기존: 모든 옵션 동시 표시 (산만)
✅ 개선: 부모만 리스트 → 클릭 시 자식 확장
```

### 2. 부모 카드 간소화
```
❌ 기존: LX 단열재 (1220 x 2440mm)
✅ 개선: LX 단열재 (3개 옵션) ▸
```

### 3. 자식 정보 명확화
```
❌ 기존: P0000CAF
✅ 개선: 1220 x 2440mm
```

### 4. 스크롤 자동 추적
```
✅ 키보드 네비게이션 시 자동 스크롤
✅ 포커스 항목 항상 화면 내 유지
```

### 5. 마우스 + 키보드 모두 지원
```
✅ 마우스 클릭
✅ 키보드 ↑↓ Enter
```

### 6. 수량 선택 UI
```
✅ [- 수량 +] 버튼
✅ 직접 입력 가능
```

---

## 🎨 전체 레이아웃

```
┌─────────────────────────────────────────────────────┐
│ Daesan | 🔍 [검색...] (Ctrl+K)     🛒 장바구니 (3) │
├──────────┬──────────────────────────────────────────┤
│          │                                           │
│  [325] ← │  ┌─────────────────────────────────┐    │
│  [326]   │  │ LX 단열재 (3개 옵션) ▸          │    │
│  [327]   │  └─────────────────────────────────┘    │
│  [328]   │                                           │
│  [329]   │  ┌─────────────────────────────────┐    │
│  [330]   │  │ 방화문 ▾                         │    │
│  [331]   │  │ ┌─────────────────────────────┐ │    │
│  [332]   │  │ │ 2400 x 900mm   ₩150,000     │ │    │
│  [333]   │  │ │ 수량: [- 1 +]  [담기]        │ │    │
│          │  │ └─────────────────────────────┘ │    │
│  ─────   │  └─────────────────────────────────┘    │
│  ⌂ 전체  │                                           │
│          │  ┌─────────────────────────────────┐    │
│          │  │ 석고보드 (5개 옵션) ▸           │    │
│          │  └─────────────────────────────────┘    │
└──────────┴──────────────────────────────────────────┘
```

---

## 📦 1. 부모 카드 (접힌 상태)

### UI 구조
```
┌───────────────────────────────────┐
│  LX 단열재 (3개 옵션) ▸            │
└───────────────────────────────────┘
```

### 구현
```tsx
<button
  onClick={() => toggleExpand(product.code)}
  className={cn(
    "w-full text-left p-4 bg-white border rounded-lg",
    "hover:shadow-md transition-shadow",
    isExpanded && "border-[#FF6B6B]"
  )}
>
  <div className="flex items-center justify-between">
    {/* 상품명 + 옵션 수 */}
    <div>
      <h3 className="text-lg font-semibold text-[#222222]">
        {product.name}
      </h3>
      <p className="text-sm text-[#777777] mt-1">
        {product.children.length}개 옵션
      </p>
    </div>
    
    {/* 화살표 */}
    <ChevronRight 
      className={cn(
        "w-5 h-5 text-gray-400 transition-transform",
        isExpanded && "rotate-90"
      )}
    />
  </div>
</button>
```

**특징:**
- ❌ 치수 정보 없음
- ✅ 옵션 개수만 표시
- ✅ 화살표 회전 애니메이션 (▸ → ▾)

---

## 📦 2. 부모 카드 (펼친 상태)

### UI 구조
```
┌─────────────────────────────────────────┐
│  LX 단열재 (3개 옵션) ▾                  │
│  ┌───────────────────────────────────┐  │
│  │ 1220 x 2440mm      ₩15,000        │  │
│  │ 수량: [- 1 +]      [담기]         │  │
│  ├───────────────────────────────────┤  │
│  │ 1220 x 3050mm      ₩20,000        │  │
│  │ 수량: [- 1 +]      [담기]         │  │
│  ├───────────────────────────────────┤  │
│  │ 915 x 2440mm       ₩25,000        │  │
│  │ 수량: [- 1 +]      [담기]         │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 구현
```tsx
<div className="border border-[#FF6B6B] rounded-lg overflow-hidden">
  {/* 부모 헤더 */}
  <button
    onClick={() => toggleExpand(product.code)}
    className="w-full text-left p-4 bg-white"
  >
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold text-[#222222]">
          {product.name}
        </h3>
        <p className="text-sm text-[#777777] mt-1">
          {product.children.length}개 옵션
        </p>
      </div>
      <ChevronDown className="w-5 h-5 text-[#FF6B6B]" />
    </div>
  </button>
  
  {/* 자식 옵션 리스트 */}
  <AnimatePresence>
    {isExpanded && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="border-t border-gray-200"
      >
        {product.children.map((child, index) => (
          <ChildOption 
            key={child.code}
            child={child}
            index={index}
            onAddToCart={handleAddToCart}
          />
        ))}
      </motion.div>
    )}
  </AnimatePresence>
</div>
```

---

## 📦 3. 자식 옵션 카드

### UI 구조
```
┌─────────────────────────────────────┐
│ 1220 x 2440mm         ₩15,000       │
│ 수량: [- 1 +]         [담기]        │
└─────────────────────────────────────┘
```

### 구현
```tsx
const ChildOption = ({ child, index, onAddToCart }) => {
  const [quantity, setQuantity] = useState(1);
  const [isFocused, setIsFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  // 키보드 네비게이션
  useEffect(() => {
    if (isFocused) {
      // 자동 스크롤
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
        onAddToCart(child, quantity);
        break;
      case 'ArrowUp':
        focusPrevOption(index);
        break;
      case 'ArrowDown':
        focusNextOption(index);
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
  
  return (
    <div
      ref={ref}
      tabIndex={0}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={handleKeyDown}
      className={cn(
        "p-4 border-t border-gray-100 first:border-t-0",
        "hover:bg-gray-50 transition-colors",
        isFocused && "bg-blue-50 ring-2 ring-[#FF6B6B] ring-inset"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        {/* 치수 */}
        <span className="text-base font-medium text-[#222222]">
          {child.dimensions.width} x {child.dimensions.height}mm
        </span>
        
        {/* 가격 */}
        <span className="text-lg font-bold text-[#222222]">
          ₩{child.price.toLocaleString()}
        </span>
      </div>
      
      <div className="flex items-center gap-3">
        {/* 수량 선택 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#777777]">수량:</span>
          <div className="flex items-center border border-gray-300 rounded">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="px-3 py-1 hover:bg-gray-100"
            >
              -
            </button>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              onDoubleClick={(e) => e.currentTarget.select()}
              className="w-16 text-center border-x border-gray-300 py-1"
            />
            <button
              onClick={() => setQuantity(q => q + 1)}
              className="px-3 py-1 hover:bg-gray-100"
            >
              +
            </button>
          </div>
        </div>
        
        {/* 담기 버튼 */}
        <button
          onClick={() => onAddToCart(child, quantity)}
          className="flex-1 px-6 py-2 bg-[#FF6B6B] text-white rounded hover:bg-[#E55A5A] font-medium"
        >
          담기
        </button>
      </div>
    </div>
  );
};
```

**핵심 기능:**
1. ✅ 치수 표시 (1220 x 2440mm)
2. ✅ 수량 선택 ([- 수량 +])
3. ✅ 더블클릭 → 전체 선택
4. ✅ 키보드 +/- → 수량 조절
5. ✅ Enter → 담기
6. ✅ ↑↓ → 이동 (자동 스크롤)

---

## ⌨️ 4. 키보드 네비게이션 (스크롤 자동 추적)

### 문제
```
❌ 화살표 ↓ 누르면 화면 밖으로 사라짐
```

### 해결
```typescript
const focusNextOption = (currentIndex: number) => {
  const nextIndex = currentIndex + 1;
  const nextElement = document.querySelector(
    `[data-option-index="${nextIndex}"]`
  );
  
  if (nextElement) {
    (nextElement as HTMLElement).focus();
    
    // 자동 스크롤
    nextElement.scrollIntoView({ 
      behavior: 'smooth',
      block: 'nearest'  // 화면 안에 유지
    });
  }
};
```

### scrollIntoView 옵션
```typescript
element.scrollIntoView({
  behavior: 'smooth',  // 부드럽게
  block: 'nearest',    // 화면 밖이면 최소한으로 스크롤
  inline: 'nearest'
});
```

**동작:**
```
[화면 상단]
  옵션 1  ← 포커스
  옵션 2
  옵션 3
[화면 하단]

↓ 키 3번
  ↓
[자동 스크롤]
  
[화면 상단]
  옵션 2
  옵션 3
  옵션 4  ← 포커스 (자동으로 보임)
[화면 하단]
```

---

## 🖱️ 5. 마우스 + 키보드 동시 지원

### 구현
```tsx
const ChildOption = ({ child }) => {
  const [isFocused, setIsFocused] = useState(false);
  
  return (
    <div
      tabIndex={0}
      onClick={() => setIsFocused(true)}  // 마우스 클릭
      onFocus={() => setIsFocused(true)}  // 키보드 Tab
      onBlur={() => setIsFocused(false)}
      className={cn(
        "cursor-pointer",
        isFocused && "ring-2 ring-[#FF6B6B]"
      )}
    >
      {/* 내용 */}
    </div>
  );
};
```

**지원 방식:**
1. ✅ 마우스 클릭 → 포커스
2. ✅ Tab 키 → 포커스
3. ✅ ↑↓ 키 → 이동
4. ✅ Enter → 담기
5. ✅ +/- → 수량 조절

---

## 🔢 6. 수량 선택 UI 상세

### UI 구조
```
┌──────────────────────────────┐
│ 수량: [- 1 +]  [담기]         │
└──────────────────────────────┘
```

### 기능
```typescript
const QuantityInput = ({ value, onChange }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    onChange(isNaN(val) ? 1 : Math.max(1, val));
  };
  
  return (
    <div className="flex items-center border border-gray-300 rounded">
      {/* - 버튼 */}
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        className="px-3 py-1 hover:bg-gray-100 transition-colors"
        disabled={value <= 1}
      >
        -
      </button>
      
      {/* 숫자 입력 */}
      <input
        type="number"
        value={value}
        onChange={handleInputChange}
        onDoubleClick={(e) => e.currentTarget.select()}
        min={1}
        className="w-16 text-center border-x border-gray-300 py-1 focus:outline-none"
      />
      
      {/* + 버튼 */}
      <button
        onClick={() => onChange(value + 1)}
        className="px-3 py-1 hover:bg-gray-100 transition-colors"
      >
        +
      </button>
    </div>
  );
};
```

**특징:**
1. ✅ `-` 버튼: 최소값 1
2. ✅ 직접 입력 가능
3. ✅ 더블클릭 → 전체 선택
4. ✅ `+` 버튼: 무제한
5. ✅ 키보드 +/- 단축키

---

## 📊 데이터 구조

### 부모 상품
```typescript
interface ParentProduct {
  code: string;           // P0000CNJ
  name: string;           // LX 단열재
  categoryNo: number;     // 325
  children: ChildOption[];
}
```

### 자식 옵션
```typescript
interface ChildOption {
  code: string;       // P0000CNJ-A
  fullName: string;   // LX 단열재 1220 x 2440mm
  dimensions: {
    width: string;    // "1220"
    height: string;   // "2440"
    thickness?: string; // "24T"
  };
  price: number;      // 15000
  stock: number;      // 50
}
```

### 화면 표시
```typescript
// 부모 카드
<h3>{product.name}</h3>
<p>{product.children.length}개 옵션</p>

// 자식 카드
<span>{child.dimensions.width} x {child.dimensions.height}mm</span>
<span>₩{child.price.toLocaleString()}</span>
```

---

## 🎬 사용자 플로우

### 시나리오 1: 마우스 사용
```
1. "LX 단열재" 카드 클릭
   ↓
2. 옵션 확장 (1220 x 2440mm, 1220 x 3050mm, ...)
   ↓
3. "1220 x 2440mm" 옵션의 수량 [+] 클릭 (5개)
   ↓
4. [담기] 클릭
   ↓
5. Toast: "✓ LX 단열재 1220 x 2440mm 5개 추가됨"
```

---

### 시나리오 2: 키보드 사용
```
1. ↓ 키로 "LX 단열재" 이동
   ↓
2. Enter 또는 Space → 확장
   ↓
3. ↓ 키로 "1220 x 2440mm" 옵션 이동 (자동 스크롤)
   ↓
4. + 키 4번 (수량 5개)
   ↓
5. Enter → 담기
   ↓
6. Toast 알림
```

---

### 시나리오 3: 혼합 사용
```
1. 검색 "LX" (Ctrl+K)
   ↓
2. 마우스 클릭 "LX 단열재" 확장
   ↓
3. ↓ 키로 옵션 탐색
   ↓
4. 마우스로 수량 조절
   ↓
5. Enter 또는 클릭 → 담기
```

---

## ✅ 검증 기준

| 테스트 | 기준 | 측정 방법 |
|--------|------|-----------|
| TEST-1 | 부모 클릭 → 자식 확장 < 200ms | Framer Motion |
| TEST-2 | 자식 카드에 치수만 표시 | 화면 확인 |
| TEST-3 | ↓ 키 시 자동 스크롤 | scrollIntoView |
| TEST-4 | 마우스 클릭 포커스 가능 | onClick + onFocus |
| TEST-5 | 수량 입력/증감 정상 작동 | 기능 테스트 |
| TEST-6 | 더블클릭 전체 선택 | onDoubleClick |
| TEST-7 | 키보드 +/- 수량 조절 | onKeyDown |

---

## 🚀 구현 우선순위

### Phase 1: 기본 구조 (필수)
```
✅ 부모 카드 접기/펼치기
✅ 자식 옵션 리스트
✅ 치수 표시 (코드 제거)
✅ 수량 선택 UI
```

### Phase 2: 인터랙션 (필수)
```
✅ 마우스 클릭 확장
✅ 키보드 ↑↓ 네비게이션
✅ Enter 담기
✅ scrollIntoView 자동 스크롤
```

### Phase 3: 고급 기능 (권장)
```
✅ 수량 +/- 단축키
✅ 더블클릭 전체 선택
✅ Undo 3초
✅ react-window (50개 이상)
```

---

## 📚 코딩 에이전시 전달 사항

### 즉시 구현 필요

```typescript
// 1. 부모 카드 (접기/펼치기)
const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

const toggleExpand = (code: string) => {
  setExpandedProducts(prev => {
    const next = new Set(prev);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    return next;
  });
};

// 2. 자동 스크롤
element.scrollIntoView({ 
  behavior: 'smooth', 
  block: 'nearest' 
});

// 3. 수량 UI
<div className="flex items-center border rounded">
  <button onClick={decrease}>-</button>
  <input 
    type="number" 
    value={qty}
    onDoubleClick={(e) => e.currentTarget.select()}
  />
  <button onClick={increase}>+</button>
</div>
```

### 제거할 것
```
❌ 부모 카드에서 치수 표시
❌ 자식 카드에서 상품코드 표시
❌ 기본 옵션 펼침 (ver5 롤백)
```

### 성공 기준
```
1. 부모만 나열 ✓
2. 클릭 시 자식 확장 ✓
3. 치수만 표시 ✓
4. 자동 스크롤 ✓
5. 수량 선택 UI ✓
```

---

**작성 완료:** 2025년 2월 14일  
**상태:** ver6 최종 완성  
**다음:** Phase 1-3 구현 시작
