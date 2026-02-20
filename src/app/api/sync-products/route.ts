import { NextResponse } from 'next/server';
import { createClient } from 'redis';
import apiClient from '@/lib/api-client';
import { normalizeProductName, GroupedProduct, ChildItem } from '@/lib/product-utils';
import { QUOTE_CATEGORY_NOS } from '@/config/quote-categories';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CATEGORY_NOS = QUOTE_CATEGORY_NOS;
const SNAPSHOT_KEY = 'catalog:snapshot:v1';

export async function GET() {
  try {
    const allProducts: any[] = [];

    for (const catNo of CATEGORY_NOS) {
      const response = await apiClient.get('/products', {
        params: {
          category: catNo,
          embed: 'options,variants', // [수정] options 추가 (option_value 접근에 필수)
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

    // === STEP 3: children 구조 재구성 ===
    const grouped: Record<string, GroupedProduct> = {};

    for (const product of allProducts) {
      const parentCode = product.product_code;
      if (!parentCode) continue;

      // 부모가 이미 등록된 경우 스킵 (중복 방지)
      if (grouped[parentCode]) continue;

      // 1. 부모 상품명: HTML 태그만 제거, 절삭 없음
      const parentName = normalizeProductName(product.product_name);
      const detail_image = product.detail_image || '';

      let children: ChildItem[] = [];

      // 2. 자식 리스트 구성
      if (product.options?.has_option === 'T') {
        // Case A: 옵션 상품 → option_value 기반 children 생성
        const optionsList = product.options?.options;
        const optionValues: any[] = optionsList?.[0]?.option_value || [];
        const variants: any[] = product.variants || [];

        children = optionValues.map((ov: any) => {
          const name = ov.value || ov.option_text || '';

          // variants에서 해당 옵션값과 매핑하여 가격 계산
          const matchedVariant = variants.find((v: any) =>
            v.options?.some((o: any) => o.value === name)
          );

          const additionalAmount = Number(matchedVariant?.additional_amount || 0);
          const basePrice = Number(product.price || 0);
          const price = basePrice + additionalAmount;
          const variantCode = matchedVariant?.variant_code || '';

          return { name, price, variantCode };
        }).filter((child: ChildItem) => child.name); // 빈 값 제거

      } else {
        // Case B: 단일 상품 → 부모 자체를 1개 자식으로 반환
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
        categoryNo: product._categoryNo || 0,
        children
      };
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
