import csv
import re
from rapidfuzz import process, fuzz

def normalize_for_tokens(s):
    if not s:
        return ""
    # 1. Lowercase
    s = s.lower()
    # 2. Dimensions: '*' -> 'x', and ensure space around x/dimension symbols
    s = s.replace('*', ' x ')
    s = s.replace('”', ' ')
    s = s.replace('"', ' ')
    # 3. Add space around numbers to treat them as tokens
    # s = re.sub(r'(\d+)', r' \1 ', s)
    # 4. Remove special characters but KEEP space
    s = re.sub(r'[^a-z0-9가-힣\s]', ' ', s)
    # 5. Collapse spaces
    s = " ".join(s.split())
    return s

def run_example_matching():
    ecount_file = 'data/예제/이카운트_재고 - 품목등록.csv'
    cafe24_file = 'data/예제/카페24_데이터_최종.xlsx - daesan3833_20260309_16_c0ba.csv'
    output_file = 'data/예제/매칭_결과_예제.csv'

    # Load Cafe24
    cafe24_candidates = []
    try:
        with open(cafe24_file, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader)
            for row in reader:
                if not row: continue
                prod_name = row[0] if len(row) > 0 else ""
                variant_name = row[7] if len(row) > 7 else ""
                combined_name = f"{prod_name} {variant_name}".strip()
                
                if combined_name:
                    cafe24_candidates.append({
                        'full_name': combined_name,
                        'norm_name': normalize_for_tokens(combined_name),
                        'product_code': row[1] if len(row) > 1 else "",
                        'variant_code': row[8] if len(row) > 8 else ""
                    })
    except Exception as e:
        print(f"Error reading Cafe24: {e}")
        return

    # Load ECount
    ecount_items = []
    try:
        with open(ecount_file, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader)
            for row in reader:
                if not row: continue
                ec_code = row[0] if len(row) > 0 else ""
                ec_name = row[1] if len(row) > 1 else ""
                if ec_name:
                    ecount_items.append({
                        'code': ec_code,
                        'name': ec_name,
                        'norm_name': normalize_for_tokens(ec_name)
                    })
    except Exception as e:
        print(f"Error reading ECount: {e}")
        return

    # Perform Matching
    cafe24_norm_list = [c['norm_name'] for c in cafe24_candidates]
    results = []

    for ec in ecount_items:
        # fuzz.token_set_ratio: Great when one string is a subset or contains common words in different order.
        # This should favor "구조재" and "1 x 4" appearing together.
        match = process.extractOne(ec['norm_name'], cafe24_norm_list, scorer=fuzz.token_set_ratio)
        
        if match:
            matched_name, score, idx = match
            best = cafe24_candidates[idx]
            results.append({
                '이카운트_품목코드': ec['code'],
                '이카운트_품목명': ec['name'],
                '카페24_매칭명': best['full_name'],
                '카페24_상품코드': best['product_code'],
                '카페24_품목코드': best['variant_code'],
                '유사도': round(score, 2)
            })
        else:
            results.append({
                '이카운트_품목코드': ec['code'],
                '이카운트_품목명': ec['name'],
                '카페24_매칭명': "매칭실패",
                '카페24_상품코드': "",
                '카페24_품목코드': "",
                '유사도': 0
            })

    # Save
    with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
        fieldnames = ['이카운트_품목코드', '이카운트_품목명', '카페24_매칭명', '카페24_상품코드', '카페24_품목코드', '유사도']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    print(f"Done. Processed {len(ecount_items)} items using token_set_ratio. Saved to {output_file}")

if __name__ == "__main__":
    run_example_matching()
