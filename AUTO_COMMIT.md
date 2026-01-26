# Auto-commit Configuration

## 🚀 사용 방법

### 1. 백그라운드에서 실행
```bash
./auto-commit.sh &
```

### 2. nohup으로 실행 (터미널 종료 후에도 계속 실행)
```bash
nohup ./auto-commit.sh > auto-commit.log 2>&1 &
```

### 3. 프로세스 확인
```bash
ps aux | grep auto-commit
```

### 4. 중지하기
```bash
# 프로세스 ID 확인 후
kill <PID>
```

## ⚙️ 설정

- **감지 주기**: 30초마다 변경 사항 확인
- **커밋 메시지**: `Auto-commit: YYYY-MM-DD HH:MM:SS`
- **제외 파일**: `.gitignore`에 정의된 파일들

## 📝 주의사항

1. `.env.local` 및 `.tokens.json`은 자동으로 제외됩니다
2. 민감한 정보가 포함된 파일은 반드시 `.gitignore`에 추가하세요
3. 백그라운드 실행 시 `auto-commit.log`에서 로그를 확인할 수 있습니다

## 🔧 수동 커밋

자동 커밋을 원하지 않는 경우 일반적인 Git 명령어를 사용하세요:
```bash
git add .
git commit -m "Your commit message"
git push
```
