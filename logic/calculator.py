import math
from config import settings

class PriceCalculator:
    """상품 가격 계산을 담당하는 클래스"""
    
    @staticmethod
    def calculate_selling_price(cost_price, margin_rate=None):
        """
        원가에 마진율을 곱하여 판매가를 계산합니다.
        가이드라인에 따라 ✱마진율 공식을 사용합니다.
        """
        if margin_rate is None:
            margin_rate = settings.MARGIN_RATE
            
        # 1. 원가 * 마진율
        raw_price = cost_price * margin_rate
        
        # 2. 반올림 처리 (예: 100원 단위)
        unit = settings.ROUND_UNIT
        final_price = math.ceil(raw_price / unit) * unit
        
        return int(final_price)
