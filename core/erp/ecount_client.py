import requests
import json
from datetime import datetime
from config import settings

class ECountClient:
    """이카운트 ERP API와 상호작용하는 클라이언트"""
    
    def __init__(self):
        self.config = {
            "COM_CODE": settings.ER_COM_CODE,
            "USER_ID": settings.ER_USER_ID,
            "API_CERT_KEY": settings.ER_CERT_KEY,
            "LAN_TYPE": "ko-KR"
        }
        self.base_url = "sboapi" if settings.ER_USE_TEST_SERVER else "oapi"
        self.session_id = None
        self.zone = None

    def login(self):
        """Zone 조회 후 로그인하여 SESSION_ID를 획득합니다."""
        # 1. Zone 조회
        zone_url = f"https://{self.base_url}.ecount.com/OAPI/V2/Zone"
        zone_res = requests.post(zone_url, json={"COM_CODE": self.config["COM_CODE"]}).json()
        
        if str(zone_res.get("Status")) != "200" or not zone_res.get("Data"):
            raise Exception(f"이카운트 Zone 조회 실패: {zone_res.get('Error')}")
        
        self.zone = zone_res["Data"]["ZONE"]
        
        # 2. 로그인
        login_url = f"https://{self.base_url}{self.zone}.ecount.com/OAPI/V2/OAPILogin"
        login_data = {**self.config, "ZONE": self.zone}
        login_res = requests.post(login_url, json=login_data).json()
        
        if str(login_res.get("Status")) != "200":
            raise Exception(f"이카운트 로그인 실패: {login_res.get('Error')}")
            
        data_obj = login_res.get("Data", {})
        if str(data_obj.get("Code")) in ["00", "204"]: # 204는 테스트 인증키 성공 코드
            self.session_id = data_obj.get("Datas", {}).get("SESSION_ID")
            return self.session_id
        else:
            raise Exception(f"이카운트 로그인 응답 오류: {data_obj.get('Message')}")

    def get_product_list(self, include_inventory=False):
        """CSV 파일에서 품목 목록을 조회합니다.
        
        Args:
            include_inventory (bool): True일 경우 ERP API에서 재고 수량도 함께 조회
            
        Returns:
            list: 품목 정보 딕셔너리 리스트
        """
        import csv
        import os
        
        # CSV 파일 경로
        csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
                                'config', 'Target_List.csv')
        
        products = []
        
        # CSV 파일 읽기
        try:
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Sync_YN이 'Y'인 품목만 포함
                    if row.get('Sync_YN', '').upper() == 'Y':
                        products.append({
                            'PROD_CD': row.get('PROD_CD', ''),
                            'PROD_DES': row.get('PROD_DES', ''),
                            'SIZE_DES': row.get('SIZE_DES', ''),
                            'OUT_PRICE': row.get('OUT_PRICE', '0'),
                            'Category': row.get('Category', ''),
                            'Memo': row.get('Memo', ''),
                            'BAL_QTY': None  # 재고 수량은 나중에 채움
                        })
        except FileNotFoundError:
            raise Exception(f"CSV 파일을 찾을 수 없습니다: {csv_path}")
        except Exception as e:
            raise Exception(f"CSV 파일 읽기 오류: {str(e)}")
        
        # 재고 수량 조회 (선택적)
        if include_inventory and products:
            if not self.session_id:
                self.login()
            
            inventory_data = self._get_inventory_from_api()
            
            # 재고 데이터를 품목 코드로 매핑
            inventory_map = {item.get('PROD_CD'): item.get('BAL_QTY') for item in inventory_data}
            
            # 품목 리스트에 재고 수량 병합
            for product in products:
                prod_cd = product['PROD_CD']
                product['BAL_QTY'] = inventory_map.get(prod_cd, 0)
        
        return products
    
    def _get_inventory_from_api(self):
        """ERP API에서 재고 현황을 조회합니다 (내부 메서드)."""
        url = f"https://{self.base_url}{self.zone}.ecount.com/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatus?SESSION_ID={self.session_id}"
        today = datetime.now().strftime("%Y%m%d")
        
        data = {
            "BASE_DATE": today,
            "WH_CD": "",
            "PROD_CD": "",
            "ZERO_FLAG": "N"
        }
        
        response = requests.post(url, json=data).json()
        if str(response.get("Status")) == "200":
            return response.get("Data", {}).get("Result", [])
        return []
