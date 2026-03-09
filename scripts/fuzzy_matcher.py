import json
import csv
import re
from rapidfuzz import process, fuzz

def normalize(s):
    if not isinstance(s, str):
        return ""
    # 1. 특수문자 제거 (Regex: [^\w\s])
    # 단, 사용자가 "글자와 숫자 위주로 매핑" 요청했으므로 한글/영문/숫자만 남김
    s = re.sub(r'[^a-zA-Z0-9가-힣]', '', s)
    # 2. 공백 제거
    s = s.replace(' ', '')
    # 3. 대소문자 통합 (lowercase)
    s = s.lower()
    return s

def run_matching():
    # Load Source A (Cafe24)
    try:
        with open('data/cafe24_products.json', encoding='utf-8') as f:
            cafe24_data = json.load(f)
    except FileNotFoundError:
        print("Error: data/cafe24_products.json not found.")
        return

    # Load Source B (Mapping Table / ECount)
    try:
        with open('data/ecount_filtered.json', encoding='utf-8') as f:
            ecount_data = json.load(f)
    except FileNotFoundError:
        print("Error: data/ecount_filtered.json not found.")
        return

    # Prepare Cafe24 names for matching
    # We create a mapping of {normalized_name: original_obj}
    cafe24_names = []
    cafe24_lookup = {}
    
    for item in cafe24_data:
        norm = normalize(item.get('product_name', ''))
        if norm:
            cafe24_names.append(norm)
            # Store first occurrence if duplicates (simplified)
            if norm not in cafe24_lookup:
                cafe24_lookup[norm] = item

    results = []
    
    for e in ecount_data:
        e_orig_des = e.get('PROD_DES', '')
        e_norm = normalize(e_orig_des)
        
        if not e_norm:
            best_match = None
            score = 0
        else:
            # Fuzzy matching
            match_result = process.extractOne(e_norm, cafe24_names, scorer=fuzz.WRatio)
            if match_result:
                best_match_name, score, index = match_result
                best_match = cafe24_lookup[best_match_name]
            else:
                best_match = None
                score = 0
        
        # Prepare output row according to requirement
        # A: ecount_prod_cd, B: ecount_prod_des, C: cafe24_product_no, D: cafe24_product_code, E: cafe24_product_name, F: similarity_score
        row = {
            'ecount_prod_cd': e.get('PROD_CD', ''),
            'ecount_prod_des': e_orig_des,
            'cafe24_product_no': best_match.get('product_no', '') if best_match else '',
            'cafe24_product_code': best_match.get('product_code', '') if best_match else '',
            'cafe24_product_name': best_match.get('product_name', '') if best_match else '',
            'similarity_score': round(score, 2)
        }
        results.append(row)

    # Write to CSV
    output_file = 'data/mapping_table.csv'
    fieldnames = ['ecount_prod_cd', 'ecount_prod_des', 'cafe24_product_no', 'cafe24_product_code', 'cafe24_product_name', 'similarity_score']
    
    with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    print(f"Matching Complete.")
    print(f"Processed: {len(ecount_data)} items.")
    print(f"Output saved to: {output_file}")

if __name__ == "__main__":
    run_matching()
