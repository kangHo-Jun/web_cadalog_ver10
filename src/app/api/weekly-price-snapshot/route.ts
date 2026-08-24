import type { CatalogSnapshotEnvelope } from '@/lib/catalog-snapshot';
import { redisGet } from '@/lib/redis-client';

export const dynamic = 'force-dynamic';

const SNAPSHOT_KEY = 'catalog:snapshot:v1';
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidGeneratedAt(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function isValidChild(value: unknown): boolean {
  if (!isRecord(value)) return false;

  const isSingle = value.isSingle === true;
  const hasVariantCode = typeof value.variantCode === 'string' && value.variantCode.length > 0;

  return typeof value.name === 'string'
    && typeof value.price === 'number'
    && Number.isFinite(value.price)
    && value.price > 0
    && typeof value.productNo === 'number'
    && Number.isFinite(value.productNo)
    && value.productNo > 0
    && (isSingle || hasVariantCode)
    && (value.customVariantCode === undefined || typeof value.customVariantCode === 'string');
}

function isValidGroup(groupId: string, value: unknown): boolean {
  if (!isRecord(value)) return false;

  return value.id === groupId
    && typeof value.parentName === 'string'
    && (value.detail_image === undefined || typeof value.detail_image === 'string')
    && (value.categoryNo === undefined
      || (Array.isArray(value.categoryNo)
        && value.categoryNo.every((categoryNo) => typeof categoryNo === 'number')))
    && Array.isArray(value.children)
    && value.children.every(isValidChild);
}

function isCatalogSnapshotEnvelope(value: unknown): value is CatalogSnapshotEnvelope {
  if (!isRecord(value)
    || value.schemaVersion !== 2
    || !isValidGeneratedAt(value.generatedAt)
    || !isRecord(value.groups)) {
    return false;
  }

  return Object.entries(value.groups).every(([groupId, group]) => isValidGroup(groupId, group));
}

function unavailableResponse() {
  return Response.json(
    { error: 'snapshot_unavailable' },
    { status: 503, headers: NO_STORE_HEADERS },
  );
}

export async function GET(request: Request) {
  const expected = process.env.WEEKLY_PRICE_SNAPSHOT_SECRET;
  const supplied = request.headers.get('authorization');

  if (!expected) {
    return Response.json(
      { error: 'not_configured' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  if (supplied !== `Bearer ${expected}`) {
    return Response.json(
      { error: 'unauthorized' },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const snapshot = await redisGet<unknown>(SNAPSHOT_KEY);
    if (!isCatalogSnapshotEnvelope(snapshot)) return unavailableResponse();

    return Response.json(snapshot, { headers: NO_STORE_HEADERS });
  } catch {
    return unavailableResponse();
  }
}
