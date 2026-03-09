import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict

import requests
from config import settings


def _parse_dt(value: str) -> datetime:
    if not value:
        raise ValueError("empty datetime string")
    # Token timestamps look like 2026-03-06T19:07:22.000
    base = value.split(".")[0]
    return datetime.strptime(base, "%Y-%m-%dT%H:%M:%S")


def _load_token() -> Dict[str, Any]:
    with open(settings.TOKEN_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_token(data: Dict[str, Any]) -> None:
    with open(settings.TOKEN_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _refresh_access_token(data: Dict[str, Any]) -> Dict[str, Any]:
    url = f"https://{settings.C24_MALL_ID}.cafe24api.com/api/v2/oauth/token"
    res = requests.post(
        url,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        auth=(settings.C24_CLIENT_ID, settings.C24_CLIENT_SECRET),
        data={
            "grant_type": "refresh_token",
            "refresh_token": data["refresh_token"],
        },
    )
    if res.status_code != 200:
        raise RuntimeError(f"token refresh failed: {res.status_code} {res.text}")

    new_data = res.json()
    data.update(new_data)
    _save_token(data)
    return data


def get_valid_token() -> str:
    """
    1) token_state.json 로드
    2) access_token 만료 확인
    3) 만료 시 refresh_token으로 갱신
    4) 갱신 성공 시 token_state.json 업데이트
    5) 갱신 실패 시 예외 발생
    """
    data = _load_token()

    access_expires_at = _parse_dt(data.get("expires_at") or data.get("access_token_expires_at") or "")
    refresh_expires_at = _parse_dt(data.get("refresh_token_expires_at") or "")

    now = datetime.now()
    # access_token 만료 1분 전부터 갱신 시도
    if now + timedelta(minutes=1) < access_expires_at:
        return data["access_token"]

    if now >= refresh_expires_at:
        logging.warning("refresh_token 만료: 수동 재인증 필요")
        raise RuntimeError("refresh_token expired")

    data = _refresh_access_token(data)
    return data["access_token"]
