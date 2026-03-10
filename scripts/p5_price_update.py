"""P5: 이카운트 OUT_PRICE2 → mapping_table.csv 업데이트

ecount_filtered.json (OUT_PRICE2 포함) 로드
→ ecount_prod_cd 매칭
→ ecount_out_price2 컬럼 추가/업데이트
→ mapping_table.csv 저장
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
ECOUNT_JSON = DATA_DIR / "ecount_filtered.json"
MAPPING_CSV = DATA_DIR / "mapping_table.csv"

if not ECOUNT_JSON.exists():
    raise SystemExit(f"파일 없음: {ECOUNT_JSON} (P2 실행 필요)")
if not MAPPING_CSV.exists():
    raise SystemExit(f"파일 없음: {MAPPING_CSV} (P4 실행 필요)")

with open(ECOUNT_JSON, encoding="utf-8") as f:
    ecount_data = json.load(f)

price_map = {
    p["PROD_CD"]: p.get("OUT_PRICE2", "")
    for p in ecount_data
    if p.get("PROD_CD")
}
print(f"이카운트 상품 로드: {len(price_map)}건")

with open(MAPPING_CSV, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    rows = list(reader)
    fieldnames = list(reader.fieldnames or [])

if "ecount_out_price2" not in fieldnames:
    fieldnames.append("ecount_out_price2")

matched = 0
unmatched = 0

for row in rows:
    prod_cd = row.get("ecount_prod_cd", "")
    price = price_map.get(prod_cd)
    if price is not None:
        row["ecount_out_price2"] = price
        matched += 1
    else:
        row["ecount_out_price2"] = row.get("ecount_out_price2", "")
        unmatched += 1

with open(MAPPING_CSV, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"매칭 성공: {matched}건")
print(f"매칭 실패: {unmatched}건")
print(f"저장 완료: {MAPPING_CSV}")
