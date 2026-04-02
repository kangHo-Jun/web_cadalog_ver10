"""
카페24 OAuth 재인증 스크립트 (외부 redirect_uri 방식)
실행: python3 scripts/reauth_cafe24.py

흐름:
  1. 인증 URL 출력
  2. 브라우저에서 URL 열고 카페24 로그인 → 동의
  3. 리다이렉트된 URL(https://web-cadalog-ver10.vercel.app/api/auth/callback?code=...)을 복사
  4. 터미널에 붙여넣기 → 토큰 교환 완료
"""
import json
import os
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "config" / "secrets.env")

MALL_ID       = os.getenv("CAFE24_MALL_ID", "daesan3833")
CLIENT_ID     = os.getenv("CAFE24_CLIENT_ID")
CLIENT_SECRET = os.getenv("CAFE24_CLIENT_SECRET")
REDIRECT_URI  = "https://web-cadalog-ver10.vercel.app/api/auth/callback"
TOKEN_FILE    = ROOT / "data" / "token_state.json"

SCOPES = "mall.read_product,mall.write_product"

AUTH_URL = (
    f"https://{MALL_ID}.cafe24api.com/api/v2/oauth/authorize"
    f"?response_type=code"
    f"&client_id={CLIENT_ID}"
    f"&redirect_uri={REDIRECT_URI}"
    f"&scope={SCOPES}"
)


def exchange_code(code: str) -> dict:
    url = f"https://{MALL_ID}.cafe24api.com/api/v2/oauth/token"
    res = requests.post(
        url,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        auth=(CLIENT_ID, CLIENT_SECRET),
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
        },
        timeout=20,
    )
    if res.status_code != 200:
        raise RuntimeError(f"Token 교환 실패: {res.status_code}\n{res.text}")
    return res.json()


def main():
    print("=" * 60)
    print("카페24 OAuth 재인증 (외부 redirect_uri 방식)")
    print("=" * 60)
    print()
    print("▶ Step 1: 아래 URL을 브라우저에서 열고 카페24 로그인 후 동의 버튼을 누르세요:\n")
    print(f"  {AUTH_URL}")
    print()
    print("▶ Step 2: 동의 완료 후 브라우저 주소창에 나타나는 URL 전체를 복사하세요.")
    print("  (예: https://web-cadalog-ver10.vercel.app/api/auth/callback?code=XXXXX&...)")
    print()

    raw = input("▶ Step 3: 리다이렉트된 URL 또는 code 값을 여기에 붙여넣기 후 Enter: ").strip()

    # URL인 경우 code만 추출
    if raw.startswith("http"):
        parsed = urlparse(raw)
        params = parse_qs(parsed.query)
        code = params.get("code", [None])[0]
        if not code:
            print("❌ URL에서 code를 찾을 수 없습니다.")
            sys.exit(1)
    else:
        code = raw  # code 값만 입력한 경우

    print(f"\n✅ Authorization Code: {code[:10]}...")
    print("▶ Step 4: Access Token 교환 중...")

    token_data = exchange_code(code)

    # token_state.json에 저장
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
        json.dump(token_data, f, indent=2, ensure_ascii=False)

    print()
    print("=" * 60)
    print("✅ 토큰 발급 완료!")
    print("=" * 60)
    print(f"  access_token:   {token_data.get('access_token', '')}")
    print(f"  refresh_token:  {token_data.get('refresh_token', '')}")
    print(f"  expires_in:     {token_data.get('expires_in')}초")
    print(f"  저장 위치:       {TOKEN_FILE}")
    print()
    print("→ 이제 구글 시트 [설정] 탭에 위 토큰을 붙여넣거나, Antigravity에게 반영을 요청하세요.")


if __name__ == "__main__":
    main()
