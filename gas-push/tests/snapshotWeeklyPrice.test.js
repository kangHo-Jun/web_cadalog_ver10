const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const code = fs.readFileSync(require('path').join(__dirname, '..', 'Code.js'), 'utf8');
const context = { console };
vm.createContext(context);
vm.runInContext(code, context);

function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}\n${error.stack}`); process.exitCode = 1; }
}

const runAt = new Date('2026-08-24T00:00:00.000Z');

function envelopeAtAgeHours(hours, matchedCount) {
  return {
    schemaVersion: 2,
    generatedAt: new Date(runAt.getTime() - hours * 60 * 60 * 1000).toISOString(),
    groups: {
      catalog: {
        id: 'catalog',
        parentName: 'Catalog',
        children: Array.from({ length: matchedCount }, (_, index) => ({
          name: `Product ${index + 1}`,
          price: 1100,
          productNo: index + 1,
          variantCode: `V${index + 1}`,
        })),
      },
    },
  };
}

function mappingRows(count) {
  return Array.from({ length: count }, (_, index) => ({
    prodCd: `P${index + 1}`,
    productName: `Product ${index + 1}`,
    stableKey: `${index + 1}:V${index + 1}`,
  }));
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('selects the last completed KST Monday-through-Sunday week across calendar boundaries', () => {
  const cases = [
    ['2026-08-23T15:10:00.000Z', '2026-08-17~08-23(일)'], // Monday 00:10 KST
    ['2026-08-23T03:00:00.000Z', '2026-08-10~08-16(일)'], // Sunday noon KST
    ['2026-01-04T15:10:00.000Z', '2025-12-29~01-04(일)'], // year boundary
    ['2024-03-03T15:10:00.000Z', '2024-02-26~03-03(일)'], // leap year
  ];

  for (const [runAt, expected] of cases) {
    assert.strictEqual(context.makeWeeklyPriceKey_(new Date(runAt)), expected);
  }
});

test('converts a VAT-inclusive catalog price to the rounded supply price', () => {
  assert.strictEqual(context.toSupplyPrice_(28380), 25800);
});

test('accepts a snapshot at the inclusive 24-hour and 95-percent trust boundaries', () => {
  const result = context.validateWeeklyEnvelope_(
    envelopeAtAgeHours(24, 95),
    mappingRows(100),
    runAt,
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.generatedAt, '2026-08-23T00:00:00.000Z');
  assert.strictEqual(result.ageMs, 86400000);
  assert.strictEqual(result.coveragePct, 95);
  assert.strictEqual(result.targetCount, 100);
  assert.strictEqual(result.matchedCount, 95);

  const exactlyFresh = context.validateWeeklyEnvelope_(
    envelopeAtAgeHours(0, 1),
    mappingRows(1),
    runAt,
  );
  assert.strictEqual(exactlyFresh.ok, true);
  assert.strictEqual(exactlyFresh.ageMs, 0);
});

test('rejects a snapshot even slightly older than 24 hours', () => {
  const result = context.validateWeeklyEnvelope_(
    envelopeAtAgeHours(24.0001, 1),
    mappingRows(1),
    runAt,
  );

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'STALE_SNAPSHOT');
  assert.strictEqual(result.targetCount, 1);
  assert.strictEqual(result.matchedCount, 1);
});

test('rejects 94.999-percent mapping coverage as below the inclusive threshold', () => {
  const result = context.validateWeeklyEnvelope_(
    envelopeAtAgeHours(1, 94999),
    mappingRows(100000),
    runAt,
  );

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'LOW_COVERAGE');
  assert.strictEqual(result.targetCount, 100000);
  assert.strictEqual(result.matchedCount, 94999);
});

test('rejects a missing generatedAt timestamp', () => {
  const envelope = envelopeAtAgeHours(1, 1);
  delete envelope.generatedAt;

  const result = context.validateWeeklyEnvelope_(envelope, mappingRows(1), runAt);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'INVALID_GENERATED_AT');
  assert.strictEqual(typeof result.message, 'string');
});

test('rejects a snapshot generated in the future', () => {
  const result = context.validateWeeklyEnvelope_(
    envelopeAtAgeHours(-0.0001, 1),
    mappingRows(1),
    runAt,
  );

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'FUTURE_SNAPSHOT');
});

test('rejects a non-v2 snapshot schema', () => {
  const envelope = envelopeAtAgeHours(1, 1);
  envelope.schemaVersion = 1;

  const result = context.validateWeeklyEnvelope_(envelope, mappingRows(1), runAt);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'INVALID_SCHEMA');
});

test('returns an explicit schema failure for malformed group children', () => {
  const envelope = envelopeAtAgeHours(1, 1);
  envelope.groups.catalog.children = null;
  let result;

  assert.doesNotThrow(() => {
    result = context.validateWeeklyEnvelope_(envelope, mappingRows(1), runAt);
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'INVALID_SCHEMA');
});

test('returns a coded schema failure when a child entry is null', () => {
  const envelope = envelopeAtAgeHours(1, 1);
  envelope.groups.catalog.children = [null];

  const result = context.validateWeeklyEnvelope_(envelope, mappingRows(1), runAt);

  assert.deepStrictEqual(plain(result), {
    ok: false,
    code: 'INVALID_SCHEMA',
    message: 'Catalog snapshot children must be objects.',
    targetCount: 1,
    matchedCount: 0,
  });
});

test('rejects duplicate stable keys anywhere in the snapshot', () => {
  const envelope = envelopeAtAgeHours(1, 1);
  envelope.groups.duplicate = {
    id: 'duplicate',
    parentName: 'Duplicate',
    children: [{ name: 'Other display name', price: 2200, productNo: 1, variantCode: 'V1' }],
  };

  const result = context.validateWeeklyEnvelope_(envelope, mappingRows(1), runAt);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'DUPLICATE_STABLE_KEY');
});

test('rejects non-positive and non-finite snapshot prices', () => {
  for (const invalidPrice of [0, -1, NaN, Infinity]) {
    const envelope = envelopeAtAgeHours(1, 1);
    envelope.groups.catalog.children[0].price = invalidPrice;

    const result = context.validateWeeklyEnvelope_(envelope, mappingRows(1), runAt);

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, 'INVALID_PRICE');
  }
});

test('rejects an empty valid mapping-key denominator', () => {
  const result = context.validateWeeklyEnvelope_(
    envelopeAtAgeHours(1, 1),
    [{ prodCd: 'NO-KEY' }, null, { stableKey: '   ' }],
    runAt,
  );

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'EMPTY_MAPPING');
  assert.strictEqual(result.targetCount, 0);
  assert.strictEqual(result.matchedCount, 0);
});

test('excludes invalid and duplicate mapping rows from coverage counts', () => {
  const rows = mappingRows(2);
  rows.push({ ...rows[0] }, { prodCd: 'MISSING-KEY' }, { prodCd: 'MALFORMED', stableKey: 'bad-key' });

  const result = context.validateWeeklyEnvelope_(envelopeAtAgeHours(1, 2), rows, runAt);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.targetCount, 2);
  assert.strictEqual(result.matchedCount, 2);
  assert.strictEqual(result.coveragePct, 100);
});

test('rejects snapshot children without a usable stable identity', () => {
  const malformedChildren = [
    { name: 'Missing product', price: 1100, variantCode: 'V1' },
    { name: 'Missing variant', price: 1100, productNo: 1 },
  ];

  for (const child of malformedChildren) {
    const envelope = envelopeAtAgeHours(1, 1);
    envelope.groups.catalog.children[0] = child;
    const result = context.validateWeeklyEnvelope_(envelope, mappingRows(1), runAt);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, 'INVALID_STABLE_KEY');
  }
});

test('classifies new, supplementable, completed, failed, and locked weekly snapshots at exact boundaries', () => {
  const firstWrittenAt = new Date('2026-08-23T00:00:00.000Z');
  const at24Hours = new Date('2026-08-24T00:00:00.000Z');
  const after24Hours = new Date('2026-08-24T00:00:00.001Z');
  const cases = [
    [{ existingState: null, targetCount: 20, missingCount: 0, runAt },
      { runResult: 'CREATED', snapshotState: 'CREATED_COMPLETE' }],
    [{ existingState: null, targetCount: 20, missingCount: 1, runAt },
      { runResult: 'CREATED', snapshotState: 'CREATED_PARTIAL' }],
    [{ existingState: null, targetCount: 100, missingCount: 6, runAt },
      { runResult: 'FAILED', snapshotState: null }],
    [{ existingState: 'CREATED_PARTIAL', firstWrittenAt, targetCount: 20, missingCount: 1, runAt: at24Hours },
      { runResult: 'SUPPLEMENTED', snapshotState: 'CREATED_PARTIAL' }],
    [{ existingState: 'CREATED_PARTIAL', firstWrittenAt, targetCount: 20, missingCount: 0, runAt: at24Hours },
      { runResult: 'SUPPLEMENTED', snapshotState: 'CREATED_COMPLETE' }],
    [{ existingState: 'CREATED_PARTIAL', firstWrittenAt, targetCount: 20, missingCount: 1, runAt: after24Hours },
      { runResult: 'SKIPPED', snapshotState: 'LOCKED_PARTIAL' }],
  ];

  for (const [input, expected] of cases) {
    assert.deepStrictEqual(plain(context.classifyWeeklySnapshotState_(input)), expected);
  }
});

test('projects rows by hidden stable key while preserving history and planning only safe writes', () => {
  const result = plain(context.projectWeeklyRows_({
    existingRows: [
      ['ENDED', 'Ended product', '9:V9'],
      ['P1', 'Old name', '1:V1'],
      ['P2', 'Shared name', '2:V2'],
    ],
    existingWeekValues: [900, 777, ''],
    mappingRows: [
      { prodCd: 'P1', productName: 'New name', stableKey: '1:V1' },
      { prodCd: 'P2', productName: 'Shared name', stableKey: '2:V2' },
      { prodCd: 'P3', productName: 'Shared name', stableKey: '3:V3' },
    ],
    pricesByKey: {
      '1:V1': 1100,
      '2:V2': 2200,
      '3:V3': 3300,
      'unrelated-key': 9999,
    },
  }));

  assert.deepStrictEqual(result.rows, [
    ['ENDED', 'Ended product', '9:V9'],
    ['P1', 'New name', '1:V1'],
    ['P2', 'Shared name', '2:V2'],
    ['P3', 'Shared name', '3:V3'],
  ]);
  assert.deepStrictEqual(result.weekValues, [900, 777, 2000, 3000]);
  assert.deepStrictEqual(result.nameWrites, [{ rowIndex: 1, value: 'New name' }]);
  assert.deepStrictEqual(result.rowWrites, [{ rowIndex: 3, values: ['P3', 'Shared name', '3:V3'] }]);
  assert.deepStrictEqual(result.priceWrites, [
    { rowIndex: 2, value: 2000 },
    { rowIndex: 3, value: 3000 },
  ]);
  assert.strictEqual(result.recordedCount, 3);
  assert.strictEqual(result.missingCount, 0);
});

function cafe24MappingValues(count) {
  return [
    ['product_no', 'product_code', 'product_name', 'custom_variant_code', 'variant_code'],
    ...Array.from({ length: count }, (_, index) => [
      index + 1,
      `CAFE${index + 1}`,
      `Product ${index + 1}`,
      `P${index + 1}`,
      `V${index + 1}`,
    ]),
  ];
}

function envelopeFor(now, matchedCount, options = {}) {
  const generatedAt = new Date(new Date(now).getTime() - (options.ageHours || 0) * 60 * 60 * 1000);
  const envelope = envelopeAtAgeHours(0, matchedCount);
  envelope.generatedAt = generatedAt.toISOString();
  if (options.schemaVersion !== undefined) envelope.schemaVersion = options.schemaVersion;
  return envelope;
}

function createSheetFake(initialValues, mutations, initialMetadata, afterMutation = () => {}) {
  let values = (initialValues || []).map(row => row.slice());
  const metadata = new Map(Object.entries(initialMetadata || {}));
  const hiddenColumns = new Set();
  const padTo = (rowCount, columnCount) => {
    while (values.length < rowCount) values.push([]);
    values.forEach(row => { while (row.length < columnCount) row.push(''); });
  };
  const lastRow = () => {
    for (let row = values.length - 1; row >= 0; row--) {
      if (values[row].some(value => value !== '' && value !== null && value !== undefined)) return row + 1;
    }
    return 0;
  };
  const lastColumn = () => values.reduce((max, row) => {
    for (let column = row.length - 1; column >= 0; column--) {
      if (row[column] !== '' && row[column] !== null && row[column] !== undefined) {
        return Math.max(max, column + 1);
      }
    }
    return max;
  }, 0);
  const metadataRecord = key => ({
    getKey: () => key,
    getValue: () => metadata.get(key),
    setValue: value => {
      metadata.set(key, value);
      mutations.push({ type: 'metadata-set', key, value });
      afterMutation('metadata-set');
      return metadataRecord(key);
    },
    remove: () => {
      metadata.delete(key);
      mutations.push({ type: 'metadata-remove', key });
      afterMutation('metadata-remove');
    },
  });
  const sheet = {
    getDataRange: () => ({ getValues: () => values.map(row => row.slice()) }),
    getLastRow: lastRow,
    getLastColumn: lastColumn,
    getRange: (row, column, rowCount = 1, columnCount = 1) => ({
      getValues: () => {
        const result = [];
        for (let rowOffset = 0; rowOffset < rowCount; rowOffset++) {
          const resultRow = [];
          for (let columnOffset = 0; columnOffset < columnCount; columnOffset++) {
            resultRow.push((values[row - 1 + rowOffset] || [])[column - 1 + columnOffset] ?? '');
          }
          result.push(resultRow);
        }
        return result;
      },
      setValues: nextValues => {
        padTo(row - 1 + rowCount, column - 1 + columnCount);
        nextValues.forEach((nextRow, rowOffset) => {
          nextRow.forEach((value, columnOffset) => {
            values[row - 1 + rowOffset][column - 1 + columnOffset] = value;
          });
        });
        mutations.push({
          type: 'setValues', row, column, rowCount, columnCount,
          values: nextValues.map(nextRow => nextRow.slice()),
        });
        afterMutation('setValues');
      },
    }),
    hideColumns: column => {
      hiddenColumns.add(column);
      mutations.push({ type: 'hideColumns', column });
      afterMutation('hideColumns');
    },
    showColumns: column => {
      hiddenColumns.delete(column);
      mutations.push({ type: 'showColumns', column });
      afterMutation('showColumns');
    },
    isColumnHiddenByUser: column => hiddenColumns.has(column),
    createDeveloperMetadataFinder: () => {
      let selectedKey = '';
      return {
        withKey(key) { selectedKey = key; return this; },
        find: () => metadata.has(selectedKey) ? [metadataRecord(selectedKey)] : [],
      };
    },
    addDeveloperMetadata: (key, value) => {
      metadata.set(key, value);
      mutations.push({ type: 'metadata-add', key, value });
      afterMutation('metadata-add');
      return metadataRecord(key);
    },
    values: () => values.map(row => row.slice()),
    visibleValues: () => {
      const rowCount = lastRow();
      const columnCount = lastColumn();
      return values.slice(0, rowCount).map(row => row.slice(0, columnCount));
    },
    metadata,
  };
  return sheet;
}

function createSnapshotRuntime(options = {}) {
  const mutations = [];
  const logs = [];
  const calls = { fetches: [], lockAttempts: 0, lockReleases: 0, historyReads: 0 };
  const events = [];
  let pendingFailure = null;
  const afterMutation = type => {
    if (!pendingFailure || pendingFailure.type !== type) return;
    pendingFailure.remaining--;
    if (pendingFailure.remaining === 0) {
      pendingFailure = null;
      throw new Error(`Injected ${type} failure after mutation`);
    }
  };
  const clock = { now: new Date(options.now || runAt) };
  const mappingSheet = createSheetFake(options.mappingValues || cafe24MappingValues(1), mutations, null, afterMutation);
  let historySheet = options.historyValues
    ? createSheetFake(options.historyValues, mutations, options.historyMetadata, afterMutation)
    : null;
  const spreadsheet = {
    getSheetByName: name => {
      if (name === '카페24상품') return mappingSheet;
      if (name === '가격이력') {
        calls.historyReads++;
        events.push('history-read');
        return historySheet;
      }
      return null;
    },
    insertSheet: name => {
      assert.strictEqual(name, '가격이력');
      mutations.push({ type: 'insertSheet', name });
      historySheet = createSheetFake([], mutations, null, afterMutation);
      return historySheet;
    },
    deleteSheet: sheet => {
      assert.strictEqual(sheet, historySheet);
      mutations.push({ type: 'deleteSheet', name: '가격이력' });
      historySheet = null;
      afterMutation('deleteSheet');
    },
  };
  const properties = Object.assign({
    WEEKLY_PRICE_SNAPSHOT_URL: 'https://snapshot.example.test/v2',
    WEEKLY_PRICE_SNAPSHOT_SECRET: 'top-secret-bearer',
  }, options.properties || {});
  const responseStatus = options.responseStatus === undefined ? 200 : options.responseStatus;
  const context = {
    console,
    Logger: { log: message => logs.push(String(message)) },
    LockService: { getScriptLock: () => ({
      tryLock: () => { calls.lockAttempts++; return options.lockAcquired !== false; },
      releaseLock: () => { calls.lockReleases++; },
    }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties[key] || null,
    }) },
    UrlFetchApp: { fetch: (url, fetchOptions) => {
      calls.fetches.push({ url, options: fetchOptions });
      const responseEnvelope = typeof options.fetchEnvelope === 'function'
        ? options.fetchEnvelope(new Date(clock.now), calls.fetches.length)
        : (options.fetchEnvelope || envelopeFor(clock.now, options.matchedCount || 1));
      const body = options.responseBody === undefined ? JSON.stringify(responseEnvelope) : options.responseBody;
      return {
        getResponseCode: () => responseStatus,
        getContentText: () => body,
      };
    } },
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  context.weeklySnapshotNow_ = () => new Date(clock.now);
  return {
    context,
    calls,
    logs,
    mutations,
    events,
    mappingSheet,
    getHistorySheet: () => historySheet,
    failNextMutation: (type, occurrence = 1) => {
      pendingFailure = { type, remaining: occurrence };
    },
    setNow: value => { clock.now = new Date(value); },
  };
}

test('fails closed for missing credentials, HTTP errors, malformed JSON, and non-v2 responses', () => {
  const cases = [
    { properties: { WEEKLY_PRICE_SNAPSHOT_URL: '' } },
    { properties: { WEEKLY_PRICE_SNAPSHOT_SECRET: '' } },
    { responseStatus: 401 },
    { responseStatus: 429 },
    { responseStatus: 503 },
    { responseBody: '{not-json' },
    { fetchEnvelope: envelopeFor(runAt, 1, { schemaVersion: 1 }) },
  ];

  for (const testCase of cases) {
    const runtime = createSnapshotRuntime(testCase);
    const result = plain(runtime.context.snapshotWeeklyPrice());
    assert.strictEqual(result.runResult, 'FAILED');
    assert.strictEqual(result.snapshotState, null);
    assert.deepStrictEqual(runtime.mutations, []);
    assert.strictEqual(runtime.calls.lockReleases, 1);
  }
});

test('rejects a plaintext snapshot URL before fetching or exposing the bearer secret', () => {
  const runtime = createSnapshotRuntime({
    properties: { WEEKLY_PRICE_SNAPSHOT_URL: 'http://snapshot.example.test/v2' },
  });

  const result = plain(runtime.context.snapshotWeeklyPrice());

  assert.strictEqual(result.runResult, 'FAILED');
  assert.strictEqual(runtime.calls.fetches.length, 0);
  assert.deepStrictEqual(runtime.mutations, []);
  assert.strictEqual(runtime.logs.join('\n').includes('top-secret-bearer'), false);
});

test('lock acquisition failure returns FAILED before fetching or mutating Sheets', () => {
  const runtime = createSnapshotRuntime({ lockAcquired: false });

  const result = plain(runtime.context.snapshotWeeklyPrice());

  assert.strictEqual(result.runResult, 'FAILED');
  assert.strictEqual(result.weekKey, null);
  assert.strictEqual(runtime.calls.fetches.length, 0);
  assert.deepStrictEqual(runtime.mutations, []);
  assert.strictEqual(runtime.calls.lockReleases, 0);
});

test('stale, below-95-percent, and above-5-percent-missing snapshots do not create price history', () => {
  const cases = [
    { mappingValues: cafe24MappingValues(1), fetchEnvelope: envelopeFor(runAt, 1, { ageHours: 24.0001 }) },
    { mappingValues: cafe24MappingValues(100), fetchEnvelope: envelopeFor(runAt, 94) },
    { mappingValues: cafe24MappingValues(20), fetchEnvelope: envelopeFor(runAt, 18) },
  ];

  for (const testCase of cases) {
    const runtime = createSnapshotRuntime(testCase);
    const result = plain(runtime.context.snapshotWeeklyPrice());
    assert.strictEqual(result.runResult, 'FAILED');
    assert.strictEqual(runtime.getHistorySheet(), null);
    assert.deepStrictEqual(runtime.mutations, []);
  }
});

test('first complete snapshot creates hidden A:C metadata and one batched week column', () => {
  const runtime = createSnapshotRuntime({
    mappingValues: cafe24MappingValues(2),
    fetchEnvelope: envelopeFor(runAt, 2),
  });

  const result = plain(runtime.context.snapshotWeeklyPrice());
  const history = runtime.getHistorySheet();
  const values = history.values();

  assert.deepStrictEqual(result, {
    weekKey: '2026-08-17~08-23(일)',
    runResult: 'CREATED',
    snapshotState: 'CREATED_COMPLETE',
    targetCount: 2,
    recordedCount: 2,
    missingCount: 0,
    generatedAt: '2026-08-24T00:00:00.000Z',
    coveragePct: 100,
  });
  assert.deepStrictEqual(values[0], ['PROD_CD', '웹카탈로그 상품명', '상품키', '2026-08-17~08-23(일)']);
  assert.deepStrictEqual(values.slice(1), [
    ['P1', 'Product 1', '1:V1', 1000],
    ['P2', 'Product 2', '2:V2', 1000],
  ]);
  assert.strictEqual(runtime.mutations.filter(write => write.type === 'hideColumns' && write.column === 3).length, 1);
  assert.strictEqual(runtime.mutations.filter(write => write.type === 'setValues' && write.column === 4).length, 1);
  const metadataValue = [...history.metadata.values()].map(JSON.parse)[0];
  assert.strictEqual(metadataValue.firstWrittenAt, '2026-08-24T00:00:00.000Z');
  assert.strictEqual(metadataValue.state, 'CREATED_COMPLETE');
});

test('matches real single products to productNo:SINGLE while keeping option variants exact', () => {
  const singleEnvelope = envelopeFor(runAt, 0);
  singleEnvelope.groups.catalog.children = [
    { name: 'Single', price: 2200, productNo: 10, variantCode: 'P000SINGLE000A', isSingle: true },
    { name: 'Option A', price: 3300, productNo: 20, variantCode: 'P000OPTION00A' },
  ];
  const runtime = createSnapshotRuntime({
    mappingValues: [
      ['product_no', 'product_code', 'product_name', 'custom_variant_code', 'variant_code'],
      [10, 'CAFE10', 'Single', 'S10', 'P000SINGLE000A'],
      [20, 'CAFE20', 'Option A', 'O20', 'P000OPTION00A'],
      [20, 'CAFE20', 'Wrong option', 'BAD20', 'P000OPTION00B'],
    ],
    fetchEnvelope: singleEnvelope,
  });

  const result = plain(runtime.context.snapshotWeeklyPrice());
  const rows = runtime.getHistorySheet().values().slice(1);

  assert.strictEqual(result.runResult, 'CREATED');
  assert.deepStrictEqual(rows, [
    ['S10', 'Single', '10:SINGLE', 2000],
    ['O20', 'Option A', '20:P000OPTION00A', 3000],
  ]);
  assert.ok(runtime.logs.join('\n').includes('MISSING_VARIANT_IDENTITY'));
});

test('fails the entire run before mutation when a mapping product name normalizes to blank', () => {
  const runtime = createSnapshotRuntime({
    mappingValues: [
      ['product_no', 'product_code', 'product_name', 'custom_variant_code', 'variant_code'],
      [1, 'CAFE1', '<p>MDF&nbsp;&amp; 합판</p>', 'P1', 'V1'],
      [2, 'CAFE2', '<br><div>&nbsp;</div>', 'P2', 'V2'],
    ],
    fetchEnvelope: envelopeFor(runAt, 2),
  });

  const result = plain(runtime.context.snapshotWeeklyPrice());

  assert.strictEqual(result.runResult, 'FAILED');
  assert.strictEqual(result.snapshotState, null);
  assert.strictEqual(runtime.getHistorySheet(), null);
  assert.deepStrictEqual(runtime.mutations, []);
  assert.ok(runtime.logs.join('\n').includes('BLANK_PRODUCT_NAME'));
});

test('fails closed before mutation when existing history contains duplicate nonblank stable keys', () => {
  const runtime = createSnapshotRuntime({
    mappingValues: cafe24MappingValues(1),
    fetchEnvelope: envelopeFor(runAt, 1),
    historyValues: [
      ['PROD_CD', '웹카탈로그 상품명', '상품키', '2026-08-10~08-16(일)'],
      ['P1', 'One', '1:V1', 1000],
      ['P1-copy', 'One copy', '1:V1', 1000],
    ],
  });

  const before = runtime.getHistorySheet().visibleValues();
  const result = plain(runtime.context.snapshotWeeklyPrice());

  assert.strictEqual(result.runResult, 'FAILED');
  assert.deepStrictEqual(runtime.getHistorySheet().visibleValues(), before);
  assert.deepStrictEqual(runtime.mutations, []);
});

test('first snapshot at exactly five percent missing creates a partial week', () => {
  const runtime = createSnapshotRuntime({
    mappingValues: cafe24MappingValues(20),
    fetchEnvelope: envelopeFor(runAt, 19),
  });

  const result = plain(runtime.context.snapshotWeeklyPrice());

  assert.strictEqual(result.runResult, 'CREATED');
  assert.strictEqual(result.snapshotState, 'CREATED_PARTIAL');
  assert.strictEqual(result.targetCount, 20);
  assert.strictEqual(result.recordedCount, 19);
  assert.strictEqual(result.missingCount, 1);
  assert.strictEqual(runtime.getHistorySheet().values()[20][3], '');
});

test('rerunning a complete week skips without changing the sheet', () => {
  const runtime = createSnapshotRuntime({
    mappingValues: cafe24MappingValues(2),
    fetchEnvelope: envelopeFor(runAt, 2),
  });
  runtime.context.snapshotWeeklyPrice();
  const mutationsAfterCreate = runtime.mutations.length;
  const valuesAfterCreate = runtime.getHistorySheet().values();

  const result = plain(runtime.context.snapshotWeeklyPrice());

  assert.strictEqual(result.runResult, 'SKIPPED');
  assert.strictEqual(result.snapshotState, 'CREATED_COMPLETE');
  assert.strictEqual(runtime.mutations.length, mutationsAfterCreate);
  assert.deepStrictEqual(runtime.getHistorySheet().values(), valuesAfterCreate);
});

test('partial rerun through exactly 24 hours supplements only blank current-week cells', () => {
  const firstRunAt = new Date('2026-08-24T00:00:00.000Z');
  const runtime = createSnapshotRuntime({
    now: firstRunAt,
    mappingValues: cafe24MappingValues(40),
    fetchEnvelope: (_now, callNumber) => envelopeFor(
      callNumber === 1 ? firstRunAt : new Date('2026-08-25T00:00:00.000Z'),
      callNumber === 1 ? 38 : 40,
    ),
  });
  runtime.context.snapshotWeeklyPrice();
  const originalWeekValues = runtime.getHistorySheet().values().slice(1).map(row => row[3]);
  const mutationOffset = runtime.mutations.length;
  runtime.setNow('2026-08-25T00:00:00.000Z');

  const result = plain(runtime.context.snapshotWeeklyPrice());
  const supplementMutations = runtime.mutations.slice(mutationOffset);
  const finalWeekValues = runtime.getHistorySheet().values().slice(1).map(row => row[3]);

  assert.strictEqual(result.runResult, 'SUPPLEMENTED');
  assert.strictEqual(result.snapshotState, 'CREATED_COMPLETE');
  assert.deepStrictEqual(finalWeekValues.slice(0, 38), originalWeekValues.slice(0, 38));
  assert.deepStrictEqual(finalWeekValues.slice(38), [1000, 1000]);
  assert.deepStrictEqual(
    plain(supplementMutations.filter(write => write.type === 'setValues')),
    [{ type: 'setValues', row: 40, column: 4, rowCount: 2, columnCount: 1, values: [[1000], [1000]] }],
  );
});

test('partial rerun after 24 hours skips as LOCKED_PARTIAL without touching price cells', () => {
  const firstRunAt = new Date('2026-08-24T00:00:00.000Z');
  const runtime = createSnapshotRuntime({
    now: firstRunAt,
    mappingValues: cafe24MappingValues(20),
    fetchEnvelope: now => envelopeFor(now, 19),
  });
  runtime.context.snapshotWeeklyPrice();
  const weekValues = runtime.getHistorySheet().values().slice(1).map(row => row[3]);
  const mutationOffset = runtime.mutations.length;
  runtime.setNow('2026-08-25T00:00:00.001Z');

  const result = plain(runtime.context.snapshotWeeklyPrice());
  const laterMutations = runtime.mutations.slice(mutationOffset);

  assert.strictEqual(result.runResult, 'SKIPPED');
  assert.strictEqual(result.snapshotState, 'LOCKED_PARTIAL');
  assert.deepStrictEqual(runtime.getHistorySheet().values().slice(1).map(row => row[3]), weekValues);
  assert.strictEqual(laterMutations.some(write => write.type === 'setValues'), false);
  const metadataValue = [...runtime.getHistorySheet().metadata.values()].map(JSON.parse)[0];
  assert.strictEqual(metadataValue.state, 'LOCKED_PARTIAL');

  const mutationOffsetAfterLock = runtime.mutations.length;
  runtime.setNow('2026-08-25T01:00:00.000Z');
  const thirdRun = plain(runtime.context.snapshotWeeklyPrice());

  assert.strictEqual(thirdRun.runResult, 'SKIPPED');
  assert.strictEqual(thirdRun.snapshotState, 'LOCKED_PARTIAL');
  assert.deepStrictEqual(runtime.mutations.slice(mutationOffsetAfterLock), []);
});

test('a new week updates active names and retains ended products and historical prices', () => {
  const weekKey = '2026-08-17~08-23(일)';
  const runtime = createSnapshotRuntime({
    mappingValues: [
      ['product_no', 'product_code', 'product_name', 'custom_variant_code', 'variant_code'],
      [1, 'CAFE1', 'New name', 'P1', 'V1'],
    ],
    fetchEnvelope: envelopeFor(runAt, 1),
    historyValues: [
      ['PROD_CD', '웹카탈로그 상품명', '상품키', '2026-08-10~08-16(일)'],
      ['ENDED', 'Ended product', '9:V9', 900],
      ['P1', 'Old name', '1:V1', 777],
    ],
  });

  const result = plain(runtime.context.snapshotWeeklyPrice());
  const values = runtime.getHistorySheet().values();

  assert.strictEqual(result.weekKey, weekKey);
  assert.deepStrictEqual(values[0], ['PROD_CD', '웹카탈로그 상품명', '상품키', '2026-08-10~08-16(일)', weekKey]);
  assert.deepStrictEqual(values[1], ['ENDED', 'Ended product', '9:V9', 900, '']);
  assert.deepStrictEqual(values[2], ['P1', 'New name', '1:V1', 777, 1000]);
});

test('mapping adapter excludes invalid identities without inventing SINGLE targets and logs reasons', () => {
  const runtime = createSnapshotRuntime({
    mappingValues: [
      ['product_no', 'product_code', 'product_name', 'custom_variant_code', 'variant_code'],
      [1, 'CAFE1', 'Valid', 'P1', 'V1'],
      ['', 'CAFE2', 'No product', 'P2', 'V2'],
      [3, 'CAFE3', 'No custom code', '', 'V3'],
      [4, 'CAFE4', 'No variant', 'P4', ''],
    ],
    fetchEnvelope: envelopeFor(runAt, 1),
  });

  const result = plain(runtime.context.snapshotWeeklyPrice());
  const combinedLogs = runtime.logs.join('\n');

  assert.strictEqual(result.targetCount, 1);
  assert.strictEqual(runtime.getHistorySheet().values().length, 2);
  assert.ok(combinedLogs.includes('MAPPING_ROW_EXCLUDED'));
  assert.ok(combinedLogs.includes('MISSING_PRODUCT_NO'));
  assert.ok(combinedLogs.includes('MISSING_CUSTOM_VARIANT_CODE'));
  assert.ok(combinedLogs.includes('MISSING_VARIANT_IDENTITY'));
  assert.strictEqual(combinedLogs.includes('SINGLE'), false);
});

test('a week-column setValues failure restores an existing history sheet and permits a clean rerun', () => {
  const previousHistory = [
    ['PROD_CD', '웹카탈로그 상품명', '상품키', '2026-08-10~08-16(일)'],
    ['P1', 'Old name', '1:V1', 777],
  ];
  const runtime = createSnapshotRuntime({
    mappingValues: cafe24MappingValues(1),
    fetchEnvelope: envelopeFor(runAt, 1),
    historyValues: previousHistory,
  });
  runtime.failNextMutation('setValues', 2);

  const failed = plain(runtime.context.snapshotWeeklyPrice());

  assert.strictEqual(failed.runResult, 'FAILED');
  assert.deepStrictEqual(runtime.getHistorySheet().visibleValues(), previousHistory);
  assert.strictEqual(runtime.getHistorySheet().metadata.size, 0);

  const retry = plain(runtime.context.snapshotWeeklyPrice());
  assert.strictEqual(retry.runResult, 'CREATED');
  assert.strictEqual(retry.snapshotState, 'CREATED_COMPLETE');
});

test('an addDeveloperMetadata failure removes the orphan week column and permits a clean rerun', () => {
  const previousHistory = [
    ['PROD_CD', '웹카탈로그 상품명', '상품키', '2026-08-10~08-16(일)'],
    ['P1', 'Old name', '1:V1', 777],
  ];
  const runtime = createSnapshotRuntime({
    mappingValues: cafe24MappingValues(1),
    fetchEnvelope: envelopeFor(runAt, 1),
    historyValues: previousHistory,
  });
  runtime.failNextMutation('metadata-add');

  const failed = plain(runtime.context.snapshotWeeklyPrice());

  assert.strictEqual(failed.runResult, 'FAILED');
  assert.deepStrictEqual(runtime.getHistorySheet().visibleValues(), previousHistory);
  assert.strictEqual(runtime.getHistorySheet().metadata.size, 0);

  const retry = plain(runtime.context.snapshotWeeklyPrice());
  assert.strictEqual(retry.runResult, 'CREATED');
  assert.strictEqual(retry.snapshotState, 'CREATED_COMPLETE');
});

test('a hideColumns failure deletes a newly-created history tab and permits a clean rerun', () => {
  const runtime = createSnapshotRuntime({
    mappingValues: cafe24MappingValues(1),
    fetchEnvelope: envelopeFor(runAt, 1),
  });
  runtime.failNextMutation('hideColumns');

  const failed = plain(runtime.context.snapshotWeeklyPrice());

  assert.strictEqual(failed.runResult, 'FAILED');
  assert.strictEqual(runtime.getHistorySheet(), null);

  const retry = plain(runtime.context.snapshotWeeklyPrice());
  assert.strictEqual(retry.runResult, 'CREATED');
  assert.strictEqual(retry.snapshotState, 'CREATED_COMPLETE');
});

test('a supplement setValues failure restores blank targets and permits a clean supplement rerun', () => {
  const weekKey = '2026-08-17~08-23(일)';
  const metadataKey = `WEEKLY_PRICE_SNAPSHOT:${weekKey}`;
  const partialRows = cafe24MappingValues(20).slice(1).map((row, index) => [
    row[3], row[2], `${row[0]}:${row[4]}`, index < 19 ? 1000 : '',
  ]);
  const previousHistory = [
    ['PROD_CD', '웹카탈로그 상품명', '상품키', weekKey],
    ...partialRows,
  ];
  const runtime = createSnapshotRuntime({
    mappingValues: cafe24MappingValues(20),
    fetchEnvelope: envelopeFor(runAt, 20),
    historyValues: previousHistory,
    historyMetadata: {
      [metadataKey]: JSON.stringify({
        firstWrittenAt: '2026-08-24T00:00:00.000Z',
        state: 'CREATED_PARTIAL',
      }),
    },
  });
  runtime.failNextMutation('setValues');

  const failed = plain(runtime.context.snapshotWeeklyPrice());

  assert.strictEqual(failed.runResult, 'FAILED');
  assert.deepStrictEqual(runtime.getHistorySheet().visibleValues(), previousHistory);
  assert.strictEqual(JSON.parse(runtime.getHistorySheet().metadata.get(metadataKey)).state, 'CREATED_PARTIAL');

  const retry = plain(runtime.context.snapshotWeeklyPrice());
  assert.strictEqual(retry.runResult, 'SUPPLEMENTED');
  assert.strictEqual(retry.snapshotState, 'CREATED_COMPLETE');
});

test('derives the envelope missing-rate inputs before reading price-history state', () => {
  const runtime = createSnapshotRuntime({
    mappingValues: cafe24MappingValues(20),
    fetchEnvelope: envelopeFor(runAt, 19),
  });
  const realPricesByKey = runtime.context.weeklyPricesByKey_;
  runtime.context.weeklyPricesByKey_ = envelope => {
    runtime.events.push('missing-rate-inputs');
    return realPricesByKey(envelope);
  };

  runtime.context.snapshotWeeklyPrice();

  assert.ok(runtime.events.indexOf('missing-rate-inputs') < runtime.events.indexOf('history-read'));
});

test('logs coded status, counts, and identifiers without leaking the bearer secret', () => {
  const runtime = createSnapshotRuntime({
    mappingValues: cafe24MappingValues(2),
    fetchEnvelope: envelopeFor(runAt, 2),
  });

  runtime.context.snapshotWeeklyPrice();
  const combinedLogs = runtime.logs.join('\n');

  assert.ok(combinedLogs.includes('CREATED'));
  assert.ok(combinedLogs.includes('CREATED_COMPLETE'));
  assert.ok(combinedLogs.includes('2026-08-17~08-23(일)'));
  assert.ok(combinedLogs.includes('targetCount=2'));
  assert.ok(combinedLogs.includes('recordedCount=2'));
  assert.strictEqual(combinedLogs.includes('top-secret-bearer'), false);
  assert.strictEqual(runtime.calls.fetches.length, 1);
  assert.strictEqual(runtime.calls.fetches[0].options.headers.Authorization, 'Bearer top-secret-bearer');
  assert.strictEqual(runtime.calls.fetches[0].options.muteHttpExceptions, true);
  assert.strictEqual(runtime.calls.fetches[0].options.timeoutSeconds, 30);
});
