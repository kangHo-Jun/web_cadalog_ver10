import { NextResponse } from 'next/server';
import apiClient from '@/lib/api-client';
import axios from 'axios';
import { QUOTE_CATEGORIES, QUOTE_CATEGORY_NOS } from '@/config/quote-categories';
import { getPriceMap } from '@/lib/price-map';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword') || '';
  const category = searchParams.get('category') || '';
  const type = searchParams.get('type'); // 'quote' for 견적서 products only

  try {
    let priceMap: Record<string, number> | null = null;
    try {
      priceMap = await getPriceMap();
    } catch (priceError: any) {
      console.error('Failed to load price map:', priceError?.message || priceError);
    }

    const applySheetPrice = (product: any) => {
      if (!priceMap) return product;

      const variants = Array.isArray(product.variants) ? product.variants : [];
      const enrichedVariants = variants.map((variant: any) => {
        const code = String(variant?.custom_variant_code || '').trim();
        const sheetPrice = code ? priceMap[code] : undefined;
        return {
          ...variant,
          sheet_price: sheetPrice !== undefined ? String(sheetPrice) : '',
        };
      });

      const firstVariantPrice = enrichedVariants[0]?.sheet_price || '';

      return {
        ...product,
        variants: enrichedVariants,
        price: firstVariantPrice,
      };
    };

    // For quote or price type, fetch products from registered quote categories
    if (type === 'quote' || type === 'price') {
      const categoryNos = category ? [Number(category)] : QUOTE_CATEGORY_NOS;

      // Fetch products from each quote category
      const productPromises = categoryNos.map(catNo =>
        apiClient.get('/products', {
          params: {
            product_name: keyword || undefined,
            category: catNo,
            selling: 'T',
            limit: 100,
            embed: 'variants',
          },
          timeout: 10000, // 10 second timeout
        }).catch((err) => {
          console.error(`Failed to fetch products for category ${catNo}:`, err.message);
          return { data: { products: [] } };
        })
      );

      const responses = await Promise.all(productPromises);
      let products: any[] = [];

      responses.forEach((response, index) => {
        const catNo = categoryNos[index];
        const quoteCat = QUOTE_CATEGORIES.find(c => c.category_no === catNo);
        const categoryProducts = (response.data.products || []).map((product: any) => {
          const priced = applySheetPrice(product);
          return {
            ...priced,
            category_name: quoteCat?.category_name || product.category_name,
            display_category_name: quoteCat?.display_name || product.category_name,
          };
        });
        products = [...products, ...categoryProducts];
      });

      // Remove duplicates by product_no
      const uniqueProducts = products.filter(
        (product, index, self) =>
          index === self.findIndex(p => p.product_no === product.product_no)
      );

      return NextResponse.json(
        { products: uniqueProducts },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    }

    // For normal type, fetch displayed products
    const response = await apiClient.get('/products', {
      params: {
        product_name: keyword || undefined,
        category: category || undefined,
        selling: 'T',
        limit: 100,
        embed: 'variants',
      },
    });

    const products = (response.data.products || []).map((product: any) => applySheetPrice(product));

    return NextResponse.json(
      { ...response.data, products },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error('Cafe24 API Client Error:', {
        code: error.code,
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        baseURL: error.config?.baseURL,
        url: error.config?.url,
        params: error.config?.params,
      });
    } else {
      console.error('Unexpected API Error:', error?.message || error);
    }
    return NextResponse.json(
      {
        error: 'Failed to fetch products',
        details: axios.isAxiosError(error) ? error.response?.data : error?.message,
      },
      { status: axios.isAxiosError(error) ? error.response?.status || 500 : 500 }
    );
  }
}
