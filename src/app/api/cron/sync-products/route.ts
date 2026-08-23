import { NextResponse } from 'next/server';
import { createClient } from 'redis';
import apiClient from '@/lib/api-client';
import { buildCatalogSnapshot } from '@/lib/catalog-snapshot';
import { QUOTE_CATEGORIES, QUOTE_CATEGORY_NOS } from '@/config/quote-categories';

const CATEGORY_NOS = QUOTE_CATEGORY_NOS;
const SNAPSHOT_KEY = 'catalog:snapshot:v1';
const CATEGORY_ORDER = QUOTE_CATEGORIES.map((c) => c.category_no);

function getCategorySortIndex(categoryNos: number[] = []) {
  const matchedIndexes = categoryNos
    .map((no) => CATEGORY_ORDER.indexOf(no))
    .filter((index) => index >= 0);

  return matchedIndexes.length > 0 ? Math.min(...matchedIndexes) : Number.MAX_SAFE_INTEGER;
}

export async function GET() {
  try {
    const allProducts: any[] = [];

    for (const catNo of CATEGORY_NOS) {
      const response = await apiClient.get('/products', {
        params: {
          category: catNo,
          embed: 'options,variants',
          display: 'T', // [수정] 진열중인 상품만 조회 (T=진열함, F=진열 안 함)
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

    const snapshot = buildCatalogSnapshot(allProducts, new Date());
    const groups = Object.values(snapshot.groups).sort((a, b) => {
      const aIdx = getCategorySortIndex(a.categoryNo);
      const bIdx = getCategorySortIndex(b.categoryNo);
      if (aIdx !== bIdx) return aIdx - bIdx;

      const aName = a.parentName || '';
      const bName = b.parentName || '';
      const aIsEng = /^[A-Za-z]/.test(aName);
      const bIsEng = /^[A-Za-z]/.test(bName);
      if (aIsEng !== bIsEng) return aIsEng ? -1 : 1;

      return aName.localeCompare(bName, aIsEng ? 'en' : 'ko');
    });

    snapshot.groups = Object.fromEntries(
      groups.map((group) => [group.id, group])
    );

    const client = createClient({ url: process.env.KV_REDIS_URL });
    await client.connect();
    await client.set(SNAPSHOT_KEY, JSON.stringify(snapshot));
    await client.quit();

    return NextResponse.json({
      success: true,
      products: groups.length,
      generatedAt: snapshot.generatedAt,
      schemaVersion: snapshot.schemaVersion,
      debug: 'cron-sync-v2'
    });

  } catch (error: any) {
    // Surface upstream error details (e.g., Cafe24) for debugging
    const upstreamStatus = error?.response?.status ?? null;
    const upstreamData = error?.response?.data ?? null;
    console.error('[cron/sync-products] upstream error', {
      status: upstreamStatus,
      data: upstreamData
    });
    return NextResponse.json({
      success: false,
      error: error.message,
      upstreamStatus,
      upstreamData,
      debug: 'cron-sync-v2'
    }, { status: 500 });
  }
}
