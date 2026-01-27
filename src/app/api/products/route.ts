import { NextResponse } from 'next/server';
import apiClient from '@/lib/api-client';
import axios from 'axios';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword') || '';
  const category = searchParams.get('category') || '';
  const type = searchParams.get('type'); // 'quote' for 견적서 products only

  try {
    // For quote type, fetch hidden products (display='F')
    // For normal type, fetch displayed products (display='T')
    const displayParam = type === 'quote' ? 'F' : 'T';

    const response = await apiClient.get('/products', {
      params: {
        product_name: keyword || undefined,
        category: category || undefined,
        display: displayParam,
        selling: 'T',
        limit: 100,
      },
    });

    let products = response.data.products || [];

    // Filter for quote products if type=quote
    if (type === 'quote') {
      products = products.filter((product: any) =>
        product.category_name?.includes('(견적서)')
      );

      // Add display_category_name with "(견적서)" removed
      products = products.map((product: any) => ({
        ...product,
        display_category_name: product.category_name?.replace('(견적서)', '').trim() || product.category_name
      }));
    }

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
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
    } else {
      console.error('Unexpected API Error:', error.message);
    }
    return NextResponse.json(
      { error: 'Failed to fetch products', details: error.response?.data },
      { status: error.response?.status || 500 }
    );
  }
}
