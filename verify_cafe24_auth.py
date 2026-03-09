import sys
import os

# 프로젝트 루트 경로 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.shop.cafe24_client import Cafe24Client
from core.auth.token_manager import TokenManager
from config import settings

def verify_cafe24_auth():
    """카페24 OAuth 인증 및 API 접근 권한을 검증합니다."""
    print("=" * 60)
    print("Version 1.0 - Phase 1: 카페24 인증 확인")
    print("=" * 60)
    
    try:
        # Step 1.1.1: 토큰 파일 존재 확인
        print("\n[Step 1.1.1] 토큰 파일 확인 중...")
        token_manager = TokenManager()
        token_data = token_manager.load_token_data()
        
        if not token_data:
            print("❌ 토큰 파일을 찾을 수 없습니다.")
            print(f"   예상 경로: {token_manager.token_file}")
            print("\n💡 해결 방법:")
            print("   1. 카페24 개발자센터에서 OAuth 인증 진행")
            print("   2. token_result.json 파일을 config/ 폴더에 저장")
            return False
        
        print(f"✅ 토큰 파일 발견: {token_manager.token_file}")
        print(f"   - Refresh Token: {token_data.get('refresh_token', 'N/A')[:20]}...")
        print(f"   - 만료 시간: {token_data.get('expires_at', 'N/A')}")
        
        # Step 1.1.2: Access Token 유효성 검증
        print("\n[Step 1.1.2] Access Token 유효성 검증 중...")
        access_token = token_manager.get_access_token()
        
        if not access_token:
            print("❌ Access Token을 가져올 수 없습니다.")
            print("   토큰이 만료되었거나 갱신에 실패했습니다.")
            return False
        
        print(f"✅ Access Token 획득 성공")
        print(f"   - Token: {access_token[:30]}...")
        
        # Step 1.1.3: API 호출 권한 확인
        print("\n[Step 1.1.3] API 호출 권한 확인 중...")
        client = Cafe24Client()
        
        # 간단한 API 호출로 권한 테스트 (상품 목록 조회)
        import requests
        url = f"{client.base_url}products"
        params = {"limit": 1}  # 1개만 조회
        
        response = requests.get(url, headers=client.get_headers(), params=params)
        
        if response.status_code == 200:
            print(f"✅ API 호출 성공 (Status: {response.status_code})")
            data = response.json()
            print(f"   - 응답 데이터: {list(data.keys())}")
            
            # 상품 수 확인
            products = data.get('products', [])
            if products:
                print(f"   - 샘플 상품: {products[0].get('product_name', 'N/A')}")
        elif response.status_code == 401:
            print(f"❌ 인증 실패 (Status: {response.status_code})")
            print("   Access Token이 유효하지 않습니다.")
            return False
        elif response.status_code == 403:
            print(f"❌ 권한 없음 (Status: {response.status_code})")
            print("   API 사용 권한이 없습니다. 카페24 앱 설정을 확인하세요.")
            return False
        else:
            print(f"⚠️ 예상치 못한 응답 (Status: {response.status_code})")
            print(f"   응답: {response.text[:200]}")
            return False
        
        # 최종 결과
        print("\n" + "=" * 60)
        print("✅ Step 1.1 완료: 카페24 인증 확인 성공!")
        print("=" * 60)
        print("\n📋 확인된 정보:")
        print(f"   - Mall ID: {settings.C24_MALL_ID}")
        print(f"   - API Version: {settings.C24_API_VERSION}")
        print(f"   - Token 상태: 정상")
        print(f"   - API 접근: 가능")
        
        print("\n🚀 다음 단계:")
        print("   Step 1.2: 상품 조회 API 구현")
        
        return True
        
    except Exception as e:
        print(f"\n❌ 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = verify_cafe24_auth()
    sys.exit(0 if success else 1)
