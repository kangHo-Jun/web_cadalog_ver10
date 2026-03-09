# 이카운트(ECOUNT) OAPI 레퍼런스 가이드

> 이 문서는 이카운트 ERP의 Open API(OAPI)를 활용한 자동화 개발을 위한 종합 참고 문서입니다.

---

## 목차

1. [개요](#개요)
2. [인증 및 세션 관리](#인증-및-세션-관리)
   - [Zone API](#zone-api)
   - [로그인 API](#로그인-api)
3. [기초등록 API](#기초등록-api)
   - [거래처등록](#거래처등록-api)
   - [품목등록](#품목등록-api)
4. [영업관리 API](#영업관리-api)
   - [주문서입력](#주문서입력-api)
   - [판매입력](#판매입력-api)
5. [구매관리 API](#구매관리-api)
   - [발주서조회](#발주서조회-api)
   - [구매입력](#구매입력-api)
6. [재고관리 API](#재고관리-api)
   - [재고현황](#재고현황-api)
7. [쇼핑몰 API](#쇼핑몰-api)
   - [주문API(쇼핑몰관리)](#쇼핑몰-주문-api)
8. [에러 코드 및 주의사항](#에러-코드-및-주의사항)

---

## 개요

### ECOUNT OAPI란?
이카운트 OAPI는 고객사가 이카운트 ERP 데이터를 타 프로그램/사이트와 연동할 수 있도록 데이터 플랫폼을 외부에 공개하는 서비스입니다.

### 연동 가능 범위
- 자체 쇼핑몰, 자사 웹사이트, 키오스크, 자사 앱 등
- 품목, 거래처, 주문서, 판매전표, 재고, 생산, 회계 데이터

### 기본 규격
| 항목 | 값 |
|------|-----|
| HTTP 메서드 | POST |
| Content-Type | application/json |
| 데이터 포맷 | JSON |
| 문자 인코딩 | UTF-8 |

### URL 구조
- **테스트 서버**: `https://sboapi{ZONE}.ecount.com/OAPI/V2/{API_PATH}`
- **정식 서버**: `https://oapi{ZONE}.ecount.com/OAPI/V2/{API_PATH}`
- `{ZONE}`: Zone API로 조회한 값 (예: A, B, C 등)
- `{SESSION_ID}`: 로그인 API로 발급받은 세션 ID

---

## 인증 및 세션 관리

### Zone API

외부 서비스 연계 시 필요한 호스트 정보(Zone 정보)를 확인하는 API입니다.

#### 기본 정보
| 항목 | 값 |
|------|-----|
| URL (테스트) | `https://sboapi.ecount.com/OAPI/V2/Zone` |
| URL (정식) | `https://oapi.ecount.com/OAPI/V2/Zone` |
| Method | POST |

#### Request 파라미터
| 변수 | 변수명 | 자릿수 | 필수 | 설명 |
|------|--------|--------|------|------|
| COM_CODE | 회사코드 | 6 | Y | 이카운트 로그인 시 사용하는 5~6자리 회사코드 |

#### Request 예시
```json
{
    "COM_CODE": "80001"
}
```

#### Response 구조
| 변수 | 설명 |
|------|------|
| Status | 처리결과 (200: 정상) |
| Data.ZONE | Sub domain Zone (예: A, B, C) |
| Data.DOMAIN | 도메인 정보 (예: .ecount.com) |
| Data.EXPIRE_DATE | API 버전 서비스 종료 예정일 |

#### Response 예시 (성공)
```json
{
    "Data": {
        "EXPIRE_DATE": "",
        "ZONE": "A",
        "DOMAIN": ".ecount.com"
    },
    "Status": "200",
    "Error": null,
    "Timestamp": "2018년 6월 11일 오후 1:09:21"
}
```

---

### 로그인 API

외부 서비스 연계를 위한 세션 ID(SESSION_ID)를 발급받는 필수 API입니다.

#### 기본 정보
| 항목 | 값 |
|------|-----|
| URL (테스트) | `https://sboapi{ZONE}.ecount.com/OAPI/V2/OAPILogin` |
| URL (정식) | `https://oapi{ZONE}.ecount.com/OAPI/V2/OAPILogin` |
| Method | POST |

#### Request 파라미터
| 변수 | 변수명 | 필수 | 설명 |
|------|--------|------|------|
| COM_CODE | 회사코드 | Y | 이카운트 회사코드 (6자) |
| USER_ID | 사용자ID | Y | 인증키를 발급받은 사용자 ID |
| API_CERT_KEY | 인증키 | Y | ERP 'API인증키발급' 메뉴에서 발급받은 키 |
| LAN_TYPE | 언어설정 | Y | ko-KR, en-US, zh-CN, ja-JP 등 |
| ZONE | Zone | Y | Zone API에서 조회한 값 |

#### Request 예시
```json
{
    "COM_CODE": "80001",
    "USER_ID": "USER_ID",
    "API_CERT_KEY": "YOUR_API_CERT_KEY",
    "LAN_TYPE": "ko-KR",
    "ZONE": "C"
}
```

#### Response 예시 (성공)
```json
{
    "Data": {
        "Code": "00",
        "Datas": {
            "COM_CODE": "80001",
            "USER_ID": "USER_ID",
            "SESSION_ID": "39313231367c256562253866...:0HDD9DBtZt2e"
        }
    },
    "Status": "200",
    "Error": null
}
```

#### 세션 유지 및 인증키 정책
| 항목 | 설명 |
|------|------|
| 세션 유지 시간 | ERP 내 자동로그아웃 설정 시간 적용 |
| 세션 연장 | API 호출 시마다 자동 연장 |
| 테스트 인증키 | 발급 후 **2주간** 유효 |
| 본 인증키 | 검증 완료 후 **1년간** 유효 |

---

## 기초등록 API

### 거래처등록 API

외부 서비스에서 ERP에 거래처를 등록합니다.

#### 기본 정보
| 항목 | 값 |
|------|-----|
| URL | `/OAPI/V2/AccountBasic/SaveBasicCust?SESSION_ID={SESSION_ID}` |
| Method | POST |

#### 주요 파라미터 (CustList > BulkDatas)
| 변수 | 자릿수 | 필수 | 설명 |
|------|--------|------|------|
| BUSINESS_NO | STRING(30) | Y | 사업자등록번호 (ERP 거래처코드) |
| CUST_NAME | STRING(100) | Y | 회사명 |
| BOSS_NAME | STRING(50) | - | 대표자명 |
| TEL | STRING(50) | - | 전화번호 |
| EMAIL | STRING(100) | - | 이메일 |
| ADDR | STRING(500) | - | 주소 |
| G_GUBUN | STRING(2) | - | 거래처코드구분 (01:사업자, 02:주민, 03:외국인) |

#### Request 예시
```json
{
  "CustList": [{
    "BulkDatas": {
      "BUSINESS_NO": "00001",
      "CUST_NAME": "Test Cust",
      "BOSS_NAME": "홍길동",
      "TEL": "010-1234-5678"
    }
  }]
}
```

---

### 품목등록 API

ERP에 품목을 등록합니다.

#### 기본 정보
| 항목 | 값 |
|------|-----|
| URL | `/OAPI/V2/InventoryBasic/SaveBasicProduct?SESSION_ID={SESSION_ID}` |
| Method | POST |

#### 주요 파라미터 (ProductList > BulkDatas)
| 변수 | 자릿수 | 필수 | 설명 |
|------|--------|------|------|
| PROD_CD | STRING(20) | Y | 품목코드 |
| PROD_DES | STRING(100) | Y | 품목명 |
| PROD_TYPE | STRING(1) | - | 품목구분 (0:원재료, 1:제품, 2:반제품, 3:상품) |
| UNIT | STRING(6) | - | 단위 |
| IN_PRICE | NUMERIC | - | 입고단가 |
| OUT_PRICE | NUMERIC | - | 출고단가 |
| WH_CD | STRING(5) | - | 생산공정/창고코드 |

#### Request 예시
```json
{
  "ProductList": [{
    "BulkDatas": {
      "PROD_CD": "ITEM001",
      "PROD_DES": "테스트 품목",
      "PROD_TYPE": "3",
      "OUT_PRICE": "1000"
    }
  }]
}
```

---

## 영업관리 API

### 주문서입력 API

영업 관리의 주문서를 입력합니다.

#### 기본 정보
| 항목 | 값 |
|------|-----|
| URL | `/OAPI/V2/SaleOrder/SaveSaleOrder?SESSION_ID={SESSION_ID}` |
| Method | POST |

#### 주요 파라미터 (SaleOrderList > BulkDatas)
| 변수 | 필수 | 설명 |
|------|------|------|
| UPLOAD_SER_NO | Y | 순번 (동일 전표 묶음 시 동일 번호) |
| IO_DATE | Y | 주문일자 (YYYYMMDD) |
| CUST | Y | 주문거래처코드 |
| WH_CD | Y | 출하창고코드 |
| PROD_CD | Y | 품목코드 |
| QTY | Y | 수량 |
| PRICE | - | 단가 |
| SUPPLY_AMT | - | 공급가액 |

#### Request 예시
```json
{
  "SaleOrderList": [{
    "BulkDatas": {
      "IO_DATE": "20180612",
      "CUST": "00016",
      "WH_CD": "00009",
      "PROD_CD": "00001",
      "QTY": "1"
    }
  }]
}
```

---

### 판매입력 API

ERP의 판매 메뉴에 데이터를 입력합니다.

#### 기본 정보
| 항목 | 값 |
|------|-----|
| URL | `/OAPI/V2/Sale/SaveSale?SESSION_ID={SESSION_ID}` |
| Method | POST |

#### 주요 파라미터 (SaleList > BulkDatas)
| 변수 | 필수 | 설명 |
|------|------|------|
| IO_DATE | Y | 판매일자 (YYYYMMDD) |
| WH_CD | Y | 출하창고코드 |
| PROD_CD | Y | 품목코드 |
| QTY | Y | 수량 |
| CUST | - | 거래처코드 |
| PRICE | - | 단가 |
| SUPPLY_AMT | - | 공급가액 |

#### Request 예시
```json
{
  "SaleList": [{
    "BulkDatas": {
      "IO_DATE": "20231024",
      "WH_CD": "00001",
      "PROD_CD": "ITEM001",
      "QTY": "10",
      "CUST": "CUST001"
    }
  }]
}
```

#### Response 구조
| 변수 | 설명 |
|------|------|
| SlipNos | 생성된 판매 전표번호 리스트 (예: ["20231024-1"]) |
| SuccessCnt | 성공 건수 |

---

## 구매관리 API

### 발주서조회 API

등록된 발주서 내역을 조건에 따라 조회합니다.

#### 기본 정보
| 항목 | 값 |
|------|-----|
| URL | `/OAPI/V2/Purchases/GetPurchasesOrderList?SESSION_ID={SESSION_ID}` |
| Method | POST |

#### 주요 파라미터
| 변수 | 필수 | 설명 |
|------|------|------|
| PROD_CD | - | 품목코드 (복수 검색 시 '∬'로 구분) |
| CUST_CD | - | 거래처코드 |
| ListParam.BASE_DATE_FROM | Y | 검색 시작일 (YYYYMMDD) |
| ListParam.BASE_DATE_TO | Y | 검색 종료일 (YYYYMMDD, 최대 30일) |
| ListParam.PAGE_CURRENT | - | 페이지 번호 |
| ListParam.PAGE_SIZE | - | 표시 줄 수 (최대 100) |

#### Response 구조
`Data.Result` 배열 내에 `ORD_NO`, `ORD_DATE`, `CUST_DES`, `QTY`, `BUY_AMT` 등의 정보가 반환됩니다.

---

### 구매입력 API

외부 서비스에서 ERP의 구매 전표를 입력합니다.

#### 기본 정보
| 항목 | 값 |
|------|-----|
| URL | `/OAPI/V2/Purchases/SavePurchases?SESSION_ID={SESSION_ID}` |
| Method | POST |

#### 주요 파라미터 (PurchasesList > BulkDatas)
| 변수 | 필수 | 설명 |
|------|------|------|
| UPLOAD_SER_NO | Y | 순번 (동일 전표 묶음 시 동일 번호) |
| IO_DATE | Y | 입고일자 (YYYYMMDD) |
| CUST | Y | 거래처코드 |
| WH_CD | Y | 입고창고코드 |
| PROD_CD | Y | 품목코드 |
| QTY | Y | 수량 |
| PRICE | - | 단가 |
| SUPPLY_AMT | - | 공급가액 |
| VAT_AMT | - | 부가세 |

#### Request 예시
```json
{
  "PurchasesList": [{
    "BulkDatas": {
      "IO_DATE": "20191012",
      "CUST": "00001",
      "WH_CD": "00001",
      "PROD_CD": "00001",
      "QTY": "1",
      "PROD_DES": "테스트품목"
    }
  }]
}
```

---

## 재고관리 API

### 재고현황 API

특정 시점의 창고별/품목별 재고 수량을 조회합니다.

#### 기본 정보
| 항목 | 값 |
|------|-----|
| URL | `/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatus?SESSION_ID={SESSION_ID}` |
| Method | POST |

#### 주요 파라미터
| 변수 | 필수 | 설명 |
|------|------|------|
| BASE_DATE | Y | 검색 기준일 (YYYYMMDD) |
| WH_CD | - | 특정 창고코드 (공백 시 전체) |
| PROD_CD | - | 특정 품목코드 (공백 시 전체) |
| ZERO_FLAG | - | 재고수량 0 포함 여부 (Y/N) |

#### Request 예시
```json
{
  "BASE_DATE": "20231024",
  "PROD_CD": "",
  "WH_CD": "00001",
  "ZERO_FLAG": "N"
}
```

#### Response 구조
| 변수 | 설명 |
|------|------|
| TotalCnt | 조회된 데이터 총 건수 |
| Result | 재고 목록 배열 (PROD_CD, BAL_QTY 포함) |

---

## 쇼핑몰 API

### 쇼핑몰 주문 API

쇼핑몰 관리 메뉴로 신규 주문 데이터를 수집 입력합니다.

#### 기본 정보
| 항목 | 값 |
|------|-----|
| URL | `/OAPI/V2/OpenMarket/SaveOpenMarketOrderNew?SESSION_ID={SESSION_ID}` |
| Method | POST |

#### 주요 파라미터
| 변수 | 필수 | 설명 |
|------|------|------|
| OPENMARKET_CD | Y | 쇼핑몰코드 |
| ORDERS | Y | 주문 목록 배열 |

#### ORDERS 배열 항목
| 변수 | 필수 | 설명 |
|------|------|------|
| GROUP_NO | Y | 묶음주문번호 |
| ORDER_NO | Y | 주문번호 |
| ORDER_DATE | Y | 주문일자 (DATETIME 형식) |
| PROD_CD | Y | 쇼핑몰상품코드 |
| ORDER_QTY | Y | 수량 |
| ORDERER | - | 주문자명 |
| RECEIVER | - | 수취인명 |
| ADDR | Y | 주소 |

#### Request 예시
```json
{
  "OPENMARKET_CD": "00001",
  "ORDERS": [{
    "GROUP_NO": "ORDER123",
    "ORDER_NO": "ITEM456",
    "ORDER_DATE": "2018-05-25 13:06:29.000",
    "PROD_CD": "P001",
    "ORDER_QTY": 1,
    "ORDERER": "홍길동",
    "ADDR": "서울특별시..."
  }]
}
```

---

## 에러 코드 및 주의사항

### HTTP 상태 코드
| 코드 | 설명 |
|------|------|
| 200 | 정상 처리 |
| 404 | API 경로(Path) 오류 |
| 412 | 서버 요청 제한 건수 초과 |
| 500 | 서버 내부 오류 (상세 코드 확인 필요) |

### 주요 오류 코드
| 코드 | 설명 |
|------|------|
| 100 | Zone 정보 없음 (유효하지 않은 회사코드) |
| 201 | Zone 정보가 없습니다 |

### 주의사항
> [!IMPORTANT]
> - 모든 API 호출 시 `SESSION_ID`가 쿼리 스트링으로 포함되어야 합니다.
> - `Content-Type`을 `application/json`으로 설정해야 합니다.
> - JSON 형식은 **쌍따옴표("")만** 사용해야 합니다. (홑따옴표 사용 불가)

> [!WARNING]
> - 테스트 인증키로 검증 절차 없이 지속 요청 시 **통보 없이 차단**될 수 있습니다.
> - API 연속 오류 제한 건수 초과 시 500 오류가 발생합니다.
> - 오류 문의 시 응답에 포함된 `TRACE_ID`를 함께 제공하세요.

> [!TIP]
> - 입력 API의 경우 ERP 내 '웹자료올리기' 항목 설정에 따라 필수 값이 달라질 수 있습니다.
> - 실제 연동 전 ERP 설정 확인을 권장합니다.
> - 네이버 스마트스토어, 11번가 등 주요 쇼핑몰은 API 개발 없이 ERP 내 '쇼핑몰관리' 메뉴에서 직접 연동이 가능합니다.

---

## API 호출 흐름 예시 (Python)

```python
import requests
import json

# 1. Zone 조회
zone_url = "https://sboapi.ecount.com/OAPI/V2/Zone"
zone_data = {"COM_CODE": "YOUR_COM_CODE"}
zone_response = requests.post(zone_url, json=zone_data)
zone_info = zone_response.json()
ZONE = zone_info["Data"]["ZONE"]

# 2. 로그인 (SESSION_ID 발급)
login_url = f"https://sboapi{ZONE}.ecount.com/OAPI/V2/OAPILogin"
login_data = {
    "COM_CODE": "YOUR_COM_CODE",
    "USER_ID": "YOUR_USER_ID",
    "API_CERT_KEY": "YOUR_API_KEY",
    "LAN_TYPE": "ko-KR",
    "ZONE": ZONE
}
login_response = requests.post(login_url, json=login_data)
session_info = login_response.json()
SESSION_ID = session_info["Data"]["Datas"]["SESSION_ID"]

# 3. 재고현황 조회
inventory_url = f"https://sboapi{ZONE}.ecount.com/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatus?SESSION_ID={SESSION_ID}"
inventory_data = {
    "BASE_DATE": "20231224",
    "WH_CD": "",
    "PROD_CD": "",
    "ZERO_FLAG": "N"
}
inventory_response = requests.post(inventory_url, json=inventory_data)
print(inventory_response.json())
```

---

*문서 생성일: 2025-12-23*  
*이카운트 OAPI V2 기준*
