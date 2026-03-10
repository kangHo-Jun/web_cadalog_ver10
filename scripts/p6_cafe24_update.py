import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict

import pandas as pd
import requests
from dotenv import load_dotenv

# Path setup
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DEFAULT_XLSX = DATA_DIR / "실제" / "자체코드_상품데이터2.xlsx"
FALLBACK_XLSX = DATA_DIR / "실제" / "자체코드 상품데이터2.xlsx"
CAFE24_PRODUCTS = DATA_DIR / "cafe24_products.json"

# Load environment
load_dotenv(ROOT / "config" / "secrets.env")

MALL_ID = os.getenv("CAFE24_MALL_ID")
if not MALL_ID:
    raise SystemExit("CAFE24_MALL_ID 누락")

# Cafe24 Auth
try:
    from cafe24_api import get_valid_token
    TOKEN = get_valid_token()
except Exception:
    # fallback to token_state.json directly if automation script fails
    token_path = DATA_DIR / "token_state.json"
    if token_path.exists():
        TOKEN = json.load(open(token_path, encoding="utf-8"))["access_token"]
    else:
        raise

API_VERSION = "2025-12-01"

TEST_OVERRIDES = {
    "(1)800플로3": 1,
    "(1)800골판지": 100,
}

def to_number(v):
    if v is None:
        return 0
    # Handle NaN/NA from pandas/excel
    if isinstance(v, float) and (v != v): # v != v is True only for NaN
        return 0
    s = str(v).strip().replace(",", "")
    if s == "" or s.lower() == "nan":
        return 0
    try:
        return float(s)
    except ValueError:
        return 0

def load_products():
    if not CAFE24_PRODUCTS.exists():
        raise SystemExit(f"cafe24_products.json 없음: {CAFE24_PRODUCTS}")
    data = json.loads(CAFE24_PRODUCTS.read_text(encoding="utf-8"))
    
    products = []
    if isinstance(data, list):
        products = data
    elif isinstance(data, dict):
        for key in ("products", "product", "data", "items"):
            if key in data and isinstance(data[key], list):
                products = data[key]
                break
    
    return [p for p in products if isinstance(p, dict) and p.get("product_no")]

def load_targets(xlsx_path: Path):
    if not xlsx_path.exists():
        return pd.DataFrame(columns=["PROD_CD", "PRICE"])
    
    # H열=이카운트 PROD_CD, L열=OUT_PRICE2
    df = pd.read_excel(xlsx_path, usecols="H,L", dtype=str)
    df.columns = ["PROD_CD", "PRICE"]
    df["PROD_CD"] = df["PROD_CD"].astype(str).str.strip()
    df["PRICE"] = df["PRICE"].astype(str).str.strip()
    return df[df["PROD_CD"].notna() & (df["PROD_CD"] != "")]

def update_variant_price(product_no: str, variant_code: str, price: float):
    """
    Final Specified Endpoint: PUT /api/v2/admin/products/{product_no}/variants/{variant_code}
    Payload structure requires 'shop_no' and 'request' object.
    """
    url = f"https://{MALL_ID}.cafe24api.com/api/v2/admin/products/{product_no}/variants/{variant_code}"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": API_VERSION,
    }
    payload = {
        "shop_no": 1,
        "request": {
            "additional_amount": int(price)
        }
    }
    r = requests.put(url, headers=headers, json=payload, timeout=20)
    return r

def refresh_token():
    global TOKEN
    try:
        from cafe24_api import get_valid_token as _refresh
        TOKEN = _refresh()
    except Exception:
        pass
    return TOKEN

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Cafe24 price update engine")
    parser.add_argument("--mode", choices=["test", "all"], default="all")
    args = parser.parse_args()

    # Load ECount prices from Excel (Production input)
    input_xlsx = DEFAULT_XLSX if DEFAULT_XLSX.exists() else FALLBACK_XLSX
    targets = load_targets(input_xlsx)
    price_map = dict(zip(targets["PROD_CD"], targets["PRICE"]))

    products = load_products()
    
    updated_count = 0
    error_count = 0
    skip_count = 0

    print(f"Starting update in {args.mode.upper()} mode...")
    print(f"Targeting {len(products)} products from catalog.")

    for p in products:
        product_no = str(p.get("product_no"))
        
        # Get Variants for this product
        url = f"https://{MALL_ID}.cafe24api.com/api/v2/admin/products/{product_no}/variants"
        headers = {
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "X-Cafe24-Api-Version": API_VERSION,
        }
        
        try:
            # Get Variants for this product with retry for 429
            def get_variants_with_retry(url, headers, retries=2):
                for i in range(retries + 1):
                    resp = requests.get(url, headers=headers, timeout=20)
                    if resp.status_code == 429:
                        print(f"  Rate limited (429). Waiting 15s... (Attempt {i+1}/{retries+1})")
                        time.sleep(15)
                        continue
                    return resp
                return resp

            get_resp = get_variants_with_retry(url, headers)
            
            if get_resp.status_code == 401:
                refresh_token()
                headers["Authorization"] = f"Bearer {TOKEN}"
                get_resp = get_variants_with_retry(url, headers)
            
            if get_resp.status_code != 200:
                print(f"Failed to get variants for product {product_no}")
                print(f"  Status: {get_resp.status_code}")
                print(f"  Error: {get_resp.text[:200]}")
                error_count += 1
                continue
                
            variants = get_resp.json().get("variants", [])
            for v in variants:
                # User's logic: Match ECount PROD_CD to custom_variant_code
                prod_cd = str(v.get("custom_variant_code", "")).strip()
                variant_code = v.get("variant_code")
                
                if not prod_cd:
                    skip_count += 1
                    continue
                
                # Check if this item is in our update list
                if prod_cd not in price_map:
                    skip_count += 1
                    continue
                
                # If test mode, only process the specific test overrides
                if args.mode == "test" and prod_cd not in TEST_OVERRIDES:
                    skip_count += 1
                    continue
                
                target_price = to_number(price_map[prod_cd])
                
                print(f"Updating: [ECount: {prod_cd}] -> [Cafe24: {variant_code}] Price: {target_price}")
                
                # Update variant with retry for 429
                def put_with_retry(product_no, variant_code, target_price, retries=2):
                    for i in range(retries + 1):
                        resp = update_variant_price(product_no, variant_code, target_price)
                        if resp.status_code == 429:
                            print(f"  Rate limited (429) on PUT. Waiting 15s... (Attempt {i+1}/{retries+1})")
                            time.sleep(15)
                            continue
                        return resp
                    return resp

                put_resp = put_with_retry(product_no, variant_code, target_price)
                
                if put_resp.status_code in (200, 201):
                    print(f"  Result: SUCCESS")
                    updated_count += 1
                else:
                    print(f"  Result: FAILED ({put_resp.status_code}) - {put_resp.text[:200]}")
                    error_count += 1
                
                # Rate limit protection (Increased to 2s for safety)
                time.sleep(2)
                
        except Exception as e:
            print(f"Exception during processing product {product_no}: {e}")
            error_count += 1

    print("\n" + "="*30)
    print("--- 최종 실행 요약 ---")
    print(f"✅ 성공(Updated)  : {updated_count}")
    print(f"⚠️ 실패(Failed)   : {error_count}")
    print(f"⏭️ 스킵(Skipped)  : {skip_count}")
    print("="*30)

if __name__ == "__main__":
    main()
