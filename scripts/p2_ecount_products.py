import json
import os
import requests
import time
from dotenv import load_dotenv

load_dotenv('config/secrets.env')

COM_CODE = os.getenv('ECOUNT_COM_CODE')
USER_ID = os.getenv('ECOUNT_USER_ID')
CERT_KEY = os.getenv('ECOUNT_CERT_KEY')

if not COM_CODE or not USER_ID or not CERT_KEY:
    raise SystemExit('ECOUNT_COM_CODE / ECOUNT_USER_ID / ECOUNT_CERT_KEY 필요')

OUT_PATH = 'data/ecount_filtered.json'


def compact_item(p):
    return {
        'PROD_CD': p.get('PROD_CD', ''),
        'PROD_DES': p.get('PROD_DES', ''),
        'OUT_PRICE': p.get('OUT_PRICE', ''),
        'OUT_PRICE1': p.get('OUT_PRICE1', ''),
        'OUT_PRICE2': p.get('OUT_PRICE2', ''),
        'OUT_PRICE3': p.get('OUT_PRICE3', ''),
        'CLASS_CD': p.get('CLASS_CD', ''),
    }


print('=== P2 이카운트 상품 수집 시작 ===')

# Zone
r1 = requests.post('https://oapi.ecount.com/OAPI/V2/Zone', json={'COM_CODE': COM_CODE}, timeout=10)
zone = r1.json().get('Data', {}).get('ZONE')
print('ZONE:', zone)

# Login
r2 = requests.post(
    f'https://oapi{zone}.ecount.com/OAPI/V2/OAPILogin',
    json={
        'COM_CODE': COM_CODE,
        'USER_ID': USER_ID,
        'API_CERT_KEY': CERT_KEY,
        'LAN_TYPE': 'ko-KR',
        'ZONE': zone,
    },
    timeout=10
)
session_id = r2.json().get('Data', {}).get('Datas', {}).get('SESSION_ID')
if not session_id:
    raise SystemExit('SESSION_ID 발급 실패')
print('SESSION_ID:', session_id[:10], '...')

# 1회 요청 (412 재시도)
attempts = 0
while True:
    attempts += 1
    r3 = requests.post(
        f'https://oapi{zone}.ecount.com/OAPI/V2/InventoryBasic/GetBasicProductsList?SESSION_ID={session_id}',
        json={'ListParam': {'PAGE_CURRENT': 1, 'PAGE_SIZE': 100}},
        timeout=10
    )
    if r3.status_code == 412 and attempts <= 5:
        print('412 제한 — 30초 대기 후 재시도')
        time.sleep(30)
        continue
    break

try:
    payload = r3.json()
except Exception:
    raise SystemExit(f'상품조회 응답 파싱 실패 (Status {r3.status_code}): {r3.text[:200]}')
data = payload.get('Data', {})
result = data.get('Result', [])
print('수신 건수:', len(result))

# (1) 또는 ◈ 필터링 + 중복 제거(PROD_CD)
seen = set()
filtered = []
for p in result:
    prod_cd = p.get('PROD_CD', '')
    prod_des = p.get('PROD_DES', '')
    if '(1)' not in prod_cd and '◈' not in prod_des:
        continue
    if prod_cd in seen:
        continue
    seen.add(prod_cd)
    filtered.append(compact_item(p))

# OUT_PRICE2 샘플 3건
sample_prices = [p.get('OUT_PRICE2', '') for p in filtered[:3]]

# 저장
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(filtered, f, ensure_ascii=False, indent=2)

print(f'완료: 총 {len(filtered)}건 → {OUT_PATH}')
print('OUT_PRICE2 샘플 3건:', sample_prices)
