#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('redis');

const SNAPSHOT_KEY = 'catalog:snapshot:v1';
const INPUT_PATH = path.join(process.cwd(), 'test', 'phase2_grouped', 'grouped-by-prefix.json');
const OUTPUT_DIR = path.join(process.cwd(), 'test', 'phase3_redis');
const REPORT_PATH = path.join(OUTPUT_DIR, 'report.json');
const READBACK_LOG_PATH = path.join(OUTPUT_DIR, 'readback-log.json');

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const tests = {
    test_1_phase2_group_result_exists: false,
    test_2_redis_connection_success: false,
    test_3_snapshot_key_set_success: false,
    test_4_ttl_not_set: false,
    test_5_readback_equals_source: false,
  };

  const report = {
    generated_at: new Date().toISOString(),
    phase: 'phase3',
    key: SNAPSHOT_KEY,
    input_file: path.relative(process.cwd(), INPUT_PATH),
    redis_url_exists: Boolean(process.env.KV_REDIS_URL),
    tests,
    error: null,
  };

  const readbackLog = {
    generated_at: report.generated_at,
    key: SNAPSHOT_KEY,
    get_performed: false,
    equals_source: false,
    source_size: 0,
    stored_size: 0,
    ttl: null,
    error: null,
  };

  if (!fs.existsSync(INPUT_PATH)) {
    report.error = 'Missing phase2 grouped input file';
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  tests.test_1_phase2_group_result_exists = true;

  const sourceText = fs.readFileSync(INPUT_PATH, 'utf8');
  readbackLog.source_size = sourceText.length;

  if (!process.env.KV_REDIS_URL) {
    report.error = 'Missing KV_REDIS_URL';
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(READBACK_LOG_PATH, JSON.stringify(readbackLog, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const client = createClient({ url: process.env.KV_REDIS_URL });
  client.on('error', () => {});

  try {
    await client.connect();
    tests.test_2_redis_connection_success = true;

    await client.set(SNAPSHOT_KEY, sourceText);
    tests.test_3_snapshot_key_set_success = true;

    const ttl = await client.ttl(SNAPSHOT_KEY);
    tests.test_4_ttl_not_set = ttl === -1;
    report.ttl = ttl;
    readbackLog.ttl = ttl;

    const stored = await client.get(SNAPSHOT_KEY);
    readbackLog.get_performed = true;
    tests.test_5_readback_equals_source = stored === sourceText;
    report.readback_size = stored ? stored.length : 0;
    readbackLog.stored_size = stored ? stored.length : 0;
    readbackLog.equals_source = stored === sourceText;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    readbackLog.error = report.error;
  } finally {
    try {
      await client.quit();
    } catch {}
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(READBACK_LOG_PATH, JSON.stringify(readbackLog, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main();
