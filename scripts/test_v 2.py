import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import requests
from cafe24_api import get_valid_token
from config import settings

def test_variant_update():
    mall_id = settings.C24_MALL_ID
    product_no = 1864
    variant_code = "P0000CTS000A"
    
    # PUT https://{mallid}.cafe24api.com/api/v2/admin/products/{product_no}/variants/{variant_code}
    url = f"https://{mall_id}.cafe24api.com/api/v2/admin/products/{product_no}/variants/{variant_code}"
    
    headers = {
        "Authorization": f"Bearer {get_valid_token()}",
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": settings.C24_API_VERSION
    }
    
    payload = {
        "shop_no": 1,
        "request": {
            "additional_amount": 1
        }
    }
    
    print(f"--- [PUT] Updating {variant_code} to additional_amount: 1 ---")
    put_response = requests.put(url, headers=headers, json=payload)
    print(f"Status Code: {put_response.status_code}")
    print(f"Response: {json.dumps(put_response.json(), indent=2, ensure_ascii=False)}")
    
    if put_response.status_code == 200:
        print(f"\n--- [GET] Verifying {variant_code} ---")
        get_response = requests.get(url, headers=headers)
        print(f"Status Code: {get_response.status_code}")
        get_data = get_response.json()
        print(f"Response: {json.dumps(get_data, indent=2, ensure_ascii=False)}")
        
        # Verify the change
        actual_amount = get_data.get("variant", {}).get("additional_amount")
        print(f"\nResult: {'SUCCESS' if str(actual_amount) == '1.00' or actual_amount == 1 or actual_amount == 1.0 else 'FAILED'}")
        print(f"Set: 1, Actual: {actual_amount}")
    else:
        print("\nUpdate failed, skipping GET verification.")

if __name__ == "__main__":
    test_variant_update()
