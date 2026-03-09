import sys
import os
import requests
import json

# 프로젝트 루트 경로 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.erp.ecount_client import ECountClient
from config import settings

def test_get_product_detail():
    print("=" * 50)
    print("ERP 품목 상세 조회 테스트")
    print("=" * 50)
    
    try:
        client = ECountClient()
        session_id = client.login()
        
        # 이전 테스트에서 확인된 품목 코드 중 하나 사용
        prod_cd = "()300씨맥태고1848" # 혹은 실제 존재하는 다른 코드
        
        url = f"https://{client.base_url}{client.zone}.ecount.com/OAPI/V2/InventoryBasic/GetProduct?SESSION_ID={session_id}"
        
        data = {
            "PROD_CD": prod_cd
        }
        
        print(f"API 호출: {url}")
        print(f"데이터: {data}")
        
        res = requests.post(url, json=data)
        print(f"응답 상태 코드: {res.status_code}")
        
        result = res.json()
        print("응답 내용:", json.dumps(result, ensure_ascii=False, indent=2))
                
    except Exception as e:
        print(f"\n❌ 오류 발생: {str(e)}")

if __name__ == "__main__":
    test_get_product_detail()
