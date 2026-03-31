import { NextResponse } from 'next/server';
import { createClient } from 'redis';
import apiClient from '@/lib/api-client';
import { normalizeProductName, GroupedProduct, ChildItem } from '@/lib/product-utils';
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

    const groups = Object.values(grouped).sort((a, b) => {
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

    const sortedGrouped = Object.fromEntries(
      groups.map((group) => [group.id, group])
    );

    const client = createClient({ url: process.env.KV_REDIS_URL });
    await client.connect();
    await client.set(SNAPSHOT_KEY, JSON.stringify(sortedGrouped));
    await client.quit();

    return NextResponse.json({
      success: true,
      products: groups.length,
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
