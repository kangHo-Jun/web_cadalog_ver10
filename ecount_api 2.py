import os
import requests
from dotenv import load_dotenv
from config import settings

load_dotenv("config/secrets.env")

COM_CODE = os.getenv("ECOUNT_COM_CODE")
USER_ID = os.getenv("ECOUNT_USER_ID")
API_CERT_KEY = os.getenv("ECOUNT_CERT_KEY")


def _base_url():
    return "sboapi" if settings.ER_USE_TEST_SERVER else "oapi"


def _post_json(url, payload):
    res = requests.post(url, json=payload)
    return res.json()


def get_zone():
    """T1: Zone 조회 -> ZONE 문자열 반환"""
    # Zone API는 고정 URL을 사용 (ZONE 미포함)
    url = "https://sboapi.ecount.com/OAPI/V2/Zone"
    data = _post_json(url, {"COM_CODE": COM_CODE})
    if str(data.get("Status")) != "200":
        raise Exception(f"Zone 조회 실패: {data.get('Error')}")
    zone = (data.get("Data") or {}).get("ZONE")
    if not zone:
        raise Exception("Zone 조회 실패: ZONE 누락")
    return zone


def login():
    """T2: 로그인 -> SESSION_ID 문자열(길이 10 이상) 반환"""
    zone = get_zone()
    url = f"https://{_base_url()}{zone}.ecount.com/OAPI/V2/OAPILogin"
    payload = {
        "COM_CODE": COM_CODE,
        "USER_ID": USER_ID,
        "API_CERT_KEY": API_CERT_KEY,
        "LAN_TYPE": "ko-KR",
        "ZONE": zone,
    }
    data = _post_json(url, payload)
    if str(data.get("Status")) != "200":
        raise Exception(f"로그인 실패: {data.get('Error')}")

    data_obj = data.get("Data") or {}
    if str(data_obj.get("Code")) not in ["00", "204"]:
        raise Exception(f"로그인 응답 오류: {data_obj.get('Message')}")

    session_id = (data_obj.get("Datas") or {}).get("SESSION_ID")
    if not session_id:
        raise Exception("로그인 실패: SESSION_ID 누락")
    return session_id


def get_products():
    """T3: 상품 목록 조회 -> PROD_CD/OUT_PRICE 포함된 리스트 반환"""
    session_id = login()
    zone = get_zone()
    url = (
        f"https://{_base_url()}{zone}.ecount.com/OAPI/V2/InventoryBasic/"
        f"GetBasicProductsList?SESSION_ID={session_id}"
    )

    page_size = 100
    page_current = 1
    results = []
    total_cnt = None

    while True:
        payload = {
            "PAGE_SIZE": page_size,
            "PAGE_CURRENT": page_current,
            "PROD_TYPE": "",
            "USE_FLAG": "Y",
        }
        data = _post_json(url, payload)
        if str(data.get("Status")) != "200":
            raise Exception(f"상품 조회 실패: {data.get('Error')}")

        data_obj = data.get("Data") or {}
        if total_cnt is None:
            total_cnt = data_obj.get("TotalCnt")

        page_items = data_obj.get("Result") or []
        results.extend(page_items)

        if not page_items:
            break

        if total_cnt is not None and len(results) >= int(total_cnt):
            break

        page_current += 1

    return results
