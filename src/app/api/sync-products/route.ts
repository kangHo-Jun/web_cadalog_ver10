import { NextResponse } from 'next/server';
import { createClient } from 'redis';
import apiClient from '@/lib/api-client';
import {
  buildCatalogSnapshot,
  type CatalogSnapshotEnvelope,
} from '@/lib/catalog-snapshot';
import { QUOTE_CATEGORY_NOS } from '@/config/quote-categories';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CATEGORY_NOS = QUOTE_CATEGORY_NOS;
const SNAPSHOT_KEY = 'catalog:snapshot:v1';

async function buildSnapshot(): Promise<{ snapshot: CatalogSnapshotEnvelope; error?: never } | { error: string }> {
  try {
    const allProducts: any[] = [];

    for (const catNo of CATEGORY_NOS) {
      const response = await apiClient.get('/products', {
        params: {
          category: catNo,
          embed: 'options,variants',
          display: 'T',
          limit: 100
        }
      });

      if (response.data.products) {
        const productsWithCategory = response.data.products.map((product: any) => ({
          ...product,
          _categoryNo: catNo
        }));
        allProducts.push(...productsWithCategory);
      }
    }

    return { snapshot: buildCatalogSnapshot(allProducts, new Date()) };
  } catch (err: any) {
    return { error: err.message };
  }
}

async function saveToRedis(snapshot: CatalogSnapshotEnvelope) {
  const client = createClient({ url: process.env.KV_REDIS_URL });
  await client.connect();
  await client.set(SNAPSHOT_KEY, JSON.stringify(snapshot));
  await client.quit();
}

// Vercel Cron 및 직접 GET 호출용
export async function GET() {
  const result = await buildSnapshot();
  if ('error' in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }
  await saveToRedis(result.snapshot);
  return NextResponse.json({
    success: true,
    products: Object.keys(result.snapshot.groups).length,
    generatedAt: result.snapshot.generatedAt,
    schemaVersion: result.snapshot.schemaVersion,
  });
}

// 관리자 페이지 "가격 즉시 동기화" 버튼용
export async function POST() {
  const result = await buildSnapshot();
  if ('error' in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }
  await saveToRedis(result.snapshot);
  return NextResponse.json({
    success: true,
    products: Object.keys(result.snapshot.groups).length,
    generatedAt: result.snapshot.generatedAt,
    schemaVersion: result.snapshot.schemaVersion,
  });
}
