import os
from dotenv import load_dotenv

# .env 파일 로드 (config 디렉토리에 있을 경우를 고려하여 경로 설정)
load_dotenv(os.path.join(os.path.dirname(__file__), 'secrets.env'))

# --- 비즈니스 설정 (Business Settings) ---
MARGIN_RATE = 1.3  # 기본 마진율 (30%)
ROUND_UNIT = 100   # 가격 반올림 단위 (100원 단위)

# --- 이카운트 ERP 설정 (ECount Settings) ---
ER_COM_CODE = os.getenv("ECOUNT_COM_CODE", "650217")
ER_USER_ID = os.getenv("ECOUNT_USER_ID", "zartkang")
ER_CERT_KEY = os.getenv("ECOUNT_CERT_KEY", "55f919e986cb444ed8ae25dc46705a3cc7")
ER_USE_TEST_SERVER = True  # 테스트 서버 사용 여부

# --- 카페24 설정 (Cafe24 Settings) ---
C24_MALL_ID = os.getenv("CAFE24_MALL_ID", "daesan3833")
C24_CLIENT_ID = os.getenv("CAFE24_CLIENT_ID", "5TbJGxFqFBOtlYEXoWL47D")
C24_CLIENT_SECRET = os.getenv("CAFE24_CLIENT_SECRET", "GIYib6feK0vCm4mevXpf7i")
C24_API_VERSION = "2025-12-01"

# --- 경로 설정 (Path Settings) ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.path.join(BASE_DIR, 'logs')
DATA_DIR = os.path.join(BASE_DIR, 'data')
TOKEN_FILE = os.path.join(DATA_DIR, 'token_state.json')
