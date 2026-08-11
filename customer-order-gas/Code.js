function doPost(e) {
    try {
        const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
        const items = Array.isArray(payload.items) ? payload.items : null;

        if (!items || items.length === 0) {
            throw new Error('items 배열이 필요합니다.');
        }

        const sourceSs = SpreadsheetApp.openById('1_T_pl2ItqfmdAsDmrjkg1BBZyQMAVXkUrPMEwhGI6ek');
        const sourceSh = sourceSs.getSheetByName('카페24상품');
        if (!sourceSh) {
            throw new Error('[카페24상품] 시트를 찾을 수 없습니다.');
        }

        const sourceRows = sourceSh.getDataRange().getValues();
        const prodCodeMap = {};

        for (let i = 1; i < sourceRows.length; i++) {
            const customVariantCode = String(sourceRows[i][3] || '').trim(); // D열
            if (!customVariantCode) continue;
            prodCodeMap[customVariantCode] = customVariantCode;
        }

        const orderSs = SpreadsheetApp.openById('1oQN0oApCGHSMHGYf_1gIpF-5dG8ETSsqrx-eAlz394k');
        const orderSh = orderSs.getSheetByName('시트1');
        if (!orderSh) {
            throw new Error('[시트1]을 찾을 수 없습니다.');
        }

        const requestDate = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
        const rows = items.map((item, index) => {
            const customVariantCode = String(item.custom_variant_code || '').trim();
            const qty = Number(item.qty);
            const price = Number(item.price);

            if (!customVariantCode) {
                throw new Error((index + 1) + '번째 항목 custom_variant_code가 비어 있습니다.');
            }
            if (!Number.isFinite(qty)) {
                throw new Error((index + 1) + '번째 항목 qty가 올바르지 않습니다.');
            }
            if (!Number.isFinite(price)) {
                throw new Error((index + 1) + '번째 항목 price가 올바르지 않습니다.');
            }

            const prodCd = prodCodeMap[customVariantCode];
            if (!prodCd) {
                throw new Error('매핑 없음: ' + customVariantCode);
            }

            const row = new Array(28).fill('');
            row[2] = requestDate; // C
            row[4] = '안양'; // E
            row[6] = '두현숙'; // G
            row[23] = prodCd; // X
            row[26] = qty; // AA
            row[27] = price; // AB
            return row;
        });

        const startRow = orderSh.getLastRow() + 1;
        orderSh.getRange(startRow, 1, rows.length, 28).setValues(rows);

        return ContentService
            .createTextOutput(JSON.stringify({ result: 'ok' }))
            .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        return ContentService
            .createTextOutput(JSON.stringify({
                result: 'error',
                message: error && error.message ? error.message : String(error),
            }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

function doGet(e) {
  Logger.log('doGet 시작');
  Logger.log('e: ' + JSON.stringify(e));
  return doPost(e);
}

function doPost(e) {
  Logger.log('doPost 시작');
  Logger.log('e: ' + JSON.stringify(e));
  
  try {
    var contents = '';
    if (e && e.postData && e.postData.contents) {
      contents = e.postData.contents;
    } else if (e && e.parameter && e.parameter.items) {
      contents = JSON.stringify({ items: JSON.parse(e.parameter.items) });
    } else {
      Logger.log('입력값 없음');
      return ContentService.createTextOutput(
        JSON.stringify({ result: 'error', message: '입력값 없음' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    Logger.log('contents: ' + contents);
    var parsed = JSON.parse(contents);
    var items = parsed.items;
    Logger.log('items: ' + JSON.stringify(items));
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('시트1');
    
    if (!sheet) {
      Logger.log('시트1 없음');
      return ContentService.createTextOutput(
        JSON.stringify({ result: 'error', message: '시트1 없음' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var row = new Array(28).fill('');
      row[2] = today;
      row[4] = '안양';
      row[6] = '두현숙';
      row[23] = item.product_code || '';
      row[26] = item.quantity || '';
      row[27] = item.price || '';
      sheet.appendRow(row);
      Logger.log('행 추가: ' + JSON.stringify(row));
    }
    
    return ContentService.createTextOutput(
      JSON.stringify({ result: 'ok' })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    Logger.log('오류: ' + err.toString());
    return ContentService.createTextOutput(
      JSON.stringify({ result: 'error', message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
function notifyNewOrder(e) {
  try {
    const ss = SpreadsheetApp.openById(
      '1oQN0oApCGHSMHGYf_1gIpF-5dG8ETSsqrx-eAlz394k'
    );
    const sheet = ss.getSheetByName('시트1');
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 1) return;

    const data = sheet.getRange(lastRow, 1, 1, 39).getValues()[0];
    const name = data[0];
    const phone = data[1];
    const message = data[2];
    const date = data[5];
    const prodName = data[26];
    const qty = data[29];
    const price = data[30];

    GmailApp.sendEmail(
      'zartkang@gmail.com',
      '[웹카탈로그] 새 견적 요청',
      `고객명: ${name}\n연락처: ${phone}\n요청사항: ${message}\n\n품목: ${prodName}\n수량: ${qty}\n단가: ${price}\n\n요청일: ${date}`
    );
  } catch(err) {
    console.error(err);
  }
}

// ✅ N열 "3일" 자동 기록 함수
function onChangeAutoFill(e) {
  var ss = SpreadsheetApp.openById("1oQN0oApCGHSMHGYf_1gIpF-5dG8ETSsqrx-eAlz394k");
  var sheet = ss.getSheetByName("시트1");
  
  var lastRow = sheet.getLastRow();
  
  // 2행부터 시작 (1행은 헤더)
  for (var i = 2; i <= lastRow; i++) {
    var aCell = sheet.getRange(i, 1).getValue();  // A열 (이름)
    var nCell = sheet.getRange(i, 14).getValue(); // N열 (견적유효기간)
    
    // A열에 데이터 있고, N열이 비어있으면 "3일" 기록
    if (aCell !== "" && nCell === "") {
      sheet.getRange(i, 14).setValue("3일");
    }
  }
}
