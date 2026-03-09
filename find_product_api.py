import sys
import os
import requests
import json

# 프로젝트 루트 경로 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.erp.ecount_client import ECountClient
from config import settings

def test_get_product_master():
    print("=" * 50)
    print("ERP 품목 마스터 조회 테스트")
    print("=" * 50)
    
    try:
        client = ECountClient()
        session_id = client.login()
        
        # 품목 리스트 조회를 위한 여러 URL 후보 시도
        urls = [
            f"https://{client.base_url}{client.zone}.ecount.com/OAPI/V2/InventoryBasic/GetListProduct?SESSION_ID={session_id}",
            f"https://{client.base_url}{client.zone}.ecount.com/OAPI/V2/InventoryBasic/GetListCommonProduct?SESSION_ID={session_id}",
        ]
        
        for url in urls:
            print(f"\nAPI 시도: {url.split('/')[-1].split('?')[0]}")
            # GetListProduct는 보통 빈 객체라도 body가 필요함
            data = {"IsWhole": True} 
            
            res = requests.post(url, json=data)
            print(f"응답 상태 코드: {res.status_code}")
            
            try:
                result = res.json()
                status = str(result.get("Status"))
                print(f"Status: {status}")
                
                if status == "200":
                    data_obj = result.get("Data", {})
                    if isinstance(data_obj, dict):
                        items = data_obj.get("Result", [])
                        print(f"✅ 조회 성공! 품목 수: {len(items)}")
                        if items:
                            print("첫 번째 품목 키:", list(items[0].keys()))
                            print("샘플 데이터:", items[0])
                            return # 성공하면 종료
                else:
                    print(f"오류 내용: {result.get('Error')}")
            except:
                print("JSON 파싱 실패")
                
    except Exception as e:
        print(f"\n❌ 오류 발생: {str(e)}")

if __name__ == "__main__":
    test_get_product_master()
