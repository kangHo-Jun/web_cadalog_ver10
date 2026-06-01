# Project Context: Cafe24 Web Catalog (ERP Integration)

이 문서는 새로운 세션에서 작업을 이어갈 때 필요한 현재 상태와 기술적 제약 사항을 요약합니다.

## 🎯 Project Overview
- **Goal**: Cafe24 Admin API를 연동하여 실시간 상품 정보를 조회하고 견적을 요청하는 현대적인 웹 카탈로그 시스템 구축.
- **Current Phase**: Phase 2 (기능 고도화 및 UX 최적화 진행 중).

## 🛠 Tech Stack & Environment
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4, Vanilla CSS (Custom Inline Styles for specific UI)
- **State Management**: Zustand (useCartStore)
- **Icons**: Lucide React
- **Deployment**: [Vercel](https://web-cadalog-ver10.vercel.app)
- **Source Control**: [GitHub Repository](https://github.com/kangHo-Jun/web_cadalog_ver10.git)

## 🧭 System Map
- 이 프로젝트는 크게 `Next.js 앱`, `Redis`, `Vercel env`, `Google Sheets`, `GAS` 2개로 구성됩니다.
- 초보자가 가장 많이 헷갈리는 지점은 `monitoring-gas`와 `gas-push(p7_gas)`를 같은 역할로 보는 것입니다.
- 현재 **토큰 갱신 단일 주체는 `monitoring-gas`** 입니다.
- `gas-push`는 가격/상품 동기화 스크립트이고, 토큰은 주로 읽기/폴백 용도로만 다룹니다.

## 📍 Key Assets
- 모니터링 시트: `1UnhOYjQmCD-rkYHZv9oP9yuUP0cUJmxV0ERhPK6lpjU`
  - `monitoring-gas`가 직접 읽고 쓰는 시트
  - `[설정]`, `대시보드`, `로그` 탭 존재
- 매핑테이블 시트: `1_T_pl2ItqfmdAsDmrjkg1BBZyQMAVXkUrPMEwhGI6ek`
  - `gas-push` 작업용 메인 시트
- Redis key: `cafe24_tokens`
- 운영 URL: `https://web-cadalog-ver10.vercel.app`

## 🔐 Token Architecture
- 실제 운영 API는 **Redis 우선**으로 토큰을 읽습니다.
- Redis 유실 시 **Vercel env fallback**(`CAFE24_ACCESS_TOKEN`, `CAFE24_REFRESH_TOKEN`)을 사용합니다.
- `monitoring-gas refreshCafe24Token()`은 모니터링 시트 `[설정]`의 `refresh_token`을 읽어 새 token 세트를 발급받고:
  - 모니터링 시트 `[설정]` 업데이트
  - `/api/token-update` 호출
  - Redis 저장
  - Vercel env fallback 갱신
- 대시보드 표시 갱신은 별도입니다.
  - 실제 토큰 갱신 함수: `refreshCafe24Token()`
  - 대시보드 상태 갱신 함수: `checkAll()`
  - 따라서 `[설정]` 탭은 최신인데 `대시보드`는 오래된 `🔴만료` 상태일 수 있습니다.

## 🧪 Where To Look First
- 토큰 장애가 나면 이 순서로 봅니다.
1. 모니터링 시트 `[설정]` 탭의 `TOKEN_EXPIRES_AT`, `REFRESH_EXPIRES_AT`
2. 모니터링 시트 `대시보드` 탭의 `마지막확인`
3. 모니터링 시트 `로그` 탭의 최근 실행 흔적
4. Redis `cafe24_tokens`
5. Vercel env fallback
- `Code.gs:527` 같은 오류가 보이면 먼저 **어느 GAS 프로젝트인지** 확인해야 합니다.
  - `monitoring-gas/Code.js`는 약 251줄
  - `gas-push/Code.js`는 1000줄 이상
  - `Code.gs:527`는 `gas-push` 쪽일 가능성이 높습니다

## ✅ Completed Features (As of 2026-04-29)
- **Real-time Catalog**: Cafe24 API를 통한 실시간 상품 목록 및 가격 조회.
- **Mobile Optimized UI**: Phase 1-C 바텀시트 패턴 및 반응형 레이아웃 완료.
- **Cart System**: 상품 담기, 수량 조절, 부가세 포함 합계 계산 기능.
- **Quote Workflow**:
  - `/quote/summary` 페이지에서 연락처 및 요청사항 입력.
  - 파일 첨부 기능 (JPG, PNG, PDF, Excel, Word 지원).
  - **[RECENT]** 안내 문구 추가: "※ 가격이 등록된 상품은 쇼핑몰에서 주문 부탁드립니다." (C안 스타일 적용).
- **Backend Integration**: Next.js Route Handlers (`/api/submit-quote`)를 통한 데이터 전송.

## ⚠️ Critical Constraints & Rules (@RULES)
1. **Communication**: 반드시 **Conclusion First**로 답변하고, 기술 용어는 **English**로 병기할 것 (예: 비동기 처리(Async/Await)).
2. **Coding Pattern**:
   - **Atomic Module**: 한 번에 하나의 파일/모듈만 수정하며 최종 단계에서 통합.
   - **Styling**: Tailwind CSS 4를 기본으로 하되, 정밀한 UI 제어가 필요한 경우 인라인 스타일 또는 CSS 변수 활용.
   - **No Placeholders**: 모든 이미지는 `generate_image` 툴을 사용한 실물 이미지 지향.
3. **Documentation**: 작업 완료 시 `SESSION.md` 업데이트 및 중요 결정 사항은 `DECISIONS.md`에 ADR 형식으로 기록.

## ⚠️ Operational Warnings
- 동일 `authorization_code`를 callback route와 로컬 스크립트에서 **중복 사용하면 안 됩니다**.
- `refresh_token`은 Cafe24의 교체 모델(rotation)이라 새 token 세트를 받으면 이전 `refresh_token`은 즉시 폐기될 수 있습니다.
- Google 결제/구독 문제로 Apps Script installable trigger가 멈추면 access token 자동 갱신이 중단될 수 있습니다.
- `checkAll()` 트리거 주기와 `refreshCafe24Token()` 트리거 주기는 다를 수 있으므로, 대시보드 표시만 보고 실제 토큰 상태를 단정하면 안 됩니다.

## 🚀 Next Steps
- 장바구니 데이터 지속성(Persistence) 강화.
- 견적서 PDF 다운로드 기능 구현 검토.
- 모바일 검색 및 필터링 기능 고도화.

## 🛠 If You Resume Work
- UI 작업 전: `src/components`, `src/app/price`, `src/app/quote`를 먼저 확인
- 토큰/운영 작업 전: `monitoring-gas/Code.js`, `gas-push/Code.js`, `src/lib/token-store.ts`, `src/app/api/token-update/route.ts`를 먼저 확인
- 문서 기준점:
  - 운영 토큰 구조: `docs/ 오픈전수정/토큰_재발급.md`
  - 최근 장애 분석: `docs/토큰_UI디버깅_0326.md`
  - 일반 토큰 트러블슈팅: `docs/로직/토큰&연결트러블슈팅.md`

## 진행 한 것인 것
- `monitoring-gas` 기준 Cafe24 토큰 자동 갱신 구조와 실제 운영 상태를 재점검함.
- 모니터링 시트 `웹카다로그_토큰_모니터링`에서 `Cafe24 Access Token`이 `2026-05-01 15:41` 이후 만료 상태로 고정된 원인을 분석함.
- 근본 원인을 `monitoring-gas refreshCafe24Token()` 자동 트리거 중단으로 판단했고, Google 결제 중단 기간과 실행 공백이 겹친다는 점을 확인함.
- `monitoring-gas`와 `gas-push`를 구분 정리함.
  - `monitoring-gas/Code.js`는 251줄이며 실제 토큰 갱신 단일 주체임.
  - `gas-push/Code.js`의 `refreshCafe24Token(cfg)`는 내부 헬퍼이며, `Code.gs:527` 오류는 이쪽에서 발생한 것임을 확인함.
- `monitoring-gas` 원격 GAS 코드와 로컬 [`monitoring-gas/Code.js`](/Users/zart/Library/Mobile%20Documents/com~apple~CloudDocs/프로젝트/ERP/monitoring-gas/Code.js)가 동일함을 `clasp pull`로 확인함.
- 기존 `refresh_token`이 `invalid_grant` 상태가 되어 자동 복구가 불가능하다는 점을 확인하고, OAuth 재인증으로 새 토큰 세트를 다시 발급받는 방향으로 전환함.
- `scripts/reauth_cafe24.py`와 `src/app/api/auth/callback/route.ts`의 역할 충돌을 분석함.
  - callback route가 code를 즉시 소비하는 구조라서, 수동 교환 시에는 code 중복 사용 위험이 있음.
  - 임시로 callback route를 `503 temporarily disabled`로 막아 code 소비를 차단한 뒤, 재인증 작업 후 다시 원복하고 Vercel 재배포까지 완료함.
- 새 토큰 반영 작업 진행:
  - Redis `cafe24_tokens` 갱신 완료
  - Vercel production env `CAFE24_ACCESS_TOKEN`, `CAFE24_REFRESH_TOKEN` 갱신 완료
  - Google Sheets 쓰기 권한 제한으로 시트 직접 쓰기는 자동화 실패했으나, 이후 `refreshCafe24Token()` 수동 실행 성공으로 `[설정]` 탭 값이 실제 갱신됨을 확인함.
- 현재 모니터링 대시보드의 `🔴만료` 표시는 실토큰 상태가 아니라 오래된 `checkAll()` 결과임을 확인함.
  - `[설정]` 탭의 `TOKEN_EXPIRES_AT`, `REFRESH_EXPIRES_AT`는 새 값으로 갱신됨.
  - 대시보드 갱신 함수는 `checkAll()`이며, 현재 코드상 `checkAll` 트리거 주기는 6시간임.
- 2026-05-08 추가 확인:
  - `syncPrices`는 `monitoring-gas`가 아니라 [`gas-push/Code.js`](/Users/zart/Library/Mobile%20Documents/com~apple~CloudDocs/프로젝트/ERP/gas-push/Code.js:88)의 함수임을 재확인함.
  - `syncPrices`는 시작 시 `readConfig(G_SS)`로 `gas-push` 메인 `[설정]` 시트를 읽고, `MONITORING_SHEET_ID`가 있을 때만 `initMonitoringSheet_(G_CFG)`로 모니터링 시트 토큰을 오버레이함.
  - 실제 `gas-push [설정]` 시트에는 `MONITORING_SHEET_ID` 행 자체가 없음을 확인함. 빈 값이 아니라 키가 누락된 상태였음.
  - 그 결과 `if (!monId) return;` 조건에 걸려 오버레이가 실행되지 않았고, `syncPrices`는 `gas-push [설정]`에 남아 있던 오래된 `CAFE24_ACCESS_TOKEN` / `CAFE24_REFRESH_TOKEN`으로 실행될 수 있는 상태였음.
  - 실측 값 비교:
    - `monitoring-gas [설정]`: `CAFE24_ACCESS_TOKEN=TQSperPOESNSL1vexhkqBJ`, `CAFE24_REFRESH_TOKEN=KadJlhufWyDLLpM09bBPiB`
    - `gas-push [설정]`: `CAFE24_ACCESS_TOKEN=tFaYKZK4FVUohpkpgXSRLA`, `CAFE24_REFRESH_TOKEN=bqmSCX1IKJhqKJcVjotERC`
  - 따라서 `2026-05-08 07:22` 알림 메일의 `syncPrices 토큰 갱신 실패 / invalid_grant`는 `gas-push`가 최신 모니터링 토큰을 못 받아 stale token으로 동작했을 가능성이 높음.
  - Google Drive connector로 `gas-push [설정]` 시트에 `MONITORING_SHEET_ID` 행을 자동 추가하려 했지만 쓰기 요청이 `FORBIDDEN`으로 거부됨. 읽기만 가능하고 쓰기 권한은 없는 상태로 판단함.
- 2026-05-29 추가 확인:
  - `gas-push [실행로그]` 기준 마지막 정상 자동 실행은 `2026-05-01 14:33:45`, 이후 공백은 `2026-05-06 07:33:19`까지 `4일 16시간 59분 34초`였음.
  - 이 공백 구간은 `2026-05-01` ~ `2026-05-06` Google Workspace 결제 중단 기간과 사실상 일치함. `2026-05-06` 토큰 복구 작업은 공백 시작 원인보다는 공백 종료 직후 복구 시점에 가까움.
  - Apps Script 트리거 화면 기준 `buildCafe24Cache`는 시간 기반 `1시간` 주기로 존재했고, `syncPrices`는 고정 반복이 아니라 `buildCafe24Cache` 완료 후 `10분 뒤` 예약되는 one-time 트리거 구조였음.
  - `gas-push` 자동화 보강을 위해 [`gas-push/Code.js`](/Users/zart/Library/Mobile%20Documents/com~apple~CloudDocs/프로젝트/ERP/gas-push/Code.js:93)에 아래 변경을 반영함.
    - `syncPrices` 중복 실행 방지용 `LockService` 추가
    - 마지막 `syncPrices` 실행 시각을 `Script Properties`에 기록
    - 최근 `syncPrices` 실행이 `75분` 이상 비면 보정 실행하는 `syncPricesFallback()` 추가
    - `createTrigger()`가 `buildCafe24Cache(1시간)`와 `syncPricesFallback(1시간)`를 함께 설치하도록 변경
  - `clasp push`로 원격 GAS 반영 완료.
  - 이후 GAS에서 `createTrigger()` 수동 실행 결과 로그 `✅ buildCafe24Cache 1시간, syncPricesFallback 1시간 트리거 생성 완료`를 확인함.
  - 추가 보강으로 `gas-push [실행로그]`에 `실행출처(AUTO/MANUAL)` 컬럼을 기록하도록 변경함.
    - 수동 메뉴 실행은 `MANUAL`
    - 시간 기반 `buildCafe24Cache`와 그 후속 `syncPrices`, `syncPricesFallback`은 `AUTO`
  - `monitoring-gas` 대시보드에 `자동 업데이트 상태` 행을 추가하도록 변경함.
    - 판정 기준: 최근 `AUTO` 실행 75분 이내 `🟢정상`
    - 75~120분 `🟡지연`
    - 120분 초과 `🔴중단의심`
  - 이 상태값은 `monitoring-gas`가 `gas-push` 메인 시트 `[실행로그]`를 직접 읽어 계산함.
  - 따라서 앞으로는 `Vercel 200`, `Redis 정상`, `토큰 정상`과 별개로 실제 자동 가격 동기화가 멈췄는지를 대시보드에서 따로 식별할 수 있음.

---
## 2026-06-01 이카운트 OAPI 고정 IP 프록시 구축

### 배경
이카운트 OAPI IP 화이트리스트 정책 (2026-05-29 적용)
- 등록된 고정 IP에서만 호출 가능
- GAS는 고정 IP 없어 직접 호출 불가

### 해결 구조
GAS → iwinv VPS 프록시(115.68.228.60:3000) → Ecount OAPI

### 구축 내용
- iwinv.kr 가상서버 (고정 IP: 115.68.228.60)
- Node.js + Express 프록시 서버
  - 경로: /opt/ecount-proxy/index.js
  - 포트: 3000
  - 인증: x-proxy-key 헤더
  - PM2로 상시 실행
- gas-push/Code.js 공통 post() 함수 프록시 경유로 수정
  (라인 1024 — Login API 포함 모든 Ecount 호출 경유)

### 검증
- 2026-06-01 14:52 수동 실행 정상
- 이카운트 10000건 조회 성공
- 가격 업데이트 12건, 오류 0건

### 관련 파일
- /opt/ecount-proxy/index.js (iwinv 서버)
- gas-push/Code.js 라인 1024
- 문서: 고정IP_오라클.md

---
## 2026-06-01 모니터링 항목 추가

### 추가 배경
기존 모니터링은 토큰/Redis/Vercel 상태만 확인
웹 카탈로그, 가격표, 가격 동기화 실제 작동 여부
직관적으로 확인 불가 → 3개 항목 신규 추가

### 추가된 항목

| 항목 | 함수 | 데이터 소스 |
|---|---|---|
| 카탈로그 스냅샷 상태 | checkCatalogSnapshot() | /api/debug-snapshot |
| 가격 동기화 결과 | checkPriceSyncResult() | gas-push [실행로그] C/E열 |
| 가격표 API 상태 | checkPricesApi() | /api/prices |

### 대시보드 행 구조 (변경 후)
1행: Cafe24 Access Token
2행: Cafe24 Refresh Token
3행: Redis 연결
4행: 자동 업데이트 상태
5행: (예비)
6행: 카탈로그 스냅샷 상태 ← 신규
7행: 가격 동기화 결과 ← 신규
8행: 가격표 API 상태 ← 신규
9행: Vercel 배포 (기존 8행에서 이동)

### 수정 파일
- monitoring-gas/Code.js
  (checkCatalogSnapshot, checkPriceSyncResult, checkPricesApi 추가)

### 주의사항
- /api/prices 응답 시간 약 4초로 느림
  muteHttpExceptions + try-catch 처리 적용
- Vercel 배포 항목이 8행 → 9행으로 이동됨

---
*Last Updated: 2026-06-01*
