import { NextResponse } from 'next/server';
import apiClient from '@/lib/api-client';
import axios from 'axios';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const response = await apiClient.get('/categories', {
      params: {
        depth: 1,
      },
    });

    return NextResponse.json(response.data, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
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
