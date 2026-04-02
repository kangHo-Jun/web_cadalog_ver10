import os
import requests
from dotenv import load_dotenv

load_dotenv('config/secrets.env')

COM_CODE = os.getenv('ECOUNT_COM_CODE')
USER_ID = os.getenv('ECOUNT_USER_ID')
CERT_KEY = os.getenv('ECOUNT_TEST_CERT_KEY')

if not COM_CODE or not USER_ID or not CERT_KEY:
    raise SystemExit("ECOUNT_COM_CODE / ECOUNT_USER_ID / ECOUNT_CERT_KEY 환경변수가 필요합니다.")

# Zone 조회
r1 = requests.post(
    'https://sboapi.ecount.com/OAPI/V2/Zone',
    json={'COM_CODE': COM_CODE},
    timeout=10
)
print('Zone Status:', r1.status_code)
zone = r1.json().get('Data', {}).get('ZONE')
print('ZONE:', zone)

# 로그인
r2 = requests.post(
    f'https://sboapi{zone}.ecount.com/OAPI/V2/OAPILogin',
    json={
        'COM_CODE': COM_CODE,
        'USER_ID': USER_ID,
        'API_CERT_KEY': CERT_KEY,
        'LAN_TYPE': 'ko-KR',
        'ZONE': zone
    },
    timeout=10
)
print('Login Status:', r2.status_code)
print('Login Response:', r2.json())

session_id = r2.json().get('Data', {}).get('Datas', {}).get('SESSION_ID', '')
if not session_id:
    session_id = r2.json().get('Data', {}).get('SESSION_ID', '')
print('SESSION_ID:', session_id)

if not session_id:
    raise SystemExit('P1 실패: SESSION_ID가 비어있음')

print('P1 성공')
