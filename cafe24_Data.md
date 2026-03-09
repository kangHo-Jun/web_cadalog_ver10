# Cafe24 데이터 연동 및 웹 게시 로직 (`cafe24_Data.md`)

이 문서는 Cafe24 쇼핑몰의 상품 데이터를 API를 통해 가져와서, 로컬 데이터베이스(JSON)로 변환하고, 웹 카탈로그에 게시하는 전체 흐름과 로직을 설명합니다.

## 1. 데이터 흐름도 (Data Pipeline)

```mermaid
graph TD
    A[Cafe24 API] -->|GET /admin/products| B(verify_transform_step2.py)
    B -->|데이터 추출 및 변환| C[data/catalog_products.json]
    C -->|데이터 정제 (100개/20개 선별)| D(logic/refine_data.py)
    D -->|최종 DB| E[data/refined_catalog.json]
    E -->|FETCH (AJAX)| F[Web Catalog (App.js)]
    F -->|랜더링| G[사용자 브라우저]
```

## 2. 단계별 상세 로직

### 2.1 데이터 수집 (Fetch)
- **소스**: Cafe24 Admin API
- **도구**: `verify_transform_step2.py` (내부적으로 `core/shop/cafe24_reader.py` 사용)
- **기능**:
  - OAuth 2.0 인증을 통해 Access Token 획득.
  - 상품 목록 API (`GET /api/v2/admin/products`) 호출.
  - 필수 필드만 추출: 상품명, 모델명, 판매가, 이미지 URL, 카테고리 등.
  - **결과물**: `data/catalog_products.json` (전체 원본 성격의 로컬 DB)

### 2.2 데이터 정제 (Refine)
- **목적**: 웹에 표시할 데이터를 선별하고, 화면 표시 규칙(테이블 vs 그리드)을 설정.
- **도구**: `logic/refine_data.py`
- **로직**:
  1. `catalog_products.json` 로드.
  2. `display: True`인 항목 필터링.
  3. **상위 100개** 추출 (전체 검색용).
  4. **상위 20개**에 `is_table_view: True` 플래그 추가 (초기 화면 테이블 표시용).
- **결과물**: `data/refined_catalog.json` (웹 앱이 실제로 읽는 파일)

### 2.3 웹 게시 및 렌더링 (Display)
- **파일**: `web/catalog/index.html`, `web/catalog/app.js`
- **화면 구성**:
  1. **초기 화면 (Default)**:
     - `is_table_view: True`인 20개 품목만 **테이블 형식**으로 표시.
     - 전체 100개 그리드는 숨김 처리.
  2. **검색 시 (Search)**:
     - 검색어와 일치하는 항목을 100개 DB(`refined_catalog.json`)에서 필터링.
     - 초기 테이블을 숨기고, 검색 결과를 **테이블 형식**으로 표시.
  3. **초기화 (Reset)**:
     - 검색어 삭제 후 초기 화면(주요 품목 20선 테이블)으로 복귀.

## 3. 파일 구조 및 역할

| 경로 | 역할 | 비고 |
|------|------|------|
| `core/shop/cafe24_reader.py` | API 통신 모듈 | 인증 및 데이터 Fetch 담당 |
| `verify_transform_step2.py` | 데이터 수집 실행 스크립트 | 실행 시 Cafe24에서 최신 데이터 가져옴 |
| `logic/transformer.py` | 데이터 변환 로직 | API 응답을 간소화된 JSON 포맷으로 변환 |
| `logic/refine_data.py` | 데이터 정제 스크립트 | 100개/20개 선별 로직 (실행 시 `refined_catalog.json` 갱신) |
| `web/catalog/app.js` | 프론트엔드 로직 | 화면 표시, 검색, 필터링 처리 |

## 4. 데이터 갱신 방법

최신 데이터를 웹에 반영하려면 다음 명령어를 순서대로 실행합니다.

```bash
# 1. Cafe24에서 데이터 가져오기 (100개)
python3 verify_transform_step2.py

# 2. 웹용 데이터로 정제하기 (100개/20개 분리)
python3 logic/refine_data.py
```

위 명령 실행 후 웹 페이지를 새로고침(F5)하면 변경된 데이터가 반영됩니다.
