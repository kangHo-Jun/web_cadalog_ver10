#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Optional

import pandas as pd


def col_to_index(col: str) -> int:
    col = col.strip()
    if not col:
        raise ValueError("target column is empty")
    if col.isdigit():
        return int(col) - 1
    # Excel-style letters
    col = col.upper()
    idx = 0
    for ch in col:
        if not ('A' <= ch <= 'Z'):
            raise ValueError(f"invalid column letter: {col}")
        idx = idx * 26 + (ord(ch) - ord('A') + 1)
    return idx - 1


def load_mapping(ecount_path: Path) -> dict:
    data = json.loads(ecount_path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("ecount json must be a list of records")
    mapping = {}
    for row in data:
        if not isinstance(row, dict):
            continue
        prod_cd = row.get("PROD_CD")
        if prod_cd is None:
            continue
        key = str(prod_cd).strip()
        if key == "":
            continue
        mapping[key] = row.get("OUT_PRICE2")
    return mapping


def main() -> int:
    parser = argparse.ArgumentParser(description="Add Ecount OUT_PRICE2 to Cafe24 CSV")
    parser.add_argument(
        "--input",
        default="data/실제/카페25_데이터_최종_ver1.csv",
        help="input CSV path",
    )
    parser.add_argument(
        "--ecount",
        default="data/ecount_filtered.json",
        help="ecount filtered json path",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="output CSV path (default: overwrite input)",
    )
    parser.add_argument(
        "--code-col",
        default="자체 품목코드",
        help="column name for matching PROD_CD",
    )
    parser.add_argument(
        "--price-col",
        default="이카운트_2단가",
        help="column name to write OUT_PRICE2",
    )
    parser.add_argument(
        "--target-col",
        default="L",
        help="target column position (Excel letter or 1-based index), default L",
    )

    args = parser.parse_args()

    input_path = Path(args.input)
    ecount_path = Path(args.ecount)
    output_path = Path(args.output) if args.output else input_path

    input_suffix = input_path.suffix.lower()
    if input_suffix in {".xlsx", ".xls"}:
        df = pd.read_excel(input_path, dtype=str)
    else:
        df = pd.read_csv(input_path, dtype=str, encoding="utf-8-sig")
    if args.code_col not in df.columns:
        raise ValueError(f"code column not found: {args.code_col}")

    mapping = load_mapping(ecount_path)

    codes = df[args.code_col].astype(str).str.strip()
    codes = codes.where(codes != "nan", None)
    price_series = codes.map(mapping)

    target_index = col_to_index(args.target_col)

    # If the price column already exists, drop it so we can re-insert at target
    if args.price_col in df.columns:
        df = df.drop(columns=[args.price_col])

    # Pad with empty columns so the target index exists
    if target_index > len(df.columns):
        pad_count = target_index - len(df.columns)
        for _ in range(pad_count):
            df.insert(len(df.columns), "", "", allow_duplicates=True)

    insert_at = min(target_index, len(df.columns))
    df.insert(insert_at, args.price_col, price_series, allow_duplicates=True)

    output_suffix = output_path.suffix.lower()
    if output_suffix in {".xlsx", ".xls"}:
        df.to_excel(output_path, index=False)
    else:
        df.to_csv(output_path, index=False, encoding="utf-8-sig")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
