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
