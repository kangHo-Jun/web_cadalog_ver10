Phase 1-B: Apple-style Glassmorphism Hover UI
수신: 코딩 에이전시 (Coding Agent)
발신: 개발 감독자 (Technical Director)
목표: 이미지 없이 텍스트와 블러 효과만으로 구현되는 고성능 2단 Hover UI 구축

1. WHAT: 구현 기능
Main: 좌측 부모 리스트(8자리 prefix 그룹) 마우스 오버 시 우측 자식 패널 노출.

Visual Effect: 자식 패널 등장 시 배경(배경부 및 좌측 리스트 일부)에 backdrop-filter: blur(12px) 및 bg-white/60 적용.

Content: 자식 패널 내에는 [옵션명 / 규격 / 가격] 정보만 텍스트로 밀도 있게 배치.

2. HOW: 기술적 제약 (엄격 준수)
CSS: Tailwind CSS의 backdrop-blur 클래스 활용.

Motion: Framer Motion을 사용하여 자식 패널이 나타날 때 미세한 스케일 변화(scale: 0.98 -> 1)와 페이드인 적용.

Logic: - 이미지 로딩이 없으므로 **TEST-1(200ms 이내 표시)**을 반드시 사수할 것.

부모에서 자식 패널로 마우스 이동 시 '삼각형 가이드(Safe Triangle)' 로직을 적용하여 패널 꺼짐 현상 방지.

3. 검증 기준 (Success Metrics)
TEST-1: Hover 즉시(200ms 미만) 자식 패널 렌더링 완료.

TEST-2: 배경 블러 처리가 본문 텍스트의 가독성을 해치지 않는 투명도 유지.

TEST-3: 이미지 없는 텍스트 리스트가 30개 이상일 때 내부 스크롤이 매끄럽게 작동.