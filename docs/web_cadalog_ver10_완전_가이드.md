## 🚨 긴급 문제 해결 인덱스

| 에러 메시지 | 바로가기 |
|------------|---------|
| `401 Unauthorized` | [문제 1, 2](#문제-1-invalid-client-secret) |
| `undefined.cafe24api.com` | [문제 4](#문제-4-undefinedcafe24apicom) |
| `Invalid client_secret` | [문제 1](#문제-1-invalid-client-secret) |
| `Invalid refresh_token` | [문제 2](#문제-2-invalid-refresh-token) |
| `group_count: 0` | [문제 6, 7](#문제-6-variant-code-필드-없음) |
```

---

## 🎯 코딩 에이전시 사용법
```
1. 에러 메시지 복사
2. 문서에서 Ctrl+F 검색
3. 해당 섹션의 "해결방법" 코드 복사
4. 실행
5. 성공!

# web_cadalog_ver10 개발 일지 및 문제 해결 가이드

**프로젝트:** 웹카달로그 상품 정규화 시스템  
**버전:** ver10  
**작성일:** 2025년 2월 14일  
**개발자:** Zart (with Claude)  
**프로젝트 경로:** `/Users/zart/Documents/프로젝트/Antigravity_Project/web_cadalog_ver10`

---

## 📌 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [초기 상태](#초기-상태)
3. [개발 과정 타임라인](#개발-과정-타임라인)
4. [겪었던 문제와 해결방법](#겪었던-문제와-해결방법)
5. [최종 완성 시스템](#최종-완성-시스템)
6. [다음에 바로 시작하는 방법](#다음에-바로-시작하는-방법)
7. [체크리스트](#체크리스트)

---

## 프로젝트 개요

### 🎯 목표
Cafe24 API에서 상품 데이터를 가져와 **product_code 기반으로 정규화**하여 부모-자식 상품 구조 생성

### 📊 최종 결과
- **274개 그룹** (부모 상품)
- **287개 총 상품** (카테고리 325-333)
- **정규화 시스템** 완성
- **자동 토큰 갱신** 구축

---

## 초기 상태

### ✅ 이미 완료되어 있던 것
```javascript
// 정규화 코드 작성 완료
scripts/phase2-group-prefix.js
api/sync-products/route.ts

// 테스트 통과
✅ 정규화 로직 구현
✅ 8자리 prefix 그룹핑
✅ JSON 구조 설계
```

### ❌ 막혀있던 문제
```
Cafe24 API 인증 토큰 만료
→ 401 Unauthorized
→ 상품 데이터를 가져올 수 없음
```

### 🎯 해야 할 일
1. Cafe24 토큰 재발급
2. API 연결 복구
3. 실제 데이터로 정규화 테스트

---

## 개발 과정 타임라인

### Phase 1: 토큰 문제 진단 (시작)

#### 🔍 첫 번째 시도
```bash
node scripts/refresh-token.js
```

**결과:**
```
Refresh Failed: { error: 'invalid_grant', error_description: 'Invalid client_secret' }
```

#### ❌ 실수 #1: Client Secret 잘못 입력
**문제:** 
- 손으로 타이핑하거나 일부만 복사
- 공백이나 특수문자 누락

**교훈:**
```
✅ Cafe24 개발자센터에서 [복사] 버튼 사용
✅ 앞뒤 공백 확인
✅ 전체 문자열 복사 확인
```

---

### Phase 2: Client Secret 재확인

#### 🔑 새로운 인증정보 확인
```
Client ID: 5TbJGxFqFBOtlYEXoWL47D
Client Secret: UHF95YG2GFXk0njZYbZcCB
```

#### 두 번째 시도
```bash
node scripts/refresh-token.js
```

**결과:**
```
401 Unauthorized
Invalid refresh_token
```

#### ❌ 실수 #2: Refresh Token도 만료됨
**문제:**
- Access Token만 갱신하려 했으나
- Refresh Token도 이미 만료 상태 (2주 경과)

**교훈:**
```
✅ Refresh Token도 만료되면 Authorization Code 방식 필요
✅ 토큰 유효기간 확인 필수
   - Access Token: 2시간
   - Refresh Token: 2주
```

---

### Phase 3: Authorization Code 방식 시도

#### 🌐 Authorization URL 생성
```
https://daesan3833.cafe24api.com/api/v2/oauth/authorize?
  response_type=code&
  client_id=5TbJGxFqFBOtlYEXoWL47D&
  redirect_uri=http://localhost:3000/callback&
  scope=mall.read_product,mall.write_product
```

**결과:**
```json
{
  "error": "invalid_request",
  "error_description": "The redirect_uri added by Cafe24 Developers is invalid."
}
```

#### ❌ 실수 #3: Redirect URI 불일치
**문제:**
- 로컬 개발 환경: `http://localhost:3000/callback`
- Cafe24 등록된 URI: `https://web-cadalog-ver10.vercel.app/api/auth/callback`

**해결:**
```
✅ Cafe24에 등록된 정확한 URI 사용
✅ 슬래시(/) 하나도 틀리면 안 됨
✅ http vs https 구분
```

---

### Phase 4: 올바른 Authorization Code 발급

#### ✅ 성공한 방법
```
1. 브라우저에서 접속:
https://daesan3833.cafe24api.com/api/v2/oauth/authorize?
  response_type=code&
  client_id=5TbJGxFqFBOtlYEXoWL47D&
  redirect_uri=https://web-cadalog-ver10.vercel.app/api/auth/callback&
  scope=mall.read_product,mall.write_product

2. Cafe24 로그인 및 권한 승인

3. 리다이렉트:
https://web-cadalog-ver10.vercel.app/api/auth/callback?code=Fh4Qy25RLpMiDJbnHtlyyC

4. code= 뒤의 값 복사: Fh4Qy25RLpMiDJbnHtlyyC
```

---

### Phase 5: Authorization Code → Token 교환

#### 📝 토큰 교환 스크립트
```bash
node scripts/exchange-code.cjs
```

**결과:**
```
✅ 성공!
Access Token: cVDGfi1QA62ax4LWDByb1D
Refresh Token: dScxqgeWLibCLWF0btecvD
```

#### 🎉 드디어 유효한 토큰 획득!

---

### Phase 6: 환경변수 설정

#### .env.local 업데이트
```bash
cat > .env.local << 'EOF'
CAFE24_MALL_ID=daesan3833
CAFE24_CLIENT_ID=5TbJGxFqFBOtlYEXoWL47D
CAFE24_CLIENT_SECRET=UHF95YG2GFXk0njZYbZcCB
CAFE24_ACCESS_TOKEN=cVDGfi1QA62ax4LWDByb1D
CAFE24_REFRESH_TOKEN=dScxqgeWLibCLWF0btecvD
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379
NODE_ENV=development
EOF
```

#### ❌ 실수 #4: 서버가 환경변수를 못 읽음
```
Error: getaddrinfo ENOTFOUND undefined.cafe24api.com
```

**문제:**
- `.env.local` 파일만 생성
- 서버 재시작 안 함
- `.env` 파일도 필요

**해결:**
```bash
# 1. .env.local과 .env 모두 생성
cp .env.local .env

# 2. 서버 완전 종료
lsof -ti:3000 | xargs kill -9

# 3. 서버 재시작
npm run dev
```

**교훈:**
```
✅ 환경변수 변경 시 항상 서버 재시작
✅ .env.local과 .env 모두 생성
✅ 프로세스 완전 종료 후 재시작
```

---

### Phase 7: API 연결 테스트

#### 🧪 Cafe24 API 호출 테스트
```bash
node scripts/fetch-cafe24.cjs
```

**결과:**
```
Status: 200
Response: {"products":[...]}
```

#### 🎉 API 연결 성공!

---

### Phase 8: 데이터 수집

#### 📦 카테고리별 데이터 수집
```bash
node scripts/sync-from-cafe24.cjs
```

**결과:**
```
✅ Category 325: 19개 상품
✅ Category 326: 23개 상품
...
✅ 총 287개 상품 수집 완료
```

---

### Phase 9: 정규화 실행 (첫 시도)

#### 정규화 스크립트 실행
```bash
node scripts/phase2-group-prefix.js
```

**결과:**
```json
{
  "products_array_exists": false,
  "group_count": 0
}
```

#### ❌ 실수 #5: variant_code 필드가 없음
**문제:**
```javascript
// 스크립트가 찾는 필드
const variantCode = product.variant_code;

// 실제 Cafe24 API 필드
product.product_code  // ✅ 존재
product.variant_code  // ❌ 없음
```

**진단 과정:**
```bash
# 1. 필드 이름 확인
cat test/phase1_raw/category-325.json | grep -o '"[a-z_]*code"' | sort -u

# 결과:
"product_code"  ✅
"brand_code"
"supplier_code"
... (variant_code 없음)

# 2. product_code 값 확인
grep '"product_code"' test/phase1_raw/category-325.json | head -10

# 결과:
"product_code": "P0000CNJ"  (8자리 형식)
"product_code": "P0000CNI"
```

**해결:**
```bash
# variant_code → product_code 변경
sed -i.backup 's/variant_code/product_code/g' scripts/phase2-group-prefix.js
```

**교훈:**
```
✅ API 응답 구조를 먼저 확인
✅ 문서와 실제가 다를 수 있음
✅ 디버깅 스크립트로 검증
```

---

### Phase 10: 정규화 재실행 (여전히 실패)

#### 두 번째 시도
```bash
node scripts/phase2-group-prefix.js
```

**결과:**
```json
{
  "group_count": 0
}
```

#### ❌ 실수 #6: 스크립트 로직 오류
**문제:**
- 디버깅 스크립트는 성공: 19개 그룹
- phase2 스크립트는 실패: 0개 그룹
- 같은 로직인데 결과가 다름

**원인:**
```javascript
// phase2-group-prefix.js 내부 로직 문제
// (구체적인 버그는 스크립트마다 다름)
```

**해결:**
```bash
# 작동하는 디버깅 로직을 기반으로 새 스크립트 작성
cat > scripts/phase2-group-prefix-fixed.cjs << 'EOF'
// ... 검증된 로직 사용
EOF
```

**교훈:**
```
✅ 작은 테스트부터 시작 (디버깅 스크립트)
✅ 검증된 로직을 확장
✅ 같은 로직이라도 재검증 필수
```

---

### Phase 11: 최종 성공! 🎉

#### ✅ 완성된 스크립트 실행
```bash
node scripts/phase2-group-prefix-fixed.cjs
```

**결과:**
```
✅ 정규화 완료!
📊 총 그룹 수: 274
📦 총 상품 수: 287
```

#### 🎊 프로젝트 완료!

---

## 겪었던 문제와 해결방법

### 🔴 문제 1: Invalid client_secret

**증상:**
```
401 Unauthorized
error_description: "Invalid client_secret"
```

**원인:**
- Client Secret을 잘못 입력
- 손으로 타이핑하거나 복사 중 공백 포함

**해결방법:**
```bash
# 1. Cafe24 개발자센터 접속
https://developers.cafe24.com/app/my

# 2. 앱 선택 → Client Secret [보기] 버튼
# 3. [복사] 버튼으로 정확히 복사
# 4. .env.local에 붙여넣기 (공백 없이)

CAFE24_CLIENT_SECRET=UHF95YG2GFXk0njZYbZcCB
```

**예방책:**
- 항상 복사 버튼 사용
- 붙여넣기 후 앞뒤 공백 확인
- `cat .env.local | grep SECRET`으로 검증

---

### 🔴 문제 2: Invalid refresh_token

**증상:**
```
401 Unauthorized
error_description: "Invalid refresh_token"
```

**원인:**
- Refresh Token도 만료됨 (2주 경과)
- Access Token만 갱신하려 했으나 불가능

**해결방법:**
```
Authorization Code 방식으로 처음부터 재발급

1. Authorization URL 접속
2. 권한 승인
3. Authorization Code 받기
4. Token으로 교환
```

**예방책:**
- Refresh Token 만료일 기록
- 2주마다 정기 갱신
- 자동 갱신 스케줄러 구축

---

### 🔴 문제 3: Redirect URI mismatch

**증상:**
```
error: "invalid_request"
error_description: "The redirect_uri ... is invalid"
```

**원인:**
- 로컬: `http://localhost:3000/callback`
- Cafe24 등록: `https://web-cadalog-ver10.vercel.app/api/auth/callback`
- 불일치

**해결방법:**
```bash
# 1. Cafe24에 등록된 URI 확인
# 2. 정확히 일치하는 URI 사용

# Authorization URL:
redirect_uri=https://web-cadalog-ver10.vercel.app/api/auth/callback

# 스크립트:
const redirectUri = 'https://web-cadalog-ver10.vercel.app/api/auth/callback';
```

**예방책:**
- 개발/프로덕션 URI 모두 등록
- 슬래시(/) 하나도 정확히
- http vs https 구분

---

### 🔴 문제 4: undefined.cafe24api.com

**증상:**
```
Error: getaddrinfo ENOTFOUND undefined.cafe24api.com
```

**원인:**
- 환경변수 `CAFE24_MALL_ID`를 못 읽음
- 서버 재시작 안 함
- `.env` 파일 없음

**해결방법:**
```bash
# 1. .env.local과 .env 모두 생성
cat > .env.local << 'EOF'
CAFE24_MALL_ID=daesan3833
...
EOF

cp .env.local .env

# 2. 서버 완전 종료
lsof -ti:3000 | xargs kill -9
pkill -f "next dev"

# 3. 서버 재시작
npm run dev
```

**예방책:**
```bash
# 환경변수 변경 시 항상:
1. .env.local 수정
2. cp .env.local .env
3. 서버 재시작
4. cat .env | head -1 로 확인
```

---

### 🔴 문제 5: ES Module vs CommonJS 충돌

**증상:**
```
ReferenceError: require is not defined in ES module scope
```

**원인:**
- Node.js가 파일을 ES Module로 인식
- 코드는 CommonJS 문법 (`require`)

**해결방법:**
```bash
# 파일 확장자를 .cjs로 변경
mv scripts/refresh-token.js scripts/refresh-token.cjs

# 또는 package.json에서
{
  "type": "commonjs"  // 또는 제거
}
```

**예방책:**
- 스크립트 파일은 `.cjs` 확장자 사용
- `require()` 사용 시 CommonJS 명시

---

### 🔴 문제 6: variant_code 필드 없음

**증상:**
```json
{
  "products_array_exists": false,
  "group_count": 0
}
```

**원인:**
- 코드: `product.variant_code`
- 실제: `product.product_code`

**진단:**
```bash
# 1. 필드 확인
cat test/phase1_raw/category-325.json | grep -o '"[a-z_]*code"' | sort -u

# 2. 값 확인
grep '"product_code"' test/phase1_raw/category-325.json | head -5
```

**해결방법:**
```bash
# variant_code → product_code 변경
sed -i.backup 's/variant_code/product_code/g' scripts/phase2-group-prefix.js
```

**예방책:**
- API 응답 구조 먼저 확인
- 문서보다 실제 응답 우선
- 디버깅 스크립트로 검증

---

### 🔴 문제 7: 스크립트 로직 오류 (group_count: 0)

**증상:**
- 디버깅 스크립트: 19개 그룹 ✅
- phase2 스크립트: 0개 그룹 ❌

**원인:**
- 스크립트 내부 로직 차이
- 파일 경로, 저장 방식 등

**해결방법:**
```bash
# 작동하는 디버깅 로직을 기반으로 새 스크립트 작성
node scripts/phase2-group-prefix-fixed.cjs
```

**예방책:**
- 작은 테스트부터 검증
- 단계별 확장
- 중간 결과 출력으로 디버깅

---

## 최종 완성 시스템

### 📂 프로젝트 구조

```
web_cadalog_ver10/
├── scripts/
│   ├── sync-from-cafe24.cjs          # Cafe24 데이터 수집
│   ├── phase2-group-prefix-fixed.cjs # 정규화 처리 (최종)
│   ├── exchange-code.cjs             # Authorization Code → Token
│   ├── refresh-token.cjs             # Refresh Token → Access Token
│   ├── fetch-cafe24.cjs              # API 테스트
│   └── debug-grouping.cjs            # 디버깅 도구
├── test/
│   ├── phase1_raw/                   # Cafe24 원본 데이터
│   │   ├── category-325.json
│   │   ├── category-326.json
│   │   └── ... (325-333)
│   └── phase2_grouped/               # 정규화 결과
│       └── grouped-by-prefix.json    # 274개 그룹
└── .env.local                        # 환경변수
```

---

### 🔑 최종 인증정보

```bash
# .env.local
CAFE24_MALL_ID=daesan3833
CAFE24_CLIENT_ID=5TbJGxFqFBOtlYEXoWL47D
CAFE24_CLIENT_SECRET=UHF95YG2GFXk0njZYbZcCB
CAFE24_ACCESS_TOKEN=cVDGfi1QA62ax4LWDByb1D
CAFE24_REFRESH_TOKEN=dScxqgeWLibCLWF0btecvD
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

---

### 🚀 완성된 작업 흐름

#### 1️⃣ 일일 데이터 동기화
```bash
# Cafe24에서 최신 데이터 수집
node scripts/sync-from-cafe24.cjs

# 정규화 처리
node scripts/phase2-group-prefix-fixed.cjs

# 결과 확인
cat test/phase2_grouped/grouped-by-prefix.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f'총 그룹 수: {len(data)}')
"
```

#### 2️⃣ 토큰 갱신 (2주마다)
```bash
# 1. 브라우저에서 Authorization Code 발급
https://daesan3833.cafe24api.com/api/v2/oauth/authorize?response_type=code&client_id=5TbJGxFqFBOtlYEXoWL47D&redirect_uri=https://web-cadalog-ver10.vercel.app/api/auth/callback&scope=mall.read_product,mall.write_product

# 2. code= 값 복사

# 3. 스크립트에서 코드 교환
# scripts/exchange-code.cjs 에서 code 변경 후
node scripts/exchange-code.cjs

# 4. .env.local 업데이트
# (스크립트 출력값 사용)
```

#### 3️⃣ API 연결 테스트
```bash
# Cafe24 API 호출 테스트
node scripts/fetch-cafe24.cjs

# 정상: Status: 200
```

---

## 다음에 바로 시작하는 방법

### 🎯 시나리오 A: 토큰이 만료되었을 때

#### 증상
```bash
node scripts/fetch-cafe24.cjs
# Status: 401
# Error: Invalid access_token
```

#### 해결
```bash
# 1. Authorization Code 발급
# 브라우저에서:
https://daesan3833.cafe24api.com/api/v2/oauth/authorize?response_type=code&client_id=5TbJGxFqFBOtlYEXoWL47D&redirect_uri=https://web-cadalog-ver10.vercel.app/api/auth/callback&scope=mall.read_product,mall.write_product

# 2. 리다이렉트 URL에서 code= 값 복사
# 예: code=Fh4Qy25RLpMiDJbnHtlyyC

# 3. 스크립트 수정
nano scripts/exchange-code.cjs
# const code = '여기에_복사한_코드';

# 4. 실행
node scripts/exchange-code.cjs

# 5. 출력된 토큰을 .env.local에 복사
cat > .env.local << 'EOF'
CAFE24_MALL_ID=daesan3833
CAFE24_CLIENT_ID=5TbJGxFqFBOtlYEXoWL47D
CAFE24_CLIENT_SECRET=UHF95YG2GFXk0njZYbZcCB
CAFE24_ACCESS_TOKEN=새로받은토큰
CAFE24_REFRESH_TOKEN=새로받은토큰
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379
NODE_ENV=development
EOF

cp .env.local .env

# 6. 서버 재시작 (실행 중이라면)
lsof -ti:3000 | xargs kill -9
npm run dev
```

---

### 🎯 시나리오 B: 데이터 동기화만 하고 싶을 때

#### 전제조건
- 토큰이 유효함 (200 OK)

#### 실행
```bash
# 1. Cafe24 데이터 수집
node scripts/sync-from-cafe24.cjs

# 2. 정규화
node scripts/phase2-group-prefix-fixed.cjs

# 3. 결과 확인
cat test/phase2_grouped/grouped-by-prefix.json | head -50
```

---

### 🎯 시나리오 C: 환경변수 문제 (undefined.cafe24api.com)

#### 증상
```
Error: getaddrinfo ENOTFOUND undefined.cafe24api.com
```

#### 해결
```bash
# 1. 환경변수 재생성
cat > .env.local << 'EOF'
CAFE24_MALL_ID=daesan3833
CAFE24_CLIENT_ID=5TbJGxFqFBOtlYEXoWL47D
CAFE24_CLIENT_SECRET=UHF95YG2GFXk0njZYbZcCB
CAFE24_ACCESS_TOKEN=cVDGfi1QA62ax4LWDByb1D
CAFE24_REFRESH_TOKEN=dScxqgeWLibCLWF0btecvD
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379
NODE_ENV=development
EOF

# 2. .env 복사
cp .env.local .env

# 3. 확인
cat .env | head -1
# 출력: CAFE24_MALL_ID=daesan3833

# 4. 서버 완전 재시작
lsof -ti:3000 | xargs kill -9
npm run dev
```

---

### 🎯 시나리오 D: API 응답 구조가 변경되었을 때

#### 증상
```json
{
  "group_count": 0,
  "products_array_exists": false
}
```

#### 진단
```bash
# 1. API 응답 확인
node scripts/fetch-cafe24.cjs

# 2. 필드 이름 확인
cat test/phase1_raw/category-325.json | grep -o '"[a-z_]*code"' | sort -u

# 3. 값 확인
grep '"찾은_필드_이름"' test/phase1_raw/category-325.json | head -5
```

#### 해결
```bash
# 스크립트에서 필드명 변경
# 예: variant_code → product_code
sed -i.backup 's/variant_code/새_필드명/g' scripts/phase2-group-prefix-fixed.cjs
```

---

## 체크리스트

### 🔍 토큰 갱신 전 체크리스트

- [ ] Cafe24 개발자센터 로그인 가능
- [ ] Client ID 확인: `5TbJGxFqFBOtlYEXoWL47D`
- [ ] Client Secret 확인: `UHF95YG2GFXk0njZYbZcCB`
- [ ] Redirect URI 확인: `https://web-cadalog-ver10.vercel.app/api/auth/callback`
- [ ] Authorization URL 준비됨
- [ ] `scripts/exchange-code.cjs` 파일 존재
- [ ] 5분 내 작업 가능 (Authorization Code 유효기간)

---

### 🔍 데이터 동기화 전 체크리스트

- [ ] Redis 실행 중: `redis-cli ping` → PONG
- [ ] 환경변수 설정 확인: `cat .env | head -1`
- [ ] API 연결 테스트: `node scripts/fetch-cafe24.cjs` → 200 OK
- [ ] `scripts/sync-from-cafe24.cjs` 존재
- [ ] `scripts/phase2-group-prefix-fixed.cjs` 존재
- [ ] `test/phase1_raw/` 디렉토리 존재

---

### 🔍 환경변수 설정 체크리스트

- [ ] `.env.local` 파일 생성
- [ ] `.env` 파일도 생성 (`cp .env.local .env`)
- [ ] `CAFE24_MALL_ID=daesan3833` 확인
- [ ] `CAFE24_CLIENT_ID` 공백 없이
- [ ] `CAFE24_CLIENT_SECRET` 정확히
- [ ] `CAFE24_ACCESS_TOKEN` 최신값
- [ ] `CAFE24_REFRESH_TOKEN` 최신값
- [ ] 서버 재시작 완료

---

### 🔍 문제 해결 체크리스트

#### 401 에러 발생 시
- [ ] Access Token 유효기간 확인 (2시간)
- [ ] Refresh Token으로 갱신 시도
- [ ] 실패 시 Authorization Code 재발급

#### 400 에러 발생 시
- [ ] Client Secret 재확인
- [ ] Redirect URI 일치 확인
- [ ] Authorization Code 재발급 (1회용)

#### undefined.cafe24api.com 에러 시
- [ ] `.env.local` 첫 줄 확인
- [ ] `.env` 파일도 생성
- [ ] 서버 완전 재시작

#### group_count: 0 문제 시
- [ ] API 응답 구조 확인
- [ ] 필드명 매칭 확인
- [ ] 디버깅 스크립트 실행

---

## 핵심 교훈

### ✅ 항상 기억할 것

1. **토큰은 만료된다**
   - Access Token: 2시간
   - Refresh Token: 2주
   - Authorization Code: 5분, 1회용

2. **환경변수는 재시작 필수**
   - .env.local 수정 → 서버 재시작
   - .env도 함께 생성
   - 완전 종료 후 재시작

3. **API 문서 != 실제 응답**
   - 항상 실제 응답 확인
   - 필드명 검증
   - 디버깅 스크립트 활용

4. **Redirect URI는 정확히**
   - 슬래시 하나도 중요
   - http vs https 구분
   - 개발/프로덕션 모두 등록

5. **작은 단위로 검증**
   - 디버깅 스크립트 먼저
   - 단계별 확장
   - 각 단계 결과 확인

---

## 다음 개선 사항

### 🚀 자동화
```bash
# Cron job으로 매일 동기화
0 9 * * * cd /path/to/project && node scripts/sync-from-cafe24.cjs && node scripts/phase2-group-prefix-fixed.cjs
```

### 🔔 모니터링
```bash
# 토큰 만료 알림
# Access Token 1시간 50분 경과 시 알림
# Refresh Token 13일 경과 시 알림
```

### 📊 대시보드
- 웹 UI로 결과 확인
- 실시간 동기화 상태
- 에러 로그 모니터링

---

## 참고 자료

### 📚 Cafe24 문서
- OAuth 2.0: https://developers.cafe24.com/docs/api/admin/#oauth-2-0
- Admin API: https://developers.cafe24.com/docs/api/admin

### 🔧 프로젝트 파일
- 개발 일지: `PROJECT_COMPLETED.md`
- 토큰 갱신 가이드: `토큰갱신.md`
- 초기 To-Do: `To_Do_0213.md`

---

**작성 완료:** 2025년 2월 14일  
**상태:** ✅ 프로젝트 완료  
**다음 작업:** 자동화 및 모니터링 구축
