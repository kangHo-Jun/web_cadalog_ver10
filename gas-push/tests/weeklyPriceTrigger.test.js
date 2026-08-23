const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const code = fs.readFileSync(path.join(__dirname, '..', 'Code.js'), 'utf8');

function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}\n${error.stack}`); process.exitCode = 1; }
}

function loadContext(handlerNames) {
  const calls = [];
  const deleted = [];
  const triggers = handlerNames.map(handlerName => ({
    getHandlerFunction: () => handlerName,
  }));
  const builder = {};
  for (const method of ['timeBased', 'onWeekDay', 'atHour', 'nearMinute', 'everyWeeks', 'inTimezone', 'create']) {
    builder[method] = (...args) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  const ScriptApp = {
    WeekDay: { MONDAY: 'MONDAY' },
    getProjectTriggers: () => triggers,
    deleteTrigger: trigger => deleted.push(trigger.getHandlerFunction()),
    newTrigger: handlerName => {
      calls.push(['newTrigger', handlerName]);
      return builder;
    },
  };
  const context = { console, ScriptApp };
  vm.createContext(context);
  vm.runInContext(code, context);
  return { context, calls, deleted };
}

test('creates the weekly trigger with the exact approved KST schedule', () => {
  const { context, calls, deleted } = loadContext([]);

  const result = context.installWeeklyPriceTrigger();

  assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), { created: true });
  assert.deepStrictEqual(calls, [
    ['newTrigger', 'snapshotWeeklyPrice'],
    ['timeBased'],
    ['onWeekDay', 'MONDAY'],
    ['atHour', 0],
    ['nearMinute', 10],
    ['everyWeeks', 1],
    ['inTimezone', 'Asia/Seoul'],
    ['create'],
  ]);
  assert.deepStrictEqual(deleted, []);
});

test('refuses a duplicate exact-handler trigger and preserves every existing trigger', () => {
  const { context, calls, deleted } = loadContext([
    'snapshotWeeklyPricePreview',
    'snapshotWeeklyPrice',
    'syncPrices',
  ]);

  const matches = context.inspectWeeklyPriceTriggers_();
  const result = context.installWeeklyPriceTrigger();

  assert.strictEqual(matches.length, 1);
  assert.strictEqual(matches[0].getHandlerFunction(), 'snapshotWeeklyPrice');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), {
    created: false,
    reason: 'ALREADY_EXISTS',
  });
  assert.deepStrictEqual(calls, []);
  assert.deepStrictEqual(deleted, []);
});
