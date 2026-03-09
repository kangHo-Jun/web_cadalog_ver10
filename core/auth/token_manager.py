import requests
import json
import base64
import os
from datetime import datetime, timedelta
from config import settings

class TokenManager:
    """Cafe24 OAuth 토큰을 관리하고 자동 갱신하는 클래스"""
    
    def __init__(self):
        self.token_file = settings.TOKEN_FILE
        self.mall_id = settings.C24_MALL_ID
        self.client_id = settings.C24_CLIENT_ID
        self.client_secret = settings.C24_CLIENT_SECRET

    def load_token_data(self):
        """파일에서 현재 토큰 데이터를 로드합니다."""
        if not os.path.exists(self.token_file):
            # 기존 쇼핑몰 폴더의 토큰 파일이 있다면 복사 시도 (마이그레이션)
            legacy_path = os.path.join(settings.BASE_DIR, '../쇼핑몰/token_result.json')
            if os.path.exists(legacy_path):
                with open(legacy_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.save_token_data(data)
                    return data
            return None
        with open(self.token_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def save_token_data(self, data):
        """토큰 데이터를 파일에 저장합니다."""
        os.makedirs(os.path.dirname(self.token_file), exist_ok=True)
        with open(self.token_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def refresh_token(self):
        """Refresh Token을 사용하여 새로운 Access Token을 발급받습니다."""
        data = self.load_token_data()
        if not data:
            return None

        url = f"https://{self.mall_id}.cafe24api.com/api/v2/oauth/token"
        
        auth_str = f"{self.client_id}:{self.client_secret}"
        b64_auth_str = base64.b64encode(auth_str.encode()).decode()
        
        headers = {
            "Authorization": f"Basic {b64_auth_str}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        payload = {
            "grant_type": "refresh_token",
            "refresh_token": data['refresh_token']
        }
        
        try:
            response = requests.post(url, headers=headers, data=payload)
            response.raise_for_status()
            new_data = response.json()
            
            data.update(new_data)
            self.save_token_data(data)
            return data['access_token']
        except Exception as e:
            print(f"❌ 토큰 갱신 오류: {str(e)}")
            return None

    def get_access_token(self):
        """유효한 Access Token을 반환하며, 필요 시 자동 갱신합니다."""
        data = self.load_token_data()
        if not data or 'expires_at' not in data:
            return None

        expires_at_str = data['expires_at'].split('.')[0]
        expiry = datetime.strptime(expires_at_str, "%Y-%m-%dT%H:%M:%S")
        
        # 만료 5분 전이면 자동 갱신
        if datetime.now() + timedelta(minutes=5) > expiry:
            return self.refresh_token()
        
        return data['access_token']
