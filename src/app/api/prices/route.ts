import { NextResponse } from 'next/server';
import { getPriceMap } from '@/lib/price-map';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const prices = await getPriceMap();
        return NextResponse.json(prices, {
            headers: {
                'Cache-Control': 'no-store, max-age=0, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
    } catch (error: any) {
        console.error('Failed to fetch prices map:', error?.message || error);
        return NextResponse.json(
            { error: 'Failed to fetch prices', details: error?.message || 'Unknown error' },
            { status: 500 }
        );
    }
}
