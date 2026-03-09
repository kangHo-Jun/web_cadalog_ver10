import json
import os
import random
import time
import requests
from dotenv import load_dotenv

load_dotenv('config/secrets.env')

COM_CODE = os.getenv('ECOUNT_COM_CODE')
USER_ID = os.getenv('ECOUNT_USER_ID')
CERT_KEY = os.getenv('ECOUNT_CERT_KEY')

if not COM_CODE or not USER_ID or not CERT_KEY:
    raise SystemExit('ECOUNT_COM_CODE / ECOUNT_USER_ID / ECOUNT_CERT_KEY 필요')

TEMP_PATH = 'data/ecount_products_temp.json'
OUT_PATH = 'data/ecount_products.json'


def save_temp(page, items):
    os.makedirs(os.path.dirname(TEMP_PATH), exist_ok=True)
    with open(TEMP_PATH, 'w', encoding='utf-8') as f:
        json.dump({'page': page, 'items': items}, f, ensure_ascii=False, indent=2)


def load_temp():
    if not os.path.exists(TEMP_PATH):
        return 1, []
    with open(TEMP_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return int(data.get('page', 1)), data.get('items', [])


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

page, collected = load_temp()
print(f'재개 페이지: {page}, 누계: {len(collected)}건')

while True:
    r3 = requests.post(
        f'https://oapi{zone}.ecount.com/OAPI/V2/InventoryBasic/GetBasicProductsList?SESSION_ID={session_id}',
        json={'ListParam': {'PAGE_CURRENT': page, 'PAGE_SIZE': 100}},
        timeout=10
    )

    if r3.status_code == 412:
        print('412 제한 — 30초 대기')
        time.sleep(30)
        continue

    data = r3.json().get('Data', {})
    result = data.get('Result', [])
    if not result:
        print('수집 완료')
        break

    filtered = [
        {
            'PROD_CD': p.get('PROD_CD', ''),
            'PROD_DES': p.get('PROD_DES', ''),
            'OUT_PRICE': p.get('OUT_PRICE', ''),
            'OUT_PRICE1': p.get('OUT_PRICE1', ''),
            'OUT_PRICE2': p.get('OUT_PRICE2', ''),
            'OUT_PRICE3': p.get('OUT_PRICE3', ''),
            'CLASS_CD': p.get('CLASS_CD', ''),
        }
        for p in result
        if p.get('CLASS_CD') == '11111'
    ]

    collected.extend(filtered)
    print(f'페이지 {page}: 필터링 {len(filtered)}건, 누계 {len(collected)}건')
    save_temp(page, collected)

    # 랜덤 딜레이 (요청 간)
    time.sleep(random.uniform(2, 5))
    # 페이지 간 추가 휴식
    time.sleep(5)

    page += 1

# 최종 저장
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(collected, f, ensure_ascii=False, indent=2)

print(f'완료: 총 {len(collected)}건 → {OUT_PATH}')
