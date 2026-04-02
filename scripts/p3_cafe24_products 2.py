import json
import os
import requests
from dotenv import load_dotenv

load_dotenv('config/secrets.env')

MALL_ID = os.getenv('CAFE24_MALL_ID')
CLIENT_ID = os.getenv('CAFE24_CLIENT_ID')
CLIENT_SECRET = os.getenv('CAFE24_CLIENT_SECRET')

if not MALL_ID or not CLIENT_ID or not CLIENT_SECRET:
    raise SystemExit('CAFE24_MALL_ID / CAFE24_CLIENT_ID / CAFE24_CLIENT_SECRET 필요')

TOKEN_FILE = 'data/token_state.json'
OUT_PATH = 'data/cafe24_products.json'

with open(TOKEN_FILE, 'r', encoding='utf-8') as f:
    token = json.load(f)

access_token = token.get('access_token')
if not access_token:
    raise SystemExit('access_token 없음. token_state.json 확인 필요')

url = f'https://{MALL_ID}.cafe24api.com/api/v2/admin/products'
headers = {
    'Authorization': f'Bearer {access_token}',
    'Content-Type': 'application/json',
    'X-Cafe24-Api-Version': '2025-12-01',
}

all_products = []
offset = 0
limit = 100

while True:
    params = {'limit': limit, 'offset': offset, 'fields': 'product_no,product_name,product_code,price'}
    r = requests.get(url, headers=headers, params=params, timeout=15)
    if r.status_code != 200:
        raise SystemExit(f'조회 실패: {r.status_code} {r.text[:200]}')
    data = r.json()
    products = data.get('products', [])
    if not products:
        break
    all_products.extend(products)
    print(f'수집: {len(all_products)}건')
    offset += limit

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(all_products, f, ensure_ascii=False, indent=2)

print(f'완료: 총 {len(all_products)}건 → {OUT_PATH}')
