"""
데이터 변환 모듈
카페24 형식 → 웹 카탈로그 형식 변환
"""
import json
from models.product import Product

class DataTransformer:
    """데이터 변환기"""
    
    @staticmethod
    def cafe24_to_catalog(cafe24_products):
        """
        카페24 상품 리스트를 웹 카탈로그 형식으로 변환
        
        Args:
            cafe24_products (list): 카페24 상품 데이터 리스트
            
        Returns:
            list: Product 객체 리스트
        """
        catalog_products = []
        
        for cafe24_data in cafe24_products:
            try:
                product = Product.from_cafe24(cafe24_data)
                catalog_products.append(product)
            except Exception as e:
                print(f"⚠️ 상품 변환 실패 (product_no: {cafe24_data.get('product_no')}): {str(e)}")
                continue
        
        return catalog_products
    
    @staticmethod
    def to_json_format(products):
        """
        Product 객체 리스트를 JSON 직렬화 가능한 형식으로 변환
        
        Args:
            products (list): Product 객체 리스트
            
        Returns:
            list: 딕셔너리 리스트
        """
        return [product.to_dict() for product in products]
    
    @staticmethod
    def save_to_json(products, filepath):
        """
        상품 데이터를 JSON 파일로 저장
        
        Args:
            products (list): Product 객체 리스트
            filepath (str): 저장할 파일 경로
            
        Returns:
            bool: 성공 여부
        """
        import os
        
        try:
            # 디렉토리 생성
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            # JSON 형식으로 변환
            data = DataTransformer.to_json_format(products)
            
            # 파일 저장
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            return True
        except Exception as e:
            print(f"❌ JSON 저장 실패: {str(e)}")
            return False
    
    @staticmethod
    def load_from_json(filepath):
        """
        JSON 파일에서 상품 데이터를 로드
        
        Args:
            filepath (str): JSON 파일 경로
            
        Returns:
            list: Product 객체 리스트
        """
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            products = []
            for item in data:
                product = Product(**item)
                products.append(product)
            
            return products
        except FileNotFoundError:
            print(f"⚠️ 파일을 찾을 수 없습니다: {filepath}")
            return []
        except Exception as e:
            print(f"❌ JSON 로드 실패: {str(e)}")
            return []
    
    @staticmethod
    def format_price(price):
        """가격을 천 단위 콤마 형식으로 변환"""
        return f"{price:,.0f}원"
    
    @staticmethod
    def get_price_statistics(products):
        """가격 통계 정보 생성"""
        if not products:
            return {"min": 0, "max": 0, "avg": 0}
        
        prices = [p.price for p in products if p.price > 0]
        
        if not prices:
            return {"min": 0, "max": 0, "avg": 0}
        
        return {
            "min": min(prices),
            "max": max(prices),
            "avg": sum(prices) / len(prices)
        }
