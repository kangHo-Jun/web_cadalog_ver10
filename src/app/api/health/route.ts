import { NextResponse } from 'next/server';
import apiClient from '@/lib/api-client';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const response = await apiClient.get('/products', {
            params: { limit: 1, selling: 'T' },
            timeout: 8000,
        });

        const count = response.data?.products?.length ?? 0;

        return NextResponse.json({
            status: 'ok',
            cafe24: 'connected',
            sample_count: count,
        });
    } catch (error: any) {
        const status = error.response?.status || 500;
        const message = error.response?.data?.message || error.message;

        return NextResponse.json(
            { status: 'error', cafe24: 'disconnected', message },
            { status }
        );
    }
}
