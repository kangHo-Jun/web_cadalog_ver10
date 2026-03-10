# 진행 히스토리 요약

## 1) 카페24 토큰/연결 이슈
- OAuth 토큰 만료/갱신 실패(`invalid_grant`, `Invalid client_secret`) 확인 → Client Secret 교체 후 재발급 성공.
- API 버전 오류: `2024-03-01` 요청 시 "version not available" → `2025-12-01`로 고정해야 정상.
- 네트워크 차단 이슈:
  - `daesan3833.cafe24api.com` 443 연결이 `Operation not permitted`로 차단됨.
  - /etc/hosts에 잘못된 IP 등록(예: 1.2.3.4)로 DNS 왜곡 발생 → 제거 및 DNS 캐시 플러시 필요.
  - cafe24edge.kr 도메인으로 DNS는 해결되나, IP별 직접 연결도 차단됨.
- 핫스팟 + 보안 해제 후 TLS 연결은 정상 확인.

## 2) 카페24 상품 조회
- 유효 토큰 재발급 후 `X-Cafe24-Api-Version: 2025-12-01`로 조회.
- 전체 상품 조회 성공: 총 **898건** 저장(`data/cafe24_products.json`).

## 3) 이카운트 API 연결/필터링
- Zone 조회 성공(`ZONE=AB`) 확인.
- 로그인 성공 후 상품 목록 API 사용: `InventoryBasic/GetBasicProductsList`.
- `OUT_PRICE`는 대부분 0이며, `OUT_PRICE1~3`에 가격 존재.
- 필터링 기준 확정:
  - PROD_CD에 `(1)` 포함
  - PROD_DES에 `◈` 포함
  - CLASS_CD = `11111`

## 4) 로그/파일 생성
- `docs/토큰_연결.md`에 토큰/연결 문제 정리.
- `docs/이카운트_필드.md`에 전체 필드/샘플 정리.
- `data/ecount_products.json`, `data/ecount_products.csv` 생성.
- `data/cafe24_products.json` 생성.

## 5) 추가 스크립트
- 로컬 실행용 스크립트 생성: `/tmp/price_sync/run_local.py`
  - 이카운트 필터링 수집 후 `data/ecount_filtered.json` 저장.

## 6) 확정 스펙 반영
- `docs/이카운트_카페24_매칭.md`에 확정 스펙/구글시트 구조 추가.

## 7) 이카운트 API 412 에러 (Precondition Failed)
- 현상: 단기간에 다량의 API 요청 시 IP가 차단되어 412 에러 발생.
- 원인: 이카운트 내부 보안 정책 또는 속도 제한(Rate Limit)으로 추정.
- 해결: 실시간 수집 대신 로컬에 저장된 전체 JSON DB(`ecount_products.json`)를 필터링하여 사용하는 **Local Bypass** 로직을 도입하여 안정성 확보.

## 8) 정교한 상품 매칭 (Fuzzy Matching)
- 현상: 카페24 상품명에 규격(예: `1*4`)이 없는 경우가 많아 매칭 정확도가 떨어짐.
- 해결:
  - 카페24의 **'상품명 + 품목명(옵션명)'**을 결합하여 비교 대상으로 삼음.
  - 규격 기호 표준화(`*`, `”` -> `x`) 처리.
  - `rapidfuzz` 라이브러리의 `token_set_ratio`를 사용하여 핵심 키워드와 규격 중심의 매칭 알고리즘 고도화.

## 9) 카페24 품목(Variant) API 규격 대응
- 현상: 품목 가격 수정(`PUT`) 시 400 Bad Request 발생.
- 원인: 요청 페이로드 구조(`request` 객체 누락, `shop_no` 필수)와 상품 전체 수정이 아닌 개별 품목 수정 URL 스펙 차이.
- 해결: `PUT /api/v2/admin/products/{product_no}/variants/{variant_code}` 엔드포인트와 `additional_amount` 필드를 사용하는 확정 스펙으로 수정 및 테스트 성공.

## 10) API 속도 제한 (429 방지)
- 현상: 대량의 가격 업데이트 시 카페24 API 서버로부터 차단당할 위험.
- 해결: `scripts/p6_cafe24_update.py` 실행 시 각 요청 사이에 **1초의 지연(time.sleep(1))**을 추가하여 안정적인 동기화 보장. (GAS 환경에서는 2초 적용)

## 11) 전체 가격 동기화 실행 (Phase 6)
- 898건의 카페24 품목에 대해 이카운트 가격(`OUT_PRICE2`)을 동기화하여 총 **385건**의 성공적인 업데이트 완료.
- 대규모 업데이트 시 429 에러 대응을 위한 자동 재시도 로직 검증 성공.

## 12) 데이터 결함 해결 (NaN/공백 가격)
- 현상: 이카운트 데이터 중 숫자가 아닌 값(`NaN`)이나 빈 필드가 포함된 경우 업데이트 스크립트 오류 발생 가능성.
- 해결: `to_number` 변환 로직 보완 및 0원 기본값 처리를 통해 데이터 정제 로직 강화.

## 13) 카페24 API 에러(422) 및 단독 상품 분석
- 현상: `(1)600LXPF901800N` 등 일부 품목 업데이트 실패 (422 Unprocessable Entity).
- 원인: 카페24 내부에 옵션(Variant)이 존재하지 않는 **'단독 상품'**으로 확인됨. 
- 조치: 현재 시스템은 옵션 기반 가격 수정을 수행하므로, 단독 상품은 스킵 로그 기록 후 안전하게 다음으로 넘어가도록 예외 처리.

## 14) GAS 환경 배포 및 자동화 (Phase 4)
- `clasp`을 활용하여 로컬 개발 코드를 Google Apps Script 환경으로 배포. 
- [설정] 시트 기반의 동기화 엔진 및 매핑 테이블 로직 이식 완료.

## 15) GAS 트리거 스펙 보완
- 현상: GAS 시간 기반 트리거 생성 시 `.everyMinutes(60)` 오동작 확인 (GAS GUI 규격과 불일치).
- 해결: `.everyHours(1)`로 트리거 엔진을 수정하고 자동으로 중복을 제거하며 생성하는 `createTrigger()` 함수 활성화.

## 16) 실행 로그 시트화
- GAS 실행 시마다 스프레드시트의 **[실행로그]** 시트에 상세 실행 결과를 기록하여 가시성 및 모니터링 환경 구축 완료.
