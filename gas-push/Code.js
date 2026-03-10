/**
 * p7_gas.js — 이카운트 ↔ 카페24 가격 자동 동기화 (Google Apps Script)
 * ================================================================
 *
 * 구글 시트 ID: 1_T_pl2ItqfmdAsDmrjkg1BBZyQMAVXkUrPMEwhGI6ek
 *
 * ■ 시트 구조
 *   [설정]       A열: 키, B열: 값
 *   [매핑테이블] A: PROD_CD | B: product_no | C: variant_code | D: 이전가격 | E: 메모
 *   [실행로그]   A: 실행시각 | B: 업데이트 | C: 스킵 | D: 오류 | E: 상세로그
 *
 * ■ 실행 순서 (syncPrices)
 *   Step 1. [설정] 시트에서 인증 정보 로드
 *   Step 2. 이카운트 API로 OUT_PRICE2 조회
 *   Step 3. [매핑테이블] 이전 가격과 비교
 *   Step 4. 가격 변동 품목만 카페24 PUT 호출
 *   Step 5. [실행로그]에 결과 기록
 */

// ════════════════════════════════════════════════════════
// ■ 상수 정의
// ════════════════════════════════════════════════════════

// 독립형 프로젝트용 스프레드시트 ID (시트에서 직접 열면 자동 감지)
const SPREADSHEET_ID = '1_T_pl2ItqfmdAsDmrjkg1BBZyQMAVXkUrPMEwhGI6ek';

// [설정] 시트의 A열 키 목록 — 시트 실제 값과 정확히 일치해야 함
const KEY = {
    EC_COM_CODE: 'COM_CODE',            // 이카운트 회사 코드
    EC_USER_ID: 'USER_ID',             // 이카운트 사용자 ID
    EC_CERT_KEY: 'API_CERT_KEY',        // 이카운트 API 인증키
    EC_ZONE: 'ZONE',               // 이카운트 Zone (예: AB)
    EC_ZONE_URL: 'ECOUNT_ZONE_URL',    // Zone 서버 URL (행 15)
    EC_PRICE_FIELD: 'ECOUNT_PRICE_FIELD', // 가격 필드 (행 17)
    C24_MALL_ID: 'CAFE24_MALL_ID',     // 카페24 몰 ID (행 7)
    C24_CLIENT_ID: 'CAFE24_CLIENT_ID',
    C24_CLIENT_SECRET: 'CAFE24_CLIENT_SECRET',
    C24_ACCESS_TOKEN: 'CAFE24_ACCESS_TOKEN',
    C24_REFRESH_TOKEN: 'CAFE24_REFRESH_TOKEN',
    C24_API_VERSION: 'CAFE24_API_VERSION',
    DRY_RUN: 'DRY_RUN',            // 행 16 (FALSE = 실제 업데이트)
};

// 시트 이름
const SH = { CONFIG: '설정', MAPPING: '매핑테이블', LOG: '실행로그' };

// 열 인덱스 (0-based)
const MAP_COL = { PROD_CD: 0, PRODUCT_NO: 1, VARIANT_CODE: 2, LAST_PRICE: 3, MEMO: 4 };


// ════════════════════════════════════════════════════════
// ■ 메인 함수 — 60분 트리거에 등록
// ════════════════════════════════════════════════════════

function syncPrices() {
    const start = new Date();
    const logs = [];
    let ss, updated = 0, skipped = 0, errors = 0;

    try {
        // ── Step 1. 스프레드시트 + 설정 로드 ─────────────────
        ss = getSpreadsheet();
        Logger.log('Step1: 스프레드시트 연결 성공');
        const cfg = readConfig(ss);
        Logger.log('Step1: 설정 로드 완료 | DRY_RUN=' + cfg[KEY.DRY_RUN]);
        logs.push(`[${now()}] Step1: 설정 로드 완료 | DRY_RUN=${cfg[KEY.DRY_RUN]}`);

        // ── Step 2. 이카운트 가격 조회 ─────────────────────
        Logger.log('Step2: 이카운트 로그인 시도...');
        const sessionId = ecLogin(cfg);
        Logger.log('Step2: 이카운트 로그인 성공. SESSION_ID=' + sessionId.substring(0, 8) + '...');
        logs.push(`[${now()}] Step2: 이카운트 로그인 성공`);

        const ecPrices = fetchEcountPrices(cfg, sessionId);
        const priceCount = Object.keys(ecPrices).length;
        Logger.log('Step2: 가격 조회 완료. ' + priceCount + '건');
        logs.push(`[${now()}] Step2: 가격 조회 완료 → ${priceCount}건`);

        // ── Step 3. 카페24 토큰 + 매핑테이블 ───────────────
        Logger.log('Step3: 카페24 토큰 확보 중...');
        const token = ensureCafe24Token(cfg, ss);
        Logger.log('Step3: 토큰 확보 완료. token=' + token.substring(0, 6) + '...');

        const mapping = readMapping(ss);
        Logger.log('Step3: 매핑테이블 ' + mapping.length + '건 로드');
        logs.push(`[${now()}] Step3: 매핑테이블 ${mapping.length}건 로드`);

        // ── Step 4. 가격 비교 → 변동 품목만 업데이트 ───────
        for (const row of mapping) {
            const { prodCd, productNo, variantCode, lastPrice, rowIdx } = row;

            if (!prodCd || !productNo || !variantCode) { skipped++; continue; }

            const newPrice = ecPrices[prodCd];
            if (newPrice === undefined || newPrice === null) {
                Logger.log('스킵(가격없음): ' + prodCd);
                skipped++;
                continue;
            }

            if (Math.round(newPrice) === Math.round(Number(lastPrice))) {
                Logger.log('스킵(변동없음): ' + prodCd + ' 가격=' + newPrice);
                skipped++;
                continue;
            }

            Logger.log('변동감지: ' + prodCd + ' | ' + lastPrice + ' → ' + newPrice);
            logs.push(`[${now()}] 변동감지 [${prodCd}] ${lastPrice} → ${newPrice}`);

            if (cfg[KEY.DRY_RUN] === 'true') {
                logs.push(`  └ DRY_RUN: 업데이트 생략`);
                Logger.log('  DRY_RUN: 실제 업데이트 건너뜀');
                updated++;
                continue;
            }

            const res = cafe24UpdateVariant(cfg, token, productNo, variantCode, newPrice);
            Logger.log('카페24 PUT 결과: ' + res.status + ' | ' + res.body.substring(0, 100));
            if (res.ok) {
                setMappingLastPrice(ss, rowIdx, newPrice);
                updated++;
                logs.push(`  └ 성공 (${res.status})`);
            } else {
                errors++;
                logs.push(`  └ 실패 (${res.status}): ${res.body}`);
            }

            Utilities.sleep(1000);
        }

    } catch (e) {
        errors++;
        Logger.log('오류 발생: ' + e.message + '\n' + (e.stack || ''));
        logs.push(`[${now()}] 오류: ${e.message}`);
        logs.push(e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : '');
    }

    // ── Step 5. 실행로그 기록 (ss가 없어도 Logger에는 기록) ─
    const elapsed = ((new Date() - start) / 1000).toFixed(1);
    const summary = `[${now()}] 완료 — 업데이트:${updated} 스킵:${skipped} 오류:${errors} (${elapsed}s)`;
    logs.push(summary);
    Logger.log(summary);

    if (ss) {
        writeLog(ss, start, updated, skipped, errors, logs.join('\n'));
        Logger.log('Step5: 실행로그 기록 완료');
    } else {
        Logger.log('Step5: ss가 없어 실행로그 기록 불가');
    }
}

/**
 * 자동 트리거 생성 (60분 간격)
 */
function createTrigger() {
    // 기존 트리거 삭제 (중복 방지)
    const triggers = ScriptApp.getProjectTriggers();
    for (const t of triggers) {
        if (t.getHandlerFunction() === 'syncPrices') {
            ScriptApp.deleteTrigger(t);
        }
    }

    // 60분 간격 트리거 생성
    ScriptApp.newTrigger('syncPrices')
        .timeBased()
        .everyHours(1)
        .create();

    Logger.log('✅ syncPrices 매 60분 자동 트리거가 생성되었습니다.');
}


// ════════════════════════════════════════════════════════
// ■ 이카운트 API
// ════════════════════════════════════════════════════════

/** Zone에 로그인 → SESSION_ID 반환 */
function ecLogin(cfg) {
    const zone = cfg[KEY.EC_ZONE];
    const baseUrl = cfg[KEY.EC_ZONE_URL]; // 예: https://sboapi.ecount.com
    // ⛔ 중요: Ecount v2는 subdomain에 ZONE이 포함되어야 함 (예: https://sboapiAB.ecount.com)
    const finalUrl = baseUrl.replace(/(sboapi|oapi)/, "$1" + zone) + '/OAPI/V2/OAPILogin';

    const payload = {
        COM_CODE: cfg[KEY.EC_COM_CODE],
        USER_ID: cfg[KEY.EC_USER_ID],
        API_CERT_KEY: cfg[KEY.EC_CERT_KEY],
        LAN_TYPE: 'ko-KR',
        ZONE: zone,
    };
    Logger.log('이카운트 로그인 시도 URL: ' + finalUrl);
    Logger.log('이카운트 로그인 Payload: ' + JSON.stringify(payload));
    const res = post(finalUrl, payload);
    const sid = res?.Data?.Datas?.SESSION_ID || res?.Data?.SESSION_ID;
    if (!sid) throw new Error(`이카운트 로그인 실패: ${JSON.stringify(res)}`);
    return sid;
}

/**
 * 품목 목록 조회 → { PROD_CD: price } 반환
 * 필터: PROD_CD에 (1) 포함 AND PROD_DES에 ◈ 포함
 */
function fetchEcountPrices(cfg, sessionId) {
    const zone = cfg[KEY.EC_ZONE];
    const baseUrl = cfg[KEY.EC_ZONE_URL];
    const priceField = cfg[KEY.EC_PRICE_FIELD] || 'OUT_PRICE2';
    const finalUrl = baseUrl.replace(/(sboapi|oapi)/, "$1" + zone) + `/OAPI/V2/InventoryBasic/GetBasicProductsList?SESSION_ID=${sessionId}`;

    Logger.log('이카운트 가격 조회 URL: ' + finalUrl);
    const res = post(finalUrl, {});

    const items = res?.Data?.Result ?? [];
    const map = {};

    for (const item of items) {
        const cd = String(item.PROD_CD || '');
        const des = String(item.PROD_DES || '');
        if (cd.includes('(1)') && des.includes('◈')) {
            const raw = String(item[priceField] || '0').replace(/,/g, '');
            map[cd] = parseFloat(raw) || 0;
        }
    }
    return map;
}


// ════════════════════════════════════════════════════════
// ■ 카페24 API
// ════════════════════════════════════════════════════════

/** Access Token 유효 반환 (필요 시 refresh 후 시트 갱신) */
function ensureCafe24Token(cfg, ss) {
    try {
        Logger.log('카페24 토큰 갱신 시도...');
        const res = refreshCafe24Token(cfg);
        Logger.log('카페24 토큰 갱신 성공. 새 Access Token 저장 중...');
        setConfig(ss, KEY.C24_ACCESS_TOKEN, res.access_token);
        if (res.refresh_token) {
            setConfig(ss, KEY.C24_REFRESH_TOKEN, res.refresh_token);
        }
        return res.access_token;
    } catch (e) {
        Logger.log('⚠️ 카페24 토큰 갱신 실패 (기존 토큰 시도): ' + e.message);
        return cfg[KEY.C24_ACCESS_TOKEN];
    }
}

/** Refresh Token으로 Access Token 갱신 */
function refreshCafe24Token(cfg) {
    const mallId = cfg[KEY.C24_MALL_ID];
    const creds = Utilities.base64Encode(`${cfg[KEY.C24_CLIENT_ID]}:${cfg[KEY.C24_CLIENT_SECRET]}`);
    const res = UrlFetchApp.fetch(
        `https://${mallId}.cafe24api.com/api/v2/oauth/token`,
        {
            method: 'POST',
            headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            payload: `grant_type=refresh_token&refresh_token=${cfg[KEY.C24_REFRESH_TOKEN]}`,
            muteHttpExceptions: true,
        }
    );
    if (res.getResponseCode() !== 200)
        throw new Error(`Token refresh 실패: ${res.getContentText()}`);
    return JSON.parse(res.getContentText());
}

/**
 * 카페24 품목 가격 업데이트
 * PUT /api/v2/admin/products/{product_no}/variants/{variant_code}
 */
function cafe24UpdateVariant(cfg, token, productNo, variantCode, price) {
    const mallId = cfg[KEY.C24_MALL_ID];
    const apiVer = cfg[KEY.C24_API_VERSION] || '2025-12-01';
    const url = `https://${mallId}.cafe24api.com/api/v2/admin/products/${productNo}/variants/${variantCode}`;
    const res = UrlFetchApp.fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Cafe24-Api-Version': apiVer,
        },
        payload: JSON.stringify({ shop_no: 1, request: { additional_amount: Math.round(price) } }),
        muteHttpExceptions: true,
    });
    return {
        ok: res.getResponseCode() === 200,
        status: res.getResponseCode(),
        body: res.getContentText().substring(0, 200),
    };
}


// ════════════════════════════════════════════════════════
// ■ 구글 시트 헬퍼
// ════════════════════════════════════════════════════════

/** 스프레드시트 객체 반환 (컨테이너/독립형 모두 지원) */
function getSpreadsheet() {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID 또는 컨테이너 연결이 필요합니다.');
    return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/** [설정] 시트 → { key: value } 맵 반환 */
function readConfig(ss) {
    const sheet = ss.getSheetByName(SH.CONFIG);
    if (!sheet) throw new Error(`[${SH.CONFIG}] 시트 없음`);
    const rows = sheet.getDataRange().getValues();
    const cfg = {};
    rows.forEach(r => { if (r[0]) cfg[String(r[0]).trim()] = String(r[1] || '').trim(); });
    return cfg;
}

/** [설정] 시트에서 특정 키의 값 업데이트 */
function setConfig(ss, key, value) {
    const sheet = ss.getSheetByName(SH.CONFIG);
    if (!sheet) return;
    const rows = sheet.getDataRange().getValues();
    for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === key) {
            sheet.getRange(i + 1, 2).setValue(value);
            return;
        }
    }
}

/** [매핑테이블] 시트 로드 (2행부터) */
function readMapping(ss) {
    const sheet = ss.getSheetByName(SH.MAPPING);
    if (!sheet) throw new Error(`[${SH.MAPPING}] 시트 없음`);
    const rows = sheet.getDataRange().getValues();
    const result = [];
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[MAP_COL.PROD_CD]) continue;
        result.push({
            rowIdx: i + 1,
            prodCd: String(r[MAP_COL.PROD_CD] || '').trim(),
            productNo: String(r[MAP_COL.PRODUCT_NO] || '').trim(),
            variantCode: String(r[MAP_COL.VARIANT_CODE] || '').trim(),
            lastPrice: r[MAP_COL.LAST_PRICE],
            memo: r[MAP_COL.MEMO] || '',
        });
    }
    return result;
}

/** [매핑테이블] 이전가격(D열) 갱신 */
function setMappingLastPrice(ss, rowIdx, price) {
    ss.getSheetByName(SH.MAPPING).getRange(rowIdx, MAP_COL.LAST_PRICE + 1).setValue(price);
}

/** [실행로그] 한 행 추가 */
function writeLog(ss, startTime, updated, skipped, errors, detail) {
    try {
        const sheet = ss.getSheetByName(SH.LOG);
        if (!sheet) {
            Logger.log('writeLog 오류: [' + SH.LOG + '] 시트를 찾을 수 없음. 실제 시트명을 확인하세요.');
            return;
        }
        sheet.appendRow([
            Utilities.formatDate(startTime, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
            updated, skipped, errors, detail,
        ]);
        Logger.log('writeLog: 로그 행 추가 완료');
    } catch (e) {
        Logger.log('writeLog 실패: ' + e.message);
    }
}

/** 진단용: 시트 접근 및 설정값 확인 (GAS에서 직접 실행) */
function diagnose() {
    try {
        const ss = getSpreadsheet();
        Logger.log('스프레드시트 연결: 성공 → ' + ss.getName());

        // 시트 존재 여부 확인
        [SH.CONFIG, SH.MAPPING, SH.LOG].forEach(name => {
            const sh = ss.getSheetByName(name);
            Logger.log('[' + name + '] 시트: ' + (sh ? '존재 (' + sh.getLastRow() + '행)' : '⚠️ 없음!'));
        });

        // 설정값 확인
        const cfg = readConfig(ss);
        Logger.log('CAFE24_MALL_ID: ' + cfg[KEY.C24_MALL_ID]);
        Logger.log('ECOUNT_ZONE_URL: ' + cfg[KEY.EC_ZONE_URL]);
        Logger.log('DRY_RUN: ' + cfg[KEY.DRY_RUN]);
        Logger.log('ACCESS_TOKEN(앞6): ' + (cfg[KEY.C24_ACCESS_TOKEN] || '').substring(0, 6));

        // 매핑테이블 행 수
        const mapping = readMapping(ss);
        Logger.log('매핑테이블 데이터: ' + mapping.length + '건');
        SpreadsheetApp.getUi().alert('진단 완료! GAS 에디터 → 실행 로그를 확인하세요.');
    } catch (e) {
        Logger.log('진단 오류: ' + e.message);
        SpreadsheetApp.getUi().alert('오류: ' + e.message);
    }
}

/** 현재 시각 HH:mm:ss 반환 */
function now() {
    return Utilities.formatDate(new Date(), 'Asia/Seoul', 'HH:mm:ss');
}

/** JSON POST 헬퍼 */
function post(url, body) {
    const res = UrlFetchApp.fetch(url, {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify(body),
        muteHttpExceptions: true,
    });
    try { return JSON.parse(res.getContentText()); } catch (_) { return null; }
}


// ════════════════════════════════════════════════════════
// ■ 트리거 / 메뉴 설정
// ════════════════════════════════════════════════════════

/** 60분 트리거 등록 (1회 실행) */
function createHourlyTrigger() {
    ScriptApp.getProjectTriggers()
        .filter(t => t.getHandlerFunction() === 'syncPrices')
        .forEach(t => ScriptApp.deleteTrigger(t));

    ScriptApp.newTrigger('syncPrices').timeBased().everyHours(1).create();
    SpreadsheetApp.getUi().alert('✅ 60분 트리거 등록 완료!\nsyncPrices()가 1시간마다 자동 실행됩니다.');
}

/** 스프레드시트 열 때 커스텀 메뉴 표시 */
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('⚙️ ERP 동기화')
        .addItem('▶️ 지금 동기화 실행', 'syncPrices')
        .addItem('🔍 진단 실행', 'diagnose')
        .addItem('⏰ 60분 자동 트리거 등록', 'createHourlyTrigger')
        .addToUi();
}


// ════════════════════════════════════════════════════════
// ■ 초기화: 시트 구조 자동 생성 (최초 1회)
// ════════════════════════════════════════════════════════

function initSheets() {
    const ss = getSpreadsheet();

    // [설정] 시트
    let cfg = ss.getSheetByName(SH.CONFIG) || ss.insertSheet(SH.CONFIG);
    if (cfg.getLastRow() === 0) {
        const rows = [
            ['항목', '값', '설명'],
            [KEY.EC_COM_CODE, '650217', '이카운트 회사 코드'],
            [KEY.EC_USER_ID, 'zartkang', '이카운트 사용자 ID'],
            [KEY.EC_CERT_KEY, '55f919e986cb444ed8ae25dc46705a3cc7', '이카운트 API 인증키'],
            [KEY.EC_ZONE, 'AB', '이카운트 Zone'],
            [KEY.EC_ZONE_URL, 'https://sboapi1.ecount.com', '이카운트 Zone 서버 URL'],
            [KEY.EC_PRICE_FIELD, 'OUT_PRICE2', '가격 필드 (OUT_PRICE1~3)'],
            [KEY.C24_MALL_ID, 'daesan3833', '카페24 몰 ID'],
            [KEY.C24_CLIENT_ID, '5TbJGxFqFBOtlYEXoWL47D', '카페24 Client ID'],
            [KEY.C24_CLIENT_SECRET, 'GIYib6feK0vCm4mevXpf7i', '카페24 Client Secret'],
            [KEY.C24_ACCESS_TOKEN, 'jPApMZNsBJ2gkyk1wGhYAC', '카페24 Access Token (자동갱신)'],
            [KEY.C24_REFRESH_TOKEN, '8OAeMYMXbi2BxzgxctXaFH', '카페24 Refresh Token'],
            [KEY.C24_API_VERSION, '2025-12-01', 'Cafe24 API 버전'],
            [KEY.DRY_RUN, 'false', 'true=로그만, 실제 업데이트 없음'],
        ];
        cfg.getRange(1, 1, rows.length, 3).setValues(rows);
        cfg.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#1a73e8').setFontColor('#fff');
        [200, 300, 250].forEach((w, i) => cfg.setColumnWidth(i + 1, w));
    }

    // [매핑테이블] 시트
    let map = ss.getSheetByName(SH.MAPPING) || ss.insertSheet(SH.MAPPING);
    if (map.getLastRow() === 0) {
        map.getRange(1, 1, 1, 5).setValues([['PROD_CD (이카운트)', 'product_no (카페24)', 'variant_code (카페24)', '이전가격 (자동)', '메모']]);
        map.getRange(2, 1, 2, 5).setValues([
            ['(1)800플로3', '1864', 'P0000CTS000A', '', '풀로베니아 보양재 3T x 900 x 1800'],
            ['(1)800골판지', '1864', 'P0000CTS000B', '', '골판지 종이 보양지'],
        ]);
        map.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#34a853').setFontColor('#fff');
        [200, 140, 190, 120, 250].forEach((w, i) => map.setColumnWidth(i + 1, w));
    }

    // [실행로그] 시트
    let log = ss.getSheetByName(SH.LOG) || ss.insertSheet(SH.LOG);
    if (log.getLastRow() === 0) {
        log.getRange(1, 1, 1, 5).setValues([['실행시각', '업데이트', '스킵', '오류', '상세로그']]);
        log.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#ea4335').setFontColor('#fff');
        [160, 80, 80, 80, 600].forEach((w, i) => log.setColumnWidth(i + 1, w));
    }

    SpreadsheetApp.getUi().alert(
        '✅ 시트 초기화 완료!\n\n' +
        '다음 단계:\n' +
        '1. [설정] 시트의 이카운트/카페24 정보를 확인하세요.\n' +
        '2. [매핑테이블]에 동기화할 품목을 추가하세요.\n' +
        '3. ⚙️ ERP 동기화 > 지금 동기화 실행을 눌러 테스트하세요.'
    );
}
