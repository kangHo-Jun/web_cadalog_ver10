from dataclasses import dataclass, asdict
from typing import Optional
import json

@dataclass
class Product:
    """웹 카탈로그용 상품 데이터 모델"""
    
    # 필수 필드
    code: str                    # 상품 코드
    name: str                    # 상품명
    price: float                 # 판매가
    
    # 선택 필드
    product_no: Optional[int] = None      # 카페24 상품 번호
    category: Optional[str] = None        # 카테고리
    image_url: Optional[str] = None       # 대표 이미지 URL
    description: Optional[str] = None     # 상품 설명
    stock_quantity: Optional[int] = None  # 재고 수량
    display: Optional[bool] = True        # 진열 여부
    selling: Optional[bool] = True        # 판매 여부
    
    def to_dict(self):
        """딕셔너리로 변환"""
        return asdict(self)
    
    def to_json(self):
        """JSON 문자열로 변환"""
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)
    
    @classmethod
    def from_cafe24(cls, cafe24_data):
        """
        카페24 API 응답 데이터를 Product 객체로 변환
        
        Args:
            cafe24_data (dict): 카페24 상품 데이터
            
        Returns:
            Product: 변환된 Product 객체
        """
        return cls(
            code=cafe24_data.get('product_code', ''),
            name=cls._clean_html(cafe24_data.get('product_name', '')),
            price=float(cafe24_data.get('price', 0)),
            product_no=cafe24_data.get('product_no'),
            category=cafe24_data.get('category_name', '미분류'),
            image_url=cls._get_main_image(cafe24_data),
            description=cls._clean_html(cafe24_data.get('description', '')),
            display=cafe24_data.get('display') == 'T',
            selling=cafe24_data.get('selling') == 'T'
        )
    
    @staticmethod
    def _clean_html(text):
        """HTML 태그 제거 (간단한 버전)"""
        if not text:
            return ''
        # <br> 태그를 공백으로 변환
        text = text.replace('<br>', ' ').replace('<br/>', ' ').replace('<br />', ' ')
        # 기타 HTML 태그 제거 (간단한 정규식)
        import re
        text = re.sub(r'<[^>]+>', '', text)
        return text.strip()
    
    @staticmethod
    def _get_main_image(cafe24_data):
        """대표 이미지 URL 추출"""
        # detail_image 또는 list_image 사용
        return cafe24_data.get('detail_image') or cafe24_data.get('list_image') or ''
