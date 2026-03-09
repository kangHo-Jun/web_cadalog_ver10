import requests
from config import settings
from core.auth.token_manager import TokenManager

class Cafe24Client:
    """카페24 API와 상호작용하는 클라이언트"""
    
    def __init__(self):
        self.mall_id = settings.C24_MALL_ID
        self.api_version = settings.C24_API_VERSION
        self.auth = TokenManager()
        self.base_url = f"https://{self.mall_id}.cafe24api.com/api/v2/admin/"

    def get_headers(self):
        token = self.auth.get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-Cafe24-Api-Version": self.api_version
        }

    def find_product_by_code(self, prod_cd):
        """자체상품코드(prod_cd)로 카페24 내 상품 존재 여부를 확인합니다."""
        url = f"{self.base_url}products"
        params = {"product_code": prod_cd}
        
        response = requests.get(url, headers=self.get_headers(), params=params).json()
        products = response.get("products", [])
        
        if products:
            return products[0] # 첫 번째 매칭 아이템 반환
        return None

    def update_product_price(self, product_no, price):
        """기존 상품의 판매가를 업데이트합니다."""
        url = f"{self.base_url}products/{product_no}"
        data = {
            "shop_no": 1,
            "request": {
                "selling_price": price
            }
        }
        
        response = requests.put(url, headers=self.get_headers(), json=data)
        return response.status_code == 200

    def create_product(self, prod_cd, name, price):
        """새로운 상품을 등록합니다."""
        url = f"{self.base_url}products"
        data = {
            "shop_no": 1,
            "request": {
                "product_name": name,
                "product_code": prod_cd, # ERP의 PROD_CD를 매칭
                "selling_price": price,
                "display": "T",
                "selling": "T"
            }
        }
        
        response = requests.post(url, headers=self.get_headers(), json=data)
        return response.json()
