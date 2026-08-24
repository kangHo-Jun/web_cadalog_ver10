import { pathToFileURL } from 'node:url';

import { createClient as redisCreateClient } from 'redis';

const SNAPSHOT_KEY = 'catalog:snapshot:v1';

function validateEnvelope(value) {
  const generatedAt = new Date(value?.generatedAt);
  if (!value || value.schemaVersion !== 2 || typeof value.generatedAt !== 'string'
    || Number.isNaN(generatedAt.getTime()) || generatedAt.toISOString() !== value.generatedAt
    || !value.groups || typeof value.groups !== 'object' || Array.isArray(value.groups)) {
    throw new Error('Source value is not a valid v2 envelope.');
  }

  const stableKeys = new Set();
  for (const [groupId, group] of Object.entries(value.groups)) {
    if (!group || group.id !== groupId || typeof group.parentName !== 'string'
      || (group.detail_image !== undefined && typeof group.detail_image !== 'string')
      || (group.categoryNo !== undefined && (!Array.isArray(group.categoryNo)
        || !group.categoryNo.every(item => typeof item === 'number')))
      || !Array.isArray(group.children)) {
      throw new Error('Source value is not a valid v2 envelope.');
    }
    for (const child of group.children) {
      const productNo = child?.productNo;
      const suffix = child?.isSingle === true ? 'SINGLE' : child?.variantCode;
      const stableKey = `${productNo}:${suffix}`;
      if (!child || typeof child.name !== 'string'
        || !Number.isFinite(productNo) || productNo <= 0 || typeof suffix !== 'string' || !suffix
        || !Number.isFinite(child?.price) || child.price <= 0 || stableKeys.has(stableKey)) {
        throw new Error('Source value is not a valid v2 envelope.');
      }
      if (child.customVariantCode !== undefined && typeof child.customVariantCode !== 'string') {
        throw new Error('Source value is not a valid v2 envelope.');
      }
      stableKeys.add(stableKey);
    }
  }
  return stableKeys.size;
}

async function withClient(url, createClient, action) {
  const client = createClient({
    url,
    socket: { reconnectStrategy: false, connectTimeout: 10000 },
  });
  client.on('error', () => {});
  try {
    await client.connect();
    return await action(client);
  } finally {
    if (client.isOpen) client.destroy();
  }
}

export async function copyWeeklySnapshot({
  sourceUrl,
  targetUrl,
  createClient = redisCreateClient,
  allowOverwrite = false,
}) {
  if (!sourceUrl || !targetUrl) throw new Error('Both Redis URLs are required.');
  if (sourceUrl === targetUrl) throw new Error('Source and target Redis URLs must be different.');

  const raw = await withClient(sourceUrl, createClient, client => client.get(SNAPSHOT_KEY));
  if (raw == null) throw new Error(`Source key ${SNAPSHOT_KEY} does not exist.`);

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new Error('Source value is not a valid v2 envelope.');
  }
  const stableKeyCount = validateEnvelope(envelope);

  await withClient(targetUrl, createClient, async client => {
    const result = allowOverwrite
      ? await client.set(SNAPSHOT_KEY, raw)
      : await client.set(SNAPSHOT_KEY, raw, { NX: true });
    if (result !== 'OK') throw new Error(`Target key ${SNAPSHOT_KEY} already exists.`);
  });

  return { key: SNAPSHOT_KEY, generatedAt: envelope.generatedAt, stableKeyCount };
}

async function main() {
  const result = await copyWeeklySnapshot({
    sourceUrl: process.env.SOURCE_KV_REDIS_URL,
    targetUrl: process.env.TARGET_KV_REDIS_URL,
    allowOverwrite: process.env.ALLOW_TARGET_OVERWRITE === '1',
  });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`Snapshot copy failed: ${error.message}`);
    process.exitCode = 1;
  });
}
