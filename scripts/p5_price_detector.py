import csv
import json
import os
import random
import time
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
MAPPING_CSV = DATA_DIR / "mapping_table.csv"
CHANGES_JSON = DATA_DIR / "price_changes.json"
CHANGES_CSV = DATA_DIR / "price_changes.csv"

load_dotenv(ROOT / "config" / "secrets.env")

COM_CODE = os.getenv("ECOUNT_COM_CODE")
USER_ID = os.getenv("ECOUNT_USER_ID")
CERT_KEY = os.getenv("ECOUNT_CERT_KEY")

if not COM_CODE or not USER_ID or not CERT_KEY:
    raise SystemExit("ECOUNT_COM_CODE / ECOUNT_USER_ID / ECOUNT_CERT_KEY 누락")


def get_zone():
    r = requests.post(
        "https://oapi.ecount.com/OAPI/V2/Zone",
        json={"COM_CODE": COM_CODE},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["Data"]["ZONE"]


def login(zone: str) -> str:
    r = requests.post(
        f"https://oapi{zone}.ecount.com/OAPI/V2/OAPILogin",
        json={
            "COM_CODE": COM_CODE,
            "USER_ID": USER_ID,
            "API_CERT_KEY": CERT_KEY,
            "LAN_TYPE": "ko-KR",
            "ZONE": zone,
        },
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["Data"]["Datas"]["SESSION_ID"]


def fetch_all_products(zone: str, session_id: str):
    page = 1
    all_items = []
    while True:
        r = requests.post(
            f"https://oapi{zone}.ecount.com/OAPI/V2/InventoryBasic/GetBasicProductsList?SESSION_ID={session_id}",
            json={"ListParam": {"PAGE_CURRENT": page, "PAGE_SIZE": 100}},
            timeout=20,
        )
        if r.status_code == 412:
            time.sleep(30)
            continue
        r.raise_for_status()
        result = r.json().get("Data", {}).get("Result", [])
        if not result:
            break
        all_items.extend(result)
        page += 1
        time.sleep(random.uniform(2, 5))
        if page % 5 == 0:
            time.sleep(5)
    return all_items


def normalize_price(val: str) -> str:
    if val is None:
        return ""
    s = str(val).strip()
    if s == "":
        return ""
    try:
        return f"{float(s):.10f}"
    except ValueError:
        return s


if not MAPPING_CSV.exists():
    raise SystemExit(f"mapping_table.csv 없음: {MAPPING_CSV}")

zone = get_zone()
session_id = login(zone)

products = fetch_all_products(zone, session_id)
price_map = {p.get("PROD_CD", ""): p.get("OUT_PRICE2", "") for p in products}

with open(MAPPING_CSV, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    rows = list(reader)
    headers = reader.fieldnames or []

extra_cols = ["ecount_prev_price", "ecount_curr_price", "price_changed", "last_checked_at"]
for col in extra_cols:
    if col not in headers:
        headers.append(col)

timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
changes = []

for row in rows:
    prod_cd = row.get("ecount_prod_cd", "")
    curr = price_map.get(prod_cd, "")
    prev = row.get("ecount_prev_price", "")

    row["ecount_curr_price"] = curr
    row["last_checked_at"] = timestamp

    if curr == "":
        row["price_changed"] = "NO_DATA"
        continue

    if prev in (None, ""):
        row["ecount_prev_price"] = curr
        row["price_changed"] = "N"
        continue

    if normalize_price(curr) != normalize_price(prev):
        row["price_changed"] = "Y"
        row["ecount_prev_price"] = curr
        changes.append({
            "ecount_prod_cd": prod_cd,
            "ecount_prod_des": row.get("ecount_prod_des", ""),
            "cafe24_product_no": row.get("cafe24_product_no", ""),
            "cafe24_product_code": row.get("cafe24_product_code", ""),
            "prev_price": prev,
            "curr_price": curr,
        })
    else:
        row["price_changed"] = "N"

with open(MAPPING_CSV, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=headers)
    writer.writeheader()
    writer.writerows(rows)

with open(CHANGES_JSON, "w", encoding="utf-8") as f:
    json.dump(changes, f, ensure_ascii=False, indent=2)

with open(CHANGES_CSV, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(
        f,
        fieldnames=["ecount_prod_cd", "ecount_prod_des", "cafe24_product_no", "cafe24_product_code", "prev_price", "curr_price"],
    )
    writer.writeheader()
    writer.writerows(changes)

print(f"mapping_table.csv 업데이트 완료: {len(rows)}건")
print(f"변동 건수: {len(changes)}건")
print(f"변동 저장: {CHANGES_JSON}")
