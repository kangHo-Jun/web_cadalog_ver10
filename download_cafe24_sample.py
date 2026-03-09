"""
카페24 상품 데이터 50개 샘플 다운로드 및 가격 확인
"""
import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.shop.cafe24_reader import Cafe24Reader

def download_cafe24_sample():
    print("=" * 60)
    print("카페24 상품 데이터 50개 샘플 다운로드")
    print("=" * 60)
    
    reader = Cafe24Reader()
    products = reader.get_display_products(max_count=50)
    
    print(f"\n✅ {len(products)}개 상품 조회 완료\n")
    
    # 가격 필드 분석
    print("[가격 필드 분석]")
    print("-" * 60)
    
    price_fields = ['price', 'retail_price', 'supply_price', 'selling_price', 'price_excluding_tax']
    
    for i, prod in enumerate(products[:10], 1):
        print(f"\n[{i}] 상품명: {prod.get('product_name', 'N/A')[:30]}")
        print(f"    상품코드: {prod.get('product_code', 'N/A')}")
        for field in price_fields:
            value = prod.get(field, 'N/A')
            print(f"    {field}: {value}")
    
    # JSON으로 저장
    save_path = os.path.join(os.path.dirname(__file__), 'data', 'cafe24_sample_50.json')
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    with open(save_path, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 샘플 데이터 저장 완료: {save_path}")
    
    # 가격이 0인 상품 개수
    zero_price = sum(1 for p in products if float(p.get('price', 0)) == 0)
    print(f"\n[통계]")
    print(f"   - 전체 상품: {len(products)}개")
    print(f"   - 가격 0원 상품: {zero_price}개")
    print(f"   - 가격 있는 상품: {len(products) - zero_price}개")
    
    return products

if __name__ == "__main__":
    download_cafe24_sample()
