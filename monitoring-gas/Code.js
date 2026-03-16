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
  checkProducts(dashboard);
  checkSyncProducts(dashboard, snapshotData);
  checkPrices(dashboard);
  checkVercel(dashboard);

  SpreadsheetApp.getUi().alert('✅ 모든 체크가 완료되었습니다.');
}

function checkCafe24Token(sheet) {
  try {
    const response = UrlFetchApp.fetch(BASE_URL + '/api/cron/check-token-expiry');
    const data = JSON.parse(response.getContentText());
    const daysLeft = data.daysLeft;
    const expiresAt = data.expiresAt;
    let status = '🟢정상';
    if (daysLeft <= 0) status = '🔴만료';
    else if (daysLeft <= 7) status = '🟡D-7경고';
    updateDashboard(sheet, 2, 'Cafe24 Access Token', status, "만료: " + expiresAt, '[갱신]');
    updateDashboard(sheet, 3, 'Cafe24 Refresh Token', status, "D-" + daysLeft + " 남음", '[재인증URL]');
    if (status !== '🟢정상') {
      sendAlert("⚠️ [웹카달로그] 토큰 만료 위험 (" + status + ")", "토큰이 " + daysLeft + "일 후 만료됩니다. 즉시 확인하세요.\n만료일: " + expiresAt);
    }
    logResult('Cafe24 Token', status, "Days left: " + daysLeft);
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

function checkProducts(sheet) {
  try {
    const response = UrlFetchApp.fetch(BASE_URL + '/api/products');
    const data = JSON.parse(response.getContentText());
    const count = data.products ? data.products.length : 0;
    const status = count > 0 ? '🟢정상' : '🔴오류';
    updateDashboard(sheet, 5, '/api/products', status, "상품수: " + count, '-');
    logResult('Products API', status, "Count: " + count);
  } catch (e) {
    updateDashboard(sheet, 5, '/api/products', '🔴오류', e.message);
    logResult('Products API', '🔴오류', e.message);
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

function checkPrices(sheet) {
  try {
    const response = UrlFetchApp.fetch(BASE_URL + '/api/prices');
    const data = JSON.parse(response.getContentText());
    const count = Object.keys(data || {}).length;
    const status = count > 0 ? '🟢정상' : '🔴오류';
    updateDashboard(sheet, 7, '가격데이터', status, "항목수: " + count, '[갱신]');
    logResult('Price Data', status, "Count: " + count);
  } catch (e) {
    updateDashboard(sheet, 7, '가격데이터', '🔴오류', e.message);
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

function refreshTokens() {
  const response = UrlFetchApp.fetch(BASE_URL + '/api/init-tokens', { method: 'post' });
  SpreadsheetApp.getUi().alert('토큰 초기화 응답: ' + response.getContentText());
  checkAll();
}

function syncProducts() {
  const response = UrlFetchApp.fetch(BASE_URL + '/api/sync-products');
  SpreadsheetApp.getUi().alert('동기화 시작 응답: ' + response.getContentText());
  checkAll();
}

function refreshPrices() {
  const response = UrlFetchApp.fetch(BASE_URL + '/api/prices?refresh=true');
  SpreadsheetApp.getUi().alert('가격 갱신 응답: ' + response.getContentText());
  checkAll();
}

function openReauthUrl() {
  const clientId = '5TbJGxFqFBOtlYEXoWL47D'; 
  const url = 'https://daesan3833.cafe24api.com/api/v2/oauth/authorize?response_type=code&client_id=' + clientId + '&redirect_uri=https://web-cadalog-ver10.vercel.app/api/auth/callback&scope=mall.read_product,mall.write_product';
  const html = '<script>window.open("' + url + '", "_blank");google.script.host.close();</script>';
  const userInterface = HtmlService.createHtmlOutput(html).setWidth(200).setHeight(100);
  SpreadsheetApp.getUi().showModalDialog(userInterface, '재인증 페이지로 이동 중...');
}
