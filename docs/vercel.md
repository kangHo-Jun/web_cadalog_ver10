# Deployment Guide: GitHub & Vercel

이 문서는 **Cafe24 Web Catalog** 프로젝트를 GitHub 소스 관리와 Vercel 클라우드 배포를 통해 운영하는 방법을 설명합니다.

---

## 1. GitHub 소스 코드 업로드 (Source Control)

먼저 로컬 컴퓨터의 소스 코드를 GitHub 저장소에 올려야 합니다.

### [Step 1] GitHub 저장소 생성
1. [GitHub](https://github.com/)에 로그인합니다.
2. **New repository**를 클릭하여 새로운 저장소를 만듭니다.
   - **Repository name**: `cafe24-web-catalog`
   - **Public/Private**: 개인 프로젝트라면 `Private` 권장

### [Step 2] 로컬 코드 Push
터미널에서 프로젝트 루트 디렉토리로 이동 후 다음 명령어를 실행합니다.
```bash
git init
git add .
git commit -m "Initial commit for deployment"
git branch -M main
git remote add origin https://github.com/사용자계정/cafe24-web-catalog.git
git push -u origin main
```

---

## 2. Vercel 클라우드 배포 (Cloud Deployment)

Vercel은 GitHub와 연동되어 코드가 수정될 때마다 자동으로 배포됩니다.

### [Step 1] Vercel 계정 생성 및 로그인
1. [Vercel](https://vercel.com/)에 접속하여 **GitHub 계정으로 가입**합니다.

### [Step 2] 프로젝트 가져오기 (Import)
1. 대시보드에서 **[+ New Project]** 버튼을 클릭합니다.
2. 연결된 GitHub 계정에서 위에서 만든 `cafe24-web-catalog` 저장소를 선택하고 **[Import]**를 클릭합니다.

### [Step 3] 환경 변수 설정 (Environment Variables) ⭐ 중요
배포 전, 로컬의 `.env.local` 파일에 들어있는 보안 정보를 Vercel에 직접 입력해야 합니다.
1. 배포 설정 화면의 **Environment Variables** 섹션을 활성화합니다.
2. 다음 항목들을 `Key`와 `Value`로 각각 입력합니다:
   - `CAFE24_CLIENT_ID`
   - `CAFE24_CLIENT_SECRET`
   - `CAFE24_MALL_ID`
   - (기타 프로젝트에 필요한 모든 `.env` 변수)

### [Step 4] 프로젝트 배포
1. 모든 설정이 완료되면 **[Deploy]** 버튼을 클릭합니다.
2. 약 1~2분 후 배포가 완료되면 전용 URL(예: `cafe24-web-catalog.vercel.app`)이 생성됩니다.

---

## 3. Cafe24 API 설정 업데이트 (Post-Deployment)

배포된 웹사이트 주소가 바뀌었으므로 Cafe24 개발자 센터 설정도 확인해야 합니다.

1. [Cafe24 Developers](https://developers.cafe24.com/) 접속
2. **앱 관리 > 앱 설정**으로 이동
3. **App URL** 및 **OAuth Redirect URI**를 Vercel 주소로 업데이트합니다.
   - 예: `https://xxx.vercel.app/api/auth/callback`

---

## 4. 업데이트 및 유지 관리

코드를 수정한 후에는 다음 명령어만 입력하면 Vercel이 자동으로 감지하여 재배포합니다.
```bash
git add .
git commit -m "Update feature XY"
git push origin main
```

> [!TIP]
> **Vercel Hobby Plan**은 SSL(HTTPS)을 자동으로 적용해주므로 별도의 보안 설정이 필요 없습니다.
