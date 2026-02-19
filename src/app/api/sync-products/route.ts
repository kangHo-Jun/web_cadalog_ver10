import { NextResponse } from 'next/server';
import { createClient } from 'redis';
import apiClient from '@/lib/api-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CATEGORY_NOS = [325, 326, 327, 328, 329, 330, 331, 332, 333];
const SNAPSHOT_KEY = 'catalog:snapshot:v1';

export async function GET() {
  try {
    const allProducts: any[] = [];

    // apiClient 사용 (자동 토큰 갱신)
    for (const catNo of CATEGORY_NOS) {
      const response = await apiClient.get('/products', {
        params: {
          category: catNo,
          embed: 'variants',
          limit: 100
        }
      });

      if (response.data.products) {
        // 각 상품에 카테고리 번호 추가
        const productsWithCategory = response.data.products.map((product: any) => ({
          ...product,
          _categoryNo: catNo  // 요청 시 사용한 카테고리 번호 저장
        }));
        allProducts.push(...productsWithCategory);
      }
    }

    /**
     * 상품명 정규화 (Normalization)
     */
    const normalizeProductName = (name: string) => {
      if (!name) return '';
      return name
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .split(/[\(x]/)[0]
        .trim()
        .replace(/\s+/g, ' ');
    };

    // 그룹핑
    const grouped: Record<string, any> = {};

    for (const product of allProducts) {
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          const variantCode = variant.variant_code;
          if (variantCode && variantCode.length >= 8) {
            const parentCode = variantCode.substring(0, 8);

            if (!grouped[parentCode]) {
              grouped[parentCode] = {
                categoryNo: product._categoryNo || 0, // 요청 시 사용한 카테고리 번호
                parentName: normalizeProductName(product.product_name),
                children: []
              };
            }

            grouped[parentCode].children.push({
              variantCode: variantCode,
              variantName: variant.variant_name || '',
              price: variant.additional_amount || '0',
              stock: variant.stock_number || 0
            });
          }
        }
      }
    }

    // Redis 저장
    const client = createClient({ url: process.env.KV_REDIS_URL });
    await client.connect();
    await client.set(SNAPSHOT_KEY, JSON.stringify(grouped));
    await client.quit();

    return NextResponse.json({
      success: true,
      products: Object.keys(grouped).length
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
