import sys
import os

# 프로젝트 루트 경로 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.shop.cafe24_reader import Cafe24Reader
from logic.transformer import DataTransformer

def verify_transform_step2():
    """Phase 2: 데이터 변환 및 저장 검증"""
    print("=" * 60)
    print("Version 1.0 - Phase 2: 데이터 변환 및 저장")
    print("=" * 60)
    
    try:
        # Step 2.1: 카페24 데이터 조회
        print("\n[Step 2.1] 카페24 데이터 조회 중...")
        reader = Cafe24Reader()
        cafe24_products = reader.get_display_products(max_count=100)
        
        if not cafe24_products:
            print("❌ 조회된 상품이 없습니다.")
            return False
        
        print(f"✅ {len(cafe24_products)}개 상품 조회 완료")
        
        # Step 2.2: 데이터 변환
        print("\n[Step 2.2] 웹 카탈로그 형식으로 변환 중...")
        catalog_products = DataTransformer.cafe24_to_catalog(cafe24_products)
        
        print(f"✅ {len(catalog_products)}개 상품 변환 완료")
        
        # 변환된 데이터 샘플 확인
        if catalog_products:
            print("\n[변환된 데이터 샘플]")
            sample = catalog_products[0]
            print(f"   - 상품코드: {sample.code}")
            print(f"   - 상품명: {sample.name}")
            print(f"   - 가격: {DataTransformer.format_price(sample.price)}")
            print(f"   - 카테고리: {sample.category}")
            print(f"   - 진열여부: {sample.display}")
        
        # Step 2.3: JSON 파일로 저장
        print("\n[Step 2.3] JSON 파일로 저장 중...")
        json_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'data', 'catalog_products.json'
        )
        
        success = DataTransformer.save_to_json(catalog_products, json_path)
        
        if not success:
            print("❌ JSON 저장 실패")
            return False
        
        print(f"✅ JSON 저장 완료: {json_path}")
        
        # 파일 크기 확인
        file_size = os.path.getsize(json_path)
        print(f"   - 파일 크기: {file_size:,} bytes ({file_size/1024:.1f} KB)")
        
        # 저장된 데이터 검증 (다시 로드)
        print("\n[데이터 검증] 저장된 파일 다시 로드 중...")
        loaded_products = DataTransformer.load_from_json(json_path)
        
        if len(loaded_products) != len(catalog_products):
            print(f"⚠️ 데이터 불일치: 저장 {len(catalog_products)}개, 로드 {len(loaded_products)}개")
        else:
            print(f"✅ 데이터 검증 완료: {len(loaded_products)}개 상품")
        
        # 가격 통계
        print("\n[가격 통계]")
        stats = DataTransformer.get_price_statistics(catalog_products)
        print(f"   - 최저가: {DataTransformer.format_price(stats['min'])}")
        print(f"   - 최고가: {DataTransformer.format_price(stats['max'])}")
        print(f"   - 평균가: {DataTransformer.format_price(stats['avg'])}")
        
        # 최종 결과
        print("\n" + "=" * 60)
        print("✅ Phase 2 완료: 데이터 변환 및 저장 성공!")
        print("=" * 60)
        print(f"\n📁 저장된 파일: {json_path}")
        print(f"📊 저장된 상품 수: {len(catalog_products)}개")
        
        print("\n🚀 다음 단계:")
        print("   Phase 3: 웹 카탈로그 구축")
        print("   - HTML/CSS 레이아웃 설계")
        print("   - 검색 기능 구현")
        print("   - 견적 요청 기능")
        
        return True
        
    except Exception as e:
        print(f"\n❌ 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = verify_transform_step2()
    sys.exit(0 if success else 1)
