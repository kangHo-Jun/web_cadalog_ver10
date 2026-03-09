import logging
from core.erp.ecount_client import ECountClient
from core.shop.cafe24_client import Cafe24Client
from logic.calculator import PriceCalculator
from config import settings

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f"{settings.LOG_DIR}/sync.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("ERP_SYNC_V1")

def run_sync():
    """ERP -> 쇼핑몰 동기화 통합 프로세스 실행"""
    logger.info("🚀 [v1] ERP-통합 자동화 시스템 가동 시작")
    
    erp = ECountClient()
    shop = Cafe24Client()
    calc = PriceCalculator()

    try:
        # 1. ERP 데이터 수집
        logger.info("1️⃣ 이카운트 ERP에서 품목 재고 현황 조회 중...")
        erp_products = erp.get_product_list()
        logger.info(f"✅ {len(erp_products)}개의 품목을 ERP에서 가져왔습니다.")

        # 2. 개별 품목 처리 루프
        for item in erp_products:
            prod_cd = item.get('PROD_CD')
            prod_name = item.get('PROD_DES')
            # 기존 테스트 코드에서 BAL_QTY, OUT_PRICE 등을 가져옴. 
            # 실제 '출고단가' 필드는 API 버전에 따라 다를 수 있으므로 예시로 10000원 가정하거나 item 필드 참조
            cost_price = float(item.get('OUT_PRICE', 10000)) 
            
            # 3. 가격 계산 (마진율 적용)
            selling_price = calc.calculate_selling_price(cost_price)
            
            logger.info(f"🔍 처리 중: {prod_cd} ({prod_name}) | 원가: {cost_price} -> 판매가: {selling_price}")

            # 4. 쇼핑몰 존재 여부 확인 및 동기화
            existing_product = shop.find_product_by_code(prod_cd)
            
            if existing_product:
                # 업데이트
                product_no = existing_product['product_no']
                success = shop.update_product_price(product_no, selling_price)
                if success:
                    logger.info(f"   ⬆️ 기존 상품 업데이트 성공 (No: {product_no})")
                else:
                    logger.error(f"   ❌ 업데이트 실패: {prod_cd}")
            else:
                # 신규 등록
                # logger.info(f"   🆕 신규 상품 등록 시도: {prod_cd}")
                # result = shop.create_product(prod_cd, prod_name, selling_price)
                # logger.info(f"   ✅ 신규 등록 결과: {result}")
                logger.info(f"   ⚠️ 신규 상품 발견({prod_cd}), 자동 등록은 현재 비활성화 상태입니다.")

    except Exception as e:
        logger.error(f"🚨 동기화 도중 치명적 오류 발생: {str(e)}")

if __name__ == "__main__":
    run_sync()
