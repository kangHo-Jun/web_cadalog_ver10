/**
 * 🚀 Cafe24 Web Catalog Monitoring Script
 */

const BASE_URL = 'https://web-cadalog-ver10.vercel.app';
const ALERT_EMAIL = 'zartkang@gmail.com';

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🛠️ 모니터링')
    .addItem('전체 갱신', 'checkAll')
    .addSeparator()
    .addItem('토큰 재인증 URL', 'openReauthUrl')
    .addToUi();
}

function checkAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let dashboard = ss.getSheetByName('대시보드');
  if (!dashboard) {
    dashboard = ss.insertSheet('대시보드');
    dashboard.appendRow(['항목', '상태', '상세', '마지막확인', '액션']);
    dashboard.getRange('A1:E1').setBackground('#f3f3f3').setFontWeight('bold');
  }

  // debug-snapshot 1회만 호출
  let snapshotData = null;
  try {
    const response = UrlFetchApp.fetch(BASE_URL + '/api/debug-snapshot');
    snapshotData = JSON.parse(response.getContentText());
  } catch (e) {
    Logger.log('debug-snapshot 호출 실패: ' + e.message);
  }

  checkCafe24Token(dashboard);
  checkRedis(dashboard, snapshotData);
  checkSyncProducts(dashboard, snapshotData);
  checkVercel(dashboard);

  SpreadsheetApp.getUi().alert('✅ 모든 체크가 완료되었습니다.');
}

function checkCafe24Token(sheet) {
  try {
    // Vercel 엔드포인트 대신 모니터링 시트 [설정]에서 직접 읽기 (504 타임아웃 방지)
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cfg = getConfigFromSheet_(ss.getSheetByName('설정'));

    const accessExpiresAt = cfg['TOKEN_EXPIRES_AT'] ? new Date(cfg['TOKEN_EXPIRES_AT']) : null;
    const refreshExpiresAt = cfg['REFRESH_EXPIRES_AT'] ? new Date(cfg['REFRESH_EXPIRES_AT']) : null;

    // access_token 상태
    const now = new Date();
    let accessStatus = '🟢정상';
    let accessDetail = accessExpiresAt ? '만료: ' + Utilities.formatDate(accessExpiresAt, 'Asia/Seoul', 'MM-dd HH:mm') : '만료일 없음';
    if (!accessExpiresAt || accessExpiresAt <= now) accessStatus = '🔴만료';
    else if ((accessExpiresAt - now) < 30 * 60 * 1000) accessStatus = '🟡30분미만';
    updateDashboard(sheet, 2, 'Cafe24 Access Token', accessStatus, accessDetail, '[갱신]');
    logResult('Cafe24 Access Token', accessStatus, accessDetail);

    // refresh_token 상태
    let refreshStatus = '🟢정상';
    let daysLeft = -1;
    let refreshDetail = '만료일 없음';
    if (refreshExpiresAt) {
      daysLeft = Math.floor((refreshExpiresAt - now) / (1000 * 60 * 60 * 24));
      refreshDetail = 'D-' + daysLeft + ' (' + Utilities.formatDate(refreshExpiresAt, 'Asia/Seoul', 'MM-dd') + ')';
      if (daysLeft <= 0) refreshStatus = '🔴만료';
      else if (daysLeft <= 1) refreshStatus = '🔴D-1경고';
      else if (daysLeft <= 7) refreshStatus = '🟡D-7경고';
    }
    updateDashboard(sheet, 3, 'Cafe24 Refresh Token', refreshStatus, refreshDetail, '[재인증URL]');
    logResult('Cafe24 Refresh Token', refreshStatus, refreshDetail);

    if (refreshStatus !== '🟢정상') {
      sendAlert('⚠️ [웹카달로그] 토큰 만료 위험 (' + refreshStatus + ')', '토큰이 ' + daysLeft + '일 후 만료됩니다. 즉시 확인하세요.\n만료일: ' + refreshExpiresAt);
    }
  } catch (e) {
    updateDashboard(sheet, 2, 'Cafe24 Access Token', '🔴오류', e.message);
    logResult('Cafe24 Token', '🔴오류', e.message);
  }
}

function checkRedis(sheet, data) {
  try {
    if (!data) throw new Error('debug-snapshot 데이터 없음');
    const status = data.status === 'OK' ? '🟢정상' : '🔴오류';
    const detail = data.status === 'OK' ? "응답: " + data.responseTime : data.error;
    updateDashboard(sheet, 4, 'Redis 연결', status, detail, '-');
    logResult('Redis', status, detail);
  } catch (e) {
    updateDashboard(sheet, 4, 'Redis 연결', '🔴오류', e.message);
    logResult('Redis', '🔴오류', e.message);
    sendAlert('🚨 [웹카달로그] Redis 연결 오류', e.message);
  }
}

function checkSyncProducts(sheet, data) {
  try {
    if (!data) throw new Error('debug-snapshot 데이터 없음');
    const snapshot = data.lastSnapshot || {};
    const productCount = Object.keys(snapshot).length;
    const status = productCount > 0 ? '🟢정상' : '🔴오류';
    updateDashboard(sheet, 6, '/api/sync-products', status, "스냅샷 상품수: " + productCount, '[재실행]');
    logResult('Sync Products', status, "Snapshot count: " + productCount);
  } catch (e) {
    updateDashboard(sheet, 6, '/api/sync-products', '🔴오류', e.message);
  }
}

function checkVercel(sheet) {
  updateDashboard(sheet, 8, 'Vercel 배포', '🟢정상', 'N/A (Health Check)', '-');
}

function updateDashboard(sheet, row, item, status, detail, action) {
  const now = Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss");
  sheet.getRange(row, 1, 1, 5).setValues([[item, status, detail, now, action]]);
  const statusRange = sheet.getRange(row, 2);
  if (status.includes('정상')) statusRange.setFontColor('green');
  else if (status.includes('경고')) statusRange.setFontColor('orange');
  else if (status.includes('오류') || status.includes('만료')) statusRange.setFontColor('red');
}

function logResult(item, status, detail) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName('로그');
  if (!logSheet) {
    logSheet = ss.insertSheet('로그');
    logSheet.appendRow(['시간', '항목', '상태', '상세내용']);
  }
  const now = Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss");
  logSheet.appendRow([now, item, status, detail]);
}

function sendAlert(subject, body) {
  MailApp.sendEmail({ to: ALERT_EMAIL, subject: subject, body: body });
}

function openReauthUrl() {
  const clientId = '5TbJGxFqFBOtlYEXoWL47D'; 
  const url = 'https://daesan3833.cafe24api.com/api/v2/oauth/authorize?response_type=code&client_id=' + clientId + '&redirect_uri=https://web-cadalog-ver10.vercel.app/api/auth/callback&scope=mall.read_product,mall.write_product';
  const html = '<script>window.open("' + url + '", "_blank");google.script.host.close();</script>';
  const userInterface = HtmlService.createHtmlOutput(html).setWidth(200).setHeight(100);
  SpreadsheetApp.getUi().showModalDialog(userInterface, '재인증 페이지로 이동 중...');
}

function refreshCafe24Token() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('설정');
    if (!sheet) throw new Error('[설정] 시트 없음');

    const cfg = getConfigFromSheet_(sheet);

    const mallId = cfg.MALL_ID || cfg.CAFE24_MALL_ID;
    const clientId = cfg.CAFE24_CLIENT_ID;
    const clientSecret = cfg.CAFE24_CLIENT_SECRET;
    const refreshToken = cfg.CAFE24_REFRESH_TOKEN;

    if (!mallId || !clientId || !clientSecret || !refreshToken) {
      Logger.log('❌ 필수 설정값 누락: ' + JSON.stringify({ mallId: !!mallId, clientId: !!clientId, clientSecret: !!clientSecret, refreshToken: !!refreshToken }));
      return;
    }

    const credentials = Utilities.base64Encode(clientId + ':' + clientSecret);

    const response = UrlFetchApp.fetch(
      'https://' + mallId + '.cafe24api.com/api/v2/oauth/token',
      {
        method: 'post',
        headers: {
          'Authorization': 'Basic ' + credentials,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: 'grant_type=refresh_token&refresh_token=' + refreshToken,
        muteHttpExceptions: true
      }
    );

    const data = JSON.parse(response.getContentText());

    if (data.access_token) {
      // 1. 구글시트 [설정] 탭 업데이트
      setConfigToSheet_(sheet, 'CAFE24_ACCESS_TOKEN', data.access_token);
      setConfigToSheet_(sheet, 'CAFE24_REFRESH_TOKEN', data.refresh_token);
      if (data.expires_at) setConfigToSheet_(sheet, 'TOKEN_EXPIRES_AT', data.expires_at);
      if (data.refresh_token_expires_at) setConfigToSheet_(sheet, 'REFRESH_EXPIRES_AT', data.refresh_token_expires_at);

      // 2. Redis + Vercel 업데이트
      UrlFetchApp.fetch('https://web-cadalog-ver10.vercel.app/api/token-update', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: new Date(data.expires_at).getTime(),
          refresh_token_expires_at: new Date(data.refresh_token_expires_at).getTime()
        }),
        muteHttpExceptions: true
      });

      Logger.log('✅ 토큰 갱신 완료');
    } else {
      Logger.log('❌ 토큰 갱신 실패: ' + JSON.stringify(data));
    }
  } catch (e) {
    Logger.log('❌ refreshCafe24Token 오류: ' + e.message);
  }
}

function getConfigFromSheet_(sheet) {
  const data = sheet.getDataRange().getValues();
  const cfg = {};
  data.forEach(row => { if (row[0]) cfg[row[0]] = row[1]; });
  return cfg;
}

function setConfigToSheet_(sheet, key, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function createTrigger() {
  // 기존 트리거 중복 방지
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'refreshCafe24Token') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // refreshCafe24Token 1시간마다 실행
  ScriptApp.newTrigger('refreshCafe24Token')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('✅ refreshCafe24Token 트리거 등록 완료 (1시간 간격)');
}
