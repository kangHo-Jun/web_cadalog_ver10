# 카페24 토큰발급 & 연결 트러블슈팅

## 최종 업데이트: 2026-03-13

---

## 1. 시스템 구조 이해
[구글시트 GAS] → [Vercel API] → [Redis] → [Cafe24 API]
↑
토큰 저장/조회

- 토큰은 Redis에 저장되며, Vercel 서버가 Redis에서 토큰을 읽어 Cafe24 API 호출
- Redis 연결 실패 = 토큰 조회 불가 = 401 오류
- 토큰 만료(2시간) 시 refresh_token으로 자동 갱신 시도

---

## 2. 주요 오류 패턴

### 오류 A: invalid_client_secret (401)
{"error":"invalid_client","error_description":"Invalid client_secret"}
**원인:**
- Redis에 토큰이 없어서 refresh 시도 → client_secret 불일치
- Cafe24 파트너센터에서 Client Secret 재발급 후 Vercel 미반영

**해결:**
1. `python3 scripts/reauth_cafe24.py` 실행
2. Redis에 새 토큰 직접 저장 (아래 명령 참고)
3. Vercel 환경변수 업데이트 후 Redeploy

---

### 오류 B: Redis 연결 오류
**원인:**
- Vercel 환경변수에 `KV_REDIS_URL` 미설정 또는 잘못된 값
- 코드에서 읽는 변수명: `KV_REDIS_URL` (REDIS_URL 아님)

**해결:**
Vercel → Settings → Environment Variables →
KV_REDIS_URL 값 확인/추가

---

### 오류 C: 스냅샷 상품수 0
**원인:**
- Redis에 스냅샷 데이터 없음
- sync-products API 미실행

**해결:**
curl https://web-cadalog-ver10.vercel.app/api/sync-products

---

### 오류 D: API 버전 오류
2024-03-01 version you requested is not available
**해결:** `X-Cafe24-Api-Version: 2025-12-01` 고정

---

## 3. 토큰 재발급 절차

### Step 1: 로컬에서 토큰 재발급
```bash
python3 scripts/reauth_cafe24.py
```

### Step 2: Redis에 토큰 직접 저장
```bash
node -e "
const { createClient } = require('redis');
const token = require('./data/token_state.json');
const client = createClient({ url: process.env.KV_REDIS_URL });
client.connect().then(async () => {
  await client.set('cafe24_tokens', JSON.stringify({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: Date.now() + 2*60*60*1000,
    refresh_token_expires_at: Date.now() + 14*24*60*60*1000
  }));
  console.log('✅ Redis 저장 완료');
  await client.disconnect();
});
"
```

### Step 3: Vercel 환경변수 업데이트
CAFE24_ACCESS_TOKEN = (새 값)
CAFE24_REFRESH_TOKEN = (새 값)

### Step 4: Vercel 재배포
```bash
npx vercel --prod
```

---

## 4. 환경변수 체크리스트

| 변수명 | 설명 | 필수 |
|--------|------|------|
| KV_REDIS_URL | Redis 연결 URL | ✅ |
| CAFE24_CLIENT_ID | 카페24 앱 ID | ✅ |
| CAFE24_CLIENT_SECRET | 카페24 앱 시크릿 | ✅ |
| CAFE24_ACCESS_TOKEN | 액세스 토큰 (fallback) | ✅ |
| CAFE24_REFRESH_TOKEN | 리프레시 토큰 (fallback) | ✅ |
| MALL_ID | 카페24 몰 ID | ✅ |

---

## 5. 토큰 만료 주기

| 토큰 | 만료 시간 |
|------|----------|
| access_token | 2시간 |
| refresh_token | 14일 |

- refresh_token 만료 7일 전 경고 메일 발송
- refresh_token 만료 시 `reauth_cafe24.py` 재실행 필요

---

## 6. 모니터링 (구글시트)

| 항목 | 체크 URL | 정상 조건 |
|------|----------|----------|
| Redis 연결 | /api/debug-snapshot | status: OK |
| 상품 API | /api/products | HTTP 200 |
| 스냅샷 | /api/debug-snapshot | lastSnapshot 상품수 > 0 |
| 상품 동기화 | /api/sync-products | success: true |

---

## 7. Git 작업 주의사항

- `node_modules`, `.DS_Store`, `token_state.json` 은 절대 커밋 금지
- `.gitignore`에 반드시 추가
- 배포 시 `git add [파일명]` 으로 선택적 스테이징
- 충돌 시: `git stash → git pull --rebase → git push → git stash pop`
