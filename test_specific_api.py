import sys
import os
import requests
import json

# 프로젝트 루트 경로 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.erp.ecount_client import ECountClient
from config import settings

def test_api():
    client = ECountClient()
    session_id = client.login()
    url = f"https://{client.base_url}{client.zone}.ecount.com/OAPI/V2/InventoryBasic/GetListBasicProduct?SESSION_ID={session_id}"
    res = requests.post(url, json={})
    print(f"URL: {url}")
    print(f"Status Code: {res.status_code}")
    print("Response:", res.text)

if __name__ == "__main__":
    test_api()
