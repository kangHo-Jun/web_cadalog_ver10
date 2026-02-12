본 명세서는 UI의 시각적 계층 구조를 명확히 하고, 코드 구현 시 일관성을 유지하기 위한 수치 가이드라인입니다.1. 디자인 토큰 (CSS Variables)모든 속성은 프로젝트의 글로벌 스타일시트에 변수로 등록하여 사용합니다.분류변수명값 (Value)비고Blur--glass-blur20px배경 분리를 위한 최소값BG Color--glass-bgrgba(255, 255, 255, 0.4)유리의 기본 투명도Border--glass-border1px solid rgba(255, 255, 255, 0.2)하이라이트 효과Shadow--glass-shadow0 8px 32px 0 rgba(0, 0, 0, 0.1)Depth 구현2. 레이어 계층 구조 (Layering)2.1 배경 레이어 (Backdrop Filter)속성: backdrop-filter: blur(var(--glass-blur));Safari 대응: -webkit-backdrop-filter: blur(var(--glass-blur)); 반드시 병행 표기.적용 대상: 부모 요소의 배경이 비쳐야 하는 모든 Floating 패널.2.2 전경 레이어 (Surface & Content)패널 배경: background: var(--glass-bg);콘텐츠 영역: 텍스트가 포함된 내부 영역은 가독성을 위해 background: #FFFFFF (완전 불투명) 처리하거나, 대비가 명확한 배경색을 별도로 지정한다.3. Depth 및 외곽선 정의Shadow (Elevation): - box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);그림자의 확산 정도(Spread)는 0으로 고정하여 경계가 지저분해지지 않도록 한다.Border (Edge Case):유리 질감을 표현하기 위해 상단과 좌측 보더에 rgba(255, 255, 255, 0.3)를 적용하는 것을 권장한다 (선택 사항).4. 구현 가이드라인 (Constraints)가독성 우선: 글래스 효과가 적용된 배경 위에서의 텍스트는 반드시 **WCAG 2.1 AA 기준(대비비 4.5:1)**을 통과해야 함.성능 최적화: 한 화면에 backdrop-filter가 적용된 요소를 3개 이상 중첩하지 않음 (저사양 기기 브라우저 렌더링 부하 방지).레이아웃 고정: 글래스 효과 적용은 시각적 스타일링에 한정하며, 요소의 width, height, position 등 레이아웃 속성에 영향을 주어서는 안 됨.데이터 보호: 가격, 수량 등 핵심 데이터가 포함된 테이블이나 그리드 영역에는 배경 블러를 적용하지 않고 불투명 배경을 유지함.5. CSS 코드 스니펫개발자가 복사하여 즉시 적용할 수 있는 표준 클래스입니다.CSS.glass-container {
  /* 배경 처리 */
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  
  /* 테두리 및 입체감 */
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.1);
  
  /* 가독성 확보 */
  color: #1a1a1a;
}
