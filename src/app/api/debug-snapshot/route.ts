import { NextResponse } from 'next/server';
import {
  getCatalogGroups,
  type CatalogSnapshotEnvelope,
} from '@/lib/catalog-snapshot';
import type { GroupedProduct } from '@/lib/product-utils';
import { redisGet } from '@/lib/redis-client';

type CatalogSnapshot = CatalogSnapshotEnvelope | Record<string, GroupedProduct>;

function isEnvelope(snapshot: CatalogSnapshot): snapshot is CatalogSnapshotEnvelope {
  const candidate = snapshot as Partial<CatalogSnapshotEnvelope>;
  return candidate.schemaVersion === 2
    && typeof candidate.generatedAt === 'string'
    && typeof candidate.groups === 'object'
    && candidate.groups !== null;
}

export async function GET() {
  const start = Date.now();
  try {
    const snapshot = await redisGet<CatalogSnapshot>('catalog:snapshot:v1') || {};
    const groups = getCatalogGroups(snapshot);
    const metadata = isEnvelope(snapshot)
      ? { generatedAt: snapshot.generatedAt, schemaVersion: snapshot.schemaVersion }
      : {};

    return NextResponse.json({
      status: 'OK',
      responseTime: Date.now() - start + 'ms',
      snapshotSize: Object.keys(groups).length,
      ...metadata,
      lastSnapshot: groups
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'ERROR',
      error: error.message
    }, { status: 500 });
  }
}
