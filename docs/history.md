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

