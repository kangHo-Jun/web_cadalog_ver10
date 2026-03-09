ECount ERP Open API v2 Guide (Updated)
This document captures the working process and troubleshooting steps used to make the ECount API calls succeed, so the next setup is faster and repeatable.

Authentication Flow
Authentication is a two-step process:

1) Zone Retrieval
Endpoint (test): POST https://sboapi.ecount.com/OAPI/V2/Zone
Endpoint (prod): POST https://oapi.ecount.com/OAPI/V2/Zone
Payload: {"COM_CODE": "YOUR_COMPANY_CODE"}
Response: Data.ZONE (e.g., "AB")

2) Session Token (Login)
Endpoint (test): POST https://sboapi{ZONE}.ecount.com/OAPI/V2/OAPILogin
Endpoint (prod): POST https://oapi{ZONE}.ecount.com/OAPI/V2/OAPILogin
Payload:
```json
{
  "COM_CODE": "YOUR_COMPANY_CODE",
  "USER_ID": "YOUR_USER_ID",
  "API_CERT_KEY": "YOUR_API_CERT_KEY",
  "LAN_TYPE": "ko-KR",
  "ZONE": "YOUR_ZONE"
}
```
Response: Data.Datas.SESSION_ID
IMPORTANT
The SESSION_ID must be passed as a query parameter in all subsequent API calls: ?SESSION_ID=[SESSION_ID].

Key Endpoints (Confirmed Working)
1) Product List Retrieval (품목 조회)
Endpoint: POST https://{base}{ZONE}.ecount.com/OAPI/V2/InventoryBasic/GetBasicProductsList?SESSION_ID={SESSION_ID}
Body:
```json
{
  "ListParam": {
    "PAGE_CURRENT": 1,
    "PAGE_SIZE": 10
  }
}
```
Returns: Data.Result[] with fields including PROD_CD and OUT_PRICE.

Notes:
- Inventory/GetListGoods returned "Not Found" on prod.
- InventoryBasic/GetBasicProductsList returned "인증되지 않은 API입니다." until valid cert key was used and prod endpoint was selected.

2) Inventory Balance Retrieval (재고 조회)
Endpoint: POST https://{base}{ZONE}.ecount.com/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatus?SESSION_ID={SESSION_ID}
Body:
```json
{
  "PROD_CD": "",
  "WH_CD": "",
  "BASE_DATE": "YYYYMMDD"
}
```

Usage Notes
All requests are POST and use JSON for both request and response bodies.
Use correct cert key type per environment:
- Test key => sboapi (test)
- Production key => oapi (prod)

Environment Variables (config/secrets.env)
- ECOUNT_COM_CODE
- ECOUNT_USER_ID
- ECOUNT_CERT_KEY (production)
- ECOUNT_TEST_CERT_KEY (test)

Troubleshooting Checklist
1) DNS resolution failures:
   - If ping/curl fails for ecount domains, set DNS to 8.8.8.8 and flush cache.
   - As last resort, add /etc/hosts entries:
     13.124.7.42 sboapi.ecount.com
     13.124.7.42 sboapiAB.ecount.com
     13.124.7.42 oapi.ecount.com

2) Login errors:
   - Code 203 + "API_CERT_KEY가 유효하지 않습니다." => wrong key or wrong environment.
   - Code 204 + "실서버용 인증키입니다." => production key used on test server.

3) Product API errors:
   - "인증되지 않은 API입니다." => wrong endpoint or not authorized for that API.
   - "Not Found" => incorrect endpoint path.
