import sys
import os

# 프로젝트 루트 경로 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.shop.cafe24_reader import Cafe24Reader

def verify_cafe24_step1():
    """Step 1.2 & 1.3: 상품 조회 및 선별 검증"""
    print("=" * 60)
    print("Version 1.0 - Phase 1: 카페24 상품 조회")
    print("=" * 60)
    
    try:
        reader = Cafe24Reader()
        
        # Step 1.2: 상품 조회 API 구현 검증
        print("\n[Step 1.2] 상품 조회 API 테스트...")
        print("   - 진열 상품(display=T) 100개 조회 중...")
        
        products = reader.get_display_products(max_count=100)
        
        if not products:
            print("❌ 조회된 상품이 없습니다.")
            print("   카페24 쇼핑몰에 진열된 상품이 있는지 확인하세요.")
            return False
        
        print(f"✅ 상품 조회 성공! 총 {len(products)}개 조회됨")
        
        # Step 1.3: 품목 선별 로직 검증
        print("\n[Step 1.3] 품목 선별 로직 확인...")
        print(f"   - 진열 상태(display=T) 필터링: 완료")
        print(f"   - 최대 100개 제한: {'적용됨' if len(products) <= 100 else '초과'}")
        
        # 데이터 필드 확인
        print("\n[데이터 필드 확인]")
        if products:
            first_product = products[0]
            print(f"   사용 가능한 필드: {list(first_product.keys())[:10]}...")
        
        # 샘플 데이터 출력
        print("\n[샘플 데이터] 상위 5개:")
        print("-" * 60)
        for i, prod in enumerate(products[:5], 1):
            print(f"[{i}] 상품번호: {prod.get('product_no')}")
            print(f"    상품명: {prod.get('product_name', 'N/A')}")
            print(f"    상품코드: {prod.get('product_code', 'N/A')}")
            print(f"    판매가: {prod.get('price', 'N/A')}원")
            print(f"    진열상태: {prod.get('display', 'N/A')}")
            print(f"    판매상태: {prod.get('selling', 'N/A')}")
            print("-" * 60)
        
        # 요약 정보
        print("\n[요약 정보]")
        summary = reader.get_products_summary(products)
        print(f"   - 총 상품 수: {summary['total_count']}개")
        print(f"   - 가격 범위: {summary['price_range']['min']:,.0f}원 ~ {summary['price_range']['max']:,.0f}원")
        
        if summary['categories']:
            print(f"   - 카테고리 분포:")
            for cat, count in list(summary['categories'].items())[:5]:
                print(f"      • {cat}: {count}개")
        
        # 최종 결과
        print("\n" + "=" * 60)
        print("✅ Phase 1 완료: 카페24 연동 및 데이터 수집 성공!")
        print("=" * 60)
        print(f"\n📊 수집된 데이터: {len(products)}개 상품")
        print("\n🚀 다음 단계:")
        print("   Phase 2: 데이터 변환 및 저장")
        print("   - 웹 카탈로그 형식으로 변환")
        print("   - JSON 파일로 저장")
        
        return True
        
    except Exception as e:
        print(f"\n❌ 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = verify_cafe24_step1()
    sys.exit(0 if success else 1)
