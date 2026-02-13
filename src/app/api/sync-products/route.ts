import { NextResponse } from 'next/server';
import { createClient } from 'redis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CATEGORY_NOS = [325, 326, 327, 328, 329, 330, 331, 332, 333];
const SNAPSHOT_KEY = 'catalog:snapshot:v1';
const LIMIT = 100;
const API_VERSION = '2025-12-01';

type Product = {
  product_no?: number;
  product_code?: string;
  variants?: Array<Record<string, unknown>>;
};

async function fetchCategoryProducts(
  mallId: string,
  accessToken: string,
  categoryNo: number
): Promise<Product[]> {
  let offset = 0;
  const all: Product[] = [];

  while (true) {
    const url = new URL(`https://${mallId}.cafe24api.com/api/v2/admin/products`);
    url.searchParams.set('category', String(categoryNo));
    url.searchParams.set('limit', String(LIMIT));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('embed', 'variants');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Cafe24-Api-Version': API_VERSION,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`category=${categoryNo} status=${response.status} body=${errorBody}`);
    }

    const payload = await response.json();
    const products: Product[] = Array.isArray(payload?.products) ? payload.products : [];
    all.push(...products);

    if (products.length < LIMIT) break;
    offset += products.length;
  }

  return all;
}

function groupByVariantPrefix(products: Product[]) {
  const grouped: Record<string, Array<Record<string, unknown>>> = {};

  products.forEach((product) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    variants.forEach((variant) => {
      const variantCode = typeof variant?.variant_code === 'string' ? variant.variant_code : '';
      if (!variantCode || variantCode.length < 8) return;

      const prefix = variantCode.slice(0, 8);
      if (!grouped[prefix]) grouped[prefix] = [];
      grouped[prefix].push(variant);
    });
  });

  return grouped;
}

export async function POST() {
  const mallId = process.env.MALL_ID || '';
  const accessToken = process.env.CAFE24_ACCESS_TOKEN || '';
  const redisUrl = process.env.KV_REDIS_URL || '';

  if (!mallId || !accessToken || !redisUrl) {
    return NextResponse.json(
      { success: false, error: 'Missing required environment variables' },
      { status: 500 }
    );
  }

  const redis = createClient({ url: redisUrl });

  try {
    const phase1Products: Product[] = [];
    for (const categoryNo of CATEGORY_NOS) {
      const products = await fetchCategoryProducts(mallId, accessToken, categoryNo);
      phase1Products.push(...products);
    }

    const grouped = groupByVariantPrefix(phase1Products);

    await redis.connect();
    await redis.set(SNAPSHOT_KEY, JSON.stringify(grouped));

    return NextResponse.json({
      success: true,
      products: Object.keys(grouped).length
    });
  } catch (error) {
    console.error('sync-products failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    try {
      await redis.quit();
    } catch {
      // no-op
    }
  }
}
