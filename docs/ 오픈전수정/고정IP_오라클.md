# 고정IP 오라클 VPS 프록시 — 개발 방향 및 진행 문서

> 작성일: 2026-05-29  
> 목적: 이카운트 OAPI IP 화이트리스트 정책 대응  
> 상태: 개발 준비 중

---

## 1. 배경 및 문제 정의

### 이카운트 정책 변경
- **적용일**: 2026년 5월 29일
- **변경 내용**: OAPI 호출 시 등록된 고정 IP에서만 호출 가능
- **등록 가능 IP**: 최대 5개 (단일 IP만 가능, CIDR 대역 불가)
- **미등록 IP 호출 시**: 403 Forbidden 반환

### 문제
- 현재 GAS(Google Apps Script)에서 Ecount OAPI를 직접 호출 중
- GAS는 Google 인프라에서 실행되며 **고정 IP가 없음**
- 따라서 이카운트에 등록 불가 → 언제든 차단 가능

### 이카운트 고객센터 확인 사항
| 항목 | 답변 |
|---|---|
| GAS IP 대역 등록 가능 여부 | **불가** |
| CIDR 등록 가능 여부 | **불가** |
| 프록시 서버 경유 허용 여부 | **허용** (Login API부터 프록시 경유 필요) |
| 미등록 IP 차단 코드 | **403 Forbidden** |
| IP 변경 적용 시점 | **Login API 재호출 즉시 적용** |

---

## 2. 해결 방향

### 구조 변경
```
[변경 전]
GAS (유동 IP) → Ecount OAPI

[변경 후]
GAS → Oracle VPS (고정 IP) → Ecount OAPI
```

### Oracle VPS 선택 이유
| 항목 | 내용 |
|---|---|
| 비용 | **영구 무료** (Oracle Cloud Free Tier) |
| IP | 고정 Public IP 제공 |
| 역할 | GAS 요청을 받아 Ecount로 전달하는 프록시 |
| Vercel 영향 | **없음** — 웹 카탈로그, Cafe24 연동 등 기존 구조 변화 없음 |

### 영향 범위
| 구성요소 | 변경 여부 |
|---|---|
| Vercel 웹 카탈로그 | **그대로** |
| Cafe24 연동 | **그대로** |
| Redis / 환경변수 | **그대로** |
| GAS → Ecount 호출 경로 | **변경** (프록시 경유) |
| Oracle VPS | **신규 추가** |

---

## 3. 개발 단계

### 1단계 — Git 태그 (완료)
- 태그명: `ecount_ip_policy_before`
- 내용: 이카운트 OAPI IP 화이트리스트 정책 적용 전 스냅샷

---

### 2단계 — Oracle Cloud VPS 생성
**담당**: 에이전시  
**작업 내용**:
1. Oracle Cloud Free Tier 계정 생성 또는 기존 계정 사용
2. VM 인스턴스 생성 (Always Free 티어)
   - Shape: `VM.Standard.E2.1.Micro` (무료)
   - OS: Ubuntu 22.04 LTS
   - 리전: `ap-seoul-1` (서울) 권장
3. 고정 Public IP 확보 (Reserved IP 설정)
4. 방화벽(Security List) 설정
   - Inbound: GAS 허용 (전체 또는 필요 포트)
   - Outbound: Ecount OAPI 도메인 허용

**확인 사항**:
- VPS 생성 후 고정 IP 주소 보고
- `ping` 및 `curl` 정상 응답 확인

---

### 3단계 — 프록시 서버 구축
**담당**: 에이전시  
**작업 내용**:
1. Node.js 설치 (또는 nginx)
2. 프록시 서버 구현
   - GAS로부터 요청 수신
   - Ecount OAPI로 요청 전달 (Login API 포함)
   - 응답을 GAS로 반환
3. 인증 처리
   - GAS → 프록시 간 간단한 인증키 설정 (무단 접근 방지)
4. PM2 또는 systemd로 프로세스 상시 실행 설정

**핵심 주의사항**:
> Login API 호출도 반드시 프록시를 경유해야 함  
> (이카운트는 Login API 호출 IP를 기준으로 등록 IP 확인)

---

### 4단계 — 이카운트 IP 등록
**담당**: Zart 직접 또는 에이전시  
**작업 내용**:
1. Oracle VPS 고정 IP 확인
2. 이카운트 ERP 접속
3. `SELF-CUSTOMIZING > 정보관리 > API인증키발급 > [IP등록]`
4. VPS 고정 IP 등록
5. 등록 후 `보안관리 > 사용자접속현황`에서 해당 IP로 로그인 이력 확인

---

### 5단계 — GAS 코드 수정
**담당**: 에이전시  
**작업 파일**: `gas-push/Code.js` (991, 1008 라인 주변)  
**작업 내용**:
1. Ecount OAPI 직접 호출 URL → 프록시 서버 URL로 변경
2. Login API 포함 모든 Ecount 호출이 프록시 경유하도록 수정
3. clasp push 후 GAS 수동 배포 (새 버전 등록)

**주의사항**:
- 새 라이브러리 도입 시 사전 승인 필요
- 코드 변경 전 승인 후 진행

---

### 6단계 — 실데이터 검증
**담당**: 에이전시  
**검증 항목**:
- [ ] GAS 수동 실행 → 프록시 경유 → Ecount 정상 응답 확인
- [ ] `GetListInventoryBalanceStatus` 재고 데이터 정상 수신
- [ ] 403 오류 없음 확인
- [ ] `보안관리 > 사용자접속현황`에서 VPS 고정 IP로 로그인 이력 확인
- [ ] 자동 실행(60분 주기) 1회 이상 정상 완료 확인

---

## 4. 일정

| 단계 | 내용 | 예상 시간 |
|---|---|---|
| 1단계 | Git 태그 | 완료 |
| 2단계 | Oracle VPS 생성 | 1~2시간 |
| 3단계 | 프록시 서버 구축 | 2~3시간 |
| 4단계 | 이카운트 IP 등록 | 30분 |
| 5단계 | GAS 코드 수정 | 1~2시간 |
| 6단계 | 실데이터 검증 | 1시간 |
| **합계** | | **5~8시간** |

---

## 5. 리스크 및 대응

| 리스크 | 대응 |
|---|---|
| GAS가 갑자기 403 차단 | 프록시 구축 완료 전까지 모니터링 유지 |
| Oracle VPS 장애 | 프록시 헬스체크 + 알림 설정 |
| IP 변경 필요 시 | 이카운트 재등록 후 Login API 재호출로 즉시 적용 |
| 프록시 무단 접근 | GAS → 프록시 간 인증키 설정으로 차단 |

---

## 6. 참고

- 이카운트 OAPI 사용 API: `InventoryBalance/GetListInventoryBalanceStatus`
- 호출 주기: 약 60분 자동 실행
- GAS 파일: `gas-push/Code.js` (라인 991, 1008)
- Oracle Cloud Free Tier: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- Vercel Static IPs (참고용): https://vercel.com/docs/connectivity/static-ips (월 $100, 미채택)