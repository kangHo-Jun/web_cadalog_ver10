import sys
import os
import json

# 프로젝트 루트 경로 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.erp.ecount_client import ECountClient
from config import settings

def extract_plywood_products():
    """ERP에서 '합판'이 포함된 품목만 추출"""
    print("=" * 50)
    print("합판 품목 추출 스크립트")
    print("=" * 50)
    
    try:
        client = ECountClient()
        
        print("\n1. 로그인 시도 중...")
        session_id = client.login()
        if session_id:
            print(f"✅ 로그인 성공! (Session ID: {session_id[:10]}...)")
        
        print("\n2. 재고 현황 조회 중...")
        # ERP API에서 재고 데이터 가져오기 (품목 코드만 있음)
        inventory_data = client._get_inventory_from_api()
        
        if inventory_data:
            print(f"✅ 총 {len(inventory_data)}개의 품목 조회 완료")
            
            # 품목 코드에서 '합판' 키워드 검색
            plywood_products = []
            
            print("\n3. '합판' 키워드로 필터링 중...")
            for item in inventory_data:
                prod_cd = item.get('PROD_CD', '')
                bal_qty = item.get('BAL_QTY', 0)
                
                # 품목 코드에 '합판' 포함 여부 확인
                if '합판' in prod_cd:
                    plywood_products.append({
                        'PROD_CD': prod_cd,
                        'BAL_QTY': bal_qty
                    })
            
            print(f"✅ '합판' 품목 {len(plywood_products)}개 발견!")
            
            if plywood_products:
                print("\n4. 합판 품목 목록:")
                print("-" * 80)
                for i, prod in enumerate(plywood_products[:20], 1):  # 상위 20개만 출력
                    print(f"[{i:2d}] 품목코드: {prod['PROD_CD']:40s} | 재고: {prod['BAL_QTY']:>6}")
                
                if len(plywood_products) > 20:
                    print(f"\n... 외 {len(plywood_products) - 20}개 더 있음")
                
                # CSV 파일로 저장
                print("\n5. CSV 파일로 저장 중...")
                csv_path = os.path.join(os.path.dirname(__file__), 
                                       'config', 'Plywood_Products.csv')
                
                with open(csv_path, 'w', encoding='utf-8') as f:
                    f.write("PROD_CD,PROD_DES,SIZE_DES,OUT_PRICE,Sync_YN,Category,Memo\n")
                    for prod in plywood_products:
                        # 품목명은 품목코드와 동일하게 (나중에 수정 가능)
                        f.write(f"{prod['PROD_CD']},{prod['PROD_CD']},,0,Y,합판,재고:{prod['BAL_QTY']}\n")
                
                print(f"✅ 저장 완료: {csv_path}")
                print("\n💡 다음 단계:")
                print("   1. Plywood_Products.csv 파일을 열어서 확인")
                print("   2. PROD_DES(품명), SIZE_DES(규격), OUT_PRICE(단가) 수동 입력")
                print("   3. 완성된 데이터를 Target_List.csv로 복사")
            else:
                print("⚠️ '합판' 키워드가 포함된 품목이 없습니다.")
                print("\n다른 키워드로 검색해보시겠습니까?")
                print("예: '목재', '판재', '보드' 등")
        else:
            print("❌ 재고 데이터를 가져올 수 없습니다.")
            
    except Exception as e:
        print(f"\n❌ 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    extract_plywood_products()
