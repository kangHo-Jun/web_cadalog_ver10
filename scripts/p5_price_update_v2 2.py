import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SRC = DATA_DIR / "ecount_filtered.json"
MAPPING = DATA_DIR / "mapping_table.csv"

if not SRC.exists():
    raise SystemExit(f"원본 JSON 없음: {SRC}")
if not MAPPING.exists():
    raise SystemExit(f"mapping_table.csv 없음: {MAPPING}")


def norm_price(v: str) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    if s == "":
        return ""
    return s.replace(",", "")

# 원본 가격 맵 만들기 (JSON)
with SRC.open(encoding="utf-8") as f:
    items = json.load(f)

price_map = {}
for item in items:
    prod_cd = (item.get("PROD_CD") or "").strip()
    if not prod_cd:
        continue
    price_map[prod_cd] = norm_price(item.get("OUT_PRICE2", ""))

# mapping_table.csv 업데이트
with MAPPING.open(encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    rows = list(reader)
    headers = reader.fieldnames or []

if "ecount_out_price2" not in headers:
    headers.append("ecount_out_price2")

updated = 0
missing = 0
for row in rows:
    prod_cd = (row.get("ecount_prod_cd") or "").strip()
    if not prod_cd:
        continue
    if prod_cd in price_map:
        row["ecount_out_price2"] = price_map[prod_cd]
        updated += 1
    else:
        missing += 1

with MAPPING.open("w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=headers)
    writer.writeheader()
    writer.writerows(rows)

print(f"매칭 업데이트: {updated}건")
print(f"매칭 실패: {missing}건")
print(f"저장: {MAPPING}")
