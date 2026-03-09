# WHAT / HOW 정리

## WHAT (무엇을 만드는가)
이카운트 ERP 가격 변경 시 → 카페24 연동 상품 자동 가격 업데이트

### 현재 상태
- 카페24 898건: 없음 (재수집 필요)
- 이카운트 601건: 없음 (수집 필요)
- 매핑 테이블: 없음

## Phase 정의

| Phase | WHAT | HOW | 검증 기준 |
|---|---|---|---|
| P1 | 이카운트 인증 | Zone → Login → SESSION_ID 발급 | SESSION_ID 반환 성공 |
| P2 | 이카운트 상품 수집 | GetBasicProductsList, 100건씩, 랜덤 딜레이 2~5초 | 601건 JSON 저장 |
| P3 | 카페24 상품 수집 | Admin API GET /products, 전체 898건 | 898건 JSON 저장 |
| P4 | 매핑 테이블 생성 | PROD_CD ↔ product_no 매칭 | 매핑 건수 확인 |
| P5 | 카페24 가격 업데이트 | PUT /api/v2/admin/products/{product_no} | 1건 테스트 성공 |
| P6 | GAS 통합 | 구글 시트 + 60분 트리거 | 자동 실행 로그 확인 |

## HOW (핵심 제약)

- 실행 환경: 로컬 PC (Python)
- API 보호: 세션 1회 발급 재사용, 요청 간 랜덤 딜레이 2~5초, 페이지 간 5초 휴식
- 필터 조건: PROD_CD에 (1) 포함 OR PROD_DES에 ◈ 포함, CLASS_CD=11111
- 가격 필드: OUT_PRICE2
- 중간 저장: 페이지마다 temp 파일 저장 (끊겨도 이어받기)

## 고정 테스트 기준 (회귀 금지선)

| 항목 | 기준 |
|---|---|
| 이카운트 로그인 | SESSION_ID 비어있지 않음 |
| 상품 수집 | 총 건수 > 0, JSON 파싱 가능 |
| 필터링 | (1) 또는 ◈ 포함 건수만 추출 |
| 카페24 업데이트 | HTTP 200, price 변경 확인 |
