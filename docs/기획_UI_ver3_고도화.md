# 기획_UI_ver3 - Apple-style Glassmorphism 2단 Hover UI (고도화)

**작성일:** 2025년 2월 14일  
**프로젝트:** web_cadalog_ver10  
**목표:** 274개 부모 상품 → 자식 옵션 2단 구조 최적화 UI

---

## 📊 현재 UI 분석

### ❌ 발견된 문제점

1. **대분류 표시 문제**
   - 현재: "전체" 하나만 노출
   - 데이터: 카테고리 325-333 (9개)
   - **원인:** 카테고리 그룹핑 로직 누락

2. **부모 상품 정보 부족**
   - 현재: 부모 상품만 표시
   - 누락 정보:
     - ❌ 치수 정보 (예: 24T x 1220 x 2440mm)
     - ❌ 상품 코드 (예: P0000CNJ)
     - ❌ 가격
     - ❌ 수량 선택
     - ❌ 견적 담기

3. **자식 옵션 접근 불가**
   - 현재: 부모만 표시
   - 필요: Hover 시 자식 옵션 패널 노출

---

## 🎯 개선 목표

### Phase 1: 정보 아키텍처 재구성

```
[카테고리 탭] (325-333)
  └─ [부모 상품 리스트] (274개)
      └─ [Hover → 자식 옵션 패널] (variants)
```

---

## 📐 UI/UX 설계 (ver3)

### 1️⃣ 상단: 카테고리 탭

```
┌─────────────────────────────────────────────────────┐
│  [325] [326] [327] [328] [329] [330] [331] [332] [333]  │
│   ▔▔▔  활성                                              │
└─────────────────────────────────────────────────────┘
```

**스펙:**
- Tailwind: `tabs tabs-boxed`
- 활성 탭: `tab-active` + `bg-gradient-to-r from-blue-500 to-purple-600`
- 카테고리명 API 연동 (예: "방화문", "목재" 등)

---

### 2️⃣ 좌측: 부모 상품 리스트 (Apple Card Style)

```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐   │
│  │ [P0000CNJ] 24T 자작합판      │ ← 부모 카드
│  │ 24T x 1220 x 2440mm         │
│  │ ₩45,000 ~                   │
│  │ [3 variants ▸]              │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [P0000CNI] 18T 자작합판      │
│  │ 18T x 1220 x 2440mm         │
│  │ ₩38,000 ~                   │
│  │ [2 variants ▸]              │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**스펙:**
- 카드: `bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg`
- Hover: `scale-[1.02] shadow-2xl transition-all duration-200`
- 정보 표시:
  - 상품코드: `text-sm text-gray-500`
  - 상품명: `text-lg font-semibold`
  - 치수: `text-sm text-gray-600`
  - 가격: `text-xl font-bold text-blue-600`
  - Variants 수: `text-xs text-purple-600`

---

### 3️⃣ 우측: 자식 옵션 패널 (Glassmorphism)

#### A. 배경 블러 레이어
```css
/* 전체 화면 오버레이 */
backdrop-filter: blur(12px);
background: rgba(255, 255, 255, 0.6);
```

#### B. 패널 디자인
```
┌───────────────────────────────────────┐
│  ┌─────────────────────────────────┐ │ ← Glassmorphism Panel
│  │  24T 자작합판 - 옵션 선택        │ │
│  │  ─────────────────────────────  │ │
│  │                                 │ │
│  │  ○ 24T x 1220 x 2440mm         │ │
│  │     ₩45,000                     │ │
│  │     재고: 20개                   │ │
│  │     수량: [- 1 +] [견적담기]     │ │
│  │                                 │ │
│  │  ○ 24T x 1220 x 3050mm         │ │
│  │     ₩52,000                     │ │
│  │     재고: 15개                   │ │
│  │     수량: [- 1 +] [견적담기]     │ │
│  │                                 │ │
│  │  ○ 24T x 915 x 2440mm          │ │
│  │     ₩38,000                     │ │
│  │     재고: 30개                   │ │
│  │     수량: [- 1 +] [견적담기]     │ │
│  │                                 │ │
│  └─────────────────────────────────┘ │
└───────────────────────────────────────┘
```

**스펙:**
- 패널: `bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl`
- 모션: Framer Motion
  ```typescript
  initial={{ opacity: 0, scale: 0.98, x: 20 }}
  animate={{ opacity: 1, scale: 1, x: 0 }}
  transition={{ duration: 0.15 }}
  ```
- 옵션 카드:
  - `bg-white/50 rounded-xl p-4 border border-gray-200/50`
  - Hover: `bg-white/80 border-blue-300`
- 수량 선택: `input[type="number"]` + Tailwind
- 견적담기: `btn btn-primary btn-sm`

---

### 4️⃣ 새로운 UI 아이디어: 비교 모드

**문제:** 부모 상품만 보면 자식 옵션 비교가 어려움

**해결:** 비교 토글 버튼 추가

```
┌─────────────────────────────────────┐
│  [목록 모드] [비교 모드 ▼]           │ ← 토글
└─────────────────────────────────────┘

[비교 모드 활성화 시]
┌─────────────────────────────────────┐
│  24T 자작합판 (3 variants)           │
│  ───────────────────────────────── │
│  | 규격         | 가격    | 재고  | │
│  |─────────────|─────────|───────| │
│  | 1220x2440mm | ₩45,000 | 20개  | │
│  | 1220x3050mm | ₩52,000 | 15개  | │
│  | 915x2440mm  | ₩38,000 | 30개  | │
│  ───────────────────────────────── │
│  [전체 견적담기]                      │
└─────────────────────────────────────┘
```

---

## 🔧 기술 스펙 (엄격 준수)

### CSS Framework
```typescript
// Tailwind CSS Classes
const styles = {
  categoryTab: "tabs tabs-boxed gap-2",
  parentCard: "bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg hover:scale-[1.02] transition-all duration-200",
  childPanel: "fixed right-0 top-0 h-full w-96 bg-white/90 backdrop-blur-xl shadow-2xl",
  overlay: "fixed inset-0 backdrop-blur-sm bg-white/60",
  optionCard: "bg-white/50 rounded-xl p-4 border border-gray-200/50 hover:bg-white/80"
}
```

### Motion (Framer Motion)
```typescript
// 자식 패널 등장 애니메이션
<motion.div
  initial={{ opacity: 0, scale: 0.98, x: 20 }}
  animate={{ opacity: 1, scale: 1, x: 0 }}
  exit={{ opacity: 0, scale: 0.98, x: 20 }}
  transition={{ duration: 0.15, ease: "easeOut" }}
>
```

### Safe Triangle 로직
```typescript
// 마우스가 부모 → 자식 이동 시 패널 유지
const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

const isInSafeTriangle = (parentRect, childRect, mousePos) => {
  // 삼각형 영역 계산
  const triangle = [
    { x: parentRect.right, y: parentRect.top },
    { x: childRect.left, y: childRect.top },
    { x: childRect.left, y: childRect.bottom }
  ];
  // 마우스가 삼각형 내부인지 확인
  return pointInTriangle(mousePos, triangle);
};
```

---

## 📊 데이터 구조 매핑

### API 응답 → UI 매핑

```typescript
// /api/sync-products 응답
{
  "P0000CNJ": {
    "prefix": "P0000CNJ",
    "parentName": "24T 자작합판",
    "categoryNo": 325,
    "children": [
      {
        "product_code": "P0000CNJ",
        "product_name": "24T 자작합판 1220x2440",
        "price": "45000",
        "stock": 20,
        "dimensions": {
          "thickness": "24T",
          "width": "1220",
          "height": "2440",
          "unit": "mm"
        }
      }
    ]
  }
}
```

**UI 컴포넌트 Props:**
```typescript
interface ParentProduct {
  code: string;          // P0000CNJ
  name: string;          // 24T 자작합판
  categoryNo: number;    // 325
  minPrice: number;      // 45000 (최저가)
  variantCount: number;  // 3
  dimensions: string;    // "24T x 1220 x 2440mm"
  children: ChildVariant[];
}

interface ChildVariant {
  code: string;
  name: string;
  price: number;
  stock: number;
  dimensions: {
    thickness: string;
    width: string;
    height: string;
  };
}
```

---

## ✅ 검증 기준 (Success Metrics)

### TEST-1: 성능 (200ms 이내)
```typescript
// 측정 코드
const startTime = performance.now();
// Hover 이벤트 발생
onMouseEnter(() => {
  const renderTime = performance.now() - startTime;
  console.assert(renderTime < 200, `Render time: ${renderTime}ms`);
});
```

**합격 기준:** 
- 자식 패널 렌더링: **< 200ms**
- 블러 효과 적용: **< 100ms**

---

### TEST-2: 가독성
```css
/* 배경 블러 투명도 테스트 */
background: rgba(255, 255, 255, 0.6);  /* 60% 불투명도 */
backdrop-filter: blur(12px);

/* 텍스트 명암비 */
color: #1a1a1a;  /* WCAG AA 기준 충족 */
```

**합격 기준:**
- WCAG 명암비: **> 4.5:1**
- 배경 텍스트 가독성 유지

---

### TEST-3: 스크롤 성능
```typescript
// 30개 이상 옵션 리스트 테스트
const options = Array(30).fill(mockOption);

// 스크롤 FPS 측정
let lastScrollTime = performance.now();
onScroll(() => {
  const currentTime = performance.now();
  const fps = 1000 / (currentTime - lastScrollTime);
  console.assert(fps > 50, `Scroll FPS: ${fps}`);
  lastScrollTime = currentTime;
});
```

**합격 기준:**
- 스크롤 FPS: **> 50 fps**
- 30개 이상 옵션 시 버벅임 없음

---

## 🎨 디자인 시스템

### 색상 팔레트
```css
/* Primary */
--color-primary: #3B82F6;      /* Blue 500 */
--color-primary-dark: #2563EB; /* Blue 600 */

/* Secondary */
--color-secondary: #8B5CF6;    /* Purple 500 */

/* Neutral */
--color-gray-50: #F9FAFB;
--color-gray-100: #F3F4F6;
--color-gray-600: #4B5563;
--color-gray-900: #111827;

/* Glassmorphism */
--glass-bg: rgba(255, 255, 255, 0.9);
--glass-border: rgba(255, 255, 255, 0.2);
--blur-amount: 12px;
```

### 타이포그래피
```css
/* 상품명 */
font-family: 'Pretendard', sans-serif;
font-size: 1.125rem;   /* 18px */
font-weight: 600;

/* 가격 */
font-size: 1.25rem;    /* 20px */
font-weight: 700;
color: var(--color-primary);

/* 치수 */
font-size: 0.875rem;   /* 14px */
font-weight: 400;
color: var(--color-gray-600);
```

---

## 🚀 구현 단계

### Phase 1-A: 카테고리 탭 (우선순위: 높음)
```typescript
// 1. 카테고리 데이터 추출
const categories = [...new Set(products.map(p => p.categoryNo))];

// 2. 탭 UI 렌더링
{categories.map(catNo => (
  <button 
    key={catNo}
    className={cn(
      "tab",
      activeCat === catNo && "tab-active"
    )}
    onClick={() => setActiveCat(catNo)}
  >
    카테고리 {catNo}
  </button>
))}
```

---

### Phase 1-B: 부모 카드 정보 보강 (우선순위: 높음)
```typescript
// 부모 카드 컴포넌트
<div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4">
  <div className="text-sm text-gray-500">{product.code}</div>
  <h3 className="text-lg font-semibold">{product.name}</h3>
  <div className="text-sm text-gray-600">{product.dimensions}</div>
  <div className="flex items-center justify-between mt-2">
    <span className="text-xl font-bold text-blue-600">
      ₩{product.minPrice.toLocaleString()} ~
    </span>
    <span className="text-xs text-purple-600">
      {product.variantCount} variants ▸
    </span>
  </div>
</div>
```

---

### Phase 1-C: Hover 패널 (우선순위: 중간)
```typescript
// Safe Triangle 로직 포함 Hover 처리
const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);
const [isPanelHovered, setIsPanelHovered] = useState(false);

<AnimatePresence>
  {hoveredProduct && (
    <>
      {/* 배경 오버레이 */}
      <motion.div 
        className="fixed inset-0 backdrop-blur-sm bg-white/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      
      {/* 자식 패널 */}
      <motion.div
        className="fixed right-0 top-0 h-full w-96 bg-white/90 backdrop-blur-xl"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
      >
        {/* 옵션 리스트 */}
      </motion.div>
    </>
  )}
</AnimatePresence>
```

---

### Phase 1-D: 견적 담기 기능 (우선순위: 낮음)
```typescript
// 전역 상태 (Zustand)
interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (code: string) => void;
}

// 견적 담기 버튼
<button 
  className="btn btn-primary btn-sm"
  onClick={() => addToCart({
    code: variant.code,
    name: variant.name,
    price: variant.price,
    quantity: 1
  })}
>
  견적 담기
</button>
```

---

## 🔄 개선된 워크플로우

```
1. 페이지 로드
   ↓
2. 카테고리 탭 렌더링 (325-333)
   ↓
3. 선택된 카테고리의 부모 상품 리스트 표시
   ↓
4. 부모 카드 Hover
   ↓
5. 배경 블러 + 우측 패널 애니메이션 (200ms)
   ↓
6. 자식 옵션 리스트 표시
   ↓
7. 수량 선택 + 견적 담기
   ↓
8. 장바구니 아이콘에 카운트 표시
```

---

## 📱 반응형 대응

### 모바일 (< 768px)
```css
/* 좌측 리스트 전체 너비 */
.parent-list {
  width: 100%;
}

/* 자식 패널 하단 시트 */
.child-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 70vh;
  border-radius: 24px 24px 0 0;
}
```

### 태블릿 (768px ~ 1024px)
```css
/* 자식 패널 너비 조정 */
.child-panel {
  width: 320px; /* 기본 384px → 320px */
}
```

---

## 🎓 핵심 개선 포인트 요약

### ✅ 해결된 문제:

1. **카테고리 표시**
   - 기존: "전체" 하나
   - 개선: 325-333 탭 (9개)

2. **부모 상품 정보**
   - 기존: 이름만
   - 개선: 코드 + 이름 + 치수 + 가격 + variants 수

3. **자식 옵션 접근**
   - 기존: 불가능
   - 개선: Hover → Glassmorphism 패널

4. **견적 담기**
   - 기존: 없음
   - 개선: 수량 선택 + 견적 담기 버튼

### 🆕 새로운 기능:

1. **비교 모드**: 한 화면에서 모든 옵션 비교
2. **Safe Triangle**: 마우스 이동 시 패널 유지
3. **성능 최적화**: 200ms 이내 렌더링
4. **반응형**: 모바일/태블릿 대응

---

## 📚 참고 자료

- [Apple Design Resources](https://developer.apple.com/design/resources/)
- [Glassmorphism Generator](https://hype4.academy/tools/glassmorphism-generator)
- [Framer Motion Docs](https://www.framer.com/motion/)
- [Safe Triangle Algorithm](https://bjk5.com/post/44698559168/breaking-down-amazons-mega-dropdown)

---

**작성 완료:** 2025년 2월 14일  
**다음 단계:** 코딩 에이전시에게 Phase 1-A부터 순차 구현 지시
