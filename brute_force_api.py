import sys
import os
import requests
import json

# 프로젝트 루트 경로 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.erp.ecount_client import ECountClient
from config import settings

def brute_force_api():
    client = ECountClient()
    session_id = client.login()
    
    prefixes = ["InventoryBasic", "AccountBasic", "Inventory", "Basic"]
    methods = ["GetListProduct", "GetListProductMaster", "GetListCommonProduct", "GetProductList", "GetListInventory"]
    versions = ["V2", "V3"] # V1 is unlikely for JSON POST
    
    results = []
    
    for v in versions:
        for p in prefixes:
            for m in methods:
                url = f"https://{client.base_url}{client.zone}.ecount.com/OAPI/{v}/{p}/{m}?SESSION_ID={session_id}"
                try:
                    res = requests.post(url, json={}, timeout=5)
                    if res.status_code == 200:
                        data = res.json()
                        if str(data.get("Status")) == "200":
                            print(f"✅ 발견: {url}")
                            print("Keys:", list(data.get("Data", {}).get("Result", [{}])[0].keys()))
                            results.append(url)
                    elif res.status_code != 404:
                         # 404가 아니면 뭔가 존재함 (405, 500 등)
                         print(f"❓ 관심: {url} (Status: {res.status_code})")
                except:
                    pass

    if not results:
        print("❌ 검색 실패")

if __name__ == "__main__":
    brute_force_api()
