const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const code = fs.readFileSync(require('path').join(__dirname, '..', 'Code.js'), 'utf8');

function runBuild(existingRows, apiProducts) {
  const writes = [];
  const sheet = {
    getDataRange: () => ({ getValues: () => existingRows.map(row => row.slice()) }),
    clearContents: () => writes.push({ type: 'clear' }),
    getRange: (row, column, rowCount, columnCount) => ({
      setValues: values => writes.push({ type: 'set', row, column, rowCount, columnCount, values }),
    }),
    getLastRow: () => {
      const setWrites = writes.filter(write => write.type === 'set');
      if (writes.some(write => write.type === 'clear')) {
        return setWrites.reduce((last, write) => Math.max(last, write.row + write.values.length - 1), 0);
      }
      return setWrites.reduce((last, write) => Math.max(last, write.row + write.values.length - 1), existingRows.length);
    },
  };
  const configSheet = {
    getDataRange: () => ({ getValues: () => [
      ['CAFE24_MALL_ID', 'mall'],
      ['CAFE24_API_VERSION', 'v'],
      ['CAFE24_ACCESS_TOKEN', 'token'],
    ] }),
  };
  const spreadsheet = { getSheetByName: name => name === '카페24상품' ? sheet : configSheet };
  const context = {
    console,
    Logger: { log() {} },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      openById: () => spreadsheet,
    },
    readConfig: () => ({ CAFE24_MALL_ID: 'mall', CAFE24_API_VERSION: 'v' }),
    initMonitoringSheet_: () => {},
    checkMonitoringTokenState_: () => {},
    resolveExecutionSource_: () => 'TEST',
    scheduleSyncPricesOnce_: () => {},
    fetchCafe24ProductsPage_: (_mall, _version, offset) => offset === 0 ? apiProducts : [],
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  context.initMonitoringSheet_ = () => {};
  context.checkMonitoringTokenState_ = () => {};
  context.resolveExecutionSource_ = () => 'TEST';
  context.scheduleSyncPricesOnce_ = () => {};
  context.fetchCafe24ProductsPage_ = (_mall, _version, offset) => offset === 0 ? apiProducts : [];
  context.buildCafe24Cache();
  return writes;
}

function finalRows(existingRows, writes) {
  let rows = existingRows.map(row => row.slice());
  for (const write of writes) {
    if (write.type === 'clear') rows = [];
    if (write.type === 'set') {
      write.values.forEach((row, index) => { rows[write.row - 1 + index] = row.slice(); });
    }
  }
  return JSON.parse(JSON.stringify(rows.filter(Boolean)));
}

const header = ['product_no', 'product_code', 'product_name', 'custom_variant_code', 'variant_code', 'additional_amount'];

function product(productNo, productCode, productName, variants) {
  return { product_no: productNo, product_code: productCode, product_name: productName, variants };
}

function variant(customCode, variantCode, price) {
  return { custom_variant_code: customCode, variant_code: variantCode, additional_amount: price };
}

function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}\n${error.stack}`); process.exitCode = 1; }
}

test('unchanged API input preserves the complete row set', () => {
  const existing = [header, ['784', 'P0000BEE', '일반합판', 'CODE', 'VAR-G', 18920]];
  const api = [product('784', 'P0000BEE', '일반합판', [variant('CODE', 'VAR-G', 18920)])];
  assert.deepStrictEqual(finalRows(existing, runBuild(existing, api)), existing);
});

test('a changed variant code replaces the stale row', () => {
  const existing = [header, ['784', 'P0000BEE', '일반합판', 'CODE', 'VAR-E', 18920]];
  const api = [product('784', 'P0000BEE', '일반합판', [variant('CODE', 'VAR-G', 18920)])];
  assert.deepStrictEqual(finalRows(existing, runBuild(existing, api)), [header, ['784', 'P0000BEE', '일반합판', 'CODE', 'VAR-G', 18920]]);
});

test('a changed product number replaces the old mapping', () => {
  const existing = [header, ['784', 'P', '이름', 'CODE', 'VAR-G', 100]];
  const api = [product('1891', 'P', '이름', [variant('CODE', 'VAR-G', 100)])];
  assert.deepStrictEqual(finalRows(existing, runBuild(existing, api)), [header, ['1891', 'P', '이름', 'CODE', 'VAR-G', 100]]);
});

test('a changed product code updates the existing row', () => {
  const existing = [header, ['784', 'OLD', '이름', 'CODE', 'VAR-G', 100]];
  const api = [product('784', 'NEW', '이름', [variant('CODE', 'VAR-G', 100)])];
  assert.deepStrictEqual(finalRows(existing, runBuild(existing, api)), [header, ['784', 'NEW', '이름', 'CODE', 'VAR-G', 100]]);
});

test('a changed product name updates the existing row', () => {
  const existing = [header, ['784', 'P', '이전 이름', 'CODE', 'VAR-G', 100]];
  const api = [product('784', 'P', '새 이름', [variant('CODE', 'VAR-G', 100)])];
  assert.deepStrictEqual(finalRows(existing, runBuild(existing, api)), [header, ['784', 'P', '새 이름', 'CODE', 'VAR-G', 100]]);
});

test('a changed additional amount updates the existing row', () => {
  const existing = [header, ['784', 'P', '이름', 'CODE', 'VAR-G', 100]];
  const api = [product('784', 'P', '이름', [variant('CODE', 'VAR-G', 200)])];
  assert.deepStrictEqual(finalRows(existing, runBuild(existing, api)), [header, ['784', 'P', '이름', 'CODE', 'VAR-G', 200]]);
});

test('new and removed variants are added and deleted', () => {
  const existing = [header, ['1', 'P1', '삭제', 'OLD', 'V1', 10]];
  const api = [product('2', 'P2', '신규', [variant('NEW', 'V2', 20)])];
  assert.deepStrictEqual(finalRows(existing, runBuild(existing, api)), [header, ['2', 'P2', '신규', 'NEW', 'V2', 20]]);
});

test('duplicate custom codes on different product variants are all preserved', () => {
  const existing = [
    header,
    ['784', 'P0000BEE', '일반합판', 'CODE', 'BEE-G', 18920],
    ['1891', 'P0000CUT', '일반합판', 'CODE', 'CUT-E', 18920],
  ];
  const api = [
    product('784', 'P0000BEE', '일반합판', [variant('CODE', 'BEE-G', 18920)]),
    product('1891', 'P0000CUT', '일반합판', [variant('CODE', 'CUT-E', 18920)]),
  ];
  assert.deepStrictEqual(finalRows(existing, runBuild(existing, api)), existing);
});

test('existing Ecount description column is preserved during a rebuild', () => {
  const existing = [
    header.concat(['']),
    ['784', 'OLD', '이름', 'CODE', 'VAR-G', 100, 'Ecount 설명'],
  ];
  const api = [product('784', 'NEW', '이름', [variant('CODE', 'VAR-G', 100)])];
  assert.deepStrictEqual(finalRows(existing, runBuild(existing, api)), [
    header.concat(['']),
    ['784', 'NEW', '이름', 'CODE', 'VAR-G', 100, 'Ecount 설명'],
  ]);
});
