import { NextResponse } from 'next/server';
import apiClient from '@/lib/api-client';
import axios from 'axios';
import { QUOTE_CATEGORIES } from '@/config/quote-categories';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'quote' for 견적서 categories only

  try {
    // For quote type, return manually registered quote categories
    // (Cafe24 API doesn't support fetching hidden categories)
    if (type === 'quote') {
      return NextResponse.json(
        { categories: QUOTE_CATEGORIES },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    }

    // For normal type, fetch displayed categories from Cafe24 API
    const response = await apiClient.get('/categories', {
      params: {
        depth: 1,
        limit: 100,
      },
    });

    const categories = response.data.categories || [];

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
