"""
이카운트 API 연결 테스트 스크립트 (테스트 서버용)
"""
import requests
import json
from datetime import datetime

# API 설정 정보
CONFIG = {
    "COM_CODE": "650217",
    "USER_ID": "zartkang",
    "API_CERT_KEY": "55f919e986cb444ed8ae25dc46705a3cc7",
    "LAN_TYPE": "ko-KR"
}

# 테스트 서버 사용
USE_TEST_SERVER = True
BASE_URL = "sboapi" if USE_TEST_SERVER else "oapi"

def get_zone():
    """Zone 정보 조회"""
    url = f"https://{BASE_URL}.ecount.com/OAPI/V2/Zone"
    data = {"COM_CODE": CONFIG["COM_CODE"]}
    
    print("=" * 50)
    print(f"1. Zone 조회 중... (서버: {'테스트' if USE_TEST_SERVER else '정식'})")
    print(f"   URL: {url}")
    
    try:
        response = requests.post(url, json=data, timeout=30)
        result = response.json()
        print(f"   Response Status: {result.get('Status')}")
        
        status = str(result.get("Status", ""))
        if status == "200" and result.get("Data"):
            zone = result["Data"]["ZONE"]
            domain = result["Data"].get("DOMAIN", ".ecount.com")
            print(f"   ✅ Zone 조회 성공: ZONE={zone}")
            return zone, domain
        else:
            print(f"   ❌ Zone 조회 실패: {result.get('Error')}")
            return None, None
    except Exception as e:
        print(f"   ❌ 오류 발생: {e}")
        return None, None

def login(zone):
    """로그인하여 SESSION_ID 발급"""
    url = f"https://{BASE_URL}{zone}.ecount.com/OAPI/V2/OAPILogin"
    data = {
        "COM_CODE": CONFIG["COM_CODE"],
        "USER_ID": CONFIG["USER_ID"],
        "API_CERT_KEY": CONFIG["API_CERT_KEY"],
        "LAN_TYPE": CONFIG["LAN_TYPE"],
        "ZONE": zone
    }
    
    print("\n" + "=" * 50)
    print("2. 로그인 중...")
    print(f"   URL: {url}")
    
    try:
        response = requests.post(url, json=data, timeout=30)
        result = response.json()
        
        print(f"   Response: {json.dumps(result, ensure_ascii=False, indent=2)}")
        
        status = str(result.get("Status", ""))
        if status == "200" and result.get("Data"):
            data_obj = result["Data"]
            code = data_obj.get("Code", "")
            message = data_obj.get("Message", "")
            
            print(f"   Code: {code}, Message: {message}")
            
            # Code가 "00"이면 성공
            if code == "00":
                datas = data_obj.get("Datas", {})
                session_id = datas.get("SESSION_ID")
                if session_id:
                    print(f"   ✅ 로그인 성공!")
                    print(f"   SESSION_ID: {session_id[:50]}...")
                    return session_id
            
            # Code 204: 테스트용 인증키 - 하지만 SESSION_ID가 있을 수도 있음
            if "Datas" in data_obj and "SESSION_ID" in data_obj.get("Datas", {}):
                session_id = data_obj["Datas"]["SESSION_ID"]
                print(f"   ✅ 로그인 성공 (테스트 모드)")
                print(f"   SESSION_ID: {session_id[:50]}...")
                return session_id
            
            print(f"   ⚠️ 로그인 응답: Code={code}, Message={message}")
            return None
        else:
            print(f"   ❌ 로그인 실패: {result.get('Error')}")
            return None
    except Exception as e:
        print(f"   ❌ 오류 발생: {e}")
        return None

def get_inventory(zone, session_id):
    """재고현황 조회 테스트"""
    today = datetime.now().strftime("%Y%m%d")
    url = f"https://{BASE_URL}{zone}.ecount.com/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatus?SESSION_ID={session_id}"
    data = {
        "BASE_DATE": today,
        "WH_CD": "",
        "PROD_CD": "",
        "ZERO_FLAG": "N"
    }
    
    print("\n" + "=" * 50)
    print("3. 재고현황 조회 테스트...")
    print(f"   BASE_DATE: {today}")
    
    try:
        response = requests.post(url, json=data, timeout=30)
        result = response.json()
        
        status = str(result.get("Status", ""))
        if status == "200":
            data_obj = result.get("Data", {})
            if isinstance(data_obj, dict):
                total_cnt = data_obj.get("TotalCnt", 0)
                print(f"   ✅ 재고현황 조회 성공! 총 {total_cnt}건")
                
                items = data_obj.get("Result", [])[:5]
                if items:
                    print("\n   [재고 샘플 데이터]")
                    for item in items:
                        prod_cd = item.get('PROD_CD', 'N/A')
                        prod_des = item.get('PROD_DES', '')
                        bal_qty = item.get('BAL_QTY', 'N/A')
                        print(f"   - {prod_cd}: {bal_qty}개 ({prod_des})")
        else:
            print(f"   Response: {json.dumps(result, ensure_ascii=False, indent=2)}")
            
        return result
    except Exception as e:
        print(f"   ❌ 오류 발생: {e}")
        return None

def main():
    print("\n" + "=" * 50)
    print(f"  이카운트 API 연결 테스트 ({'테스트 서버' if USE_TEST_SERVER else '정식 서버'})")
    print("=" * 50)
    
    # 1. Zone 조회
    zone, domain = get_zone()
    if not zone:
        print("\n❌ Zone 조회 실패")
        return
    
    # 2. 로그인
    session_id = login(zone)
    if not session_id:
        print("\n⚠️ 로그인에서 SESSION_ID를 받지 못했습니다.")
        print("   테스트용 인증키는 일부 기능이 제한될 수 있습니다.")
        print("   본 인증키 발급을 위해 이카운트에 검증 요청이 필요합니다.")
        return
    
    # 3. 재고현황 조회 테스트
    get_inventory(zone, session_id)
    
    print("\n" + "=" * 50)
    print("  ✅ API 연결 테스트 완료!")
    print("=" * 50)

if __name__ == "__main__":
    main()
