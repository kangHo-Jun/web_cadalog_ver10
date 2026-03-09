import requests
from config import settings
from core.auth.token_manager import TokenManager

class Cafe24Reader:
    """카페24 상품 정보를 조회하는 클라이언트"""
    
    def __init__(self):
        self.mall_id = settings.C24_MALL_ID
        self.api_version = settings.C24_API_VERSION
        self.auth = TokenManager()
        self.base_url = f"https://{self.mall_id}.cafe24api.com/api/v2/admin/"

    def get_headers(self):
        """API 요청 헤더를 생성합니다."""
        token = self.auth.get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-Cafe24-Api-Version": self.api_version
        }

    def get_all_products(self, display_filter='T', limit=100, offset=0):
        """
        카페24 상품 목록을 조회합니다.
        
        Args:
            display_filter (str): 진열 상태 필터 ('T': 진열함, 'F': 진열안함, None: 전체)
            limit (int): 한 번에 가져올 상품 수 (최대 100)
            offset (int): 시작 위치
            
        Returns:
            list: 상품 정보 딕셔너리 리스트
        """
        url = f"{self.base_url}products"
        params = {
            "limit": min(limit, 100),  # 카페24 API 최대값 100
            "offset": offset
        }
        
        if display_filter:
            params["display"] = display_filter
        
        try:
            response = requests.get(url, headers=self.get_headers(), params=params)
            response.raise_for_status()
            data = response.json()
            return data.get('products', [])
        except Exception as e:
            print(f"❌ 상품 조회 오류: {str(e)}")
            return []

    def get_product_detail(self, product_no):
        """
        특정 상품의 상세 정보를 조회합니다.
        
        Args:
            product_no (int): 상품 번호
            
        Returns:
            dict: 상품 상세 정보
        """
        url = f"{self.base_url}products/{product_no}"
        
        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            data = response.json()
            return data.get('product', {})
        except Exception as e:
            print(f"❌ 상품 상세 조회 오류 (product_no: {product_no}): {str(e)}")
            return {}

    def get_display_products(self, max_count=100):
        """
        웹에 진열된 상품을 최대 max_count개까지 조회합니다.
        
        Args:
            max_count (int): 조회할 최대 상품 수
            
        Returns:
            list: 진열 상품 리스트
        """
        products = []
        offset = 0
        batch_size = 100
        
        while len(products) < max_count:
            remaining = max_count - len(products)
            limit = min(batch_size, remaining)
            
            batch = self.get_all_products(
                display_filter='T',
                limit=limit,
                offset=offset
            )
            
            if not batch:
                break  # 더 이상 상품이 없음
            
            products.extend(batch)
            offset += len(batch)
            
            # 요청한 수만큼 가져왔거나, 배치 크기보다 적게 반환되면 종료
            if len(batch) < batch_size:
                break
        
        return products[:max_count]

    def get_products_summary(self, products):
        """
        상품 리스트의 요약 정보를 생성합니다.
        
        Args:
            products (list): 상품 리스트
            
        Returns:
            dict: 요약 정보
        """
        if not products:
            return {
                "total_count": 0,
                "categories": {},
                "price_range": {"min": 0, "max": 0}
            }
        
        categories = {}
        prices = []
        
        for prod in products:
            # 카테고리 집계
            category = prod.get('category_name', '미분류')
            categories[category] = categories.get(category, 0) + 1
            
            # 가격 수집
            price = float(prod.get('price', 0))
            if price > 0:
                prices.append(price)
        
        return {
            "total_count": len(products),
            "categories": categories,
            "price_range": {
                "min": min(prices) if prices else 0,
                "max": max(prices) if prices else 0
            }
        }
