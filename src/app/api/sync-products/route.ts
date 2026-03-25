import { NextResponse } from 'next/server';
import { createClient } from 'redis';
import apiClient from '@/lib/api-client';
import { normalizeProductName, GroupedProduct, ChildItem } from '@/lib/product-utils';
import { QUOTE_CATEGORY_NOS } from '@/config/quote-categories';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CATEGORY_NOS = QUOTE_CATEGORY_NOS;
const SNAPSHOT_KEY = 'catalog:snapshot:v1';

async function buildSnapshot(): Promise<{ grouped: Record<string, GroupedProduct>; error?: never } | { error: string }> {
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

    const grouped: Record<string, GroupedProduct> = {};

    for (const product of allProducts) {
      const parentCode = product.product_code;
      if (!parentCode) continue;

      if (grouped[parentCode]) {
        const catNo = product._categoryNo || 0;
        if (!grouped[parentCode].categoryNo!.includes(catNo)) {
          grouped[parentCode].categoryNo!.push(catNo);
        }
        continue;
      }

      const parentName = normalizeProductName(product.product_name);
      const detail_image = product.detail_image || '';

      let children: ChildItem[] = [];

      if (product.options?.has_option === 'T') {
        // 옵션 상품 → additional_amount 직접 사용
        const optionsList = product.options?.options;
        const optionValues: any[] = optionsList?.[0]?.option_value || [];
        const variants: any[] = product.variants || [];

        children = optionValues.map((ov: any) => {
          const name = ov.value || ov.option_text || '';
          const matchedVariant = variants.find((v: any) =>
            v.options?.some((o: any) => o.value === name)
          );

          const additionalAmount = Number(matchedVariant?.additional_amount || 0);
          const basePrice = Number(product.price || 0);
          const price = basePrice + additionalAmount;
          const variantCode = matchedVariant?.variant_code || '';

          return { name, price, variantCode };
        }).filter((child: ChildItem) => child.name);

      } else {
        // 단일 상품 → price 직접 사용
        children = [{
          name: parentName,
          price: Number(product.price || 0),
          isSingle: true
        }];
      }

      grouped[parentCode] = {
        id: parentCode,
        parentName,
        detail_image,
        categoryNo: [product._categoryNo || 0],
        children
      };
    }

    return { grouped };
  } catch (err: any) {
    return { error: err.message };
  }
}

async function saveToRedis(grouped: Record<string, GroupedProduct>) {
  const client = createClient({ url: process.env.KV_REDIS_URL });
  await client.connect();
  await client.set(SNAPSHOT_KEY, JSON.stringify(grouped));
  await client.quit();
}

// Vercel Cron 및 직접 GET 호출용
export async function GET() {
  const result = await buildSnapshot();
  if ('error' in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }
  await saveToRedis(result.grouped);
  return NextResponse.json({ success: true, products: Object.keys(result.grouped).length });
}

// 관리자 페이지 "가격 즉시 동기화" 버튼용
export async function POST() {
  const result = await buildSnapshot();
  if ('error' in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }
  await saveToRedis(result.grouped);
  return NextResponse.json({ success: true, products: Object.keys(result.grouped).length });
}
