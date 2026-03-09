import sys
import os
import json

# 프로젝트 루트 경로 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.erp.ecount_client import ECountClient
from config import settings

def test_erp_connection():
    print("=" * 50)
    print("ERP 모듈 검증 테스트 (CSV 기반)")
    print(f"사용 서버: {'테스트' if settings.ER_USE_TEST_SERVER else '정식'}")
    print(f"COM_CODE: {settings.ER_COM_CODE}")
    print("=" * 50)
    
    try:
        client = ECountClient()
        
        print("\n1. CSV 파일에서 품목 리스트 조회 중...")
        products = client.get_product_list(include_inventory=False)
        
        if products:
            print(f"✅ 조회 성공! 총 {len(products)}개의 품목을 가져왔습니다.")
            
            print("\n2. 데이터 필드 확인 (첫 번째 품목의 모든 키):")
            first_item = products[0]
            print(list(first_item.keys()))
            
            print("\n3. 데이터 샘플 확인 (전체):")
            for i, prod in enumerate(products):
                print(f"[{i+1}] 코드: {prod.get('PROD_CD')}")
                print(f"    품명: {prod.get('PROD_DES')}")
                print(f"    규격: {prod.get('SIZE_DES', 'N/A')}")
                print(f"    출고단가: {prod.get('OUT_PRICE')}")
                print(f"    카테고리: {prod.get('Category', 'N/A')}")
                print(f"    메모: {prod.get('Memo', 'N/A')}")
                print("-" * 30)
            
            print("\n4. 재고 수량 포함 조회 테스트...")
            print("   로그인 시도 중...")
            session_id = client.login()
            if session_id:
                print(f"   ✅ 로그인 성공! (Session ID: {session_id[:10]}...)")
                
                print("   재고 데이터 병합 중...")
                products_with_inventory = client.get_product_list(include_inventory=True)
                
                print(f"   ✅ 재고 데이터 병합 완료!")
                print("\n   재고 포함 샘플:")
                for i, prod in enumerate(products_with_inventory):
                    print(f"   [{i+1}] {prod.get('PROD_DES')}: 재고 {prod.get('BAL_QTY', 'N/A')}개")
        else:
            print("⚠️ 조회 결과가 없습니다. (Sync_YN='Y'인 품목이 없거나 CSV 파일이 비어있습니다.)")
            
    except Exception as e:
        print(f"\n❌ 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_erp_connection()
