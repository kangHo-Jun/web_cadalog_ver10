import { NextResponse } from 'next/server';
import apiClient from '@/lib/api-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productNo = searchParams.get('id');

  if (!productNo) {
    return NextResponse.json({ error: 'id 파라미터 필요' }, { status: 400 });
  }

  const response = await apiClient.get(`/products/${productNo}`, {
    params: { embed: 'options,variants,category' }
  });

  return NextResponse.json(response.data);
}
