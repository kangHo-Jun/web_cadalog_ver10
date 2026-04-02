import json
import os

EC_PATH = 'data/ecount_products.json'
CF_PATH = 'data/cafe24_products.json'
OUT_PATH = 'data/mapping_table.json'

if not os.path.exists(EC_PATH):
    raise SystemExit('data/ecount_products.json 없음 (P2 필요)')
if not os.path.exists(CF_PATH):
    raise SystemExit('data/cafe24_products.json 없음 (P3 필요)')

with open(EC_PATH, 'r', encoding='utf-8') as f:
    ecount = json.load(f)
with open(CF_PATH, 'r', encoding='utf-8') as f:
    cafe24 = json.load(f)

# 필터: PROD_CD에 (1) 포함 OR PROD_DES에 ◈ 포함
filtered = [
    p for p in ecount
    if '(1)' in p.get('PROD_CD', '') or '◈' in p.get('PROD_DES', '')
]

# Cafe24 custom_product_code 매핑 사전
cafe24_map = {}
for p in cafe24:
    key = (p.get('custom_product_code') or '').strip()
    if key:
        cafe24_map[key] = p

results = []
matched = 0
unmatched = 0

for p in filtered:
    prod_cd = p.get('PROD_CD', '')
    key = prod_cd.replace('(1)', '').strip()
    target = cafe24_map.get(key)
    if target:
        matched += 1
        results.append({
            'ecount_prod_cd': prod_cd,
            'ecount_prod_des': p.get('PROD_DES', ''),
            'cafe24_product_no': target.get('product_no'),
            'cafe24_product_code': target.get('product_code'),
            'cafe24_custom_product_code': target.get('custom_product_code'),
            'cafe24_product_name': target.get('product_name'),
            'match': True,
        })
    else:
        unmatched += 1
        results.append({
            'ecount_prod_cd': prod_cd,
            'ecount_prod_des': p.get('PROD_DES', ''),
            'cafe24_product_no': None,
            'cafe24_product_code': None,
            'cafe24_custom_product_code': None,
            'cafe24_product_name': None,
            'match': False,
        })

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(f'필터링 건수: {len(filtered)}')
print(f'매칭 성공: {matched}')
print(f'매칭 실패: {unmatched}')
print(f'저장: {OUT_PATH}')
