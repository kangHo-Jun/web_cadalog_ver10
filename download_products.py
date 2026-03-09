import csv
import json
import os
from typing import List, Dict

import requests
from dotenv import load_dotenv


def _post_json(url: str, payload: dict) -> dict:
    res = requests.post(url, json=payload)
    return res.json()


def _get_env_keys():
    load_dotenv("config/secrets.env")
    com_code = os.getenv("ECOUNT_COM_CODE")
    user_id = os.getenv("ECOUNT_USER_ID")
    test_key = os.getenv("ECOUNT_TEST_CERT_KEY")
    prod_key = os.getenv("ECOUNT_CERT_KEY")
    if test_key:
        return com_code, user_id, test_key, "sboapi"
    return com_code, user_id, prod_key, "oapi"


def _get_zone(base: str, com_code: str) -> str:
    url = f"https://{base}.ecount.com/OAPI/V2/Zone"
    data = _post_json(url, {"COM_CODE": com_code})
    if str(data.get("Status")) != "200":
        raise RuntimeError(f"Zone 조회 실패: {data}")
    zone = (data.get("Data") or {}).get("ZONE")
    if not zone:
        raise RuntimeError(f"ZONE 누락: {data}")
    return zone


def _login(base: str, zone: str, com_code: str, user_id: str, cert_key: str) -> str:
    url = f"https://{base}{zone}.ecount.com/OAPI/V2/OAPILogin"
    payload = {
        "COM_CODE": com_code,
        "USER_ID": user_id,
        "API_CERT_KEY": cert_key,
        "LAN_TYPE": "ko-KR",
        "ZONE": zone,
    }
    data = _post_json(url, payload)
    if str(data.get("Status")) != "200":
        raise RuntimeError(f"로그인 실패: {data}")
    code = str((data.get("Data") or {}).get("Code"))
    if code not in ["00", "204"]:
        raise RuntimeError(f"로그인 오류: {data}")
    session_id = ((data.get("Data") or {}).get("Datas") or {}).get("SESSION_ID")
    if not session_id:
        raise RuntimeError(f"SESSION_ID 누락: {data}")
    return session_id


def fetch_all_products() -> List[Dict[str, str]]:
    com_code, user_id, cert_key, base = _get_env_keys()
    if not com_code or not user_id or not cert_key:
        raise RuntimeError("ECOUNT_COM_CODE / ECOUNT_USER_ID / (ECOUNT_TEST_CERT_KEY or ECOUNT_CERT_KEY) 필요")

    zone = _get_zone(base, com_code)
    session_id = _login(base, zone, com_code, user_id, cert_key)

    url = (
        f"https://{base}{zone}.ecount.com/OAPI/V2/InventoryBasic/"
        f"GetBasicProductsList?SESSION_ID={session_id}"
    )

    page_size = 100
    page_current = 1
    total_cnt = None
    all_items: List[Dict[str, str]] = []

    while True:
        payload = {"ListParam": {"PAGE_CURRENT": page_current, "PAGE_SIZE": page_size}}
        data = _post_json(url, payload)
        if str(data.get("Status")) != "200":
            raise RuntimeError(f"상품 조회 실패: {data}")

        data_obj = data.get("Data") or {}
        if total_cnt is None:
            total_cnt = data_obj.get("TotalCnt", 0)

        result = data_obj.get("Result") or []
        all_items.extend(result)

        if not result:
            break
        if total_cnt is not None and len(all_items) >= int(total_cnt):
            break

        page_current += 1

    # 필요한 필드만 유지
    filtered = [
        {
            "PROD_CD": item.get("PROD_CD", ""),
            "PROD_DES": item.get("PROD_DES", ""),
            "OUT_PRICE": item.get("OUT_PRICE", ""),
        }
        for item in all_items
    ]
    return filtered


def save_csv(rows: List[Dict[str, str]], filepath: str) -> None:
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["PROD_CD", "PROD_DES", "OUT_PRICE"])
        writer.writeheader()
        writer.writerows(rows)


def save_json(rows: List[Dict[str, str]], filepath: str) -> None:
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    rows = fetch_all_products()
    csv_path = os.path.join("data", "ecount_products.csv")
    json_path = os.path.join("data", "ecount_products.json")
    save_csv(rows, csv_path)
    save_json(rows, json_path)

    sample = rows[:3]
    print(f"총 상품수: {len(rows)}")
    print(f"CSV 저장 경로: {csv_path}")
    print(f"JSON 저장 경로: {json_path}")
    print("샘플 3건:", sample)


if __name__ == "__main__":
    main()
