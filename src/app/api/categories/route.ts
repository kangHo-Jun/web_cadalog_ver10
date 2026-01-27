import { NextResponse } from 'next/server';
import apiClient from '@/lib/api-client';
import axios from 'axios';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'quote' for 견적서 categories only

  try {
    // For quote type, fetch hidden categories (display='F')
    // For normal type, fetch displayed categories (display='T')
    const displayParam = type === 'quote' ? 'F' : 'T';

    const response = await apiClient.get('/categories', {
      params: {
        depth: 1,
        limit: 100,
        display: displayParam,
      },
    });

    let categories = response.data.categories || [];

    // Filter for quote categories if type=quote
    if (type === 'quote') {
      categories = categories.filter((category: any) =>
        category.category_name?.includes('(견적서)')
      );

      // Add display_name with "(견적서)" removed
      categories = categories.map((category: any) => ({
        ...category,
        display_name: category.category_name.replace('(견적서)', '').trim()
      }));
    }

    return NextResponse.json(
      { ...response.data, categories },
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
      console.error('Cafe24 Categories API Error:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
    } else {
      console.error('Unexpected API Error:', error.message);
    }
    return NextResponse.json(
      { error: 'Failed to fetch categories', details: error.response?.data },
      { status: error.response?.status || 500 }
    );
  }
}
