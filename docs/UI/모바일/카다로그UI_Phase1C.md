# Phase 1-C 모바일 UI

## 완료일
2026-03-25

## 구현 내용
- 패턴: 바텀시트 단일 패턴
- 분기 기준: window.innerWidth < 768px
- SSR 안전: useState<boolean | null>(null)

## 관련 파일
- src/app/page.tsx
- src/components/phase1/Phase1MobileView.tsx

## 버그 수정
- 가격 0/null/undefined → "가격문의" 표시
- 참조: ProductListPhase1.tsx 동일 로직 이식

## 검증 완료
- 카테고리 필터링 ✅
- 바텀시트 300ms ✅
- 외부 터치 닫힘 ✅
- 가격문의 표시 ✅
- PC UI 변화 없음 ✅
- 견적 완료 후 모바일 복귀 정상 ✅
- 설정완료 버튼 제거 (UX 최적화) ✅
